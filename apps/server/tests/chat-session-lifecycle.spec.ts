import { ChatSessionsService } from "../src/modules/chat-sessions/chat-sessions.service";
import { sha256 } from "../src/common/security/hash";

const room = { id: "room-id", roomNumber: "101", hotel: { id: "hotel-id", name: "테스트 호텔" } };

describe("상담 수락·고객 종료 수명주기", () => {
  it("Agent가 수락한 시각부터 정확히 15분 뒤로 만료 시각을 설정한다", async () => {
    const waiting = { id: "session-id", roomId: room.id, status: "WAITING", agentId: null, guestTokenHash: "hash", expiresAt: null, room, agent: null };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const findUnique = jest.fn().mockResolvedValueOnce(waiting).mockImplementation(async () => {
      const data = updateMany.mock.calls[0][0].data;
      return { ...waiting, ...data, room, agent: { id: "agent-id", name: "상담원" } };
    });
    const emit = jest.fn();
    const service = new ChatSessionsService({ chatSession: { findUnique, updateMany } } as never, { emit } as never);

    const before = Date.now();
    const result = await service.accept("session-id", { sub: "agent-id", role: "AGENT", kind: "staff", tokenVersion: 0 });
    const after = Date.now();
    const data = updateMany.mock.calls[0][0].data;

    expect(data.startedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(data.startedAt.getTime()).toBeLessThanOrEqual(after);
    expect(data.expiresAt.getTime() - data.startedAt.getTime()).toBe(15 * 60 * 1000);
    expect(result.status).toBe("ACTIVE");
    expect(emit).toHaveBeenCalledWith("chat.session.updated", expect.objectContaining({ id: "session-id", status: "ACTIVE" }));
  });

  it("유효한 고객 토큰으로 종료하면 GUEST_CLOSED 이벤트를 즉시 보낸다", async () => {
    const guestToken = "guest-token";
    const active = { id: "session-id", roomId: room.id, status: "ACTIVE", agentId: "agent-id", guestTokenHash: sha256(guestToken), expiresAt: new Date(Date.now() + 60_000), room, agent: { id: "agent-id", name: "상담원" } };
    const closed = { ...active, status: "CLOSED", closeReason: "GUEST_CLOSED", closedAt: new Date() };
    const findUnique = jest.fn().mockResolvedValueOnce(active).mockResolvedValueOnce(closed);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const emit = jest.fn();
    const service = new ChatSessionsService({ chatSession: { findUnique, updateMany } } as never, { emit } as never);

    await expect(service.closeByGuest("session-id", guestToken)).resolves.toEqual(expect.objectContaining({ status: "CLOSED", closeReason: "GUEST_CLOSED" }));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "session-id", status: { in: ["WAITING", "ACTIVE"] } } }));
    expect(emit).toHaveBeenCalledWith("chat.session.closed", expect.objectContaining({ id: "session-id", status: "CLOSED" }));
  });
});
