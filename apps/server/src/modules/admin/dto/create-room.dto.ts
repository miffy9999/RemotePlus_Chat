import { IsString, IsUUID, Length, Matches } from "class-validator";

/** 룸 추가 입력값이다. 호텔 UUID와 화면에 표시할 객실 번호만 MVP에서 받는다. */
export class CreateRoomDto {
  @IsUUID() hotelId!: string;
  @IsString() @Length(1, 20) @Matches(/^[a-zA-Z0-9가-힣_-]+$/) roomNumber!: string;
}
