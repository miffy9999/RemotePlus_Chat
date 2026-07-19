import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { sha256 } from "../../common/security/hash";
import { AuthService } from "../auth/auth.service";

/** 호텔 객실 접근 키를 검증하고 투숙객에게 공개 가능한 최소 정보만 반환합니다. */
@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService) {}

  /** 원문 키를 해시한 뒤 활성·만료·객실·호텔 상태를 모두 확인합니다. */
  async verifyAccess(accessKey: string) {
    const key = await this.prisma.roomAccessKey.findUnique({
      where: { keyHash: sha256(accessKey) },
      include: { room: { include: { hotel: true } } },
    });
    const expired = key?.expiresAt ? key.expiresAt.getTime() <= Date.now() : false;
    if (!key || key.status !== "ACTIVE" || expired || key.room.status !== "ACTIVE" || key.room.hotel.status !== "ACTIVE") {
      throw new UnauthorizedException("유효하지 않거나 만료된 객실 접근 키입니다.");
    }

    return {
      accessToken: this.auth.createGuestAccessToken(key.id, key.roomId),
      room: { id: key.room.id, roomNumber: key.room.roomNumber, hotel: { id: key.room.hotel.id, name: key.room.hotel.name } },
    };
  }
}
