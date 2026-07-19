import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";

/** 인증 서비스를 다른 기능 모듈에서도 재사용할 수 있도록 내보냅니다. */
@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
