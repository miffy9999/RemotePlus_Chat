import type { SessionView } from "./api";

/** 완료 상태만 공동 상담 로그에 포함하고 선택한 호텔 ID가 있으면 해당 호텔 기록만 반환합니다. */
export function filterConversationLogs(sessions: readonly SessionView[], hotelId: string): SessionView[] {
  return sessions.filter((session) =>
    ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"].includes(session.status)
      && (!hotelId || session.room.hotel.id === hotelId),
  );
}
