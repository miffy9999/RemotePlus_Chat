import { describe, expect, it } from "vitest";
import { clearStoredGuestAccess, readStoredGuestAccess, saveStoredGuestAccess } from "./guest-access-storage";
import type { StoredGuestAccess } from "./api";

/** 실제 브라우저 없이도 항목별 삭제 범위와 손상 복구를 검증하기 위한 메모리 저장소입니다. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

const validAccess = {
  guestToken: "opaque-token",
  session: {
    id: "session-1", status: "WAITING", language: "ja", startedAt: null,
    expiresAt: null, closedAt: null,
    room: { roomNumber: "101", hotel: { name: "테스트 호텔" } },
  },
} satisfies StoredGuestAccess;
const beforeExpiry = new Date("2026-07-22T03:00:00.000Z").getTime();

describe("게스트 상담 기기 저장소", () => {
  it("정상 상담 정보를 접근 키별로 저장하고 복원한다", () => {
    const storage = memoryStorage();
    saveStoredGuestAccess("room-a", validAccess, storage);
    expect(readStoredGuestAccess("room-a", storage, beforeExpiry)).toEqual(validAccess);
  });

  it("깨진 JSON을 제거하고 신규 상담 흐름에 사용할 null을 반환한다", () => {
    const storage = memoryStorage({ "hotel-chat-guest:room-a": "{broken" });
    expect(readStoredGuestAccess("room-a", storage)).toBeNull();
    expect(storage.getItem("hotel-chat-guest:room-a")).toBeNull();
  });

  it("세션 ID나 토큰이 없는 저장값을 제거한다", () => {
    const storage = memoryStorage({ "hotel-chat-guest:room-a": JSON.stringify({ session: {} }) });
    expect(readStoredGuestAccess("room-a", storage)).toBeNull();
  });

  it("브라우저 시각 기준으로 만료된 상담 정보를 즉시 제거한다", () => {
    const storage = memoryStorage();
    saveStoredGuestAccess("room-a", { ...validAccess, session: { ...validAccess.session, status: "ACTIVE", expiresAt: "2026-07-22T04:00:00.000Z" } }, storage);
    expect(readStoredGuestAccess("room-a", storage, new Date("2026-07-22T04:00:01.000Z").getTime())).toBeNull();
    expect(storage.getItem("hotel-chat-guest:room-a")).toBeNull();
  });

  it("수락 전 WAITING 상담은 만료 시각 없이 복원한다", () => {
    const storage = memoryStorage();
    saveStoredGuestAccess("room-a", validAccess, storage);
    expect(readStoredGuestAccess("room-a", storage, Date.now() + 365 * 24 * 60 * 60 * 1000)).toEqual(validAccess);
  });

  it.each(["CLOSED", "EXPIRED"] as const)("%s 상담 정보는 재접속에 사용하지 않고 제거한다", (status) => {
    const storage = memoryStorage();
    saveStoredGuestAccess("room-a", { ...validAccess, session: { ...validAccess.session, status } }, storage);
    expect(readStoredGuestAccess("room-a", storage, new Date("2026-07-22T03:00:00.000Z").getTime())).toBeNull();
  });

  it("한 객실의 인증 실패 정리가 다른 객실 상담을 삭제하지 않는다", () => {
    const storage = memoryStorage();
    saveStoredGuestAccess("room-a", validAccess, storage);
    saveStoredGuestAccess("room-b", { ...validAccess, guestToken: "room-b-token" }, storage);
    clearStoredGuestAccess("room-a", storage);
    expect(readStoredGuestAccess("room-a", storage)).toBeNull();
    expect(readStoredGuestAccess("room-b", storage, beforeExpiry)?.guestToken).toBe("room-b-token");
  });
});
