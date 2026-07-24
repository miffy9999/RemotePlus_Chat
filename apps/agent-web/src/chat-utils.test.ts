import { describe, expect, it, vi } from "vitest";
import {
  anchorCountdownDeadline,
  mergeMessage,
  remainingTime,
  scrollChatToLatest,
} from "./chat-utils";

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
  /** PC 시계가 서버보다 느려도 사용자에게 서버 정책보다 긴 상담 시간을 약속하면 안 됩니다. */
  it("시계 오차로 17분이 계산돼도 15:00을 넘겨 표시하지 않는다", () => {
    const now = Date.parse("2026-07-21T00:00:00.000Z");
    expect(remainingTime("2026-07-21T00:17:00.000Z", now)).toBe("15:00");
  });

  /** 15분 상한이 매초 다시 적용되면 시계 오차 동안 15:00에 멈추므로 로컬 종료 시각을 한 번 고정합니다. */
  it("PC 시계가 서버보다 느려도 15:00 다음 초에 14:59로 감소한다", () => {
    const observedAt = Date.parse("2026-07-21T00:00:00.000Z");
    const anchored = anchorCountdownDeadline(
      "2026-07-21T00:17:00.000Z",
      observedAt,
    );

    expect(anchored).toBe("2026-07-21T00:15:00.000Z");
    expect(remainingTime(anchored!, observedAt)).toBe("15:00");
    expect(remainingTime(anchored!, observedAt + 1_000)).toBe("14:59");
  });

  it("첫 답변 전에는 카운트다운 종료 시각을 만들지 않는다", () => {
    expect(anchorCountdownDeadline(null, Date.now())).toBeNull();
  });
  /** 새 메시지는 페이지가 아니라 전달된 채팅 컨테이너의 마지막 위치로만 이동해야 합니다. */
  it("채팅 컨테이너를 마지막 메시지로 스크롤한다", () => {
    const scrollTo = vi.fn();
    scrollChatToLatest({ scrollHeight: 720, scrollTo }, true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 720, behavior: "smooth" });
  });
});
