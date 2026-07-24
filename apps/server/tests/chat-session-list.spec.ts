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
});
