/**
 * 알림 판단에 필요한 최소 브라우저 상태입니다.
 * 실제 document뿐 아니라 단위 테스트의 가벼운 대역 객체도 받을 수 있게 분리했습니다.
 */
export interface AgentAttentionDocument {
  visibilityState: DocumentVisibilityState;
  hasFocus(): boolean;
}

/**
 * Agent가 현재 화면을 직접 보고 있으면 별도 팝업이 업무를 방해하므로 알림을 만들지 않습니다.
 * 탭이 숨겨졌거나 다른 창으로 포커스가 이동한 경우에만 백그라운드 알림을 허용합니다.
 */
export function shouldNotifyAgent(
  target: AgentAttentionDocument = document,
): boolean {
  return target.visibilityState !== "visible" || !target.hasFocus();
}
