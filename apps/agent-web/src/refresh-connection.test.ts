import { describe, expect, it } from "vitest";
import {
  nextRefreshFailureCount,
  REFRESH_RECONNECT_THRESHOLD,
  shouldShowReconnectNotice,
} from "./refresh-connection";

describe("Agent 상담 목록 재연결 상태", () => {
  it("첫 두 번의 일시 실패는 사용자 오류로 표시하지 않는다", () => {
    expect(shouldShowReconnectNotice(1)).toBe(false);
    expect(shouldShowReconnectNotice(2)).toBe(false);
  });

  it("세 번 연속 실패하면 재연결 안내를 표시한다", () => {
    expect(REFRESH_RECONNECT_THRESHOLD).toBe(3);
    expect(shouldShowReconnectNotice(3)).toBe(true);
  });

  it("실패 횟수는 임계치보다 커지지 않는다", () => {
    expect(nextRefreshFailureCount(0)).toBe(1);
    expect(nextRefreshFailureCount(2)).toBe(3);
    expect(nextRefreshFailureCount(3)).toBe(3);
  });
});
