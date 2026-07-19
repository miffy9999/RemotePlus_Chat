import { createHash, randomBytes } from "node:crypto";

/**
 * 접근 키와 투숙객 세션 토큰을 SHA-256으로 단방향 변환합니다.
 * 원문을 DB에 저장하지 않아 데이터가 유출되어도 바로 재사용하기 어렵게 합니다.
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** 추측이 어려운 256비트 임의 토큰을 URL에 안전한 문자열로 생성합니다. */
export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}
