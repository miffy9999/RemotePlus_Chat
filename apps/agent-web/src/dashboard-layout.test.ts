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

  /** 로고와 설정 메뉴가 사이드바 폭에 갇히지 않고 화면 전체 상단을 사용해야 합니다. */
  it("Agent 공통 메뉴를 전체 너비 상단 메뉴바로 렌더링한다", () => {
    expect(mainSource).toContain('className="line-agent-shell"');
    expect(mainSource).toContain('className="line-agent-topbar"');
    expect(styles).toMatch(
      /\.line-agent-topbar\s*\{[^}]*width:\s*100%;[^}]*display:\s*flex;[^}]*border-bottom:/,
    );
    expect(styles).toMatch(
      /\.line-agent-topbar-actions\s*\{[^}]*margin-left:\s*auto;/,
    );
    expect(styles).toContain(
      ".line-agent-topbar .language-switcher > span { white-space: nowrap; }",
    );
  });

  /** 시각적 CSS 순서에 의존하지 않고 DOM 자체가 요구된 메뉴 순서를 보장해야 합니다. */
  it("로고는 왼쪽, 프로필과 이름은 오른쪽 설정 메뉴의 첫 항목에 배치한다", () => {
    const topbarStart = mainSource.indexOf('<header className="line-agent-topbar">');
    const topbarEnd = mainSource.indexOf("</header>", topbarStart);
    const topbar = mainSource.slice(topbarStart, topbarEnd);
    const actionsStart = topbar.indexOf('className="line-agent-topbar-actions"');
    const actions = topbar.slice(actionsStart);

    expect(topbarStart).toBeGreaterThan(-1);
    expect(topbar.indexOf('className="agent-brand"')).toBeLessThan(actionsStart);
    expect(actions.indexOf('className="line-agent-account"')).toBeLessThan(actions.indexOf("<strong>{auth.agent.name}</strong>"));
    expect(actions.indexOf('aria-hidden="true"')).toBeLessThan(actions.indexOf("<strong>{auth.agent.name}</strong>"));
    expect(actions.indexOf("<strong>{auth.agent.name}</strong>")).toBeLessThan(actions.indexOf("<LanguageSwitcher/>"));
    expect(actions.indexOf("<LanguageSwitcher/>")).toBeLessThan(actions.indexOf('className="line-agent-controls"'));
    expect(actions.indexOf("notificationButtonLabel")).toBeLessThan(actions.indexOf('onClick={() => setShowPasswordChange(true)}'));
    expect(actions.indexOf('onClick={() => setShowPasswordChange(true)}')).toBeLessThan(actions.indexOf("onClick={logout}"));
    expect(mainSource).not.toContain("auth.agent.loginId");
  });

  /** 수신음은 제거하되 백그라운드 브라우저 알림과 계정 기능은 유지해야 합니다. */
  it("상단 메뉴에서 언어·무음 알림·비밀번호·로그아웃 기능을 유지한다", () => {
    expect(mainSource).toContain("<LanguageSwitcher/>");
    expect(mainSource).toContain("notificationButtonLabel");
    expect(mainSource).toContain("onClick={() => void enableBrowserNotifications()}");
    expect(mainSource).toContain('onClick={() => setShowPasswordChange(true)}');
    expect(mainSource).toContain("onClick={logout}");
    expect(mainSource).not.toContain("toggleNotificationSound");
    expect(mainSource).not.toContain("playNotificationSound");
  });

  /** 사이드바에는 상담 탐색 요소만 남고 공통 메뉴가 중복 렌더링되지 않아야 합니다. */
  it("사이드바를 Current/Log 탭부터 시작하고 사용자 메뉴를 제거한다", () => {
    const sidebarStart = mainSource.indexOf('<aside className="line-agent-list">');
    const sidebarEnd = mainSource.indexOf("</aside>", sidebarStart);
    const sidebar = mainSource.slice(sidebarStart, sidebarEnd);

    expect(sidebar).toContain('className="line-inbox-tabs"');
    expect(sidebar).toContain('t("Current chat room")');
    expect(sidebar).toContain('t("Log")');
    expect(sidebar).not.toContain('className="agent-brand"');
    expect(sidebar).not.toContain('className="line-agent-account"');
    expect(sidebar).not.toContain("<LanguageSwitcher/>");
    expect(sidebar).not.toContain('className="line-agent-controls"');
  });

  /** ADMIN Agent 조회 화면에서는 Dashboard 복귀 버튼을 로고 바로 뒤에 두고 일반 Agent에는 조건부로 숨깁니다. */
  it("관리자 Agent 화면의 로고 다음에 Dashboard 이동 버튼을 제공한다", () => {
    const topbarStart = mainSource.indexOf('<header className="line-agent-topbar">');
    const topbarEnd = mainSource.indexOf("</header>", topbarStart);
    const topbar = mainSource.slice(topbarStart, topbarEnd);

    expect(topbar.indexOf('className="agent-brand"')).toBeLessThan(
      topbar.indexOf('className="line-agent-admin-link secondary"'),
    );
    expect(topbar).toContain("isAdminView &&");
    expect(topbar).toContain("navigate(ADMIN_DASHBOARD_PATH)");
  });

  /** Dashboard의 이동 버튼도 로고와 같은 왼쪽 묶음에 있으며 뒤로가기에 의존하지 않아야 합니다. */
  it("Admin Dashboard 로고 오른쪽에 Agent 페이지 이동 버튼을 제공한다", () => {
    const headingStart = mainSource.indexOf('className="admin-heading"');
    const headingEnd = mainSource.indexOf("<h1>", headingStart);
    const heading = mainSource.slice(headingStart, headingEnd);

    expect(heading).toContain('className="admin-brand-row"');
    expect(heading.indexOf('className="brand dark"')).toBeLessThan(
      heading.indexOf('className="secondary admin-agent-link"'),
    );
    expect(heading).toContain("navigate(ADMIN_AGENT_WORKSPACE_PATH)");
  });

  /** 관리자 특별 조회에서는 전체 진행 상담을 보되 배정·메시지·종료 동작을 실행하지 않습니다. */
  it("ADMIN Agent 화면을 전체 상담 읽기 전용 모드로 유지한다", () => {
    expect(mainSource).toContain('const isAdminView = auth.agent.role === "ADMIN"');
    expect(mainSource).toContain("if (isAdminView) {");
    expect(mainSource).toContain("adminReadOnly={isAdminView}");
    expect(mainSource).toContain("관리자 조회 모드입니다.");
    expect(mainSource).toContain("clearStoredAuth(auth.agent.role)");
  });

  /** 대화방을 연 것만으로 시간을 차감하지 않고 첫 답변 전 입력과 안내 문구를 유지해야 합니다. */
  it("첫 Agent 답변 전에는 만료시각 없이 입력할 수 있고 서버 갱신 이벤트로 타이머를 시작한다", () => {
    expect(mainSource).toContain('socket.on("chat:session-updated"');
    expect(mainSource).toContain('session.expiresAt === null ||');
    expect(mainSource).toContain('t("첫 답변 후 15분")');
  });

  /** Dashboard 전용 상담 로그만 제거하고 Agent 화면의 Log 탭은 계속 제공해야 합니다. */
  it("관리자 Dashboard에는 호텔·Agent만 남기고 Agent Log는 유지한다", () => {
    expect(mainSource).toContain('className="admin-navigation"');
    expect(mainSource).toContain('setActiveAdminSection("hotels")');
    expect(mainSource).toContain('setActiveAdminSection("agents")');
    expect(mainSource).not.toContain('setActiveAdminSection("logs")');
    expect(mainSource).not.toContain('activeAdminSection === "logs"');
    expect(mainSource).toContain('t("Log")');
    expect(mainSource).toContain("const logSessions = useMemo");
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

  /** DB와 API의 실제 agent 관계를 목록과 상세 헤더에 표시하고 미배정 문구도 제공해야 합니다. */
  it("채팅 목록과 상세 헤더에 실제 담당 Agent를 표시한다", () => {
    expect(mainSource.match(/t\("담당 상담원"\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(mainSource.match(/session\.agent\?\.name \?\? t\("담당자 없음"\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(mainSource).not.toContain("auth.agent.name ??");
  });

  /** ADMIN 읽기 전용 상세도 다른 Agent의 수락 이벤트를 받아 담당자와 상태를 즉시 바꿔야 합니다. */
  it("수락·종료 실시간 이벤트를 목록과 선택 상세에 함께 반영한다", () => {
    expect(mainSource).toContain('socket.on("chat:session-updated", applyRealtimeSession)');
    expect(mainSource).toContain('socket.on("chat:session-closed", applyRealtimeSession)');
    expect(mainSource).toContain("setSessions((items) =>");
    expect(mainSource).toContain("setSelected((current) =>");
  });

  /** ADMIN은 쓰기 권한 없이 상담방을 구독해 Agent와 Guest의 새 메시지를 즉시 읽어야 합니다. */
  it("관리자 읽기 전용 진행 상담도 WebSocket 상담방에 입장한다", () => {
    expect(mainSource).toContain("const shouldJoinRealtime =");
    expect(mainSource).toContain(
      'adminReadOnly &&\n        (session.status === "WAITING" || session.status === "ACTIVE")',
    );
    expect(mainSource).toContain(
      'socket.emitWithAck("chat:join", { sessionId: session.id })',
    );
    expect(mainSource).toContain(
      'socket.on("chat:message", (message: MessageView) => setMessages',
    );
    expect(mainSource).toContain(
      'if (!content || readOnly || session.status !== "ACTIVE"',
    );
  });

  /** 타이머 다음에 종료 버튼을 렌더링하고 action 그룹을 오른쪽 끝으로 보내야 합니다. */
  it("만료 시간과 종료 버튼을 헤더 오른쪽에 순서대로 배치한다", () => {
    const headerStart = mainSource.indexOf('<header className="line-conversation-header">');
    const headerEnd = mainSource.indexOf("</header>", headerStart);
    const header = mainSource.slice(headerStart, headerEnd);

    expect(header.indexOf('className="line-conversation-actions"')).toBeGreaterThan(-1);
    expect(header.indexOf('aria-label={t("채팅 만료 시간")}')).toBeLessThan(
      header.indexOf('onClick={() => setShowCloseConfirm(true)}'),
    );
    expect(styles).toMatch(
      /\.line-conversation-actions\s*\{[^}]*margin-left:\s*auto;/,
    );
    expect(styles).not.toContain(".line-conversation-actions { position: absolute");
  });

  /** Agent 미선택 안내에서는 전용 초록색 R 요소 자체를 만들지 않아야 합니다. */
  it("Current와 Log 공용 빈 상태에서 초록색 R 로고를 렌더링하지 않는다", () => {
    const placeholderStart = mainSource.indexOf(
      '<section className="line-conversation-placeholder">',
    );
    const placeholderEnd = mainSource.indexOf("</section>", placeholderStart);
    const placeholder = mainSource.slice(placeholderStart, placeholderEnd);

    expect(placeholder).toContain('t(mode === "current" ? "대화를 선택하세요" : "상담 기록을 선택하세요")');
    expect(placeholder).not.toContain("<div>R");
    expect(styles).not.toContain(".line-conversation-placeholder > div");
  });

  /** null은 전체 호텔, UUID 문자열은 특정 호텔이며 별도 select를 다시 만들지 않아야 합니다. */
  it("전체 호텔 버튼을 첫 번째로 두고 null 필터를 API 생략값으로 사용한다", () => {
    const chipsStart = mainSource.indexOf('<div className="hotel-chip-list">');
    const chipsEnd = mainSource.indexOf("</div>", chipsStart);
    const chips = mainSource.slice(chipsStart, chipsEnd);

    expect(mainSource).toContain(
      "useState<string | null>(null)",
    );
    expect(mainSource).toContain(
      "listRooms(auth.accessToken, selectedHotelId ?? undefined)",
    );
    expect(chips.indexOf('t("전체 호텔")')).toBeLessThan(
      chips.indexOf("hotels.map"),
    );
    expect(chips).toContain("setSelectedHotelId(null)");
    expect(chips).toContain("setSelectedHotelId(hotel.id)");
    expect(mainSource).not.toContain('className="filter"');
  });
});
