import { IsIn, IsString, Length, Matches } from "class-validator";

/** 관리자가 만드는 Agent 계정 입력값이다. 테스트 운영 결정에 따라 비밀번호 길이·조합은 제한하지 않는다. */
export class CreateAgentDto {
  @IsString() @Length(2, 50) name!: string;
  @IsString() @Length(4, 30) @Matches(/^[a-zA-Z0-9._-]+$/) loginId!: string;
  @IsString() password!: string;
  @IsIn(["AGENT"]) role: "AGENT" = "AGENT";
}
