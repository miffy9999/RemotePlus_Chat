import type { StaffRole } from "./auth-storage";

/** 방문 기록과 무관하게 각 역할 화면을 직접 열 수 있도록 경로를 한 곳에서 관리합니다. */
export const ADMIN_DASHBOARD_PATH = "/admin" as const;
export const AGENT_WORKSPACE_PATH = "/agent" as const;
export const ADMIN_AGENT_WORKSPACE_PATH = "/admin/agent" as const;

/** 두 역할 모두 상담 화면에서 업무를 시작하되 ADMIN은 관리자 전용 전체 조회 경로를 사용합니다. */
export function staffHomePath(
  role: StaffRole,
): typeof ADMIN_AGENT_WORKSPACE_PATH | typeof AGENT_WORKSPACE_PATH {
  return role === "ADMIN" ? ADMIN_AGENT_WORKSPACE_PATH : AGENT_WORKSPACE_PATH;
}

/** 일반 Agent가 관리자 전용 Dashboard와 전체 상담 조회 화면에 들어가지 못하도록 경계를 명시합니다. */
export function canAccessStaffPath(
  role: StaffRole,
  path: string,
): boolean {
  if (path === AGENT_WORKSPACE_PATH) return role === "AGENT";
  if (
    path === ADMIN_DASHBOARD_PATH ||
    path === ADMIN_AGENT_WORKSPACE_PATH
  ) {
    return role === "ADMIN";
  }
  return false;
}
