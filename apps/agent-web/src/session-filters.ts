import type { SessionView } from "./api";

export interface AgentSessionFilters {
  search: string;
  hotel: string;
  language: string;
}

/**
 * 상담 목록의 검색·호텔·언어 조건을 한곳에서 적용합니다.
 * 언어 코드는 API와 select 표시 형식이 달라도 동작하도록 양쪽을 소문자로 정규화합니다.
 */
export function filterAgentSessions(
  sessions: SessionView[],
  filters: AgentSessionFilters,
): SessionView[] {
  const needle = filters.search.trim().toLowerCase();
  const language = filters.language.trim().toLowerCase();

  return sessions.filter((session) => {
    const searchable =
      `${session.room.hotel.name} ${session.room.roomNumber} ${session.lastMessage?.content ?? ""} ${session.agent?.name ?? ""}`.toLowerCase();
    const sessionLanguage = session.language.trim().toLowerCase();

    return (
      (!needle || searchable.includes(needle)) &&
      (!filters.hotel || session.room.hotel.id === filters.hotel) &&
      (!language || sessionLanguage === language)
    );
  });
}
