import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { createOpaqueToken, sha256 } from "../../common/security/hash";
import type { GuestAccessPayload, StaffTokenPayload } from "../auth/auth.types";
import { assertCanAccept, assertCanClose, canStaffReadSession, isSessionExpired } from "./session-policy";
import { Prisma, type ChatSessionStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { SessionListScope } from "./dto/list-sessions.dto";
import { PUBLIC_AGENT_SELECT, toPublicSession } from "./session-view";

const SESSION_DURATION_MS = 15 * 60 * 1000;
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
    const accessKey = await this.prisma.roomAccessKey.findUnique({ where: { id: guest.sub } });
    if (!accessKey || accessKey.roomId !== guest.roomId || accessKey.status !== "ACTIVE") throw new UnauthorizedException("객실 접근 권한이 만료되었습니다.");

    const existing = await this.prisma.chatSession.findFirst({ where: { roomId: guest.roomId, status: { in: ["WAITING", "ACTIVE"] } } });
    if (existing) throw new ConflictException("이 객실에는 이미 진행 중인 상담이 있습니다.");

    const guestToken = createOpaqueToken();
    let session;
    try {
      session = await this.prisma.chatSession.create({
        // 고객이 대기한 시간은 상담 시간에서 제외하고 Agent 수락 순간에 15분 만료 시각을 기록합니다.
        data: { roomId: guest.roomId, language, guestTokenHash: sha256(guestToken), expiresAt: null },
        include: { room: { include: { hotel: true } } },
      });
    } catch (error) {
      // PostgreSQL 부분 고유 인덱스가 동시 생성 경쟁을 차단하면 사용자에게 일관된 409 오류를 반환합니다.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("이 객실에는 이미 진행 중인 상담이 있습니다.");
      throw error;
    }
    return { session: toPublicSession(session), guestToken };
  }

  /** 직원 또는 해당 투숙객 토큰만 상담 상세를 읽을 수 있습니다. */
  async get(id: string, staff: StaffTokenPayload | null, guestToken?: string) {
    const session = await this.findOrThrow(id);
    this.assertCanRead(session, staff, guestToken);
    return toPublicSession(session);
  }

  /** Agent 목록은 별도 메시지 집계 없이 인덱스가 있는 최근 활동 시각으로 정렬해 무료 DB 부하를 제한합니다. */
  async list(status?: ChatSessionStatus, scope?: SessionListScope) {
    await this.expireDueSessions();
    // 단일 상태가 지정되면 기존 API 의미를 유지하고, 그 외에는 화면 용도별 상태 그룹만 조회합니다.
    const where: Prisma.ChatSessionWhereInput | undefined = status
      ? { status }
      : scope === "OPEN"
        ? { status: { in: ["WAITING", "ACTIVE"] } }
        : scope === "COMPLETED"
          ? { status: { in: ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"] } }
          : undefined;
    const sessions = await this.prisma.chatSession.findMany({ where, include: { room: { include: { hotel: true } }, agent: { select: PUBLIC_AGENT_SELECT } }, orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }] });
    return sessions.map((session) => toPublicSession(session));
  }

  /** 동시 수락 경쟁에서도 한 Agent만 성공하도록 조건부 updateMany를 사용합니다. */
  async accept(id: string, agent: StaffTokenPayload) {
    const current = await this.findOrThrow(id);
    assertCanAccept(current.status, current.agentId);
    const acceptedAt = new Date();
    const result = await this.prisma.chatSession.updateMany({
      where: { id, status: "WAITING", agentId: null },
      // 수락 시각과 만료 시각을 같은 DB 갱신에 넣어 어떤 화면에서도 정확히 15분으로 보이게 합니다.
      data: { status: "ACTIVE", agentId: agent.sub, startedAt: acceptedAt, expiresAt: new Date(acceptedAt.getTime() + SESSION_DURATION_MS) },
    });
    if (result.count !== 1) throw new ConflictException("다른 Agent가 먼저 상담을 수락했습니다.");
    const accepted = await this.get(id, agent);
    this.logger.log(JSON.stringify({ event: "session.accepted", sessionId: id, agentId: agent.sub }));
    this.events.emit("chat.session.updated", accepted);
    return accepted;
  }

  /** 담당 Agent 또는 관리자가 상담을 종료하며 종료 이유와 시각을 함께 기록합니다. */
  async close(id: string, requester: StaffTokenPayload) {
    const current = await this.findOrThrow(id);
    assertCanClose(current.status, current.agentId, requester.sub, requester.role === "ADMIN");
    const session = await this.prisma.chatSession.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), closeReason: "AGENT_CLOSED" }, include: { room: { include: { hotel: true } }, agent: { select: PUBLIC_AGENT_SELECT } } });
    const safe = toPublicSession(session);
    this.logger.log(JSON.stringify({ event: "session.closed", sessionId: id, actorId: requester.sub, reason: "AGENT_CLOSED" }));
    this.events.emit("chat.session.closed", safe);
    return safe;
  }

  /** 고객의 불투명 토큰을 재검증한 뒤 대기 또는 진행 상담을 즉시 종료합니다. */
  async closeByGuest(id: string, guestToken?: string) {
    const current = await this.findOrThrow(id);
    if (!guestToken || sha256(guestToken) !== current.guestTokenHash) throw new UnauthorizedException("투숙객 채팅 인증 정보가 올바르지 않습니다.");
    if (!["WAITING", "ACTIVE"].includes(current.status)) throw new ConflictException("이미 종료되었거나 만료된 상담입니다.");
    // Agent 종료·자동 만료와 동시에 요청되어도 마지막 요청이 종료 사유를 덮어쓰지 않게 상태 조건을 함께 갱신합니다.
    const result = await this.prisma.chatSession.updateMany({ where: { id, status: { in: ["WAITING", "ACTIVE"] } }, data: { status: "CLOSED", closedAt: new Date(), closeReason: "GUEST_CLOSED" } });
    if (result.count !== 1) throw new ConflictException("이미 종료되었거나 만료된 상담입니다.");
    const session = await this.findOrThrow(id);
    const safe = toPublicSession(session);
    this.logger.log(JSON.stringify({ event: "session.closed", sessionId: id, actor: "GUEST", reason: "GUEST_CLOSED" }));
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
    let session = await this.prisma.chatSession.findUnique({ where: { id }, include: { room: { include: { hotel: true } }, agent: { select: PUBLIC_AGENT_SELECT } } });
    if (!session) throw new NotFoundException("상담 세션을 찾을 수 없습니다.");
    // Phase 4의 주기 만료 작업 전에도 늦게 도착한 API 요청이 만료 상담을 사용하지 못하도록 즉시 동기화합니다.
    if (session.status === "ACTIVE" && isSessionExpired(session.expiresAt)) {
      session = await this.prisma.chatSession.update({
        where: { id },
        data: { status: "EXPIRED", closedAt: new Date(), closeReason: "TIME_LIMIT" },
        include: { room: { include: { hotel: true } }, agent: { select: PUBLIC_AGENT_SELECT } },
      });
      this.events.emit("chat.session.closed", toPublicSession(session));
    }
    return session;
  }

  /** 목록을 반환하기 전에 수락 뒤 제한 시간이 지난 ACTIVE 상담을 EXPIRED로 전환합니다. */
  async expireDueSessions(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.chatSession.findMany({ where: { status: "ACTIVE", expiresAt: { lte: now } }, select: { id: true } });
    for (const item of due) {
      const result = await this.prisma.chatSession.updateMany({ where: { id: item.id, status: "ACTIVE", expiresAt: { lte: now } }, data: { status: "EXPIRED", closedAt: now, closeReason: "TIME_LIMIT" } });
      if (result.count === 1) { const session = await this.findOrThrow(item.id); const safe = toPublicSession(session); this.events.emit("chat.session.closed", safe); this.logger.log(JSON.stringify({ event: "session.expired", sessionId: item.id, reason: "TIME_LIMIT" })); }
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

}
