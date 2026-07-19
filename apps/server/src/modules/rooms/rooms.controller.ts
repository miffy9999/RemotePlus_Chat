import { Body, Controller, Post } from "@nestjs/common";
import { VerifyAccessDto } from "./dto/verify-access.dto";
import { RoomsService } from "./rooms.service";

/** 회원가입 없는 투숙객 진입점입니다. 실제 상담 생성 전 객실 접근 권한만 검증합니다. */
@Controller("guest/access")
export class RoomsController {
  constructor(private readonly rooms: RoomsService) {}

  /** 유효한 접근 키에 한해 짧은 수명의 상담 생성 토큰을 반환합니다. */
  @Post("verify")
  verify(@Body() dto: VerifyAccessDto) { return this.rooms.verifyAccess(dto.accessKey); }
}
