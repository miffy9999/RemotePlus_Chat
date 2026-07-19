import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatSessionsModule } from "../chat-sessions/chat-sessions.module";
import { MessagesModule } from "../messages/messages.module";
import { ChatGateway } from "./chat.gateway";

/** 실시간 모듈은 인증·상담·메시지 서비스를 조립하고 Gateway만 외부에 노출합니다. */
@Module({ imports: [AuthModule, ChatSessionsModule, MessagesModule], providers: [ChatGateway] })
export class RealtimeModule {}
