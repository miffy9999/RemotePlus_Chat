import { ConflictException, ForbiddenException } from "@nestjs/common";
import { assertCanClose, assertCanOpen, canStaffReadSession, isSessionExpired } from "../src/modules/chat-sessions/session-policy";

describe("상담 상태 전환 정책", () => {
  /** WAITING이며 담당자가 없는 상담만 수락할 수 있어야 합니다. */
  it("대기 상담 수락을 허용한다", () => {
    expect(() => assertCanOpen("WAITING", null, "agent-id")).not.toThrow();
  });

  /** 이미 진행 중인 상담의 이중 수락은 메시지 혼선을 만들기 때문에 거절합니다. */
  it("이미 수락된 상담을 거절한다", () => {
    expect(() => assertCanOpen("ACTIVE", "agent-id", "other-agent")).toThrow(ConflictException);
  });

  /** 담당자가 아닌 Agent가 다른 상담을 종료할 수 없어야 합니다. */
  it("담당자가 아닌 Agent의 종료를 거절한다", () => {
    expect(() => assertCanClose("ACTIVE", "owner", "other", false)).toThrow(ForbiddenException);
  });

  /** 관리자는 운영 장애 대응을 위해 진행 중 상담을 종료할 수 있습니다. */
  it("관리자의 종료를 허용한다", () => {
    expect(() => assertCanClose("ACTIVE", "owner", "admin", true)).not.toThrow();
  });

  /** 종료 로그는 담당자와 관계없이 모든 Agent가 공동으로 확인할 수 있어야 합니다. */
  it("다른 Agent의 완료 상담 로그 조회를 허용한다", () => {
    expect(canStaffReadSession("CLOSED", "owner", "other", false)).toBe(true);
    expect(canStaffReadSession("EXPIRED", null, "other", false)).toBe(true);
  });

  /** 진행 중 상담은 기존 담당자 경계를 유지해 다른 Agent가 메시지를 엿보거나 조작하지 못하게 합니다. */
  it("다른 Agent의 진행 상담 조회를 거절한다", () => {
    expect(canStaffReadSession("ACTIVE", "owner", "other", false)).toBe(false);
    expect(canStaffReadSession("ACTIVE", "owner", "owner", false)).toBe(true);
  });

  /** 만료 시각과 현재 시각이 같아도 서버는 추가 요청을 차단해야 합니다. */
  it("현재 시각에 도달한 상담을 만료로 판단한다", () => {
    const now = new Date("2026-07-19T08:00:00.000Z");
    expect(isSessionExpired(now, now)).toBe(true);
    expect(isSessionExpired(new Date(now.getTime() + 1), now)).toBe(false);
  });

  /** WAITING에는 만료시각이 없으므로 대기 시간만으로 자동 종료하지 않아야 합니다. */
  it("만료시각이 없는 대기 상담을 만료로 보지 않는다", () => {
    expect(isSessionExpired(null)).toBe(false);
  });
});
