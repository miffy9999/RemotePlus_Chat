import { compare, hash } from "bcrypt";
import { decode, sign } from "jsonwebtoken";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../src/modules/auth/auth.service";

describe("24시간 콜센터 직원 인증", () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousForceCredentials = process.env.FORCE_FREE_TEST_CREDENTIALS;
  const secret = "test-secret-that-is-long-enough-for-jwt-tests";

  beforeAll(() => { process.env.JWT_SECRET = secret; });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
    if (previousForceCredentials === undefined) delete process.env.FORCE_FREE_TEST_CREDENTIALS; else process.env.FORCE_FREE_TEST_CREDENTIALS = previousForceCredentials;
  });

  /** Render 시작 명령과 무관하게 현재 무료 테스트 계정이 사용자 지정 비밀번호로 맞춰지는지 확인합니다. */
  it("서버 시작 시 무료 테스트 계정 비밀번호를 bcrypt 해시로 재설정한다", async () => {
    process.env.FORCE_FREE_TEST_CREDENTIALS = "true";
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auth = new AuthService({ agent: { updateMany } } as never);

    await auth.onModuleInit();

    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(await compare("admin", updateMany.mock.calls[0][0].data.passwordHash as string)).toBe(true);
    expect(await compare("agent01", updateMany.mock.calls[1][0].data.passwordHash as string)).toBe(true);
  });

  /** 상업 전환 플래그를 끄면 운영자가 설정한 비밀번호를 서버 시작 과정에서 덮어쓰지 않습니다. */
  it("무료 테스트 계정 강제 설정을 명시적으로 끌 수 있다", async () => {
    process.env.FORCE_FREE_TEST_CREDENTIALS = "false";
    const updateMany = jest.fn();
    const auth = new AuthService({ agent: { updateMany } } as never);

    await auth.onModuleInit();

    expect(updateMany).not.toHaveBeenCalled();
  });

  /** 직원 로그인 JWT에는 exp를 넣지 않아 브라우저 탭을 유지하는 동안 재로그인을 요구하지 않습니다. */
  it("직원 토큰을 만료 시각 없이 발급한다", async () => {
    const passwordHash = await hash("agent01", 4);
    const prisma = { agent: { findUnique: jest.fn().mockResolvedValue({ id: "agent-id", name: "Agent", role: "AGENT", status: "ACTIVE", passwordHash }) } };
    const auth = new AuthService(prisma as never);

    const result = await auth.login("agent01", "agent01", "AGENT");
    const payload = decode(result.accessToken) as { exp?: number };

    expect(payload.exp).toBeUndefined();
  });

  /** 만료 없는 토큰이라도 계정이 삭제되거나 비활성화되면 DB 확인 단계에서 즉시 거부합니다. */
  it("현재 활성 계정이 아닌 직원 토큰을 거부한다", async () => {
    const prisma = { agent: { findUnique: jest.fn().mockResolvedValue(null) } };
    const auth = new AuthService(prisma as never);
    const token = sign({ sub: "deleted-agent", role: "AGENT", kind: "staff" }, secret);

    await expect(auth.verifyActiveStaff(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
