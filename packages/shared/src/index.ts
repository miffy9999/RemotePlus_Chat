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
  inboxUpdated: "chat:inbox-updated",
  sessionRead: "chat:session-read",
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

const JAPANESE_HTTP_ERRORS: Record<number, string> = {
  400: "入力内容を確認してください。",
  401: "認証情報が無効です。もう一度ログインしてください。",
  403: "この操作を行う権限がありません。",
  404: "指定されたデータが見つかりません。",
  409: "ほかの操作と重複しました。画面を更新してもう一度お試しください。",
  413: "画像のサイズが大きすぎます。2MB以下の画像を選択してください。",
  429: "リクエストが多すぎます。しばらくしてからもう一度お試しください。",
};

/** 서버·브라우저의 한국어/영어 원문을 일본 운영 화면에 그대로 노출하지 않습니다. */
export function toJapaneseUserMessage(message: unknown, status?: number): string {
  const text = typeof message === "string" ? message.trim() : "";
  if (status !== undefined && JAPANESE_HTTP_ERRORS[status]) return JAPANESE_HTTP_ERRORS[status];
  if (/リクエストが多すぎ|メッセージの送信が多すぎ/.test(text)) return JAPANESE_HTTP_ERRORS[429];
  if (/요청이 너무 많|메시지를 너무 빠르게|too many requests/i.test(text)) return JAPANESE_HTTP_ERRORS[429];
  // 이미 일본어로 정리된 서버 메시지는 구체적인 안내를 보존합니다.
  if (/[ぁ-んァ-ヶ]/.test(text)) return text;
  if (status !== undefined && status >= 500) return "サーバーでエラーが発生しました。しばらくしてからもう一度お試しください。";
  if (!text || /failed to fetch|networkerror|network request failed/i.test(text)) return "サーバーに接続できません。通信状態を確認してもう一度お試しください。";
  return "処理を完了できませんでした。もう一度お試しください。";
}
