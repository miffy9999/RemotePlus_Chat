/** 직원 JWT에 들어가는 최소 정보입니다. 비밀번호나 개인정보는 토큰에 넣지 않습니다. */
export interface StaffTokenPayload {
  sub: string;
  role: "ADMIN" | "AGENT";
  kind: "staff";
}

/** 투숙객이 접근 키 검증 후 상담을 만들 때 사용하는 짧은 수명의 JWT 정보입니다. */
export interface GuestAccessPayload {
  sub: string;
  roomId: string;
  kind: "guest-access";
}

export type RequestIdentity = StaffTokenPayload | GuestAccessPayload;
