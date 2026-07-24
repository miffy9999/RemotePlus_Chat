import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { createOpaqueToken, sha256 } from "../../common/security/hash";
import type { GuestAccessPayload, StaffTokenPayload } from "../auth/auth.types";
import { assertCanOpen, assertCanClose, canStaffReadSession, isSessionExpired } from "./session-policy";
import { Prisma, type ChatSessionStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { SessionListScope } from "./dto/list-sessions.dto";
import { PUBLIC_AGENT_SELECT, toPublicSession } from "./session-view";

const CHAT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const RETENTION_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** 상담 생성부터 조회·수락·종료까지 상태 전환을 트랜잭션 단위로 관리합니다. */
@Injectable()
export class ChatSessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatSessionsService.name);
  private expirationTimer?: NodeJS.Timeout;
  private retentionTimer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  /** 서버 시작 즉시 누락 만료와 오래된 기록을 정리하고, 각각 필요한 최소 주기로만 반복합니다. */
  onModuleInit(): void {
    void this.expireDueSessions();
    void this.deleteExpiredHistory().catch((reason) => this.logger.error(JSON.stringify({ event: "retention.failed", reason: reason instanceof Error ? reason.message : String(reason) })));
    this.expirationTimer = setInterval(() => void this.expireDueSessions(), 5_000);
    // 무료 DB에 요청마다 삭제 쿼리를 추가하지 않고 하루 한 번만 보존 기한을 확인합니다.
    this.retentionTimer = setInterval(() => void this.deleteExpiredHistory().catch((reason) => this.logger.error(JSON.stringify({ event: "retention.failed", reason: reason instanceof Error ? reason.message : String(reason) }))), RETENTION_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
    if (this.retentionTimer) clearInterval(this.retentionTimer);
  }

  /**
   * 같은 객실에 쓰기 가능한 상담이 있으면 새 상담을 만들지 않습니다.
   * 생성 시 발급한 투숙객 토큰 원문은 한 번만 반환하고 DB에는 해시만 저장합니다.
   */
  async create(guest: GuestAccessPayload, language: string) {
    const accessKey = await this.prisma.roomAccessKey.findUnique({
      where: { id: guest.sub },
      include: { room: { include: { hotel: true } } },
    });
    if (!accessKey || accessKey.roomId !== guest.roomId || accessKey.status !== "ACTIVE") throw new UnauthorizedException("객실 접근 권한이 만료되었습니다.");

    const existing = await this.prisma.chatSession.findFirst({ where: { roomId: guest.roomId, status: { in: ["WAITING", "ACTIVE"] } } });
    if (existing) throw new ConflictException("이 객실에는 이미 진행 중인 상담이 있습니다.");

    const guestToken = createOpaqueToken();
    let session;
    try {
      session = await this.prisma.chatSession.create({
        data: {
          roomId: guest.roomId,
          language,
          guestTokenHash: sha256(guestToken),
          // WAITING과 담당자 배정 직후에는 시간 제한을 두지 않고, 담당 Agent의 첫 메시지를 저장할 때 15분을 시작합니다.
          expiresAt: null,
          messages: {
            create: {
              senderType: "SYSTEM",
              senderId: null,
              clientMessageId: "hotel-welcome",
              messageType: "SYSTEM",
              // 영어 Guest에는 영어 원문을, 그 외 지원 언어에는 현재 MVP 기본 원문인 일본어를 저장합니다.
              content: language === "en" ? accessKey.room.hotel.welcomeMessageEn : accessKey.room.hotel.welcomeMessage,
            },
          },
        },
        include: { room: { include: { hotel: true } } },
      });
    } catch (error) {
      // PostgreSQL 부분 고유 인덱스가 동시 생성 경쟁을 차단하면 사용자에게 일관된 409 오류를 반환합니다.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("이 객실에는 이미 진행 중인 상담이 있습니다.");
      throw error;
    }
    const safe = this.toPublic(session);
    this.events.emit("chat.inbox.updated", { sessionId: session.id, reason: "SESSION_CREATED" });
    return { session: safe, guestToken };
  }

  /** 직원 또는 해당 투숙객 토큰만 상담 상세를 읽을 수 있습니다. */
  async get(id: string, staff: StaffTokenPayload | null, guestToken?: string) {
    const session = await this.findOrThrow(id);
    this.assertCanRead(session, staff, guestToken);
    return this.toPublic(session);
  }

  /** Agent 목록은 별도 메시지 집계 없이 인덱스가 있는 최근 활동 시각으로 정렬해 무료 DB 부하를 제한합니다. */
  async list(
    status: ChatSessionStatus | undefined,
    requester: StaffTokenPayload,
    scope?: SessionListScope,
  ) {
    await this.expireDueSessions();
    // Agent에게는 전체 WAITING, 본인 ACTIVE, 전체 종료 Log만 반환해 다른 Agent의 진행 상담을 목록 단계부터 차단합니다.
    const filters: Prisma.ChatSessionWhereInput[] = [];
    if (requester.role !== "ADMIN") {
      filters.push({
        OR: [
          { status: "WAITING" },
          { status: "ACTIVE", agentId: requester.sub },
          { status: { in: ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"] } },
        ],
      });
    }
    // main의 OPEN/COMPLETED 최적화는 유지하되 직원별 가시성 조건보다 우선하지 않게 AND로 결합합니다.
    if (status) {
      filters.push({ status });
    } else if (scope === "OPEN") {
      filters.push({ status: { in: ["WAITING", "ACTIVE"] } });
    } else if (scope === "COMPLETED") {
      filters.push({
        status: { in: ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"] },
      });
    }
    const where: Prisma.ChatSessionWhereInput =
      filters.length === 0
        ? {}
        : filters.length === 1
          ? filters[0]
          : { AND: filters };
    const sessions = await this.prisma.chatSession.findMany({
      where,
      include: {
        room: { include: { hotel: true } },
        // 비밀번호 해시와 토큰 버전은 DB 조회 단계부터 응답 후보에서 제외합니다.
        agent: { select: PUBLIC_AGENT_SELECT },
        messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
      },
      orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
    });
    return sessions.map((session) => {
      const { messages, ...withoutMessages } = session;
      return {
        ...toPublicSession(withoutMessages),
        lastMessage: messages[0] ?? null,
      };
    });
  }

  /**
   * 별도 수락 화면 없이 대화를 여는 첫 Agent에게 원자 배정합니다.
   * 이 단계에서는 상담사가 아직 답변하지 않았으므로 타이머를 시작하지 않고, 첫 Agent 메시지를 저장하는 트랜잭션에서 시작합니다.
   */
  async open(id: string, agent: StaffTokenPayload) {
    const current = await this.findOrThrow(id);
    assertCanOpen(current.status, current.agentId, agent.sub);
    if (current.status === "ACTIVE" && current.agentId === agent.sub) return this.toPublic(current);
    const result = await this.prisma.chatSession.updateMany({
      where: { id, status: "WAITING", agentId: null },
      data: {
        status: "ACTIVE",
        agentId: agent.sub,
        startedAt: null,
        expiresAt: null,
      },
    });
    if (result.count !== 1) throw new ConflictException("다른 Agent가 먼저 대화를 열었습니다.");
    const opened = await this.get(id, agent);
    this.logger.log(JSON.stringify({ event: "session.opened", sessionId: id, agentId: agent.sub }));
    this.events.emit("chat.session.updated", opened);
    this.events.emit("chat.inbox.updated", { sessionId: id, reason: "SESSION_OPENED" });
    return opened;
  }

  /** 이전 프런트가 사용하는 수락 API도 새 대화 열기 정책으로 연결해 순차 배포 중 동작을 유지합니다. */
  async accept(id: string, agent: StaffTokenPayload) { return this.open(id, agent); }

  /** 담당 Agent 또는 관리자가 상담을 종료하며 종료 이유와 시각을 함께 기록합니다. */
  async close(id: string, requester: StaffTokenPayload) {
    const current = await this.findOrThrow(id);
    assertCanClose(current.status, current.agentId, requester.sub, requester.role === "ADMIN");
    const session = await this.prisma.chatSession.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), closeReason: "AGENT_CLOSED" }, include: { room: { include: { hotel: true } }, agent: true } });
    const safe = this.toPublic(session);
    this.logger.log(JSON.stringify({ event: "session.closed", sessionId: id, actorId: requester.sub, reason: "AGENT_CLOSED" }));
    this.events.emit("chat.session.closed", safe);
    return safe;
  }

  /** 고객 토큰을 재검증한 뒤 WAITING 또는 ACTIVE 상담을 고객 요청으로 즉시 종료합니다. */
  async closeByGuest(id: string, guestToken?: string) {
    const current = await this.findOrThrow(id);
    if (!guestToken || sha256(guestToken) !== current.guestTokenHash) {
      throw new UnauthorizedException("투숙객 채팅 인증 정보가 올바르지 않습니다.");
    }
    if (!["WAITING", "ACTIVE"].includes(current.status)) {
      throw new ConflictException("이미 종료되었거나 만료된 상담입니다.");
    }
    // Agent 종료·자동 만료와 동시에 요청되어도 마지막 요청이 종료 사유를 덮어쓰지 않게 상태 조건을 함께 갱신합니다.
    const result = await this.prisma.chatSession.updateMany({
      where: { id, status: { in: ["WAITING", "ACTIVE"] } },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closeReason: "GUEST_CLOSED",
      },
    });
    if (result.count !== 1) {
      throw new ConflictException("이미 종료되었거나 만료된 상담입니다.");
    }
    const session = await this.findOrThrow(id);
    const safe = this.toPublic(session);
    this.logger.log(
      JSON.stringify({
        event: "session.closed",
        sessionId: id,
        actor: "GUEST",
        reason: "GUEST_CLOSED",
      }),
    );
    this.events.emit("chat.session.closed", safe);
    return safe;
  }

  /** 이전 메시지 조회는 Phase 2 전에도 재연결 API 계약을 준비하기 위해 제공합니다. */
  async messages(id: string, staff: StaffTokenPayload | null, guestToken?: string) {
    const session = await this.findOrThrow(id);
    this.assertCanRead(session, staff, guestToken);
    return this.prisma.message.findMany({ where: { sessionId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  }

  /** WebSocket 연결 단계에서 투숙객 불투명 토큰과 상담 ID의 결합을 검증합니다. */
  async authenticateGuestRealtime(id: string, guestToken: string): Promise<void> {
    const session = await this.findOrThrow(id);
    if (sha256(guestToken) !== session.guestTokenHash) throw new UnauthorizedException("투숙객 채팅 인증 정보가 올바르지 않습니다.");
  }

  /** 채팅방 입장 시 담당 Agent·관리자 또는 해당 투숙객만 허용합니다. */
  async authorizeRealtime(id: string, identity: { kind: "guest"; sessionId: string } | { kind: "staff"; staff: StaffTokenPayload }): Promise<void> {
    const session = await this.findOrThrow(id);
    if (identity.kind === "guest") {
      if (identity.sessionId !== id) throw new UnauthorizedException("다른 상담방에는 입장할 수 없습니다.");
      return;
    }
    if (identity.staff.role === "ADMIN" || session.agentId === identity.staff.sub) return;
    throw new UnauthorizedException("담당 상담방만 입장할 수 있습니다.");
  }

  private async findOrThrow(id: string) {
    let session = await this.prisma.chatSession.findUnique({ where: { id }, include: { room: { include: { hotel: true } }, agent: true } });
    if (!session) throw new NotFoundException("상담 세션을 찾을 수 없습니다.");
    // Phase 4의 주기 만료 작업 전에도 늦게 도착한 API 요청이 만료 상담을 사용하지 못하도록 즉시 동기화합니다.
    if (session.status === "ACTIVE" && isSessionExpired(session.expiresAt)) {
      session = await this.prisma.chatSession.update({
        where: { id },
        data: { status: "EXPIRED", closedAt: new Date(), closeReason: "TIME_LIMIT" },
        include: { room: { include: { hotel: true } }, agent: true },
      });
      this.events.emit("chat.session.closed", this.toPublic(session));
    }
    return session;
  }

  /** 목록을 반환하기 전에 만료된 모든 쓰기 가능 상담을 한 번에 EXPIRED로 전환합니다. */
  async expireDueSessions(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.chatSession.findMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, select: { id: true } });
    for (const item of due) {
      const result = await this.prisma.chatSession.updateMany({ where: { id: item.id, status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED", closedAt: now, closeReason: "TIME_LIMIT" } });
      if (result.count === 1) { const session = await this.findOrThrow(item.id); const safe = this.toPublic(session); this.events.emit("chat.session.closed", safe); this.logger.log(JSON.stringify({ event: "session.expired", sessionId: item.id, reason: "TIME_LIMIT" })); }
    }
  }

  /**
   * 종료 시각이 30일 지난 쓰기 불가 상담만 삭제합니다.
   * ChatSession의 연쇄 삭제 제약이 하위 Message를 함께 지우며 WAITING·ACTIVE와 closedAt 없는 행은 대상에서 제외합니다.
   */
  async deleteExpiredHistory(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - CHAT_RETENTION_MS);
    const deleted = await this.prisma.chatSession.deleteMany({
      where: { status: { in: ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"] }, closedAt: { lte: cutoff } }
    });
    if (deleted.count > 0) this.logger.log(JSON.stringify({ event: "retention.deleted", count: deleted.count, cutoff: cutoff.toISOString() }));
    return deleted.count;
  }

  private assertCanRead(session: { guestTokenHash: string; agentId: string | null; status: string }, staff: StaffTokenPayload | null, guestToken?: string): void {
    // 완료 상담은 공동 운영 기록이므로 모든 Agent가 읽을 수 있지만 진행 중 상담의 담당자 경계는 그대로 유지합니다.
    if (staff && canStaffReadSession(session.status, session.agentId, staff.sub, staff.role === "ADMIN")) return;
    if (guestToken && sha256(guestToken) === session.guestTokenHash) return;
    throw new UnauthorizedException("이 상담을 조회할 권한이 없습니다.");
  }

  /** DB 객체에서 접근 토큰 해시를 제거하고 화면에 필요한 정보만 반환합니다. */
  private toPublic(session: any) {
    return toPublicSession(session);
  }
}
