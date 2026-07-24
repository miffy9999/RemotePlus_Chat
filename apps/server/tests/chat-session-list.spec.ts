import { ChatSessionsService } from "../src/modules/chat-sessions/chat-sessions.service";

describe("상담 목록 범위", () => {
  const agent = {
    sub: "agent-id",
    role: "AGENT",
    kind: "staff",
    tokenVersion: 0,
  } as const;
  const admin = {
    sub: "admin-id",
    role: "ADMIN",
    kind: "staff",
    tokenVersion: 0,
  } as const;

  /** Agent의 5초 폴링은 완료 로그를 포함하지 않아 기록이 많아져도 매번 전체 30일 데이터를 전송하지 않습니다. */
  it("OPEN 범위에서 대기·진행 상담만 조회한다", async () => {
    const findMany = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const service = new ChatSessionsService({ chatSession: { findMany } } as never, { emit: jest.fn() } as never);

    await service.list(undefined, agent, "OPEN");

    expect(findMany.mock.calls[1][0].where).toEqual({
      AND: [
        {
          OR: [
            { status: "WAITING" },
            { status: "ACTIVE", agentId: "agent-id" },
            {
              status: {
                in: ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"],
              },
            },
          ],
        },
        { status: { in: ["WAITING", "ACTIVE"] } },
      ],
    });
  });

  /** 관리자 공동 로그 요청은 쓰기가 끝난 네 상태만 조회하며 담당자 인증 필드를 선택하지 않습니다. */
  it("COMPLETED 범위와 최소 Agent 필드를 사용한다", async () => {
    const findMany = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const service = new ChatSessionsService({ chatSession: { findMany } } as never, { emit: jest.fn() } as never);

    await service.list(undefined, admin, "COMPLETED");

    const query = findMany.mock.calls[1][0];
    expect(query.where).toEqual({ status: { in: ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"] } });
    expect(query.include.agent).toEqual({ select: { id: true, name: true } });
  });

  /** 관리자 Agent 조회 화면은 담당자와 무관하게 모든 WAITING·ACTIVE 상담을 볼 수 있어야 합니다. */
  it("ADMIN OPEN 범위에서는 Agent별 가시성 필터를 추가하지 않는다", async () => {
    const findMany = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const service = new ChatSessionsService(
      { chatSession: { findMany } } as never,
      { emit: jest.fn() } as never,
    );

    await service.list(undefined, admin, "OPEN");

    expect(findMany.mock.calls[1][0].where).toEqual({
      status: { in: ["WAITING", "ACTIVE"] },
    });
  });

  /** 완료 Log는 전체 행을 메모리에 올리지 않고 DB skip/take와 count로 100건 단위 응답을 만들어야 합니다. */
  it("COMPLETED Log를 100건씩 DB 페이지네이션한다", async () => {
    const session = {
      id: "session-id",
      status: "CLOSED",
      language: "ja",
      agentId: null,
      agent: null,
      startedAt: null,
      expiresAt: null,
      closedAt: new Date(),
      createdAt: new Date(),
      lastActivityAt: new Date(),
      room: {
        roomNumber: "101",
        hotel: { id: "hotel-id", name: "테스트 호텔" },
      },
      messages: [],
    };
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([session])
      .mockResolvedValueOnce([{ language: "ja" }]);
    const count = jest.fn().mockResolvedValue(235);
    const hotelFindMany = jest
      .fn()
      .mockResolvedValue([{ id: "hotel-id", name: "테스트 호텔" }]);
    const service = new ChatSessionsService(
      {
        chatSession: { findMany, count },
        hotel: { findMany: hotelFindMany },
      } as never,
      { emit: jest.fn() } as never,
    );

    const result = await service.list(undefined, admin, "COMPLETED", {
      page: 2,
      pageSize: 100,
      hotelId: "hotel-id",
      language: "ja",
      search: "수건",
    });

    const pageQuery = findMany.mock.calls[1][0];
    expect(pageQuery.skip).toBe(100);
    expect(pageQuery.take).toBe(100);
    expect(pageQuery.orderBy).toEqual([
      { lastActivityAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(count).toHaveBeenCalledWith({ where: pageQuery.where });
    expect(result).toEqual(
      expect.objectContaining({
        total: 235,
        page: 2,
        pageSize: 100,
        totalPages: 3,
        filters: {
          hotels: [{ id: "hotel-id", name: "테스트 호텔" }],
          languages: ["ja"],
        },
      }),
    );
  });
});
