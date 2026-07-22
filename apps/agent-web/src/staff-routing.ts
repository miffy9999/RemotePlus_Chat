import type { StaffRole } from "./auth-storage";

/** 통합 로그인 응답의 서버 검증 역할을 실제 접근 가능한 업무 시작 경로로 변환합니다. */
export function staffHomePath(role: StaffRole): "/admin" | "/agent" {
  return role === "ADMIN" ? "/admin" : "/agent";
}
