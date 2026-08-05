import { ChatSessionsService } from "../src/modules/chat-sessions/chat-sessions.service";

const staff = {
  sub: "11111111-1111-4111-8111-111111111111",
  role: "AGENT",
  kind: "staff",
  tokenVersion: 0,
} as const;

const session = {
  id: "22222222-2222-4222-8222-222222222222",
  roomId: "33333333-3333-4333-8333-333333333333",
  status: "ACTIVE",
  language: "ja",
  agentId: staff.sub,
  agent: { id: staff.sub, name: "相談員" },
  guestTokenHash: "guest-hash",
  startedAt: null,
  expiresAt: null,
  closedAt: null,
  createdAt: new Date("2026-08-05T00:00:00.000Z"),
  lastActivityAt: new Date("2026-08-05T00:02:00.000Z"),
  room: {
    roomNumber: "101",
    hotel: { id: "44444444-4444-4444-8444-444444444444", name: "ホテル" },
  },
  messages: [],
};

describe("공동 계정 상담 읽음 상태", () => {
  it("서버의 마지막 읽은 시각 이후 Guest 메시지 수를 목록에 반환한다", async () => {
    const chatSessionFindMany = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([session]);
    const queryRaw = jest.fn().mockResolvedValue([
      { sessionId: session.id, unreadCount: 2, hasRead: true },
    ]);
    const service = new ChatSessionsService(
      {
        chatSession: { findMany: chatSessionFindMany },
        $queryRaw: queryRaw,
      } as never,
      { emit: jest.fn() } as never,
    );

    const result = await service.list(undefined, staff, "OPEN");

    expect(result).toEqual([
      expect.objectContaining({ id: session.id, unreadCount: 2 }),
    ]);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("한 PC가 읽으면 DB를 갱신하고 같은 계정용 실시간 이벤트를 발생시킨다", async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const emit = jest.fn();
    const service = new ChatSessionsService(
      {
        chatSession: { findUnique: jest.fn().mockResolvedValue(session) },
        conversationRead: { upsert },
      } as never,
      { emit } as never,
    );

    const result = await service.markRead(session.id, staff);

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          agentId_sessionId: { agentId: staff.sub, sessionId: session.id },
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ sessionId: session.id, staffId: staff.sub, unreadCount: 0 }),
    );
    expect(emit).toHaveBeenCalledWith(
      "chat.session.read",
      expect.objectContaining({ sessionId: session.id, staffId: staff.sub }),
    );
  });
});
