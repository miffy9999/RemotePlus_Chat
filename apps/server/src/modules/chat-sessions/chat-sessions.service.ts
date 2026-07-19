import { ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { createOpaqueToken, sha256 } from "../../common/security/hash";
import type { GuestAccessPayload, StaffTokenPayload } from "../auth/auth.types";
import { assertCanAccept, assertCanClose, isSessionExpired } from "./session-policy";
import { Prisma, type ChatSessionStatus } from "@prisma/client";
import { EventEmitter2 } from "@nestjs/event-emitter";

const SESSION_DURATION_MS = 15 * 60 * 1000;

/** 상담 생성부터 조회·수락·종료까지 상태 전환을 트랜잭션 단위로 관리합니다. */
@Injectable()
export class ChatSessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatSessionsService.name);
  private expirationTimer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService, private readonly events: EventEmitter2) {}

  /** 서버 시작 즉시 누락된 만료를 복구하고 이후 5초마다 DB 기준 만료 대상을 처리한다. */
  onModuleInit(): void { void this.expireDueSessions(); this.expirationTimer = setInterval(() => void this.expireDueSessions(), 5_000); }
  onModuleDestroy(): void { if (this.expirationTimer) clearInterval(this.expirationTimer); }

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
    const now = new Date();
    let session;
    try {
      session = await this.prisma.chatSession.create({
        data: { roomId: guest.roomId, language, guestTokenHash: sha256(guestToken), expiresAt: new Date(now.getTime() + SESSION_DURATION_MS) },
        include: { room: { include: { hotel: true } } },
      });
    } catch (error) {
      // PostgreSQL 부분 고유 인덱스가 동시 생성 경쟁을 차단하면 사용자에게 일관된 409 오류를 반환합니다.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("이 객실에는 이미 진행 중인 상담이 있습니다.");
      throw error;
    }
    return { session: this.toPublic(session), guestToken };
  }

  /** 직원 또는 해당 투숙객 토큰만 상담 상세를 읽을 수 있습니다. */
  async get(id: string, staff: StaffTokenPayload | null, guestToken?: string) {
    const session = await this.findOrThrow(id);
    this.assertCanRead(session, staff, guestToken);
    return this.toPublic(session);
  }

  /** Agent 목록은 민감한 토큰 해시를 제외하고 최신 상담부터 반환합니다. */
  async list(status?: ChatSessionStatus) {
    await this.expireDueSessions();
    const sessions = await this.prisma.chatSession.findMany({ where: status ? { status } : undefined, include: { room: { include: { hotel: true } }, agent: true }, orderBy: { createdAt: "desc" } });
    return sessions.map((session) => this.toPublic(session));
  }

  /** 동시 수락 경쟁에서도 한 Agent만 성공하도록 조건부 updateMany를 사용합니다. */
  async accept(id: string, agent: StaffTokenPayload) {
    const current = await this.findOrThrow(id);
    assertCanAccept(current.status, current.agentId);
    const result = await this.prisma.chatSession.updateMany({ where: { id, status: "WAITING", agentId: null }, data: { status: "ACTIVE", agentId: agent.sub, startedAt: new Date() } });
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
    const session = await this.prisma.chatSession.update({ where: { id }, data: { status: "CLOSED", closedAt: new Date(), closeReason: "AGENT_CLOSED" }, include: { room: { include: { hotel: true } }, agent: true } });
    const safe = this.toPublic(session);
    this.logger.log(JSON.stringify({ event: "session.closed", sessionId: id, actorId: requester.sub, reason: "AGENT_CLOSED" }));
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
    if (["WAITING", "ACTIVE"].includes(session.status) && isSessionExpired(session.expiresAt)) {
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
    const due = await this.prisma.chatSession.findMany({ where: { status: { in: ["WAITING", "ACTIVE"] }, expiresAt: { lte: now } }, select: { id: true } });
    for (const item of due) {
      const result = await this.prisma.chatSession.updateMany({ where: { id: item.id, status: { in: ["WAITING", "ACTIVE"] } }, data: { status: "EXPIRED", closedAt: now, closeReason: "TIME_LIMIT" } });
      if (result.count === 1) { const session = await this.findOrThrow(item.id); const safe = this.toPublic(session); this.events.emit("chat.session.closed", safe); this.logger.log(JSON.stringify({ event: "session.expired", sessionId: item.id, reason: "TIME_LIMIT" })); }
    }
  }

  private assertCanRead(session: { guestTokenHash: string; agentId: string | null }, staff: StaffTokenPayload | null, guestToken?: string): void {
    if (staff?.role === "ADMIN" || (staff?.role === "AGENT" && staff.sub === session.agentId)) return;
    if (guestToken && sha256(guestToken) === session.guestTokenHash) return;
    throw new UnauthorizedException("이 상담을 조회할 권한이 없습니다.");
  }

  /** DB 객체에서 접근 토큰 해시를 제거하고 화면에 필요한 정보만 반환합니다. */
  private toPublic(session: any) {
    const { guestTokenHash: _secret, ...safe } = session;
    return safe;
  }
}
