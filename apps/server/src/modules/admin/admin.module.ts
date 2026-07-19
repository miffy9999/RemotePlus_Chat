import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

/** 관리자 기능을 별도 모듈로 격리해 Agent 상담 API와 권한 경계를 명확히 유지한다. */
@Module({ imports: [AuthModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
