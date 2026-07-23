/** Agent 목록 영역은 너무 좁아지지 않도록 최소 너비를 보장합니다. */
export const AGENT_SIDEBAR_MIN_WIDTH = 320;

/** 넓은 모니터에서도 목록이 대화 영역을 과도하게 차지하지 않도록 최대 너비를 제한합니다. */
export const AGENT_SIDEBAR_MAX_WIDTH = 620;

/** 처음 접속했거나 저장값이 없을 때 사용하는 기본 목록 너비입니다. */
export const AGENT_SIDEBAR_DEFAULT_WIDTH = 420;

/** 사용자가 조정한 목록 너비를 같은 브라우저에서 복원하기 위한 저장 키입니다. */
export const AGENT_SIDEBAR_STORAGE_KEY = "hotel-chat:agent-sidebar-width";

/**
 * 목록 너비를 현재 화면에서 사용할 수 있는 범위로 제한합니다.
 * 8px 구분선을 제외한 오른쪽 대화 영역은 최소 420px을 남겨 두며, 900px 이하 모바일 전환 구간에서는 CSS가 한 열 레이아웃을 담당합니다.
 */
export function clampAgentSidebarWidth(
  width: number,
  viewportWidth: number,
): number {
  const finiteWidth = Number.isFinite(width)
    ? width
    : AGENT_SIDEBAR_DEFAULT_WIDTH;
  const viewportMaximum = Math.max(
    AGENT_SIDEBAR_MIN_WIDTH,
    viewportWidth - 428,
  );
  const maximum = Math.min(AGENT_SIDEBAR_MAX_WIDTH, viewportMaximum);
  return Math.round(
    Math.min(maximum, Math.max(AGENT_SIDEBAR_MIN_WIDTH, finiteWidth)),
  );
}

/** 손상된 저장값은 무시하고 현재 화면에 맞춘 기본 너비를 반환합니다. */
export function readAgentSidebarWidth(
  storage: Pick<Storage, "getItem">,
  viewportWidth: number,
): number {
  const stored = Number(storage.getItem(AGENT_SIDEBAR_STORAGE_KEY));
  return clampAgentSidebarWidth(
    Number.isFinite(stored) && stored > 0
      ? stored
      : AGENT_SIDEBAR_DEFAULT_WIDTH,
    viewportWidth,
  );
}

/** 드래그가 끝난 너비만 저장하여 새로고침 뒤에도 같은 화면 비율을 유지합니다. */
export function saveAgentSidebarWidth(
  storage: Pick<Storage, "setItem">,
  width: number,
): void {
  storage.setItem(AGENT_SIDEBAR_STORAGE_KEY, String(Math.round(width)));
}
