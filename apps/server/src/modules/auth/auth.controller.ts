import { Body, Controller, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { requireStaff } from "./request-auth";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { LoginDto } from "./dto/login.dto";

/** 공통 로그인에서 실제 계정 역할을 판별하되, 기존 역할별 URL은 순차 배포와 이전 클라이언트 호환을 위해 유지합니다. */
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** 로그인 ID에 저장된 ADMIN 또는 AGENT 역할을 한 번의 계정 조회로 판별해 해당 역할 JWT를 반환합니다. */
  @Post("login")
  loginStaff(@Body() dto: LoginDto) { return this.auth.login(dto.loginId, dto.password); }

  /** ADMIN과 AGENT 모두 자기 계정의 현재 비밀번호를 확인한 뒤 변경할 수 있습니다. */
  @Post("change-password")
  async changePassword(@Req() request: Request, @Body() dto: ChangePasswordDto) {
    const staff = await requireStaff(request, this.auth, ["ADMIN", "AGENT"]);
    return this.auth.changePassword(staff.sub, dto.currentPassword, dto.newPassword);
  }

  /** Agent 계정을 인증해 상담 API용 토큰을 반환합니다. */
  @Post("agent/login")
  loginAgent(@Body() dto: LoginDto) { return this.auth.login(dto.loginId, dto.password, "AGENT"); }

  /** 관리자 계정을 인증해 관리 API용 토큰을 반환합니다. */
  @Post("admin/login")
  loginAdmin(@Body() dto: LoginDto) { return this.auth.login(dto.loginId, dto.password, "ADMIN"); }
}
