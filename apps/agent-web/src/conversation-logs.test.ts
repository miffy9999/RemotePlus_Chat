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

  /** LINE형 Agent Log는 현재 상담 목록과 분리되고 선택한 완료 상담을 읽기 전용 본문으로 엽니다. */
  it("Agent Log 상세를 읽기 전용 LINE 본문으로 연다", () => {
    expect(mainSource).toContain('setMode("log")');
    expect(mainSource).toContain(
      'readOnly={isAdminView || mode === "log" || TERMINAL_SESSION_STATUSES.includes(selected.status)}',
    );
    expect(mainSource).toContain("adminReadOnly={isAdminView}");
    expect(mainSource).toContain("종료된 상담 기록입니다");
  });

  /** 상담 종료는 현재 대화를 읽기 전용으로 바꿀 뿐 사용자가 선택하지 않은 Log 탭으로 이동시키지 않습니다. */
  it("상담 상태 변경 뒤 현재 탭과 본문을 유지한다", () => {
    const handler = mainSource.match(
      /function updateSelectedConversation[\s\S]*?\n  }/,
    )?.[0];
    expect(handler).toContain("setSelected(updated)");
    expect(handler).not.toContain('setMode("log")');
    expect(mainSource).toContain("onChanged={updateSelectedConversation}");
  });
});
