import { describe, expect, it } from "vitest";
import { detectGuestUiLanguage } from "./i18n";

describe("게스트 UI 언어 자동 감지", () => {
  it("기기 선호 언어에 한국어가 있으면 한국어 UI를 선택한다", () => {
    expect(detectGuestUiLanguage(["en-US", "ko-KR"])).toBe("ko");
  });

  it("한국어 기기가 아니면 기본 일본어 UI를 선택한다", () => {
    expect(detectGuestUiLanguage(["en-US"])).toBe("ja");
    expect(detectGuestUiLanguage(["ja-JP"])).toBe("ja");
  });
});
