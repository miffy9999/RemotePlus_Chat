import { ChatSessionsService } from "../src/modules/chat-sessions/chat-sessions.service";

describe("상담 기록 30일 보존", () => {
  /** 종료 시각이 30일 지난 쓰기 불가 상태만 한 번의 인덱스 삭제 조건으로 전달합니다. */
  it("종료 상담과 메시지를 30일 기준으로 정리한다", async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 3 });
    const service = new ChatSessionsService({ chatSession: { deleteMany } } as never, { emit: jest.fn() } as never);
    const now = new Date("2026-07-22T00:00:00.000Z");

    await expect(service.deleteExpiredHistory(now)).resolves.toBe(3);

    expect(deleteMany).toHaveBeenCalledWith({ where: {
      status: { in: ["CLOSED", "EXPIRED", "CANCELLED", "BLOCKED"] },
      closedAt: { lte: new Date("2026-06-22T00:00:00.000Z") }
    } });
  });

  /** 삭제 대상이 없어도 오류 없이 끝나 정기 작업이 무료 서버의 다른 기능을 방해하지 않습니다. */
  it("정리 대상이 없으면 0건으로 끝난다", async () => {
    const service = new ChatSessionsService({ chatSession: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) } } as never, { emit: jest.fn() } as never);

    await expect(service.deleteExpiredHistory(new Date("2026-07-22T00:00:00.000Z"))).resolves.toBe(0);
  });
});
