import { decryptSecret, decryptSecretOrNull, encryptSecret } from "../src/common/security/encryption";

describe("관리자용 룸 접근키 암호화", () => {
  const previousSecret = process.env.ACCESS_KEY_ENCRYPTION_SECRET;

  beforeAll(() => {
    // 테스트 전용 비밀값을 사용하여 실제 운영 비밀값과 테스트 데이터를 분리한다.
    process.env.ACCESS_KEY_ENCRYPTION_SECRET = "test-only-room-access-key-encryption-secret";
  });

  afterAll(() => {
    // 다른 테스트에 환경변수 변경이 전파되지 않도록 원래 상태로 복구한다.
    if (previousSecret === undefined) delete process.env.ACCESS_KEY_ENCRYPTION_SECRET;
    else process.env.ACCESS_KEY_ENCRYPTION_SECRET = previousSecret;
  });

  it("평문을 노출하지 않고 암호화한 뒤 원래 값으로 복호화한다", () => {
    const plainText = "room-access-key-example";
    const encrypted = encryptSecret(plainText);

    expect(encrypted).not.toContain(plainText);
    expect(decryptSecret(encrypted)).toBe(plainText);
  });

  it("손상되거나 다른 비밀값으로 만든 암호문은 목록 장애 대신 null로 처리한다", () => {
    expect(decryptSecretOrNull("invalid-encrypted-room-key")).toBeNull();
  });
});
