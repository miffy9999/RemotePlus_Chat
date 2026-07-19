import { HttpException, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ConnectedSocket, MessageBody, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { CHAT_EVENTS } from "@hotel-chat/shared";
import { AuthService } from "../auth/auth.service";
import { ChatSessionsService } from "../chat-sessions/chat-sessions.service";
import { MessagesService } from "../messages/messages.service";
import type { RealtimeErrorView, RealtimeIdentity } from "./realtime.types";

/** Socket.IO 네임스페이스에서 인증, 방 입장과 실시간 이벤트 전달을 담당합니다. */
@WebSocketGateway({
  namespace: "/chat",
  // REST와 동일하게 두 로컬 호스트 표기를 허용해 브라우저별 주소 차이로 연결이 막히지 않게 합니다.
  cors: { origin: [process.env.AGENT_WEB_ORIGIN ?? "http://localhost:5173", process.env.GUEST_WEB_ORIGIN ?? "http://localhost:5174", "http://127.0.0.1:5173", "http://127.0.0.1:5174"], credentials: true },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly messageRates = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly auth: AuthService, private readonly sessions: ChatSessionsService, private readonly messages: MessagesService) {}

  /**
   * Socket.IO 연결 미들웨어는 인증이 끝나기 전에는 connect 이벤트를 발생시키지 않습니다.
   * 이 경계에서 직원 JWT 또는 상담 ID와 투숙객 불투명 토큰을 검증해 입장 요청과의 경쟁을 방지합니다.
   */
  afterInit(server: Server): void {
    server.use(async (socket, next) => {
      try {
        const { staffToken, guestToken, sessionId } = socket.handshake.auth as Record<string, unknown>;
        if (typeof staffToken === "string") {
          const identity = this.auth.verifyToken(staffToken);
          if (identity.kind !== "staff") throw new Error("직원 토큰이 아닙니다.");
          socket.data.identity = { kind: "staff", staff: identity } satisfies RealtimeIdentity;
          next();
          return;
        }
        if (typeof guestToken === "string" && typeof sessionId === "string") {
          await this.sessions.authenticateGuestRealtime(sessionId, guestToken);
          socket.data.identity = { kind: "guest", sessionId } satisfies RealtimeIdentity;
          next();
          return;
        }
        throw new Error("인증 정보가 없습니다.");
      } catch {
        const error = new Error("인증되지 않은 WebSocket 연결입니다.") as Error & { data?: RealtimeErrorView };
        error.data = { code: "UNAUTHORIZED", message: error.message };
        next(error);
      }
    });
  }

  /** 상담별 Socket.IO 방에 입장하기 전에 현재 담당자와 세션 ID를 다시 검사합니다. */
  @SubscribeMessage(CHAT_EVENTS.join)
  async join(@ConnectedSocket() socket: Socket, @MessageBody() payload: { sessionId?: string }) {
    try {
      const identity = this.identity(socket);
      if (typeof payload?.sessionId !== "string") throw new Error("상담 ID가 필요합니다.");
      await this.sessions.authorizeRealtime(payload.sessionId, identity);
      await socket.join(this.room(payload.sessionId));
      return { ok: true, sessionId: payload.sessionId };
    } catch (error) {
      return this.emitError(socket, error);
    }
  }

  /** DB 저장이 성공한 뒤 송신자에게 승인 이벤트를 보내고 상대방에게만 메시지를 전달합니다. */
  @SubscribeMessage(CHAT_EVENTS.message)
  async message(@ConnectedSocket() socket: Socket, @MessageBody() payload: unknown) {
    try {
      // 연결별 분당 60개를 넘는 메시지는 저장 전에 차단해 반복 전송으로부터 DB와 상대방을 보호한다.
      const now = Date.now(); const rate = this.messageRates.get(socket.id);
      if (!rate || rate.resetAt <= now) this.messageRates.set(socket.id, { count: 1, resetAt: now + 60_000 });
      else if (++rate.count > 60) throw new HttpException("메시지를 너무 빠르게 보내고 있습니다.", 429);
      const saved = await this.messages.save(this.identity(socket), payload);
      const view = { ...saved.message, createdAt: saved.message.createdAt.toISOString(), duplicate: saved.duplicate };
      socket.emit(CHAT_EVENTS.accepted, view);
      if (!saved.duplicate) socket.to(this.room(saved.message.sessionId)).emit(CHAT_EVENTS.message, view);
      return { ok: true, messageId: saved.message.id, duplicate: saved.duplicate };
    } catch (error) {
      return this.emitError(socket, error);
    }
  }

  /** REST에서 상담이 수락되면 이미 대기 중인 투숙객에게 상태 변경을 전달합니다. */
  @OnEvent("chat.session.updated")
  sessionUpdated(session: { id: string }): void {
    this.server.to(this.room(session.id)).emit(CHAT_EVENTS.sessionUpdated, session);
  }

  /** 수동 종료 또는 만료를 양쪽에 즉시 알리고 이후 입력 차단 UI가 전환될 수 있게 합니다. */
  @OnEvent("chat.session.closed")
  sessionClosed(session: { id: string }): void {
    this.server.to(this.room(session.id)).emit(CHAT_EVENTS.sessionClosed, session);
  }

  private identity(socket: Socket): RealtimeIdentity {
    const identity = socket.data.identity as RealtimeIdentity | undefined;
    if (!identity) throw new Error("인증된 연결이 아닙니다.");
    return identity;
  }

  private room(sessionId: string): string { return `session:${sessionId}`; }

  private emitError(socket: Socket, error: unknown) {
    const message = error instanceof HttpException ? String(error.getResponse() instanceof Object ? (error.getResponse() as any).message : error.message) : error instanceof Error ? error.message : "채팅 처리 중 오류가 발생했습니다.";
    const view = { code: error instanceof HttpException ? `HTTP_${error.getStatus()}` : "CHAT_ERROR", message } satisfies RealtimeErrorView;
    this.logger.warn(`WebSocket 요청 거부: ${view.code}`);
    socket.emit(CHAT_EVENTS.error, view);
    return { ok: false, error: view };
  }
}
