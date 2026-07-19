import type { StaffTokenPayload } from "../auth/auth.types";

/** 연결 인증이 끝난 뒤 Socket.IO 세션에만 저장하는 최소 신원 정보입니다. */
export type RealtimeIdentity =
  | { kind: "guest"; sessionId: string }
  | { kind: "staff"; staff: StaffTokenPayload };

/** 클라이언트에 전달하는 오류는 내부 스택이나 DB 정보를 포함하지 않습니다. */
export interface RealtimeErrorView {
  code: string;
  message: string;
}
