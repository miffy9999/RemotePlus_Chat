import { IsNotEmpty, IsString } from "class-validator";

/** 길이·문자 조합은 제한하지 않되 인증값으로 의미가 없는 빈 문자열은 받지 않습니다. */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  newPassword!: string;
}
