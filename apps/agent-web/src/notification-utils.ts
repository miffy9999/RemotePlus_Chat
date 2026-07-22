/** 상담 목록의 최소 형태만 받아 알림 판정 로직을 UI와 분리합니다. */
interface NotifiableSession {
  id: string;
  status: string;
}

interface ActivitySession {
  createdAt: string;
  lastActivityAt?: string;
}

const NOTIFICATION_SOUND_KEY = "remoteplus-agent-notification-sound";

/** 저장값이 명시적으로 true일 때만 알림음을 켜 기본 동작은 조용한 화면 팝업으로 유지합니다. */
export function readNotificationSoundEnabled(storage: Storage = localStorage): boolean {
  try { return storage.getItem(NOTIFICATION_SOUND_KEY) === "true"; }
  catch { return false; }
}

/** 알림음 선택은 인증정보가 아닌 UI 환경설정이므로 같은 브라우저에서 유지되도록 localStorage에 저장합니다. */
export function saveNotificationSoundEnabled(enabled: boolean, storage: Storage = localStorage): void {
  try { storage.setItem(NOTIFICATION_SOUND_KEY, String(enabled)); }
  catch { /* 저장소가 차단되어도 현재 탭의 상태와 팝업 동작은 유지합니다. */ }
}

/** 최근 메시지 시각이 큰 상담부터 복사 정렬해 React 원본 상태를 변경하지 않고 메신저형 목록을 만듭니다. */
export function sortSessionsByRecentActivity<T extends ActivitySession>(sessions: readonly T[]): T[] {
  // 무료 플랜의 순차 배포 중 구버전 API가 lastActivityAt을 아직 주지 않는 짧은 구간에는 생성 시각으로 안전하게 대체합니다.
  return [...sessions].sort((left, right) => (right.lastActivityAt ?? right.createdAt).localeCompare(left.lastActivityAt ?? left.createdAt));
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
