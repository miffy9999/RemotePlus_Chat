import { describe, expect, it } from "vitest";
import { DEFAULT_GUEST_UI_LANGUAGE, normalizeGuestUiLanguage } from "./i18n";

describe("게스트 UI 언어 선택", () => {
  it("저장된 언어가 없거나 알 수 없는 값이면 일본어를 기본으로 선택한다", () => {
    expect(DEFAULT_GUEST_UI_LANGUAGE).toBe("ja");
    expect(normalizeGuestUiLanguage(null)).toBe("ja");
    expect(normalizeGuestUiLanguage("fr")).toBe("ja");
  });

  it("일본어·영어·한국어·중국어 선택을 그대로 유지한다", () => {
    expect(["ja", "en", "ko", "zh"].map(normalizeGuestUiLanguage)).toEqual(["ja", "en", "ko", "zh"]);
  });
});
