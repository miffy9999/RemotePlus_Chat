import { IsIn, IsOptional, IsString, Length } from "class-validator";

/** 투숙객이 상담을 생성할 때 선택할 수 있는 언어값을 MVP 범위로 제한하고, 생략 시 화면과 같은 일본어를 사용합니다. */
export class CreateSessionDto {
  @IsOptional()
  @IsString()
  @Length(2, 10)
  @IsIn(["ko", "en", "ja", "zh"])
  language: string = "ja";
}
