import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { SessionView } from "./api";
import { filterAgentSessions } from "./session-filters";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

function session(
  id: string,
  language: string,
  hotel = "사쿠라 호텔",
  hotelId = `hotel-${id}`,
): SessionView {
  return {
    id,
    status: "WAITING",
    language,
    agentId: null,
    agent: null,
    startedAt: null,
    expiresAt: null,
    closedAt: null,
    createdAt: "2026-07-23T00:00:00.000Z",
    lastMessage: null,
    room: {
      roomNumber: "101",
      hotel: { id: hotelId, name: hotel },
    },
  };
}

describe("Agent 상담 목록 필터", () => {
  it("select 옵션의 표시 문구와 별개로 실제 소문자 언어 코드를 값으로 지정한다", () => {
    expect(mainSource).toContain(
      '<option key={language} value={language}>{language.toUpperCase()}</option>',
    );
    expect(mainSource).toContain("filterAgentSessions(");
  });

  /** UI의 JA 표시값과 API의 ja 코드가 달라 필터 결과가 비는 회귀를 막습니다. */
  it("언어 코드를 대소문자와 관계없이 필터링한다", () => {
    const sessions = [
      session("ja", "ja"),
      session("en", "EN"),
      session("ko", "ko"),
    ];

    expect(
      filterAgentSessions(sessions, {
        search: "",
        hotel: "",
        language: "JA",
      }).map((item) => item.id),
    ).toEqual(["ja"]);
    expect(
      filterAgentSessions(sessions, {
        search: "",
        hotel: "",
        language: "en",
      }).map((item) => item.id),
    ).toEqual(["en"]);
  });

  it("검색·호텔·언어 조건을 함께 적용한다", () => {
    const sessions = [
      session("target", "ja", "타누키", "hotel-target"),
      session("other", "ja", "사쿠라 호텔", "hotel-other"),
    ];
    sessions[0].lastMessage = {
      id: "message-1",
      sessionId: "target",
      senderType: "GUEST",
      senderId: null,
      clientMessageId: "client-1",
      content: "수건 요청",
      createdAt: "2026-07-23T00:00:00.000Z",
    };

    expect(
      filterAgentSessions(sessions, {
        search: "수건",
        hotel: "hotel-target",
        language: "ja",
      }).map((item) => item.id),
    ).toEqual(["target"]);
  });
});
