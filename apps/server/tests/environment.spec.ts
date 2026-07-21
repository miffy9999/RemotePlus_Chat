import { allowedWebOrigins, serverPort, validateRuntimeEnvironment } from "../src/common/config/environment";

describe("운영 환경 설정", () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env = { ...original };
    delete process.env.WEB_ORIGINS;
    delete process.env.AGENT_WEB_ORIGIN;
    delete process.env.GUEST_WEB_ORIGIN;
    delete process.env.PORT;
    delete process.env.SERVER_PORT;
  });

  afterAll(() => {
    process.env = original;
  });

  it("쉼표로 전달된 출처를 정리하고 중복을 제거한다", () => {
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGINS = "https://agent.example.com/, https://guest.example.com,https://agent.example.com";
    expect(allowedWebOrigins()).toEqual(["https://agent.example.com", "https://guest.example.com"]);
  });

  it("Render PORT를 기존 SERVER_PORT보다 우선한다", () => {
    process.env.PORT = "10000";
    process.env.SERVER_PORT = "4000";
    expect(serverPort()).toBe(10000);
  });

  it("운영 환경의 예시 비밀값을 거부한다", () => {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = "postgresql://example";
    process.env.JWT_SECRET = "replace-with-a-long-random-secret";
    process.env.ACCESS_KEY_ENCRYPTION_SECRET = "replace-with-another-long-random-secret";
    process.env.WEB_ORIGINS = "https://agent.example.com";
    process.env.GUEST_PUBLIC_URL = "https://guest.example.com";
    expect(() => validateRuntimeEnvironment()).toThrow("JWT_SECRET");
  });
});
