import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { staffHomePath } from "./staff-routing";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("직원 역할별 로그인 이동", () => {
  /** 관리자는 상담 화면을 거치지 않고 관리 기능으로 바로 진입해야 합니다. */
  it("ADMIN을 관리자 페이지로 보낸다", () => {
    expect(staffHomePath("ADMIN")).toBe("/admin");
  });

  /** Agent는 관리자 화면을 거치지 않고 상담 목록으로 바로 진입해야 합니다. */
  it("AGENT를 상담 페이지로 보낸다", () => {
    expect(staffHomePath("AGENT")).toBe("/agent");
  });

  /** 역할 선택이나 관리자 전용 로그인 폼이 다시 생겨 통합 진입 흐름이 분리되는 회귀를 막습니다. */
  it("단일 로그인 화면만 사용한다", () => {
    expect(mainSource).not.toContain("RoleSelection");
    expect(mainSource).not.toContain("function AdminLogin");
    expect(mainSource).toContain("loginStaff(loginId, password)");
  });
});
