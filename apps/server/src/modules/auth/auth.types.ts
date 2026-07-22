/** 직원 JWT에 들어가는 최소 정보입니다. 비밀번호나 개인정보는 토큰에 넣지 않습니다. */
export interface StaffTokenPayload {
  sub: string;
  role: "ADMIN" | "AGENT";
  kind: "staff";
  /** 구버전 JWT에는 없을 수 있으며 0으로 해석해 순차 배포 중 기존 로그인을 유지합니다. */
  tokenVersion?: number;
}

/** 투숙객이 접근 키 검증 후 상담을 만들 때 사용하는 짧은 수명의 JWT 정보입니다. */
export interface GuestAccessPayload {
  sub: string;
  roomId: string;
  kind: "guest-access";
}

export type RequestIdentity = StaffTokenPayload | GuestAccessPayload;
