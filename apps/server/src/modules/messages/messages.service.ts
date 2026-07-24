import { Injectable, UnauthorizedException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, type Message } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { RealtimeIdentity } from "../realtime/realtime.types";
import { assertSessionWritable, validateMessageInput } from "./message-policy";
import {
  PUBLIC_AGENT_SELECT,
  toPublicSession,
} from "../chat-sessions/session-view";
import { SESSION_DURATION_MS } from "../chat-sessions/session-policy";

/** 메시지 권한 검사, 멱등 저장과 순서 보존을 담당하는 단일 서비스입니다. */
@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  /**
   * 메시지를 저장하기 직전에 상담 상태와 발신자 권한을 다시 확인합니다.
   * 연결 당시 인증만 믿지 않으므로 상담 종료와 메시지 전송이 동시에 일어나도 잘못된 쓰기를 줄입니다.
   */
  async save(identity: RealtimeIdentity, rawInput: unknown): Promise<{ message: Message; duplicate: boolean }> {
    const input = validateMessageInput((rawInput ?? {}) as Record<string, unknown>);
    const session = await this.prisma.chatSession.findUnique({ where: { id: input.sessionId } });
    if (!session) throw new UnauthorizedException("상담 세션을 찾을 수 없습니다.");

    const isExpired =
      session.status === "ACTIVE" &&
      session.expiresAt !== null &&
      session.expiresAt.getTime() <= Date.now();
    if (isExpired) {
      const expiredSession = await this.prisma.chatSession.update({
        where: { id: session.id },
        data: {
          status: "EXPIRED",
          closedAt: new Date(),
          closeReason: "TIME_LIMIT",
        },
        include: {
          room: { include: { hotel: true } },
          agent: { select: PUBLIC_AGENT_SELECT },
        },
      });
      // 만료를 촉발한 마지막 메시지 요청에서도 전체 화면 형식을 유지하고 인증 내부값이 Socket.IO로 새지 않게 합니다.
      this.events.emit(
        "chat.session.closed",
        toPublicSession(expiredSession),
      );
    }
    const effectiveStatus = isExpired ? "EXPIRED" : session.status;
    this.assertSender(identity, session.id, session.agentId);

    const senderType = identity.kind === "guest" ? "GUEST" : "AGENT";
    const senderId = identity.kind === "staff" ? identity.staff.sub : null;
    const shouldStartTimer =
      identity.kind === "staff" &&
      effectiveStatus === "ACTIVE" &&
      session.expiresAt === null;
    // 첫 Agent 답변이 아닌 요청은 트랜잭션 전에 빠르게 거절하고, 첫 답변만 아래 트랜잭션에서 타이머와 함께 검사합니다.
    if (!shouldStartTimer) {
      assertSessionWritable(
        effectiveStatus,
        session.expiresAt,
        identity.kind,
      );
    }
    try {
      // 메시지 저장과 상담 최근 활동 갱신을 한 트랜잭션으로 묶어 목록 정렬값이 실제 대화와 어긋나지 않게 합니다.
      // 매 5초 전체 메시지 MAX 집계를 피하고 메시지당 인덱스 컬럼 1회 갱신만 수행해 무료 PostgreSQL 부하를 일정하게 유지합니다.
      const saved = await this.prisma.$transaction(async (transaction) => {
        let writableStatus = effectiveStatus;
        let writableExpiresAt = session.expiresAt;
        let timerStartedAt: Date | null = null;

        if (shouldStartTimer && identity.kind === "staff") {
          const startedAt = new Date();
          const expiresAt = new Date(
            startedAt.getTime() + SESSION_DURATION_MS,
          );
          // 같은 Agent가 첫 답변을 빠르게 두 번 보내도 expiresAt=null 조건을 만족한 한 요청만 타이머를 시작합니다.
          const timerUpdate = await transaction.chatSession.updateMany({
            where: {
              id: session.id,
              status: "ACTIVE",
              agentId: identity.staff.sub,
              expiresAt: null,
            },
            data: { startedAt, expiresAt },
          });
          if (timerUpdate.count === 1) {
            writableExpiresAt = expiresAt;
            timerStartedAt = startedAt;
          } else {
            // 다른 첫 메시지 요청이 먼저 타이머를 만들었다면 그 값을 다시 읽어 동일한 15분 구간을 공유합니다.
            const latest = await transaction.chatSession.findUnique({
              where: { id: session.id },
              select: { status: true, agentId: true, expiresAt: true },
            });
            if (!latest) {
              throw new UnauthorizedException(
                "상담 세션을 찾을 수 없습니다.",
              );
            }
            this.assertSender(identity, session.id, latest.agentId);
            writableStatus = latest.status;
            writableExpiresAt = latest.expiresAt;
          }
          assertSessionWritable(
            writableStatus,
            writableExpiresAt,
            identity.kind,
          );
        }

        const created = await transaction.message.create({ data: { sessionId: session.id, senderType, senderId, clientMessageId: input.clientMessageId, messageType: "TEXT", content: input.content } });
        await transaction.chatSession.update({ where: { id: session.id }, data: { lastActivityAt: created.createdAt } });
        return { message: created, timerStartedAt };
      });
      if (saved.timerStartedAt !== null) {
        const startedSession = await this.prisma.chatSession.findUnique({
          where: { id: session.id },
          include: {
            room: { include: { hotel: true } },
            agent: { select: PUBLIC_AGENT_SELECT },
          },
        });
        // Agent·Guest 화면이 첫 답변 직후 같은 서버 만료시각으로 타이머를 시작하도록 공개 상담 이벤트를 보냅니다.
        if (startedSession) {
          this.events.emit(
            "chat.session.updated",
            toPublicSession(startedSession),
          );
        }
      }
      // 새 WAITING 문의와 이후 Guest 메시지를 Agent 목록에 즉시 반영하되 메시지 본문은 이벤트에 싣지 않습니다.
      if (identity.kind === "guest") this.events.emit("chat.inbox.updated", { sessionId: session.id, reason: "GUEST_MESSAGE" });
      return { message: saved.message, duplicate: false };
    } catch (error) {
      // 네트워크 재전송으로 고유 제약이 충돌하면 기존 메시지를 반환해 같은 요청을 안전하게 반복할 수 있게 합니다.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.message.findUnique({ where: { sessionId_clientMessageId: { sessionId: session.id, clientMessageId: input.clientMessageId } } });
        if (existing) return { message: existing, duplicate: true };
      }
      throw error;
    }
  }

  private assertSender(identity: RealtimeIdentity, sessionId: string, agentId: string | null): void {
    if (identity.kind === "guest" && identity.sessionId === sessionId) return;
    if (identity.kind === "staff" && identity.staff.role === "AGENT" && identity.staff.sub === agentId) return;
    throw new UnauthorizedException("이 상담에 메시지를 보낼 권한이 없습니다.");
  }
}
