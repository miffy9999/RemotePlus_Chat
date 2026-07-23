import { afterEach, describe, expect, it, vi } from "vitest";
import { browserNotificationsSupported, prepareNotificationServiceWorker, showBrowserNotification } from "./browser-notifications";

describe("Edge 호환 브라우저 알림", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("서비스 워커 알림을 직접 Notification보다 우선 사용한다", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const register = vi.fn().mockResolvedValue({ showNotification });
    vi.stubGlobal("window", { Notification: class {}, location: { href: "https://agent.example.com/agent" } });
    vi.stubGlobal("Notification", { permission: "granted" });
    vi.stubGlobal("document", { visibilityState: "hidden" });
    vi.stubGlobal("navigator", { serviceWorker: { register } });

    await expect(showBrowserNotification("새 상담", "1201호", "session-1", true)).resolves.toBe(true);
    expect(register).toHaveBeenCalledWith("/notification-sw.js", { scope: "/" });
    expect(showNotification).toHaveBeenCalledWith("새 상담", expect.objectContaining({ tag: "session-1", silent: true }));
  });

  it("서비스 워커가 없는 환경에서는 등록 결과를 null로 반환한다", async () => {
    vi.stubGlobal("navigator", {});
    await expect(prepareNotificationServiceWorker()).resolves.toBeNull();
  });

  it("Notification API가 없으면 미지원으로 판단한다", () => {
    vi.stubGlobal("window", {});
    expect(browserNotificationsSupported()).toBe(false);
  });
});
