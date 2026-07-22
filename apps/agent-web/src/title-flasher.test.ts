import { describe, expect, it, vi } from "vitest";
import { createTitleFlasher } from "./title-flasher";

describe("새 채팅 탭 제목 알림", () => {
  it("현재 보고 있는 Agent 탭에서는 제목 타이머를 만들지 않는다", () => {
    const documentTarget = { title: "RemotePlus Agent", visibilityState: "visible" as const, hasFocus: () => true };
    const intervalHost = { setInterval: vi.fn(() => 1), clearInterval: vi.fn() };
    createTitleFlasher(documentTarget, intervalHost).start("새 상담이 도착했습니다.");
    expect(intervalHost.setInterval).not.toHaveBeenCalled();
    expect(documentTarget.title).toBe("RemotePlus Agent");
  });

  it("비활성 탭 제목을 1초마다 교대하고 확인하면 원래 제목으로 복구한다", () => {
    const documentTarget = { title: "RemotePlus Agent", visibilityState: "hidden" as const, hasFocus: () => false };
    let tick: () => void = () => undefined;
    const intervalHost = { setInterval: vi.fn((handler: () => void) => { tick = handler; return 7; }), clearInterval: vi.fn() };
    const flasher = createTitleFlasher(documentTarget, intervalHost);
    flasher.start("새 상담이 도착했습니다.");
    expect(documentTarget.title).toBe("새 상담이 도착했습니다.");
    tick();
    expect(documentTarget.title).toBe("RemotePlus Agent");
    tick();
    expect(documentTarget.title).toBe("새 상담이 도착했습니다.");
    flasher.stop();
    expect(intervalHost.clearInterval).toHaveBeenCalledWith(7);
    expect(documentTarget.title).toBe("RemotePlus Agent");
  });

  it("연속 알림은 타이머를 늘리지 않고 최신 알림 문구만 사용한다", () => {
    const documentTarget = { title: "RemotePlus Agent", visibilityState: "hidden" as const, hasFocus: () => false };
    let tick: () => void = () => undefined;
    const intervalHost = { setInterval: vi.fn((handler: () => void) => { tick = handler; return 3; }), clearInterval: vi.fn() };
    const flasher = createTitleFlasher(documentTarget, intervalHost);
    flasher.start("새 상담");
    flasher.start("새 고객 메시지");
    tick();
    tick();
    expect(documentTarget.title).toBe("새 고객 메시지");
    expect(intervalHost.setInterval).toHaveBeenCalledTimes(1);
  });
});
