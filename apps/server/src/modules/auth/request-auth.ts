import { UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import type { GuestAccessPayload, StaffTokenPayload } from "./auth.types";

/** Authorization 헤더에서 Bearer 토큰만 안전하게 분리합니다. */
export function readBearerToken(request: Request): string {
  const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) throw new UnauthorizedException("Bearer 인증 토큰이 필요합니다.");
  return token;
}

/** 직원 토큰인지와 허용 역할을 함께 확인합니다. */
export function requireStaff(request: Request, auth: AuthService, roles: Array<"ADMIN" | "AGENT">): StaffTokenPayload {
  const identity = auth.verifyToken(readBearerToken(request));
  if (identity.kind !== "staff" || !roles.includes(identity.role)) throw new UnauthorizedException("이 기능을 사용할 권한이 없습니다.");
  return identity;
}

/** 상담 생성 API에서 투숙객 접근 검증 토큰만 허용합니다. */
export function requireGuestAccess(request: Request, auth: AuthService): GuestAccessPayload {
  const identity = auth.verifyToken(readBearerToken(request));
  if (identity.kind !== "guest-access") throw new UnauthorizedException("유효한 객실 접근 토큰이 필요합니다.");
  return identity;
}

/** Bearer 헤더가 있을 때만 직원 신원을 읽습니다. 투숙객은 별도 불투명 토큰을 사용합니다. */
export function optionalStaff(request: Request, auth: AuthService): StaffTokenPayload | null {
  if (!request.headers.authorization) return null;
  const identity = auth.verifyToken(readBearerToken(request));
  if (identity.kind !== "staff") throw new UnauthorizedException("직원 인증 토큰이 아닙니다.");
  return identity;
}
