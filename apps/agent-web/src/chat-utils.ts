/** 메시지 ID 중복을 제거하고 서버 생성 시각 순서로 정렬해 재연결 이벤트가 화면을 중복시키지 않게 합니다. */
export function mergeMessage<T extends { id: string; createdAt: string }>(items: T[], incoming: T): T[] {
  return items.some((item) => item.id === incoming.id) ? items : [...items, incoming].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
/** 서버 정책상 Agent 상담에 표시할 수 있는 최대 시간은 대화 시작부터 15분입니다. */
export const AGENT_SESSION_DURATION_SECONDS = 15 * 60;

/**
 * 서버 만료 시각까지 남은 시간을 MM:SS로 표시합니다.
 * PC 시계가 서버보다 느려 절대 시각 차이가 17분처럼 계산돼도 운영 정책 상한인 15분을 넘겨 노출하지 않습니다.
 */
export function remainingTime(expiresAt: string, now: number): string {
  const seconds = Math.min(
    AGENT_SESSION_DURATION_SECONDS,
    Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/** 새 메시지 또는 종료 상태가 반영된 뒤 전체 문서가 아닌 채팅 컨테이너만 마지막 위치로 이동합니다. */
export function scrollChatToLatest(container: Pick<HTMLElement, "scrollHeight" | "scrollTo">, smooth: boolean): void {
  container.scrollTo({ top: container.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}
