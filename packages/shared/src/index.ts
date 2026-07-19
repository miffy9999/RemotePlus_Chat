/** 상담의 전체 상태입니다. CANCELLED와 BLOCKED는 후속 관리 기능을 위해 미리 유지합니다. */
export type ChatSessionStatus =
  | "WAITING"
  | "ACTIVE"
  | "CLOSED"
  | "EXPIRED"
  | "CANCELLED"
  | "BLOCKED";

/** 로그인 계정의 역할이며, 서버와 화면 모두 이 값을 기준으로 접근 영역을 분리합니다. */
export type StaffRole = "ADMIN" | "AGENT";

/** MVP에서 사용하는 WebSocket 이벤트 이름을 한곳에서 관리해 오타와 계약 불일치를 방지합니다. */
export const CHAT_EVENTS = {
  join: "chat:join",
  message: "chat:message",
  accepted: "chat:message-accepted",
  sessionUpdated: "chat:session-updated",
  sessionClosed: "chat:session-closed",
  error: "chat:error",
} as const;

/** 클라이언트가 메시지를 보낼 때 사용하는 최소 계약입니다. */
export interface SendChatMessage {
  sessionId: string;
  clientMessageId: string;
  content: string;
}

/** 채팅방 입장 요청은 반드시 상담 ID를 포함하며 서버가 다시 권한을 검사합니다. */
export interface JoinChatSession {
  sessionId: string;
}

/** 서버가 저장을 마친 뒤 양쪽에 전달하는 메시지 형태입니다. */
export interface ChatMessageView extends SendChatMessage {
  id: string;
  senderType: "GUEST" | "AGENT" | "SYSTEM";
  senderId: string | null;
  messageType: "TEXT";
  createdAt: string;
}
