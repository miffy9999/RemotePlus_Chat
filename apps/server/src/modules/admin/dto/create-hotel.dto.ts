import { IsString, Length } from "class-validator";

/** 호텔 이름은 공백만 입력되는 일을 막기 위해 서비스에서도 trim한 값을 다시 확인한다. */
export class CreateHotelDto { @IsString() @Length(2, 100) name!: string; }
