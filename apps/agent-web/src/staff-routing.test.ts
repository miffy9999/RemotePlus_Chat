import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  ADMIN_AGENT_WORKSPACE_PATH,
  ADMIN_DASHBOARD_PATH,
  AGENT_WORKSPACE_PATH,
  canAccessStaffPath,
  staffHomePath,
} from "./staff-routing";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("직원 역할별 로그인 이동", () => {
  /** 관리자는 로그인과 새로고침 뒤 Dashboard가 아니라 관리자 전용 상담 화면에서 시작해야 합니다. */
  it("ADMIN을 관리자 Agent 화면으로 보낸다", () => {
    expect(staffHomePath("ADMIN")).toBe(ADMIN_AGENT_WORKSPACE_PATH);
  });

  /** Agent는 관리자 화면을 거치지 않고 상담 목록으로 바로 진입해야 합니다. */
  it("AGENT를 상담 페이지로 보낸다", () => {
    expect(staffHomePath("AGENT")).toBe(AGENT_WORKSPACE_PATH);
  });

  /** 관리자는 같은 ADMIN 인증으로 Dashboard와 전체 상담 조회 화면을 왕복할 수 있어야 합니다. */
  it("ADMIN에게 Dashboard와 관리자 Agent 조회 경로를 모두 허용한다", () => {
    expect(canAccessStaffPath("ADMIN", ADMIN_DASHBOARD_PATH)).toBe(true);
    expect(canAccessStaffPath("ADMIN", ADMIN_AGENT_WORKSPACE_PATH)).toBe(true);
    expect(canAccessStaffPath("ADMIN", AGENT_WORKSPACE_PATH)).toBe(false);
  });

  /** 일반 Agent는 명확한 Agent 경로만 사용하며 관리자 전용 버튼과 경로에 접근할 수 없어야 합니다. */
  it("AGENT에게 관리자 전용 두 경로를 허용하지 않는다", () => {
    expect(canAccessStaffPath("AGENT", AGENT_WORKSPACE_PATH)).toBe(true);
    expect(canAccessStaffPath("AGENT", ADMIN_DASHBOARD_PATH)).toBe(false);
    expect(canAccessStaffPath("AGENT", ADMIN_AGENT_WORKSPACE_PATH)).toBe(false);
  });

  /** 이동 버튼은 브라우저 뒤로가기가 아니라 고정된 목적지 경로를 사용해야 합니다. */
  it("방문 기록에 의존하지 않는 양방향 경로를 렌더링한다", () => {
    expect(mainSource).toContain("navigate(ADMIN_AGENT_WORKSPACE_PATH)");
    expect(mainSource).toContain("navigate(ADMIN_DASHBOARD_PATH)");
    expect(mainSource).not.toContain("navigate(-1)");
    expect(mainSource).not.toContain("history.back()");
  });

  /** 로그인 화면과 저장된 인증 자동 이동이 같은 시작 경로 함수를 사용해야 합니다. */
  it("로그인 직후와 저장 인증 복구 모두 staffHomePath를 사용한다", () => {
    expect(mainSource).toContain("navigate(staffHomePath(auth.agent.role))");
    expect(mainSource).toContain(
      "<Navigate to={staffHomePath(staffAuth.agent.role)} replace />",
    );
  });

  /** 역할 선택이나 관리자 전용 로그인 폼이 다시 생겨 통합 진입 흐름이 분리되는 회귀를 막습니다. */
  it("단일 로그인 화면만 사용한다", () => {
    expect(mainSource).not.toContain("RoleSelection");
    expect(mainSource).not.toContain("function AdminLogin");
    expect(mainSource).toContain("loginStaff(loginId, password)");
  });

  /** 특정 테스트 Agent ID는 하드코딩하지 않고 사용자가 명시적으로 저장한 ID만 복원합니다. */
  it("저장 선택이 없으면 빈 ID로 시작한다", () => {
    expect(mainSource).toContain("useState(readLoginPreference)");
    expect(mainSource).toContain("useState(initialPreference.loginId)");
    expect(mainSource).not.toContain('useState("agent01")');
  });

  /** 직원 토큰 저장과 별개로 ID·브라우저 비밀번호 관리자 선택을 로그인 화면에서 제공합니다. */
  it("두 로그인 저장 버튼을 제공한다", () => {
    expect(mainSource).toContain('t("아이디 저장")');
    expect(mainSource).toContain('t("로그인 정보 저장")');
    expect(mainSource).toContain('saveMode === "CREDENTIALS"');
  });
});
