import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionView } from "./api";
import { listSessions } from "./api";
import { filterConversationLogs } from "./conversation-logs";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

function session(id: string, status: SessionView["status"], hotelId: string): SessionView {
  return { id, status, language: "ja", agentId: null, agent: null, startedAt: null, expiresAt: "2026-07-22T00:00:00.000Z", closedAt: null, createdAt: "2026-07-22T00:00:00.000Z", room: { roomNumber: "101", hotel: { id: hotelId, name: hotelId } } };
}

describe("공동 상담 로그 필터", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("진행 상담을 제외하고 모든 완료 상담을 공유한다", () => {
    const sessions = [session("active", "ACTIVE", "hotel-a"), session("closed", "CLOSED", "hotel-a"), session("expired", "EXPIRED", "hotel-b")];
    expect(filterConversationLogs(sessions, "").map((item) => item.id)).toEqual(["closed", "expired"]);
  });

  it("선택한 호텔의 완료 상담만 반환한다", () => {
    const sessions = [session("a", "CLOSED", "hotel-a"), session("b", "CLOSED", "hotel-b")];
    expect(filterConversationLogs(sessions, "hotel-b").map((item) => item.id)).toEqual(["b"]);
  });

  /** 5초 업무 폴링과 완료 로그 요청이 서버에서 다른 상태 범위를 조회하도록 API 계약을 고정합니다. */
  it("OPEN과 COMPLETED 범위를 쿼리에 전달한다", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("[]", { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await listSessions("token", "OPEN");
    await listSessions("token", "COMPLETED");

    expect(String(fetchMock.mock.calls[0][0])).toContain("scope=OPEN");
    expect(String(fetchMock.mock.calls[1][0])).toContain("scope=COMPLETED");
  });

  /** 새 Vercel이 먼저 뜬 짧은 구간에는 구버전 Render의 scope 거부를 전체 목록 필터로 대체해 상담 화면 중단을 막습니다. */
  it("구버전 서버가 scope를 거부하면 필요한 상태만 호환 조회한다", async () => {
    const sessions = [session("waiting", "WAITING", "hotel-a"), session("closed", "CLOSED", "hotel-a")];
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "property scope should not exist" }), { status: 400, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify(sessions), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSessions("token", "OPEN")).resolves.toEqual([sessions[0]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /** Agent 공동 로그는 활성 채팅 컴포넌트를 열지 않고 관리자와 같은 읽기 전용 모달을 사용합니다. */
  it("Agent 로그 상세를 읽기 전용 모달로 연다", () => {
    expect(mainSource).toContain("<ConversationLogBlock sessions={conversationLogs} onOpen={setSelectedLog} />");
    expect(mainSource).not.toContain("<ConversationLogBlock sessions={sessions} onOpen={open} />");
  });
});
