import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("Agent 화면 팝업 CSS 격리", () => {
  /** 모바일 사이드바 숨김 규칙이 모든 aside를 대상으로 하면 알림 팝업도 함께 사라지는 회귀를 막습니다. */
  it("사이드바 스타일을 shell의 직계 aside에만 적용한다", () => {
    expect(styles).toContain(".shell > aside { display: none; }");
    expect(styles).not.toMatch(/(?:^|\n)\s*aside\s*\{/);
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
