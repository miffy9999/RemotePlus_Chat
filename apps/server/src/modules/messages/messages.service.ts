import { Injectable, UnauthorizedException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma, type Message } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import type { RealtimeIdentity } from "../realtime/realtime.types";
import { assertSessionWritable, validateMessageInput } from "./message-policy";

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

    if (session.expiresAt.getTime() <= Date.now() && ["WAITING", "ACTIVE"].includes(session.status)) {
      const expired = await this.prisma.chatSession.update({ where: { id: session.id }, data: { status: "EXPIRED", closedAt: new Date(), closeReason: "TIME_LIMIT" } });
      this.events.emit("chat.session.closed", expired);
    }
    assertSessionWritable(session.expiresAt.getTime() <= Date.now() ? "EXPIRED" : session.status, session.expiresAt);
    this.assertSender(identity, session.id, session.agentId);

    const senderType = identity.kind === "guest" ? "GUEST" : "AGENT";
    const senderId = identity.kind === "staff" ? identity.staff.sub : null;
    try {
      // 메시지 저장과 상담 최근 활동 갱신을 한 트랜잭션으로 묶어 목록 정렬값이 실제 대화와 어긋나지 않게 합니다.
      // 매 5초 전체 메시지 MAX 집계를 피하고 메시지당 인덱스 컬럼 1회 갱신만 수행해 무료 PostgreSQL 부하를 일정하게 유지합니다.
      const message = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.message.create({ data: { sessionId: session.id, senderType, senderId, clientMessageId: input.clientMessageId, messageType: "TEXT", content: input.content } });
        await transaction.chatSession.update({ where: { id: session.id }, data: { lastActivityAt: created.createdAt } });
        return created;
      });
      return { message, duplicate: false };
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
