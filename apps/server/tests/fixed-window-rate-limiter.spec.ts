import { FixedWindowRateLimiter } from "../src/common/security/fixed-window-rate-limiter";

describe("단일 서버 요청 제한 기록 정리", () => {
  /** 제한 횟수까지 허용하고 같은 시간 창의 초과 요청은 거절합니다. */
  it("고정 시간 창의 요청 상한을 적용한다", () => {
    const limiter = new FixedWindowRateLimiter(1_000);
    expect(limiter.allow("client", 2, 1_000)).toBe(true);
    expect(limiter.allow("client", 2, 1_001)).toBe(true);
    expect(limiter.allow("client", 2, 1_002)).toBe(false);
  });

  /** 종료된 소켓 키는 즉시 제거하되 다른 활성 키의 제한 상태는 유지합니다. */
  it("지정한 연결 기록만 즉시 제거한다", () => {
    const limiter = new FixedWindowRateLimiter(1_000);
    limiter.allow("socket-1", 60, 1_000);
    limiter.allow("socket-2", 60, 1_000);

    limiter.forget("socket-1");

    expect(limiter.trackedKeyCount()).toBe(1);
  });

  /** 정리 주기가 지나면 만료된 REST·소켓 키를 제거하고 현재 요청 키만 새로 보관합니다. */
  it("시간 창이 끝난 제한 기록을 정리한다", () => {
    const limiter = new FixedWindowRateLimiter(1_000);
    limiter.allow("expired-1", 10, 1_000);
    limiter.allow("expired-2", 10, 1_000);

    limiter.allow("current", 10, 2_001);

    expect(limiter.trackedKeyCount()).toBe(1);
  });
});
