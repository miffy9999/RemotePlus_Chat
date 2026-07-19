import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AgentChatSessionsController, ChatSessionsController } from "./chat-sessions.controller";
import { ChatSessionsService } from "./chat-sessions.service";

@Module({ imports: [AuthModule], controllers: [ChatSessionsController, AgentChatSessionsController], providers: [ChatSessionsService], exports: [ChatSessionsService] })
export class ChatSessionsModule {}
