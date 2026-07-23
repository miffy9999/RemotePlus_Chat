import { describe, expect, it, vi } from "vitest";
import {
  readLoginPreference,
  requestBrowserCredentialSave,
  saveLoginPreference,
} from "./login-preferences";

/** 브라우저 저장소가 없는 단위 테스트에서도 실제 Storage와 같은 계약으로 저장 동작을 검증합니다. */
function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe("직원 로그인 저장 선택", () => {
  it("아이디 저장 모드에는 ID와 모드만 남긴다", () => {
    const storage = memoryStorage();
    saveLoginPreference("ID", " agent01 ", storage);
    expect(readLoginPreference(storage)).toEqual({
      mode: "ID",
      loginId: "agent01",
    });
    expect(
      [...Array(storage.length)]
        .map((_, index) => storage.getItem(storage.key(index)!))
        .join(),
    ).not.toContain("password");
  });

  it("선택 해제 시 저장된 ID도 제거한다", () => {
    const storage = memoryStorage();
    saveLoginPreference("CREDENTIALS", "admin", storage);
    saveLoginPreference("NONE", "admin", storage);
    expect(readLoginPreference(storage)).toEqual({
      mode: "NONE",
      loginId: "",
    });
  });

  it("로그인 정보 저장은 브라우저 비밀번호 관리자에 위임한다", async () => {
    const store = vi.fn(async () => undefined);
    class FakePasswordCredential {
      constructor(readonly data: unknown) {}
    }
    expect(
      await requestBrowserCredentialSave("admin", "secret", {
        PasswordCredential: FakePasswordCredential,
        store,
      }),
    ).toBe(true);
    expect(store).toHaveBeenCalledOnce();
  });

  it("비밀번호 관리자를 지원하지 않아도 로그인 흐름을 막지 않는다", async () => {
    expect(
      await requestBrowserCredentialSave("admin", "secret", {}),
    ).toBe(false);
  });
});
