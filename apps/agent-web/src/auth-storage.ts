export type StaffRole = "AGENT" | "ADMIN";

export interface AgentAuth {
  accessToken: string;
  agent: { id: string; name: string; role: StaffRole };
}

const AUTH_KEYS: Record<StaffRole, string> = {
  AGENT: "hotel-chat-agent-auth",
  ADMIN: "hotel-chat-admin-auth",
};

/** JWT 본문을 디코딩하며 형식이 잘못되면 null을 반환합니다. 서명과 계정 상태의 최종 검증은 서버가 담당합니다. */
function readJwtPayload(token: string): { exp?: unknown } | null {
  try {
    const encoded = token.split(".")[1];
    if (!encoded) return null;
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    return JSON.parse(atob(normalized)) as { exp?: unknown };
  } catch {
    return null;
  }
}

/** JWT 본문의 만료 시각을 읽으며 만료 정보가 없거나 형식이 잘못되면 null을 반환합니다. */
export function readJwtExpiresAt(token: string): number | null {
  const payload = readJwtPayload(token);
  return typeof payload?.exp === "number" ? payload.exp * 1000 : null;
}

/** 저장된 인증 객체의 필수 필드, 역할과 JWT 만료 시각을 확인해 손상되거나 만료된 값을 거부합니다. */
export function isStoredAuthValid(value: unknown, role: StaffRole, now = Date.now()): value is AgentAuth {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AgentAuth>;
  if (typeof candidate.accessToken !== "string" || !candidate.agent || candidate.agent.role !== role) return false;
  if (typeof candidate.agent.id !== "string" || typeof candidate.agent.name !== "string") return false;
  const payload = readJwtPayload(candidate.accessToken);
  if (!payload) return false;
  const expiresAt = typeof payload.exp === "number" ? payload.exp * 1000 : null;
  // 현재 직원 토큰은 무기한이므로 exp가 없으면 유효한 저장 형식으로 봅니다. 구버전 exp 토큰은 만료 시 제거합니다.
  return expiresAt === null || expiresAt > now;
}

/** 같은 브라우저 탭 세션에서 인증 정보를 복구하며 손상되거나 만료된 값은 즉시 제거합니다. */
export function readStoredAuth(role: StaffRole, now = Date.now(), storage: Storage = sessionStorage): AgentAuth | null {
  const key = AUTH_KEYS[role];
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredAuthValid(parsed, role, now)) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    // 브라우저가 저장소 사용을 막은 경우에도 앱 자체는 로그인 화면으로 계속 사용할 수 있습니다.
  }
  return null;
}

/** 로그인 성공 정보를 현재 탭의 sessionStorage에 저장해 새로고침에는 유지하고 탭 종료 후에는 제거합니다. */
export function saveStoredAuth(auth: AgentAuth, storage: Storage = sessionStorage): void {
  const key = AUTH_KEYS[auth.agent.role];
  storage.setItem(key, JSON.stringify(auth));
}

/** 명시적 로그아웃 또는 서버의 401 응답 시 현재 탭의 인증 정보를 제거합니다. */
export function clearStoredAuth(role: StaffRole, storage: Storage = sessionStorage): void {
  storage.removeItem(AUTH_KEYS[role]);
}

/** REST API가 인증 만료를 감지했을 때 화면 상태와 저장소를 함께 비우기 위한 브라우저 이벤트입니다. */
export const AUTH_INVALID_EVENT = "hotel-chat:auth-invalid";
