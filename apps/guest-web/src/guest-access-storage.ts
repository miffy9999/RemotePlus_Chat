import type { GuestSession, StoredGuestAccess } from "./api";

/** 객실 접근 키마다 다른 기기 저장소 항목을 사용해 서로 다른 객실 상담 정보가 섞이지 않게 합니다. */
function storageKey(accessKey: string): string {
  return `hotel-chat-guest:${accessKey}`;
}

/**
 * WAITING과 첫 Agent 답변 전 ACTIVE는 만료시각이 없어도 정상 진행 상태입니다.
 * 첫 답변 뒤에는 서버가 준 절대 만료시각만 사용해 복구와 입력 가능 여부를 동일하게 판단합니다.
 */
export function isGuestSessionOpen(
  session: Pick<GuestSession, "status" | "expiresAt">,
  nowMs: number = Date.now(),
): boolean {
  if (session.status === "WAITING") return true;
  if (session.status !== "ACTIVE") return false;
  if (session.expiresAt === null) return true;
  const expiresAt = new Date(session.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > nowMs;
}

/**
 * 브라우저 저장값은 사용자가 개발자 도구에서 바꾸거나 확장 프로그램·비정상 종료로 손상될 수 있습니다.
 * 서버 재검증에 꼭 필요한 세션 ID와 불투명 토큰의 형태만 먼저 확인하고 나머지 세션 정보는 서버 응답으로 교체합니다.
 */
function isStoredGuestAccess(value: unknown): value is StoredGuestAccess {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { guestToken?: unknown; session?: { id?: unknown; status?: unknown; expiresAt?: unknown } };
  return typeof candidate.guestToken === "string" && candidate.guestToken.length > 0
    && typeof candidate.session === "object" && candidate.session !== null
    && typeof candidate.session.id === "string" && candidate.session.id.length > 0
    && typeof candidate.session.status === "string"
    && (typeof candidate.session.expiresAt === "string" || candidate.session.expiresAt === null);
}

/**
 * 저장된 상담 복구 정보를 읽습니다.
 * JSON 파싱 실패나 필수 식별자 누락 시 그 접근 키의 값만 제거하고 null을 반환해 신규 상담 화면으로 복구하게 합니다.
 */
export function readStoredGuestAccess(accessKey: string, storage: Storage = localStorage, nowMs: number = Date.now()): StoredGuestAccess | null {
  const key = storageKey(accessKey);
  const raw = storage.getItem(key);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isStoredGuestAccess(parsed)) {
      // WAITING과 첫 답변 전 ACTIVE는 만료시각이 null이어도 삭제하지 않습니다.
      if (isGuestSessionOpen(parsed.session, nowMs)) return parsed;
    }
  } catch { /* 아래 공통 정리에서 손상된 JSON을 제거합니다. */ }
  storage.removeItem(key);
  return null;
}

/** 상담 생성 성공 결과만 저장해 새로고침 시 같은 상담으로 복귀할 수 있게 합니다. */
export function saveStoredGuestAccess(accessKey: string, access: StoredGuestAccess, storage: Storage = localStorage): void {
  storage.setItem(storageKey(accessKey), JSON.stringify(access));
}

/** 서버가 저장된 토큰을 거부하면 해당 객실 항목만 제거하고 다른 객실 탭 데이터는 보존합니다. */
export function clearStoredGuestAccess(accessKey: string, storage: Storage = localStorage): void {
  storage.removeItem(storageKey(accessKey));
}
