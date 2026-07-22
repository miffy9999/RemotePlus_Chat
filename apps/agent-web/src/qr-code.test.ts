import { describe, expect, it } from "vitest";
import { createRoomQrDataUrl, createRoomQrFileName } from "./qr-code";

describe("객실 고정 QR", () => {
  it("고객 HTTPS 주소를 약 1024px의 정사각형 PNG 데이터 URL로 만든다", async () => {
    const value = await createRoomQrDataUrl("https://guest.example.com/?accessKey=room-key");
    expect(value).toMatch(/^data:image\/png;base64,/);
    const bytes = Uint8Array.from(atob(value.split(",")[1] ?? ""), (character) => character.charCodeAt(0));
    const pngHeader = new DataView(bytes.buffer);
    const width = pngHeader.getUint32(16);
    const height = pngHeader.getUint32(20);
    expect(width).toBeGreaterThanOrEqual(960);
    expect(width).toBeLessThanOrEqual(1024);
    expect(height).toBe(width);
  });

  it("실행 가능한 URL 스킴을 거부한다", async () => {
    await expect(createRoomQrDataUrl("javascript:alert(1)")).rejects.toThrow("HTTP(S)");
  });

  it("운영체제 금지 문자를 다운로드 파일명에서 제거한다", () => {
    expect(createRoomQrFileName("호텔/A", "10:01")).toBe("remoteplus-호텔-A-10-01-qr.png");
  });
});
