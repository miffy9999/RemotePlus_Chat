const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000/api";
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://127.0.0.1:4000/chat";

export interface GuestSession { id: string; status: "WAITING" | "ACTIVE" | "CLOSED" | "EXPIRED"; language: string; startedAt: string | null; expiresAt: string | null; closedAt: string | null; room: { roomNumber: string; hotel: { name: string } }; }
export interface GuestMessage { id: string; sessionId: string; senderType: "GUEST" | "AGENT" | "SYSTEM"; senderId: string | null; clientMessageId: string; content: string; createdAt: string; }
export interface StoredGuestAccess { session: GuestSession; guestToken: string; }

/** HTTP 상태와 서버 메시지를 함께 보존해 인증 실패와 일시 장애의 저장소 처리 정책을 구분합니다. */
export class GuestApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "GuestApiError"; }
}

/** 투숙객 REST 오류를 화면에서 설명할 수 있도록 서버 메시지를 보존합니다. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const message = Array.isArray(body.message) ? body.message.join(", ") : body.message; throw new GuestApiError(message ?? "서버 요청에 실패했습니다.", response.status); }
  return body as T;
}

/** URL의 접근 키를 검증한 뒤 상담 생성에만 사용하는 단기 JWT를 받습니다. */
export function verifyAccess(accessKey: string) { return request<{ accessToken: string }>("/guest/access/verify", { method: "POST", body: JSON.stringify({ accessKey }) }); }
/** 검증 JWT로 WAITING 상담과 새 투숙객 불투명 토큰을 생성합니다. */
export function createSession(accessToken: string, language: string) { return request<StoredGuestAccess>("/chat-sessions", { method: "POST", headers: { authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ language }) }); }
/** 새 탭·새로고침 후 localStorage의 불투명 토큰이 아직 유효한지 확인합니다. */
export function getSession(sessionId: string, guestToken: string) { return request<GuestSession>(`/chat-sessions/${sessionId}`, { headers: { "x-guest-token": guestToken } }); }
/** 재연결 시 데이터베이스에 저장된 메시지 이력을 복구합니다. */
export function getMessages(sessionId: string, guestToken: string) { return request<GuestMessage[]>(`/chat-sessions/${sessionId}/messages`, { headers: { "x-guest-token": guestToken } }); }
/** 고객이 종료 버튼을 확인했을 때 서버 상태와 Agent 화면을 즉시 CLOSED로 전환합니다. */
export function closeGuestSession(sessionId: string, guestToken: string) { return request<GuestSession>(`/chat-sessions/${sessionId}/guest-close`, { method: "POST", headers: { "x-guest-token": guestToken } }); }
