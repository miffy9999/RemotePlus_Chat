import { describe, expect, it } from "vitest";
import {
  clearUnreadConversation,
  incrementUnreadConversation,
  reconcileUnreadConversations,
  synchronizeUnreadConversations,
  totalUnreadMessages,
} from "./unread-conversations";

describe("상담방별 읽지 않음 상태", () => {
  it("같은 상담방에 메시지가 다시 오면 읽지 않은 수를 다시 늘린다", () => {
    const first = incrementUnreadConversation(new Map(), "session-a");
    const second = incrementUnreadConversation(first, "session-a");
    expect(second.get("session-a")).toBe(2);
    expect(totalUnreadMessages(second)).toBe(2);
  });

  it("상담방을 열면 그 방만 읽음 처리한다", () => {
    const unread = new Map([
      ["session-a", 2],
      ["session-b", 1],
    ]);
    const next = clearUnreadConversation(unread, "session-a");
    expect([...next]).toEqual([["session-b", 1]]);
  });

  it("새 대기 상담은 한 건으로 표시하고 종료된 상담 상태는 제거한다", () => {
    const current = new Map([
      ["closed", 3],
      ["active", 2],
    ]);
    const next = reconcileUnreadConversations(
      current,
      new Set(["active", "waiting"]),
      ["waiting"],
    );
    expect([...next]).toEqual([
      ["active", 2],
      ["waiting", 1],
    ]);
  });

  it("다른 PC가 읽은 뒤 받은 서버 상태로 로컬 표시를 함께 지운다", () => {
    const current = new Map([
      ["read-on-other-pc", 2],
      ["still-unread", 1],
    ]);
    const synchronized = synchronizeUnreadConversations(current, [
      { sessionId: "still-unread", count: 1 },
    ]);
    expect([...synchronized]).toEqual([["still-unread", 1]]);
  });
});
