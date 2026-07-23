export type LoginSaveMode = "NONE" | "ID" | "CREDENTIALS";

export interface LoginPreference {
  mode: LoginSaveMode;
  loginId: string;
}

const LOGIN_PREFERENCE_KEY = "remoteplus-staff-login-preference";

/** 저장소가 차단되거나 값이 손상돼도 빈 로그인 화면으로 안전하게 복구합니다. */
export function readLoginPreference(
  storage: Storage = localStorage,
): LoginPreference {
  try {
    const raw = storage.getItem(LOGIN_PREFERENCE_KEY);
    if (!raw) return { mode: "NONE", loginId: "" };
    const value = JSON.parse(raw) as Partial<LoginPreference>;
    if (
      (value.mode === "ID" || value.mode === "CREDENTIALS") &&
      typeof value.loginId === "string" &&
      value.loginId.trim()
    ) {
      return { mode: value.mode, loginId: value.loginId };
    }
    storage.removeItem(LOGIN_PREFERENCE_KEY);
  } catch {
    // 사생활 보호 모드 등에서 localStorage가 막혀도 로그인 자체는 계속 사용할 수 있습니다.
  }
  return { mode: "NONE", loginId: "" };
}

/** 비밀번호는 받지도 저장하지도 않고 사용자가 고른 모드와 ID만 브라우저 로컬 설정에 기록합니다. */
export function saveLoginPreference(
  mode: LoginSaveMode,
  loginId: string,
  storage: Storage = localStorage,
): void {
  try {
    if (mode === "NONE") {
      storage.removeItem(LOGIN_PREFERENCE_KEY);
      return;
    }
    storage.setItem(
      LOGIN_PREFERENCE_KEY,
      JSON.stringify({
        mode,
        loginId: loginId.trim(),
      } satisfies LoginPreference),
    );
  } catch {
    // 저장 실패는 인증 성공을 막지 않습니다.
  }
}

interface BrowserCredentialEnvironment {
  PasswordCredential?: new (data: {
    id: string;
    name: string;
    password: string;
  }) => unknown;
  store?: (credential: unknown) => Promise<unknown>;
}

/** 지원 브라우저에만 표준 비밀번호 저장을 요청하며 앱 저장소에는 비밀번호를 남기지 않습니다. */
export async function requestBrowserCredentialSave(
  loginId: string,
  password: string,
  environment: BrowserCredentialEnvironment = {
    PasswordCredential: (
      globalThis as typeof globalThis & {
        PasswordCredential?: BrowserCredentialEnvironment["PasswordCredential"];
      }
    ).PasswordCredential,
    store:
      typeof navigator !== "undefined" && navigator.credentials?.store
        ? (navigator.credentials.store.bind(navigator.credentials) as (
            credential: unknown,
          ) => Promise<unknown>)
        : undefined,
  },
): Promise<boolean> {
  if (!environment.PasswordCredential || !environment.store) return false;
  try {
    const credential = new environment.PasswordCredential({
      id: loginId,
      name: loginId,
      password,
    });
    await environment.store(credential);
    return true;
  } catch {
    // 사용자가 저장을 거절하거나 브라우저 정책이 막아도 로그인은 정상 완료합니다.
    return false;
  }
}
