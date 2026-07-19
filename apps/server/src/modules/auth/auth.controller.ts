import { Body, Controller, Post } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";

/** 역할별 로그인 URL을 분리해 관리자가 Agent 화면 토큰으로 접근하는 혼동을 줄입니다. */
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Agent 계정을 인증해 상담 API용 토큰을 반환합니다. */
  @Post("agent/login")
  loginAgent(@Body() dto: LoginDto) { return this.auth.login(dto.loginId, dto.password, "AGENT"); }

  /** 관리자 계정을 인증해 관리 API용 토큰을 반환합니다. */
  @Post("admin/login")
  loginAdmin(@Body() dto: LoginDto) { return this.auth.login(dto.loginId, dto.password, "ADMIN"); }
}
