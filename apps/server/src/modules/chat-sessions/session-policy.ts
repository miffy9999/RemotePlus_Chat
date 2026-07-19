import { ConflictException, ForbiddenException } from "@nestjs/common";

/** 상담 수락이 가능한 유일한 상태를 중앙 정책으로 관리합니다. */
export function assertCanAccept(status: string, agentId: string | null): void {
  if (status !== "WAITING" || agentId) throw new ConflictException("이미 수락되었거나 대기 중이 아닌 상담입니다.");
}

/** 상담 종료는 담당 Agent 또는 관리자만 가능하도록 검사합니다. */
export function assertCanClose(status: string, assignedAgentId: string | null, requesterId: string, isAdmin: boolean): void {
  if (!isAdmin && assignedAgentId !== requesterId) throw new ForbiddenException("담당 상담만 종료할 수 있습니다.");
  if (status !== "ACTIVE" && status !== "WAITING") throw new ConflictException("이미 종료되었거나 만료된 상담입니다.");
}

/** 화면 타이머가 아니라 서버 시각으로 만료 여부를 판단합니다. 같은 시각도 이미 만료된 것으로 처리합니다. */
export function isSessionExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}
