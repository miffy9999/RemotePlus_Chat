import { describe, expect, it } from "vitest";
import { mergeMessage, remainingTime } from "./chat-utils";

describe("Agent 채팅 화면 유틸리티", () => {
  /** 승인 이벤트와 방 이벤트가 겹쳐도 같은 메시지는 한 번만 표시해야 합니다. */
  it("동일 ID 메시지를 중복 추가하지 않는다", () => {
    const message = { id: "m1", createdAt: "2026-07-21T00:00:00.000Z" };
    expect(mergeMessage([message], message)).toEqual([message]);
  });
  /** 늦게 복구된 과거 메시지도 서버 생성 시각 위치에 정렬돼야 합니다. */
  it("메시지를 생성 시각 순서로 정렬한다", () => {
    const later = { id: "m2", createdAt: "2026-07-21T00:00:02.000Z" };
    const earlier = { id: "m1", createdAt: "2026-07-21T00:00:01.000Z" };
    expect(mergeMessage([later], earlier).map((item) => item.id)).toEqual(["m1", "m2"]);
  });
  /** 만료 뒤에도 사용자에게 음수 시간을 노출하지 않습니다. */
  it("남은 시간과 만료 후 00:00을 계산한다", () => {
    const now = Date.parse("2026-07-21T00:00:00.000Z");
    expect(remainingTime("2026-07-21T00:01:05.000Z", now)).toBe("01:05");
    expect(remainingTime("2026-07-20T23:59:59.000Z", now)).toBe("00:00");
  });
});
