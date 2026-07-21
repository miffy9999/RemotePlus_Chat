import { describe, expect, it } from "vitest";
import { mergeMessage, remainingTime } from "./chat-utils";

describe("투숙객 채팅 화면 유틸리티", () => {
  /** REST 이력과 Socket 이벤트가 겹쳐도 메시지는 한 번만 보여야 합니다. */
  it("동일 ID 메시지를 중복 추가하지 않는다", () => {
    const message = { id: "guest-1", createdAt: "2026-07-21T00:00:00.000Z" };
    expect(mergeMessage([message], message)).toHaveLength(1);
  });
  /** 네트워크 수신 순서가 달라도 서버 생성 시각으로 복구합니다. */
  it("메시지를 생성 시각 순서로 정렬한다", () => {
    const later = { id: "guest-2", createdAt: "2026-07-21T00:00:02.000Z" };
    const earlier = { id: "guest-1", createdAt: "2026-07-21T00:00:01.000Z" };
    expect(mergeMessage([later], earlier).map((item) => item.id)).toEqual(["guest-1", "guest-2"]);
  });
  /** 남은 시간 형식과 만료 후 하한을 함께 검증합니다. */
  it("남은 시간을 MM:SS로 계산한다", () => {
    const now = Date.parse("2026-07-21T00:00:00.000Z");
    expect(remainingTime("2026-07-21T00:15:00.000Z", now)).toBe("15:00");
    expect(remainingTime("2026-07-20T23:59:00.000Z", now)).toBe("00:00");
  });
});
