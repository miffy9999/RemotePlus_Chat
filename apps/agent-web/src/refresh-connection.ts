export const REFRESH_RECONNECT_THRESHOLD = 3;

/**
 * 상담 목록 폴링 실패 횟수를 제한된 범위로 누적합니다.
 * 일시적인 Render 재시작이나 네트워크 흔들림 한두 번은 사용자 업무를 방해하지 않고,
 * 임계치에 도달한 경우에만 명확한 재연결 상태를 표시하기 위해 사용합니다.
 */
export function nextRefreshFailureCount(current: number): number {
  return Math.min(current + 1, REFRESH_RECONNECT_THRESHOLD);
}

/** 연속 실패가 사용자에게 재연결 상태를 알려야 하는 수준인지 판정합니다. */
export function shouldShowReconnectNotice(failureCount: number): boolean {
  return failureCount >= REFRESH_RECONNECT_THRESHOLD;
}
