import { describe, expect, it } from "vitest";
import { shouldNotifyAgent } from "./agent-notification-policy";

describe("Agent 알림 표시 정책", () => {
  it("Agent 화면이 보이고 포커스되어 있으면 팝업을 만들지 않는다", () => {
    expect(
      shouldNotifyAgent({
        visibilityState: "visible",
        hasFocus: () => true,
      }),
    ).toBe(false);
  });

  it("탭이 숨겨졌거나 다른 창을 사용하는 경우에만 알림을 허용한다", () => {
    expect(
      shouldNotifyAgent({
        visibilityState: "hidden",
        hasFocus: () => false,
      }),
    ).toBe(true);
    expect(
      shouldNotifyAgent({
        visibilityState: "visible",
        hasFocus: () => false,
      }),
    ).toBe(true);
  });
});
