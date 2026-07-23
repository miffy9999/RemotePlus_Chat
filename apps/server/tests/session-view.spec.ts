import { toPublicSession } from "../src/modules/chat-sessions/session-view";

describe("상담 공개 응답 보안 경계", () => {
  /** 중첩 관계를 전체 조회하는 실수가 생겨도 인증에 쓰는 값은 REST·Socket 응답으로 나가지 않아야 합니다. */
  it("투숙객 해시와 직원 인증 필드를 제거한다", () => {
    const view = toPublicSession({
      id: "session-id",
      guestTokenHash: "guest-secret-hash",
      agent: { id: "agent-id", name: "상담원", passwordHash: "bcrypt-secret", tokenVersion: 7, loginId: "agent01" },
    });

    expect(view).toEqual({ id: "session-id", agent: { id: "agent-id", name: "상담원" } });
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(JSON.stringify(view)).not.toContain("tokenVersion");
  });
});
