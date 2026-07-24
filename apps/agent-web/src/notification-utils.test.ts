import { describe, expect, it } from "vitest";
import { findNewWaitingSessions, notificationPreview, sortSessionsByRecentActivity, waitingSessionIds } from "./notification-utils";

const waiting = { id: "waiting-1", status: "WAITING" };

describe("상담 알림 판정", () => {
  it("최초 로딩에 이미 있던 상담은 새 상담으로 알리지 않는다", () => {
    expect(findNewWaitingSessions(null, [waiting])).toEqual([]);
  });

  it("대기 상담이 0건에서 1건이 되어도 감지한다", () => {
    expect(findNewWaitingSessions(new Set(), [waiting])).toEqual([waiting]);
  });

  it("이미 확인한 대기 상담과 대기가 아닌 상담은 다시 알리지 않는다", () => {
    const sessions = [waiting, { id: "active-1", status: "ACTIVE" }];
    expect(findNewWaitingSessions(waitingSessionIds(sessions), sessions)).toEqual([]);
  });

  it("팝업 메시지의 연속 공백을 정리하고 지정 길이로 줄인다", () => {
    expect(notificationPreview("  객실에서\n  수건을 요청했습니다.  ")).toBe("객실에서 수건을 요청했습니다.");
    expect(notificationPreview("123456789", 6)).toBe("12345…");
  });

  it("마지막 메시지 시각이 최신인 상담을 목록 맨 위로 정렬한다", () => {
    const older = { id: "older", createdAt: "2026-07-22T02:00:00.000Z", lastActivityAt: "2026-07-22T03:00:00.000Z" };
    const newer = { id: "newer", createdAt: "2026-07-22T02:01:00.000Z", lastActivityAt: "2026-07-22T03:01:00.000Z" };
    expect(sortSessionsByRecentActivity([older, newer]).map((session) => session.id)).toEqual(["newer", "older"]);
  });

  it("Render 구버전 API와 겹치는 배포 구간에는 생성 시각으로 목록을 정렬한다", () => {
    const older = { id: "older", createdAt: "2026-07-22T02:00:00.000Z" };
    const newer = { id: "newer", createdAt: "2026-07-22T02:01:00.000Z" };
    expect(sortSessionsByRecentActivity([older, newer]).map((session) => session.id)).toEqual(["newer", "older"]);
  });
});
