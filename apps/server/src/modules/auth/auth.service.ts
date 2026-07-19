import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { compare } from "bcrypt";
import { sign, verify } from "jsonwebtoken";
import { PrismaService } from "../../database/prisma.service";
import type { GuestAccessPayload, RequestIdentity, StaffTokenPayload } from "./auth.types";

/** 직원 로그인과 서버 발급 토큰의 생성·검증을 한곳에서 담당합니다. */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 로그인 ID와 비밀번호를 확인하고 역할이 일치할 때만 JWT를 발급합니다.
   * 존재하지 않는 계정과 틀린 비밀번호에 같은 오류를 반환해 계정 추측을 어렵게 합니다.
   */
  async login(loginId: string, password: string, requiredRole: "ADMIN" | "AGENT") {
    const agent = await this.prisma.agent.findUnique({ where: { loginId } });
    if (!agent || agent.status !== "ACTIVE" || agent.role !== requiredRole || !(await compare(password, agent.passwordHash))) {
      this.logger.warn(JSON.stringify({ event: "login.failed", role: requiredRole, loginId: loginId.slice(0, 30) }));
      throw new UnauthorizedException("로그인 정보가 올바르지 않습니다.");
    }

    const payload: StaffTokenPayload = { sub: agent.id, role: agent.role, kind: "staff" };
    this.logger.log(JSON.stringify({ event: "login.succeeded", role: agent.role, staffId: agent.id }));
    return { accessToken: this.sign(payload, process.env.JWT_EXPIRES_IN ?? "15m"), agent: { id: agent.id, name: agent.name, role: agent.role } };
  }

  /** 접근 키 검증 성공 후 상담 생성에만 사용할 수 있는 10분짜리 제한 토큰을 발급합니다. */
  createGuestAccessToken(accessKeyId: string, roomId: string): string {
    return this.sign({ sub: accessKeyId, roomId, kind: "guest-access" } satisfies GuestAccessPayload, "10m");
  }

  /** Bearer 토큰의 서명과 만료를 확인하고 이후 권한 검사에 사용할 신원을 반환합니다. */
  verifyToken(token: string): RequestIdentity {
    try {
      return verify(token, this.secret()) as RequestIdentity;
    } catch {
      throw new UnauthorizedException("인증 토큰이 없거나 만료되었습니다.");
    }
  }

  private sign(payload: object, expiresIn: string): string {
    return sign(payload, this.secret(), { expiresIn: expiresIn as never });
  }

  private secret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret === "replace-with-a-long-random-secret") {
      throw new Error("JWT_SECRET 환경변수에 충분히 긴 임의 값을 설정해야 합니다.");
    }
    return secret;
  }
}
