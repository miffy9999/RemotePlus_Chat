import { IsString, Length, Matches } from "class-validator";

/** 관리자가 호텔별 일본어 또는 영어 첫 안내문을 수정할 때 허용하는 최소 입력 계약입니다. */
export class UpdateHotelWelcomeMessageDto {
  @Matches(/^[a-z]{2,8}(?:-[a-z0-9]{2,8})?$/)
  language!: string;

  @IsString()
  @Length(1, 1000)
  welcomeMessage!: string;
}
