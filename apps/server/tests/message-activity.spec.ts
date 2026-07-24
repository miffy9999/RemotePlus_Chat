import { ConflictException } from "@nestjs/common";
import { MessagesService } from "../src/modules/messages/messages.service";

describe("최근 채팅 활동 시각", () => {
  /** 상담사가 실제 첫 답변을 저장한 트랜잭션에서만 15분 제한시간을 시작해야 화면과 DB 기준이 일치합니다. */
  it("첫 Agent 메시지와 함께 정확히 15분 타이머를 시작한다", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const clientMessageId = "33333333-3333-4333-8333-333333333333";
    const message = {
      id: "22222222-2222-4222-8222-222222222222",
      sessionId,
      senderType: "AGENT",
      senderId: "agent-id",
      clientMessageId,
      messageType: "TEXT",
      content: "안녕하세요. 무엇을 도와드릴까요?",
      createdAt: new Date("2026-07-23T06:00:00.000Z"),
    };
    const waitingForReply = {
      id: sessionId,
      status: "ACTIVE",
      agentId: "agent-id",
      startedAt: null,
      expiresAt: null,
    };
    const startedSession = {
      ...waitingForReply,
      startedAt: new Date("2026-07-23T06:00:00.000Z"),
      expiresAt: new Date("2026-07-23T06:15:00.000Z"),
      guestTokenHash: "private-hash",
      room: {
        roomNumber: "101",
        hotel: { id: "hotel-id", name: "테스트 호텔" },
      },
      agent: { id: "agent-id", name: "상담원" },
    };
    const transaction = {
      message: { create: jest.fn().mockResolvedValue(message) },
      chatSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: sessionId }),
      },
    };
    const emit = jest.fn();
    const prisma = {
      chatSession: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(waitingForReply)
          .mockResolvedValueOnce(startedSession),
      },
      message: { findUnique: jest.fn() },
      $transaction: jest.fn(
        async (work: (client: typeof transaction) => Promise<unknown>) =>
          work(transaction),
      ),
    };
    const service = new MessagesService(prisma as never, { emit } as never);

    const result = await service.save(
      {
        kind: "staff",
        staff: {
          sub: "agent-id",
          role: "AGENT",
          kind: "staff",
          tokenVersion: 0,
        },
      },
      {
        sessionId,
        clientMessageId,
        content: message.content,
      },
    );

    const timerData = transaction.chatSession.updateMany.mock.calls[0][0].data;
    expect(timerData.expiresAt.getTime() - timerData.startedAt.getTime()).toBe(
      15 * 60 * 1000,
    );
    expect(result).toEqual({ message, duplicate: false });
    expect(emit).toHaveBeenCalledWith(
      "chat.session.updated",
      expect.objectContaining({
        id: sessionId,
        startedAt: startedSession.startedAt,
        expiresAt: startedSession.expiresAt,
      }),
    );
  });

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

  /** 메시지 요청이 만료를 처음 발견해도 고객 화면에 필요한 관계는 유지하고 인증 내부값은 이벤트에서 제거합니다. */
  it("만료 이벤트를 완전한 공개 상담 형식으로 전송한다", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    const expired = {
      id: sessionId,
      status: "EXPIRED",
      expiresAt: new Date(0),
      guestTokenHash: "guest-secret",
      room: { roomNumber: "101", hotel: { id: "hotel-id", name: "호텔" } },
      agent: { id: "agent-id", name: "상담원", passwordHash: "bcrypt-secret", tokenVersion: 3 },
    };
    const emit = jest.fn();
    const prisma = {
      chatSession: {
        findUnique: jest.fn().mockResolvedValue({ id: sessionId, status: "ACTIVE", agentId: "agent-id", expiresAt: new Date(0) }),
        update: jest.fn().mockResolvedValue(expired),
      },
    };
    const service = new MessagesService(prisma as never, { emit } as never);

    await expect(service.save(
      { kind: "guest", sessionId },
      { sessionId, clientMessageId: "33333333-3333-4333-8333-333333333333", content: "늦은 메시지" },
    )).rejects.toBeInstanceOf(ConflictException);

    expect(emit).toHaveBeenCalledWith("chat.session.closed", expect.objectContaining({
      id: sessionId,
      room: expired.room,
      agent: { id: "agent-id", name: "상담원" },
    }));
    expect(JSON.stringify(emit.mock.calls[0][1])).not.toContain("secret");
    expect(JSON.stringify(emit.mock.calls[0][1])).not.toContain("tokenVersion");
  });
});
