interface TitleDocument {
  title: string;
  visibilityState: DocumentVisibilityState;
  hasFocus: () => boolean;
}

interface IntervalHost {
  setInterval: (handler: () => void, milliseconds: number) => number;
  clearInterval: (id: number) => void;
}

export interface TitleFlasher {
  start: (alertTitle: string) => void;
  stop: () => void;
}

/**
 * 비활성 브라우저 탭 제목을 새 채팅 문구와 원래 제목 사이에서 교대합니다.
 * 서버 요청은 전혀 만들지 않고 타이머 하나만 재사용하며, stop에서 반드시 자원을 정리합니다.
 */
export function createTitleFlasher(documentTarget: TitleDocument, intervalHost: IntervalHost): TitleFlasher {
  const originalTitle = documentTarget.title;
  let alertTitle = originalTitle;
  let intervalId: number | null = null;
  let showAlert = false;

  function stop(): void {
    if (intervalId !== null) intervalHost.clearInterval(intervalId);
    intervalId = null;
    showAlert = false;
    documentTarget.title = originalTitle;
  }

  function start(nextAlertTitle: string): void {
    // 현재 보고 있는 화면에서는 앱 내부 팝업으로 충분하므로 비활성 탭에서만 제목 타이머를 사용합니다.
    if (documentTarget.visibilityState === "visible" && documentTarget.hasFocus()) return;
    alertTitle = nextAlertTitle;
    showAlert = true;
    documentTarget.title = alertTitle;
    if (intervalId !== null) return;
    intervalId = intervalHost.setInterval(() => {
      showAlert = !showAlert;
      documentTarget.title = showAlert ? alertTitle : originalTitle;
    }, 1000);
  }

  return { start, stop };
}
