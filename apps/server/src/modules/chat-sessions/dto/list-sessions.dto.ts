import { ChatSessionStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export const SESSION_LIST_SCOPES = ["OPEN", "COMPLETED"] as const;
export type SessionListScope = (typeof SESSION_LIST_SCOPES)[number];
export const SESSION_LOG_PAGE_SIZE = 100;

/** 목록 API에서 허용된 상담 상태만 필터로 받을 수 있게 합니다. */
export class ListSessionsDto {
  @IsOptional()
  @IsEnum(ChatSessionStatus)
  status?: ChatSessionStatus;

  /** 실시간 목록과 저주기 완료 로그가 같은 30일치 응답을 매번 받지 않도록 범위를 나눕니다. */
  @IsOptional()
  @IsIn(SESSION_LIST_SCOPES)
  scope?: SessionListScope;

  /** 완료 Log는 DB에서 필요한 페이지 행만 읽도록 1부터 시작하는 페이지 번호를 받습니다. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  /** 운영자가 값을 조작해도 한 요청이 100건을 넘지 않게 서버에서 상한을 검증합니다. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(SESSION_LOG_PAGE_SIZE)
  pageSize?: number;

  @IsOptional()
  @IsUUID()
  hotelId?: string;

  @IsOptional()
  @IsIn(["ja", "en", "ko", "zh"])
  language?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
