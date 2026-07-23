/* Edge를 포함한 Chromium 브라우저에서 알림 클릭 시 기존 상담 탭을 우선 활성화합니다. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || self.location.origin;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    const existing = clients.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.focus();
    return self.clients.openWindow(targetUrl);
  }));
});
