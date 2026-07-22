import { MessagesService } from "../src/modules/messages/messages.service";

describe("최근 채팅 활동 시각", () => {
  /** 메시지 저장과 목록 정렬 시각 갱신이 같은 트랜잭션에서 끝나야 최근 상담이 안정적으로 맨 위에 표시됩니다. */
  it("새 메시지 시각을 상담 lastActivityAt에 함께 저장한다", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const createdAt = new Date("2026-07-22T04:00:00.000Z");
    const message = {
      id: "22222222-2222-4222-8222-222222222222", sessionId, senderType: "GUEST", senderId: null,
      clientMessageId: "33333333-3333-4333-8333-333333333333", messageType: "TEXT", content: "수건을 부탁합니다.", createdAt,
    };
    const transaction = {
      message: { create: jest.fn().mockResolvedValue(message) },
      chatSession: { update: jest.fn().mockResolvedValue({ id: sessionId }) },
    };
    const prisma = {
      chatSession: { findUnique: jest.fn().mockResolvedValue({ id: sessionId, status: "ACTIVE", agentId: "agent-id", expiresAt: new Date(Date.now() + 60_000) }) },
      message: { findUnique: jest.fn() },
      $transaction: jest.fn(async (work: (client: typeof transaction) => Promise<unknown>) => work(transaction)),
    };
    const service = new MessagesService(prisma as never, { emit: jest.fn() } as never);

    const result = await service.save(
      { kind: "guest", sessionId },
      { sessionId, clientMessageId: message.clientMessageId, content: message.content },
    );

    expect(result).toEqual({ message, duplicate: false });
    expect(transaction.chatSession.update).toHaveBeenCalledWith({ where: { id: sessionId }, data: { lastActivityAt: createdAt } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
