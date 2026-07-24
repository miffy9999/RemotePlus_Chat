import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("./main.tsx", import.meta.url), "utf8");

describe("Guest 상담원 연결 상태 표시", () => {
  /** Agent 배정은 상담 상태만 갱신하며 보안 안내 문장을 채팅 본문 위에 다시 만들지 않아야 합니다. */
  it("ACTIVE 전환 안내문을 렌더링하지 않는다", () => {
    expect(mainSource).not.toContain(
      't("상담원이 연결되었습니다. 개인정보나 결제 비밀번호는 전송하지 마세요.")',
    );
    expect(mainSource).not.toContain(
      "相談員に接続しました。個人情報や決済用パスワードは送信しないでください。",
    );
  });

  /** 안내문 제거와 관계없이 WebSocket 상태 갱신과 ACTIVE 입력 가능 정책은 유지해야 합니다. */
  it("상담 상태 이벤트와 메시지 입력 기능을 유지한다", () => {
    expect(mainSource).toContain('socket.on("chat:session-updated"');
    expect(mainSource).toContain("isGuestSessionOpen(access.session, now)");
    expect(mainSource).toContain('socket.on("connect"');
    expect(mainSource).toContain('setConnection("연결됨")');
    expect(mainSource).toContain("terminal && <section");
  });

  /** Guest 헤더는 호텔·객실 정보만 표시하고 우측 연결 상태 배지를 렌더링하지 않습니다. */
  it("Guest 우측 상단 연결 상태 표시를 제거한다", () => {
    expect(mainSource).not.toContain('className="guest-header-actions"');
    expect(mainSource).not.toContain("t(connection)");
    expect(mainSource).not.toContain('className={`online');
  });
});
