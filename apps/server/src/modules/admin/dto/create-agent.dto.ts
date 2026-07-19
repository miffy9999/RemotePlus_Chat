import { IsIn, IsString, Length, Matches } from "class-validator";

/** 관리자가 만드는 Agent 계정 입력값이다. 로그인 ID와 비밀번호를 서버에서 제한해 약한 계정 생성을 막는다. */
export class CreateAgentDto {
  @IsString() @Length(2, 50) name!: string;
  @IsString() @Length(4, 30) @Matches(/^[a-zA-Z0-9._-]+$/) loginId!: string;
  @IsString() @Length(8, 72) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/) password!: string;
  @IsIn(["AGENT"]) role: "AGENT" = "AGENT";
}
