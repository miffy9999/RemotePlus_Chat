import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("Agent 화면 레이아웃과 팝업 CSS 격리", () => {
  /** 현재 화면으로 되돌아가는 링크 하나뿐인 사이드바가 다시 공간을 차지하는 회귀를 막습니다. */
  it("기능 없는 사이드바를 렌더링하지 않고 언어 선택을 상단 동작에 유지한다", () => {
    expect(mainSource).not.toContain("<aside>");
    expect(mainSource).not.toContain('t("Agent 상담")');
    expect(mainSource).toContain('<div className="agent-header-actions"><LanguageSwitcher/>');
    expect(styles).not.toContain(".shell > aside");
  });

  /** 팝업은 사이드바와 다른 시맨틱 요소를 사용해 높이·배치·모바일 표시 규칙을 상속받지 않아야 합니다. */
  it("알림 팝업을 독립된 section 요소로 렌더링한다", () => {
    expect(mainSource).toContain('<section className="agent-notice"');
    expect(mainSource).not.toContain('<aside className="agent-notice"');
  });

  /** 팝업은 항상 유지하되 알림음은 저장된 사용자 선택이 켜진 경우에만 호출해야 합니다. */
  it("알림음 버튼과 조건부 재생 경계를 제공한다", () => {
    expect(mainSource).toContain("aria-pressed={soundEnabled}");
    expect(mainSource).toContain("if (soundEnabledRef.current) playNotificationSound()");
  });
});
