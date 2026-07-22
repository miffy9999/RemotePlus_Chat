/** 상담 목록의 최소 형태만 받아 알림 판정 로직을 UI와 분리합니다. */
interface NotifiableSession {
  id: string;
  status: string;
}

/** 현재 대기 중인 상담 ID를 저장해 다음 폴링 결과와 정확하게 비교합니다. */
export function waitingSessionIds(sessions: readonly NotifiableSession[]): Set<string> {
  return new Set(sessions.filter((session) => session.status === "WAITING").map((session) => session.id));
}

/**
 * 최초 목록 로딩 때는 이미 쌓여 있던 상담을 새 상담처럼 알리지 않습니다.
 * 그 뒤에는 대기 건수 대신 ID 차집합을 사용하므로 0건에서 1건이 되는 경우도 놓치지 않습니다.
 */
export function findNewWaitingSessions<T extends NotifiableSession>(
  previousIds: ReadonlySet<string> | null,
  sessions: readonly T[],
): T[] {
  if (previousIds === null) return [];
  return sessions.filter((session) => session.status === "WAITING" && !previousIds.has(session.id));
}

/** 긴 메시지는 공백을 정리하고 잘라 팝업이 상담 화면을 과도하게 가리지 않도록 합니다. */
export function notificationPreview(content: string, maximumLength = 80): string {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximumLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maximumLength - 1)).trimEnd()}…`;
}
