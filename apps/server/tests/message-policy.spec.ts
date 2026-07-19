import { BadRequestException, ConflictException } from "@nestjs/common";
import { assertSessionWritable, validateMessageInput } from "../src/modules/messages/message-policy";

describe("메시지 서버 검증 정책", () => {
  /** 앞뒤 공백을 제거한 정상 텍스트와 UUID를 허용합니다. */
  it("정상 메시지를 정리해 반환한다", () => {
    const result = validateMessageInput({ sessionId: "2e790fdf-e1e9-41f4-90d8-ba4771a8ff3d", clientMessageId: "48b92e6d-de14-451e-a9d6-f791c735c4bb", content: "  안녕하세요  " });
    expect(result.content).toBe("안녕하세요");
  });

  /** 공백뿐인 메시지는 데이터베이스와 상대방 화면을 오염시키므로 거절합니다. */
  it("빈 메시지를 거절한다", () => {
    expect(() => validateMessageInput({ sessionId: "2e790fdf-e1e9-41f4-90d8-ba4771a8ff3d", clientMessageId: "48b92e6d-de14-451e-a9d6-f791c735c4bb", content: "   " })).toThrow(BadRequestException);
  });

  /** ACTIVE 상태이며 아직 만료되지 않은 상담만 쓰기를 허용합니다. */
  it("진행 중인 상담의 쓰기를 허용한다", () => {
    const now = new Date("2026-07-19T08:00:00.000Z");
    expect(() => assertSessionWritable("ACTIVE", new Date(now.getTime() + 1000), now)).not.toThrow();
  });

  /** 종료 상태나 만료 시각 이후 메시지는 클라이언트 UI와 무관하게 서버에서 차단합니다. */
  it("종료되거나 만료된 상담의 쓰기를 거절한다", () => {
    const now = new Date("2026-07-19T08:00:00.000Z");
    expect(() => assertSessionWritable("CLOSED", new Date(now.getTime() + 1000), now)).toThrow(ConflictException);
    expect(() => assertSessionWritable("ACTIVE", now, now)).toThrow(ConflictException);
  });
});
