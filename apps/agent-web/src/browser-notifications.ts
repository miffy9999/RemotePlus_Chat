/** Edge와 Chromium 계열에서 공통으로 사용할 브라우저 알림 지원 여부를 반환합니다. */
export function browserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * 운영체제 알림을 서비스 워커에서 표시할 수 있도록 등록합니다.
 * HTTPS가 아니거나 브라우저 정책이 등록을 막아도 앱 내부 팝업은 계속 동작하도록 null로 복구합니다.
 */
export async function prepareNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/notification-sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** 브라우저 알림 버튼의 사용자 동작 안에서만 권한을 요청합니다. */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!browserNotificationsSupported()) return "unsupported";
  return Notification.requestPermission();
}

/**
 * 앱이 백그라운드일 때 Edge가 안정적으로 표시하는 서비스 워커 경로를 우선 사용합니다.
 * 서비스 워커가 없는 구형 환경에서는 기존 Notification 생성자로 한 번만 폴백합니다.
 */
export async function showBrowserNotification(title: string, body: string, tag: string, silent: boolean): Promise<boolean> {
  if (!browserNotificationsSupported() || Notification.permission !== "granted" || document.visibilityState !== "hidden") return false;
  try {
    const registration = await prepareNotificationServiceWorker();
    if (registration) {
      await registration.showNotification(title, { body, tag, silent, data: { url: window.location.href } });
      return true;
    }
    const notification = new Notification(title, { body, tag, silent });
    notification.onclick = () => { window.focus(); notification.close(); };
    return true;
  } catch {
    // 운영체제 알림 실패는 앱 내부 팝업·제목 깜빡임을 막지 않습니다.
    return false;
  }
}
