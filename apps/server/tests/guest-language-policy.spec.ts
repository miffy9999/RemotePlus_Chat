import { validate } from "class-validator";
import { CreateSessionDto } from "../src/modules/chat-sessions/dto/create-session.dto";

describe("게스트 상담 언어 정책", () => {
  /** API 호출자가 언어를 생략해도 게스트 화면과 동일한 일본어 상담이 생성되어야 합니다. */
  it("상담 생성 언어의 서버 기본값을 일본어로 사용한다", () => {
    expect(new CreateSessionDto().language).toBe("ja");
  });

  /** 화면이 제공하는 네 언어는 서버 DTO에서도 모두 허용해 클라이언트와 API 계약이 어긋나지 않게 합니다. */
  it.each(["ja", "en", "ko", "zh"])("지원 언어 %s를 허용한다", async (language) => {
    const dto = Object.assign(new CreateSessionDto(), { language });
    expect(await validate(dto)).toHaveLength(0);
  });

  /** 지원하지 않는 값은 DB에 들어가기 전에 거부해 언어별 화면 복원이 깨지는 일을 막습니다. */
  it("지원하지 않는 언어를 거부한다", async () => {
    const dto = Object.assign(new CreateSessionDto(), { language: "fr" });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
