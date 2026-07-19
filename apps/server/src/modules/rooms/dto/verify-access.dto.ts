import { IsString, Length } from "class-validator";

/** 접근 키 길이를 제한해 비정상적으로 큰 요청이 해시 계산과 로그를 소모하지 않게 합니다. */
export class VerifyAccessDto {
  @IsString()
  @Length(16, 200)
  accessKey!: string;
}
