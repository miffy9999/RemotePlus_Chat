import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("Agent 채팅과 관리자 대시보드 레이아웃 회귀 방지", () => {
  /** 조건부 안내 요소 수가 달라져도 입력창이 중간 그리드 행으로 밀려 올라가지 않아야 합니다. */
  it("상담 본문을 묶고 대화 패널을 헤더·본문·입력창 세 행으로 유지한다", () => {
    expect(mainSource).toContain('className="line-conversation-body"');
    expect(styles).toMatch(
      /\.line-conversation-panel\s*\{[^}]*grid-template-rows:\s*auto minmax\(0,1fr\) auto;/,
    );
    expect(styles).toMatch(
      /\.line-conversation-body\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/,
    );
    expect(styles).toMatch(
      /\.line-chat-composer\s*\{[^}]*position:\s*relative;/,
    );
  });

  /** 짧은 상담도 일반 메신저처럼 최근 메시지가 하단 입력창 가까이에 보여야 합니다. */
  it("첫 말풍선을 남은 메시지 공간의 아래쪽에 배치한다", () => {
    expect(styles).toContain(
      ".line-chat-messages > .line-bubble:first-of-type { margin-top: auto; }",
    );
  });

  /** 공용 PC에서 다른 직원 계정으로 바뀌어도 직원 이름을 헤더에서 즉시 확인해야 합니다. */
  it("Agent 헤더에 현재 로그인 계정 칩을 표시한다", () => {
    expect(mainSource).toContain('className="line-agent-account"');
    expect(mainSource).toContain("{auth.agent.name}");
    expect(mainSource).not.toContain("auth.agent.loginId");
    expect(styles).toContain(".line-agent-account {");
  });

  /** 호텔·Agent·로그를 긴 단일 페이지로 다시 합치는 회귀를 막습니다. */
  it("관리 메뉴와 선택 패널을 가진 대시보드 구조를 제공한다", () => {
    expect(mainSource).toContain('className="admin-navigation"');
    expect(mainSource).toContain('setActiveAdminSection("hotels")');
    expect(mainSource).toContain('setActiveAdminSection("agents")');
    expect(mainSource).toContain('setActiveAdminSection("logs")');
    expect(mainSource).toContain("remoteplus-admin-menu-collapsed");
    expect(styles).toContain(
      ".admin-dashboard { display: grid; grid-template-columns: 250px minmax(0,1fr);",
    );
    expect(styles).toContain(
      ".admin-dashboard.menu-collapsed { grid-template-columns: 76px minmax(0,1fr); }",
    );
  });

  /** 호텔·룸과 자동 안내문이 별도 카드로 다시 분리돼 긴 화면처럼 보이지 않게 합니다. */
  it("호텔 자원과 자동 안내문을 하나의 관리 카드에 배치한다", () => {
    expect(mainSource).toContain(
      'className="card admin-property-card admin-hotel-card"',
    );
    expect(mainSource).toContain('className="admin-welcome-section"');
    expect(mainSource).not.toContain('className="card admin-welcome-card"');
  });

  /** 상단 호텔을 이미 골랐는데 안내문에서 다시 고르게 하는 중복 상태와 입력을 막습니다. */
  it("룸 추가 호텔 선택을 자동 안내문에도 공통으로 사용한다", () => {
    expect(mainSource).not.toContain("welcomeHotelId");
    expect(mainSource).toContain(
      "hotels.find((item) => item.id === roomHotelId)",
    );
    expect(mainSource).toContain(
      "updateHotelWelcomeMessage(auth.accessToken, roomHotelId",
    );
    expect(mainSource).toContain('className="welcome-selected-hotel"');
  });
});
