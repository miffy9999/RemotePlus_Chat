import { Injectable, Logger, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { compare, hash } from "bcrypt";
import { sign, verify } from "jsonwebtoken";
import { PrismaService } from "../../database/prisma.service";
import type { GuestAccessPayload, RequestIdentity, StaffTokenPayload } from "./auth.types";

/** 직원 로그인과 서버 발급 토큰의 생성·검증을 한곳에서 담당합니다. */
@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Render의 기존 서비스가 Prisma 데이터 마이그레이션을 실행하지 않는 경우에도 무료 테스트 계정을 맞춥니다.
   * 상업 전환 시 `FORCE_FREE_TEST_CREDENTIALS=false`로 끄면 서버 재시작이 운영 비밀번호를 덮어쓰지 않습니다.
   */
  async onModuleInit(): Promise<void> {
    if ((process.env.FORCE_FREE_TEST_CREDENTIALS ?? "true") !== "true") return;
    const [adminHash, agentHash] = await Promise.all([hash("admin", 12), hash("agent01", 12)]);
    const [admin, agent] = await Promise.all([
      this.prisma.agent.updateMany({ where: { loginId: "admin", role: "ADMIN" }, data: { passwordHash: adminHash } }),
      this.prisma.agent.updateMany({ where: { loginId: "agent01", role: "AGENT" }, data: { passwordHash: agentHash } })
    ]);
    this.logger.warn(JSON.stringify({ event: "test-credentials.reset", adminUpdated: admin.count, agentUpdated: agent.count }));
  }

  /**
   * 로그인 ID와 비밀번호를 확인하고, 구버전 역할별 엔드포인트가 역할을 지정한 경우에는 역할 일치까지 확인한 뒤 JWT를 발급합니다.
   * 존재하지 않는 계정과 틀린 비밀번호에 같은 오류를 반환해 계정 추측을 어렵게 합니다.
   */
  async login(loginId: string, password: string, requiredRole?: "ADMIN" | "AGENT") {
    const agent = await this.prisma.agent.findUnique({ where: { loginId } });
    if (!agent || agent.status !== "ACTIVE" || (requiredRole !== undefined && agent.role !== requiredRole) || !(await compare(password, agent.passwordHash))) {
      this.logger.warn(JSON.stringify({ event: "login.failed", role: requiredRole ?? "STAFF", loginId: loginId.slice(0, 30) }));
      throw new UnauthorizedException("로그인 정보가 올바르지 않습니다.");
    }

    const payload: StaffTokenPayload = { sub: agent.id, role: agent.role, kind: "staff" };
    this.logger.log(JSON.stringify({ event: "login.succeeded", role: agent.role, staffId: agent.id }));
    // 콜센터 PC는 24시간 상시 운영하므로 직원 JWT에는 만료 시각을 넣지 않습니다. 각 요청에서 계정 활성 상태를 다시 확인해 삭제 계정은 즉시 차단합니다.
    return { accessToken: sign(payload, this.secret()), agent: { id: agent.id, name: agent.name, role: agent.role } };
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

  /**
   * 서명된 직원 토큰의 계정이 현재도 존재하고 활성 상태이며 역할이 동일한지 DB에서 확인합니다.
   * 만료 없는 토큰을 사용하더라도 관리자가 계정을 삭제하거나 비활성화하면 다음 요청부터 즉시 거부합니다.
   */
  async verifyActiveStaff(token: string): Promise<StaffTokenPayload> {
    const identity = this.verifyToken(token);
    if (identity.kind !== "staff") throw new UnauthorizedException("직원 인증 토큰이 아닙니다.");
    const agent = await this.prisma.agent.findUnique({ where: { id: identity.sub }, select: { role: true, status: true } });
    if (!agent || agent.status !== "ACTIVE" || agent.role !== identity.role) throw new UnauthorizedException("사용할 수 없는 직원 계정입니다.");
    return identity;
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
