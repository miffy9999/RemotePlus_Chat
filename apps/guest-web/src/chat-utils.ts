/** 투숙객 화면도 Agent와 같은 ID·생성 시각 규칙으로 메시지를 병합합니다. */
export function mergeMessage<T extends { id: string; createdAt: string }>(items: T[], incoming: T): T[] {
  return items.some((item) => item.id === incoming.id) ? items : [...items, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
/** 만료 시각을 MM:SS로 변환하며 서버 종료 이벤트 전에도 음수 표시는 방지합니다. */
export function remainingTime(expiresAt: string, now: number): string {
  const seconds = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** 게스트 모바일에서 전체 화면을 움직이지 않고 메시지 목록만 최신 말풍선으로 이동합니다. */
export function scrollChatToLatest(container: Pick<HTMLElement, "scrollHeight" | "scrollTo">, smooth: boolean): void {
  container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}
