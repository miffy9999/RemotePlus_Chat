import { hash } from "bcrypt";
import { decode, sign } from "jsonwebtoken";
import { UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../src/modules/auth/auth.service";

describe("24시간 콜센터 직원 인증", () => {
  const previousSecret = process.env.JWT_SECRET;
  const secret = "test-secret-that-is-long-enough-for-jwt-tests";

  beforeAll(() => { process.env.JWT_SECRET = secret; });
  afterAll(() => { process.env.JWT_SECRET = previousSecret; });

  /** 직원 로그인 JWT에는 exp를 넣지 않아 브라우저 탭을 유지하는 동안 재로그인을 요구하지 않습니다. */
  it("직원 토큰을 만료 시각 없이 발급한다", async () => {
    const passwordHash = await hash("remote1234!", 4);
    const prisma = { agent: { findUnique: jest.fn().mockResolvedValue({ id: "agent-id", name: "Agent", role: "AGENT", status: "ACTIVE", passwordHash }) } };
    const auth = new AuthService(prisma as never);

    const result = await auth.login("agent01", "remote1234!", "AGENT");
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
