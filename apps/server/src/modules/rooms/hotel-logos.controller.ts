import { Controller, Get, NotFoundException, Param, ParseUUIDPipe, Res } from "@nestjs/common";
import type { Response } from "express";
import { RoomsService } from "./rooms.service";

/** 상담 목록의 호텔 로고를 브라우저 캐시 가능한 공개 이미지로 제공합니다. */
@Controller("hotel-logos")
export class HotelLogosController {
  constructor(private readonly rooms: RoomsService) {}

  @Get(":hotelId")
  async getLogo(@Param("hotelId", new ParseUUIDPipe()) hotelId: string, @Res() response: Response): Promise<void> {
    const logo = await this.rooms.getHotelLogo(hotelId);
    if (!logo) throw new NotFoundException("ホテルロゴが登録されていません。");
    response.setHeader("Content-Type", logo.contentType);
    response.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    response.setHeader("ETag", `W/\"${logo.updatedAt.getTime()}-${logo.data.length}\"`);
    response.send(Buffer.from(logo.data));
  }
}
