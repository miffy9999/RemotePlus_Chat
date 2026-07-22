import { IsString, Length } from "class-validator";

/** 관리자와 Agent 로그인 요청의 허용 범위를 제한합니다. */
export class LoginDto {
  @IsString()
  @Length(3, 50)
  loginId!: string;

  @IsString()
  password!: string;
}
