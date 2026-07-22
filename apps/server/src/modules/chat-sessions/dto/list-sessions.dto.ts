import { ChatSessionStatus } from "@prisma/client";
import { IsEnum, IsIn, IsOptional } from "class-validator";

export const SESSION_LIST_SCOPES = ["OPEN", "COMPLETED"] as const;
export type SessionListScope = (typeof SESSION_LIST_SCOPES)[number];

/** 목록 API에서 허용된 상담 상태만 필터로 받을 수 있게 합니다. */
export class ListSessionsDto {
  @IsOptional()
  @IsEnum(ChatSessionStatus)
  status?: ChatSessionStatus;

  /** 실시간 목록과 저주기 완료 로그가 같은 30일치 응답을 매번 받지 않도록 범위를 나눕니다. */
  @IsOptional()
  @IsIn(SESSION_LIST_SCOPES)
  scope?: SessionListScope;
}
