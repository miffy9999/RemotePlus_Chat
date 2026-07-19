import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcrypt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { CreateHotelDto } from "./dto/create-hotel.dto";
import { CreateRoomDto } from "./dto/create-room.dto";

/** 관리자 MVP의 Agent·호텔·룸 조회와 생성을 담당하며 비밀번호 해시는 절대 응답하지 않는다. */
@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /** Agent 목록은 계정 운영에 필요한 공개 필드만 최신순으로 반환한다. */
  listAgents() { return this.prisma.agent.findMany({ where: { role: "AGENT" }, select: { id: true, name: true, loginId: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } }); }

  /** 비밀번호는 bcrypt 해시로만 저장하고 로그인 ID 충돌은 사용자에게 409로 알린다. */
  async createAgent(dto: CreateAgentDto) {
    try {
      return await this.prisma.agent.create({ data: { name: dto.name.trim(), loginId: dto.loginId.trim(), passwordHash: await hash(dto.password, 12), role: "AGENT" }, select: { id: true, name: true, loginId: true, role: true, status: true, createdAt: true } });
    } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("이미 사용 중인 로그인 ID입니다."); throw error; }
  }

  listHotels() { return this.prisma.hotel.findMany({ orderBy: { name: "asc" } }); }

  /** 동일한 이름도 운영상 혼동되므로 대소문자를 무시해 중복을 거부한다. */
  async createHotel(dto: CreateHotelDto) {
    const name = dto.name.trim();
    if (await this.prisma.hotel.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })) throw new ConflictException("같은 이름의 호텔이 이미 있습니다.");
    return this.prisma.hotel.create({ data: { name } });
  }

  /** 선택 호텔 필터가 있으면 해당 호텔의 룸만 반환하며 QR 칸은 화면 확장용으로만 사용한다. */
  listRooms(hotelId?: string) { return this.prisma.room.findMany({ where: hotelId ? { hotelId } : undefined, include: { hotel: true }, orderBy: [{ hotel: { name: "asc" } }, { roomNumber: "asc" }] }); }

  async createRoom(dto: CreateRoomDto) {
    if (!(await this.prisma.hotel.findUnique({ where: { id: dto.hotelId } }))) throw new NotFoundException("호텔을 찾을 수 없습니다.");
    try { return await this.prisma.room.create({ data: { hotelId: dto.hotelId, roomNumber: dto.roomNumber.trim() }, include: { hotel: true } }); }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("해당 호텔에 같은 객실 번호가 이미 있습니다."); throw error; }
  }
}
