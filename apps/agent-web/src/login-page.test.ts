import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("직원 로그인 화면 문구", () => {
  it("요청하지 않은 설명은 숨기고 로그인과 저장 동작은 유지한다", () => {
    expect(mainSource).not.toContain("상담 센터 계정으로 로그인하세요.");
    expect(mainSource).not.toContain("로그인 정보 저장은 브라우저 비밀번호 관리자를 사용합니다.");
    expect(mainSource).not.toContain("계정 역할에 따라 관리 또는 상담 화면으로 이동합니다.");
    expect(mainSource).toContain('t("아이디 저장")');
    expect(mainSource).toContain('t("로그인 정보 저장")');
    expect(mainSource.match(/type="checkbox"/g)).toHaveLength(2);
    expect(mainSource).not.toContain('aria-pressed={saveMode');
    expect(mainSource).toContain('t(loading ? "로그인 중…" : "로그인")');
  });
});
