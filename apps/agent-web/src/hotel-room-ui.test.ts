import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("hotel room operations UI", () => {
  it("shows hotel logos and LINE-style new consultation badges", () => {
    expect(mainSource).toContain("function HotelAvatar");
    expect(mainSource).toContain('className="line-unread-badge"');
    expect(mainSource).toContain('className="line-chat-badge"');
    expect(styles).toContain(".line-room-avatar img");
  });

  it("supports logo management and four data-driven welcome languages", () => {
    expect(mainSource).toContain("uploadHotelLogo");
    expect(mainSource).toContain("deleteHotelLogo");
    expect(mainSource).toContain('code: "ko"');
    expect(mainSource).toContain('code: "zh"');
    expect(mainSource).toContain("hotel?.welcomeMessages.find");
    expect(mainSource).toContain('className="welcome-language-select"');
    expect(mainSource).not.toContain('className="welcome-language-tabs"');
    expect(mainSource).toContain("{selectedHotel && (");
    expect(mainSource).toContain("2 * 1024 * 1024");
    expect(styles).toContain(".admin-logo-layout");
  });

  it("uses actual status controls and removes the decorative composer plus", () => {
    expect(mainSource).toContain("toggleAgentStatus");
    expect(mainSource).toContain("toggleRoomStatus");
    expect(mainSource).not.toContain('<span aria-hidden="true">＋</span>');
    expect(styles).not.toContain(".line-chat-composer > span");
  });
});
