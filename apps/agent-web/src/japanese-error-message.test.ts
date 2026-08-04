import { describe, expect, it } from "vitest";
import { toJapaneseUserMessage } from "@hotel-chat/shared";

describe("Japanese user-facing errors", () => {
  it("localizes rate-limit and network failures", () => {
    expect(toJapaneseUserMessage("서버 요청이 너무 많습니다", 429)).toContain("リクエスト");
    expect(toJapaneseUserMessage("Failed to fetch")).toContain("接続");
  });

  it("does not expose Korean backend details for generic failures", () => {
    expect(toJapaneseUserMessage("상담 세션을 찾을 수 없습니다.")).not.toMatch(/[가-힣]/);
  });
});
