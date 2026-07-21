const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000/api";

/** 서버가 반환하는 상담 화면용 최소 타입입니다. */
export interface SessionView {
  id: string;
  status: "WAITING" | "ACTIVE" | "CLOSED" | "EXPIRED" | "CANCELLED" | "BLOCKED";
  language: string;
  agentId: string | null;
  startedAt: string | null;
  expiresAt: string;
  closedAt: string | null;
  room: { roomNumber: string; hotel: { name: string } };
}

export interface MessageView {
  id: string;
  sessionId: string;
  senderType: "GUEST" | "AGENT" | "SYSTEM";
  senderId: string | null;
  clientMessageId: string;
  content: string;
  createdAt: string;
}

/** 모든 REST 요청에서 오류 본문을 읽어 사용자가 이해할 수 있는 메시지로 바꿉니다. */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    throw new Error(message ?? "서버 요청에 실패했습니다.");
  }
  return body as T;
}

/** Agent 로그인 후 REST와 WebSocket에서 함께 사용하는 짧은 JWT를 반환합니다. */
export function login(loginId: string, password: string) {
  return request<{ accessToken: string; agent: { id: string; name: string; role: "AGENT" } }>("/auth/agent/login", { method: "POST", body: JSON.stringify({ loginId, password }) });
}

/** 상태 필터 없이 전체 목록을 받아 화면에서 역할과 탭에 맞게 나눕니다. */
export function listSessions(token: string) {
  return request<SessionView[]>("/agent/chat-sessions", { headers: { authorization: `Bearer ${token}` } });
}

/** WAITING 상담을 현재 Agent에게 원자적으로 배정합니다. */
export function acceptSession(token: string, sessionId: string) {
  return request<SessionView>(`/agent/chat-sessions/${sessionId}/accept`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
}

/** 재접속 시 DB에 저장된 메시지를 생성 순서대로 복구합니다. */
export function getMessages(token: string, sessionId: string) {
  return request<MessageView[]>(`/chat-sessions/${sessionId}/messages`, { headers: { authorization: `Bearer ${token}` } });
}

/** 담당 Agent가 상담을 직접 종료하고 양쪽 Socket에 종료 이벤트가 전달되게 합니다. */
export function closeSession(token: string, sessionId: string) {
  return request<SessionView>(`/chat-sessions/${sessionId}/close`, { method: "POST", headers: { authorization: `Bearer ${token}` } });
}

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? "http://127.0.0.1:4000/chat";

export interface AdminAgentView { id: string; name: string; loginId: string; role: "AGENT"; status: "ACTIVE" | "INACTIVE"; createdAt: string }
export interface HotelView { id: string; name: string; status: "ACTIVE" | "INACTIVE"; createdAt: string }
export interface RoomView { id: string; hotelId: string; roomNumber: string; status: "ACTIVE" | "INACTIVE"; createdAt: string; hotel: HotelView; guestUrl: string | null }
/** 관리자 로그인과 관리 API는 ADMIN 역할 JWT를 요구해 Agent 상담 권한과 분리합니다. */
export function loginAdmin(loginId: string, password: string) { return request<{ accessToken: string; agent: { id: string; name: string; role: "ADMIN" } }>("/auth/admin/login", { method: "POST", body: JSON.stringify({ loginId, password }) }); }
export function listAdminAgents(token: string) { return request<AdminAgentView[]>("/admin/agents", { headers: { authorization: `Bearer ${token}` } }); }
export function createAdminAgent(token: string, input: { name: string; loginId: string; password: string }) { return request<AdminAgentView>("/admin/agents", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ ...input, role: "AGENT" }) }); }
/** 관리자 확인을 거친 Agent 계정을 삭제하며 기존 상담 기록은 서버가 보존합니다. */
export function deleteAdminAgent(token: string, id: string) { return request<{ deletedId: string }>(`/admin/agents/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }); }
export function listHotels(token: string) { return request<HotelView[]>("/admin/hotels", { headers: { authorization: `Bearer ${token}` } }); }
export function createHotel(token: string, name: string) { return request<HotelView>("/admin/hotels", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ name }) }); }
/** 호텔과 모든 하위 룸·상담 데이터의 연쇄 삭제를 서버에 요청합니다. */
export function deleteHotel(token: string, id: string) { return request<{ deletedId: string }>(`/admin/hotels/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }); }
export function listRooms(token: string, hotelId?: string) { return request<RoomView[]>(`/admin/rooms${hotelId ? `?hotelId=${encodeURIComponent(hotelId)}` : ""}`, { headers: { authorization: `Bearer ${token}` } }); }
export function createRoom(token: string, hotelId: string, roomNumber: string) { return request<RoomView>("/admin/rooms", { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ hotelId, roomNumber }) }); }
/** 룸과 연결된 접근키·상담·메시지를 함께 삭제하도록 서버에 요청합니다. */
export function deleteRoom(token: string, id: string) { return request<{ deletedId: string }>(`/admin/rooms/${id}`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } }); }
