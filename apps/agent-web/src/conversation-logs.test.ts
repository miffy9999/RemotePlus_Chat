import { describe, expect, it } from "vitest";
import type { SessionView } from "./api";
import { filterConversationLogs } from "./conversation-logs";

function session(id: string, status: SessionView["status"], hotelId: string): SessionView {
  return { id, status, language: "ja", agentId: null, agent: null, startedAt: null, expiresAt: "2026-07-22T00:00:00.000Z", closedAt: null, createdAt: "2026-07-22T00:00:00.000Z", room: { roomNumber: "101", hotel: { id: hotelId, name: hotelId } } };
}

describe("공동 상담 로그 필터", () => {
  it("진행 상담을 제외하고 모든 완료 상담을 공유한다", () => {
    const sessions = [session("active", "ACTIVE", "hotel-a"), session("closed", "CLOSED", "hotel-a"), session("expired", "EXPIRED", "hotel-b")];
    expect(filterConversationLogs(sessions, "").map((item) => item.id)).toEqual(["closed", "expired"]);
  });

  it("선택한 호텔의 완료 상담만 반환한다", () => {
    const sessions = [session("a", "CLOSED", "hotel-a"), session("b", "CLOSED", "hotel-b")];
    expect(filterConversationLogs(sessions, "hotel-b").map((item) => item.id)).toEqual(["b"]);
  });
});
