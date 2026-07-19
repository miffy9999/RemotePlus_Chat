import { ChatSessionStatus } from "@prisma/client";
import { IsEnum, IsOptional } from "class-validator";

/** 목록 API에서 허용된 상담 상태만 필터로 받을 수 있게 합니다. */
export class ListSessionsDto {
  @IsOptional()
  @IsEnum(ChatSessionStatus)
  status?: ChatSessionStatus;
}
