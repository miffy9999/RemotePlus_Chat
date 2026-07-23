/** Prisma 관계 조회에서 인증 필드를 애초에 읽지 않고 화면에 필요한 최소 담당자 정보만 선택합니다. */
export const PUBLIC_AGENT_SELECT = { id: true, name: true } as const;

/**
 * REST와 WebSocket으로 내보내는 상담 객체의 마지막 보안 경계입니다.
 * 조회 코드가 실수로 전체 Agent를 포함해도 비밀번호 해시·토큰 버전은 버리고, 투숙객 인증 해시는 항상 제거합니다.
 */
export function toPublicSession(session: Record<string, any>): Record<string, any> {
  const { guestTokenHash: _guestTokenHash, agent, ...safe } = session;
  if (!("agent" in session)) return safe;
  return { ...safe, agent: agent ? { id: agent.id, name: agent.name } : null };
}
