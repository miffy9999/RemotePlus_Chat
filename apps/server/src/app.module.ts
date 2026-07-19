import { Module } from "@nestjs/common";
import { PrismaModule } from "./database/prisma.module";
import { HealthController } from "./health.controller";
import { AuthModule } from "./modules/auth/auth.module";
import { RoomsModule } from "./modules/rooms/rooms.module";
import { ChatSessionsModule } from "./modules/chat-sessions/chat-sessions.module";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { AdminModule } from "./modules/admin/admin.module";

/** 최상위 모듈은 공통 데이터베이스 연결과 기능별 모듈을 조립하는 역할만 담당합니다. */
@Module({ imports: [PrismaModule, EventEmitterModule.forRoot(), AuthModule, RoomsModule, ChatSessionsModule, RealtimeModule, AdminModule], controllers: [HealthController] })
export class AppModule {}
