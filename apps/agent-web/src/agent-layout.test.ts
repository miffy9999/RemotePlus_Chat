import { describe, expect, it } from "vitest";
import {
  AGENT_SIDEBAR_DEFAULT_WIDTH,
  AGENT_SIDEBAR_STORAGE_KEY,
  clampAgentSidebarWidth,
  readAgentSidebarWidth,
  saveAgentSidebarWidth,
} from "./agent-layout";

describe("Agent 사이드바 너비", () => {
  it("사용자가 목록을 지나치게 좁거나 넓게 만들 수 없도록 제한한다", () => {
    expect(clampAgentSidebarWidth(100, 1600)).toBe(320);
    expect(clampAgentSidebarWidth(900, 1600)).toBe(620);
  });

  it("작은 데스크톱 화면에서는 대화 영역을 위한 최소 공간을 남긴다", () => {
    expect(clampAgentSidebarWidth(620, 1000)).toBe(572);
  });

  it("저장값이 없거나 손상되면 기본 너비를 사용한다", () => {
    const storage = { getItem: () => "not-a-number" };
    expect(readAgentSidebarWidth(storage, 1600)).toBe(
      AGENT_SIDEBAR_DEFAULT_WIDTH,
    );
  });

  it("조정한 너비를 정수 문자열로 저장한다", () => {
    const values = new Map<string, string>();
    saveAgentSidebarWidth(
      { setItem: (key, value) => values.set(key, value) },
      487.8,
    );
    expect(values.get(AGENT_SIDEBAR_STORAGE_KEY)).toBe("488");
  });
});
