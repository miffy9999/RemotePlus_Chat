import { describe, expect, it } from "vitest";
import { clearStoredAuth, isStoredAuthValid, readStoredAuth, saveStoredAuth, type AgentAuth } from "./auth-storage";

/** 테스트 시각을 기준으로 만료 시간이 담긴 최소 JWT 모양의 문자열을 만듭니다. 서명 검증은 실제 서버가 담당합니다. */
function token(exp: number): string {
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

function tokenWithoutExpiry(): string { return `header.${btoa(JSON.stringify({ kind: "staff" }))}.signature`; }

/** 브라우저 Storage 계약 중 인증 코드가 사용하는 동작만 메모리로 구현합니다. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("직원 로그인 영속 저장", () => {
  const auth: AgentAuth = { accessToken: token(2_000), agent: { id: "agent-id", name: "Agent", role: "AGENT" } };

  it("유효한 역할과 만료 시각의 인증만 허용한다", () => {
    expect(isStoredAuthValid(auth, "AGENT", 1_000_000)).toBe(true);
    expect(isStoredAuthValid(auth, "ADMIN", 1_000_000)).toBe(false);
    expect(isStoredAuthValid(auth, "AGENT", 2_000_000)).toBe(false);
  });

  it("24시간 콜센터용 만료 없는 직원 JWT를 sessionStorage에서 허용한다", () => {
    expect(isStoredAuthValid({ ...auth, accessToken: tokenWithoutExpiry() }, "AGENT", 9_999_999)).toBe(true);
  });

  it("sessionStorage 저장과 로그아웃 시 역할별 인증 값만 변경한다", () => {
    const storage = memoryStorage();
    saveStoredAuth(auth, storage);
    expect(readStoredAuth("AGENT", 1_000_000, storage)).toEqual(auth);
    clearStoredAuth("AGENT", storage);
    expect(storage.length).toBe(0);
  });

  it("만료된 sessionStorage 인증을 복구하지 않고 제거한다", () => {
    const storage = memoryStorage();
    storage.setItem("hotel-chat-agent-auth", JSON.stringify(auth));
    expect(readStoredAuth("AGENT", 2_000_000, storage)).toBeNull();
    expect(storage.length).toBe(0);
  });
});
