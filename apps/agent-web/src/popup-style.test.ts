import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("Agent 화면 레이아웃과 팝업 CSS 격리", () => {
  /** 현재 화면으로 되돌아가는 링크 하나뿐인 사이드바가 다시 공간을 차지하는 회귀를 막습니다. */
  it("기능 없는 사이드바를 렌더링하지 않고 언어 선택을 상단 동작에 유지한다", () => {
    expect(mainSource).not.toContain("<aside>");
    expect(mainSource).not.toContain('t("Agent 상담")');
    expect(mainSource).toMatch(/<div className="agent-header-actions">\s*<LanguageSwitcher\s*\/>/);
    expect(styles).not.toContain(".shell > aside");
  });

  /** 팝업은 사이드바와 다른 시맨틱 요소를 사용해 높이·배치·모바일 표시 규칙을 상속받지 않아야 합니다. */
  it("알림 팝업을 독립된 section 요소로 렌더링한다", () => {
    expect(mainSource).toContain('<section className="agent-notice"');
    expect(mainSource).not.toContain('<aside className="agent-notice"');
  });

  /** 화면을 직접 보는 동안 중복 팝업을 만들지 않고 모든 알림을 무음으로 유지해야 합니다. */
  it("활성 화면 알림 차단과 무음 시스템 알림 경계를 제공한다", () => {
    expect(mainSource).toContain("if (!shouldNotifyAgent(document)) return");
    expect(mainSource).toContain(
      "new Notification(title, { body, tag, silent: true })",
    );
    expect(mainSource).not.toContain("playNotificationSound");
    expect(mainSource).not.toContain("AudioContext");
  });
});
