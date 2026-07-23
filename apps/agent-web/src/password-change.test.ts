import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const apiSource = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("직원 비밀번호 변경 UI", () => {
  /** 새 비밀번호 요청은 현재 직원 JWT를 포함해야 다른 계정을 임의로 바꿀 수 없습니다. */
  it("인증된 본인 변경 API만 호출한다", () => {
    expect(apiSource).toContain('request<{ changed: true }>("/auth/change-password"');
    expect(apiSource).toContain("authorization: `Bearer ${token}`");
  });

  /** Chrome이 비밀번호 변경 폼으로 인식하고 저장값을 갱신할 수 있도록 표준 자동완성 의미를 유지합니다. */
  it("현재 비밀번호와 새 비밀번호 자동완성을 구분한다", () => {
    expect(mainSource).toContain('autoComplete="current-password"');
    expect(mainSource.match(/autoComplete="new-password"/g)).toHaveLength(2);
  });

  /** 오타로 계정을 잃지 않도록 두 새 비밀번호가 일치할 때만 서버에 요청합니다. */
  it("새 비밀번호 확인값을 검사하고 성공 후 역할별 저장 토큰을 지운다", () => {
    expect(mainSource).toContain("if (newPassword !== confirmation)");
    expect(mainSource).toContain('clearStoredAuth("ADMIN"); clearStoredAuth("AGENT")');
  });

  /** 세 입력칸은 한꺼번에 노출하지 않고 각 눈 버튼으로 독립 전환하며 접근성 이름을 제공합니다. */
  it("입력칸별 비밀번호 표시 버튼을 제공한다", () => {
    expect(mainSource).toContain("function PasswordField");
    expect(mainSource).toContain('aria-label={t(visible ? "비밀번호 숨기기" : "비밀번호 보기")}');
    expect(mainSource.match(/<PasswordField/g)).toHaveLength(3);
  });
});
