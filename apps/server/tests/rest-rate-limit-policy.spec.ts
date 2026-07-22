import { restRateLimitPolicy } from "../src/common/security/rest-rate-limit-policy";

describe("REST 요청 제한 키 정책", () => {
  /** 한 사무실의 여러 로그인 세션은 같은 공인 IP를 써도 서로의 5초 폴링 한도를 소진하지 않아야 합니다. */
  it("직원 목록 폴링을 Bearer 토큰 지문별로 분리한다", () => {
    const first = restRateLimitPolicy({ ip: "203.0.113.10", method: "GET", path: "/api/agent/chat-sessions", authorization: "Bearer first-token" });
    const second = restRateLimitPolicy({ ip: "203.0.113.10", method: "GET", path: "/api/agent/chat-sessions", authorization: "Bearer second-token" });

    expect(first.limit).toBe(30);
    expect(first.key).not.toBe(second.key);
    expect(first.key).not.toContain("first-token");
  });

  /** 로그인처럼 계정 추측 위험이 있는 요청은 토큰 문자열로 키를 우회하지 못하고 기존 IP 상한을 유지합니다. */
  it("로그인 요청은 IP·메서드·경로 기준을 유지한다", () => {
    expect(restRateLimitPolicy({ ip: "203.0.113.10", method: "POST", path: "/api/auth/login" })).toEqual({
      key: "203.0.113.10:POST:/api/auth/login",
      limit: 30,
    });
  });
});
