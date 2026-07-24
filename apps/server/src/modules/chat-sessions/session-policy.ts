import { ConflictException, ForbiddenException } from "@nestjs/common";

/** 상담사가 첫 답변을 보낸 시각부터 적용하는 서버 기준 상담 제한시간입니다. */
export const SESSION_DURATION_MS = 15 * 60 * 1000;

/** 새 WAITING을 열거나 현재 담당자가 자기 ACTIVE 상담을 다시 여는 경우만 허용합니다. */
export function assertCanOpen(status: string, agentId: string | null, requesterId: string): void {
  if (status === "WAITING" && agentId === null) return;
  if (status === "ACTIVE" && agentId === requesterId) return;
  throw new ConflictException("이미 다른 Agent가 열었거나 진행 가능한 상담이 아닙니다.");
}

/** 상담 종료는 담당 Agent 또는 관리자만 가능하도록 검사합니다. */
export function assertCanClose(status: string, assignedAgentId: string | null, requesterId: string, isAdmin: boolean): void {
  if (!isAdmin && assignedAgentId !== requesterId) throw new ForbiddenException("담당 상담만 종료할 수 있습니다.");
  if (status !== "ACTIVE" && status !== "WAITING") throw new ConflictException("이미 종료되었거나 만료된 상담입니다.");
}

/**
 * 관리자는 모든 상담을 조회하고, Agent는 자신의 진행 상담과 모든 완료 상담 로그를 조회할 수 있습니다.
 * 대기·진행 중인 타 Agent 상담은 실시간 업무 경계를 유지하기 위해 공유 로그로 취급하지 않습니다.
 */
export function canStaffReadSession(status: string, assignedAgentId: string | null, requesterId: string, isAdmin: boolean): boolean {
  if (isAdmin || assignedAgentId === requesterId) return true;
  return ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"].includes(status);
}

/** 화면 타이머가 아니라 서버 시각으로 만료 여부를 판단합니다. 같은 시각도 이미 만료된 것으로 처리합니다. */
export function isSessionExpired(expiresAt: Date | null, now: Date = new Date()): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}
