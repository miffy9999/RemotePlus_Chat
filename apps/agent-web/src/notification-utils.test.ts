import { describe, expect, it } from "vitest";
import { findNewWaitingSessions, notificationPreview, readNotificationSoundEnabled, saveNotificationSoundEnabled, sortSessionsByRecentActivity, waitingSessionIds } from "./notification-utils";

const waiting = { id: "waiting-1", status: "WAITING" };

/** 브라우저 없이 알림음 환경설정 저장과 기본값을 확인하는 최소 메모리 저장소입니다. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; }, clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); },
  };
}

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

  it("알림음은 기본으로 꺼지고 사용자의 켜기·끄기 선택을 유지한다", () => {
    const storage = memoryStorage();
    expect(readNotificationSoundEnabled(storage)).toBe(false);
    saveNotificationSoundEnabled(true, storage);
    expect(readNotificationSoundEnabled(storage)).toBe(true);
    saveNotificationSoundEnabled(false, storage);
    expect(readNotificationSoundEnabled(storage)).toBe(false);
  });

  it("브라우저가 환경설정 저장소를 차단해도 기본 무음으로 안전하게 동작한다", () => {
    const blocked = memoryStorage();
    blocked.getItem = () => { throw new Error("blocked"); };
    blocked.setItem = () => { throw new Error("blocked"); };
    expect(readNotificationSoundEnabled(blocked)).toBe(false);
    expect(() => saveNotificationSoundEnabled(true, blocked)).not.toThrow();
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
