import { compare, hash } from "bcrypt";
import { decode, sign } from "jsonwebtoken";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../src/modules/auth/auth.service";

describe("24시간 콜센터 직원 인증", () => {
  const previousSecret = process.env.JWT_SECRET;
  const secret = "test-secret-that-is-long-enough-for-jwt-tests";

  beforeAll(() => { process.env.JWT_SECRET = secret; });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
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

  /** 공통 로그인은 사용자가 역할을 미리 선택하지 않아도 저장된 역할을 그대로 반환하며 계정 조회를 반복하지 않습니다. */
  it("통합 로그인에서 관리자 역할을 한 번의 조회로 판별한다", async () => {
    const passwordHash = await hash("admin", 4);
    const findUnique = jest.fn().mockResolvedValue({ id: "admin-id", name: "Admin", role: "ADMIN", status: "ACTIVE", passwordHash });
    const auth = new AuthService({ agent: { findUnique } } as never);

    const result = await auth.login("admin", "admin");

    expect(result.agent.role).toBe("ADMIN");
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  /** 남아 있는 구버전 역할별 엔드포인트는 다른 역할 계정에 토큰을 발급하지 않아 기존 권한 경계를 유지합니다. */
  it("구버전 역할별 로그인에서는 다른 역할 계정을 거부한다", async () => {
    const passwordHash = await hash("admin", 4);
    const prisma = { agent: { findUnique: jest.fn().mockResolvedValue({ id: "admin-id", name: "Admin", role: "ADMIN", status: "ACTIVE", passwordHash }) } };
    const auth = new AuthService(prisma as never);

    await expect(auth.login("admin", "admin", "AGENT")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  /** 만료 없는 토큰이라도 계정이 삭제되거나 비활성화되면 DB 확인 단계에서 즉시 거부합니다. */
  it("현재 활성 계정이 아닌 직원 토큰을 거부한다", async () => {
    const prisma = { agent: { findUnique: jest.fn().mockResolvedValue(null) } };
    const auth = new AuthService(prisma as never);
    const token = sign({ sub: "deleted-agent", role: "AGENT", kind: "staff" }, secret);

    await expect(auth.verifyActiveStaff(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  /** 순차 배포 중 구버전 JWT에는 버전이 없으므로 초기 DB 버전 0과 호환해 갑작스러운 로그아웃을 막습니다. */
  it("버전 없는 구버전 토큰을 초기 계정 버전과 호환한다", async () => {
    const prisma = { agent: { findUnique: jest.fn().mockResolvedValue({ role: "AGENT", status: "ACTIVE", tokenVersion: 0 }) } };
    const auth = new AuthService(prisma as never);
    const token = sign({ sub: "agent-id", role: "AGENT", kind: "staff" }, secret);

    await expect(auth.verifyActiveStaff(token)).resolves.toMatchObject({ sub: "agent-id", role: "AGENT" });
  });

  /** 현재 비밀번호가 맞으면 새 해시는 평문을 남기지 않고 저장되며 토큰 버전을 함께 올립니다. */
  it("본인 비밀번호를 bcrypt로 변경하고 기존 토큰 버전을 폐기한다", async () => {
    const oldHash = await hash("agent01", 4);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const auth = new AuthService({ agent: { findUnique: jest.fn().mockResolvedValue({ passwordHash: oldHash }), updateMany } } as never);

    await expect(auth.changePassword("agent-id", "agent01", "new-password")).resolves.toEqual({ changed: true });

    const update = updateMany.mock.calls[0][0];
    expect(await compare("new-password", update.data.passwordHash as string)).toBe(true);
    expect(update.data.tokenVersion).toEqual({ increment: 1 });
    expect(update.where).toEqual({ id: "agent-id", passwordHash: oldHash });
  });

  /** 현재 비밀번호가 틀리면 bcrypt 갱신이나 토큰 폐기를 수행하지 않습니다. */
  it("틀린 현재 비밀번호의 변경 요청을 거부한다", async () => {
    const oldHash = await hash("agent01", 4);
    const updateMany = jest.fn();
    const auth = new AuthService({ agent: { findUnique: jest.fn().mockResolvedValue({ passwordHash: oldHash }), updateMany } } as never);

    await expect(auth.changePassword("agent-id", "wrong", "new-password")).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  /** 길이 제한은 두지 않지만 빈 값을 해시해 로그인 불가능한 계정을 만드는 요청은 서비스 경계에서도 차단합니다. */
  it("빈 새 비밀번호를 거부한다", async () => {
    const oldHash = await hash("agent01", 4);
    const updateMany = jest.fn();
    const auth = new AuthService({ agent: { findUnique: jest.fn().mockResolvedValue({ passwordHash: oldHash }), updateMany } } as never);

    await expect(auth.changePassword("agent-id", "agent01", "")).rejects.toBeInstanceOf(BadRequestException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  /** 비밀번호 변경 전 발급된 무기한 JWT는 DB 버전과 달라지는 즉시 거부됩니다. */
  it("DB와 토큰 버전이 다른 기존 로그인을 거부한다", async () => {
    const prisma = { agent: { findUnique: jest.fn().mockResolvedValue({ role: "AGENT", status: "ACTIVE", tokenVersion: 1 }) } };
    const auth = new AuthService(prisma as never);
    const token = sign({ sub: "agent-id", role: "AGENT", kind: "staff", tokenVersion: 0 }, secret);

    await expect(auth.verifyActiveStaff(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
