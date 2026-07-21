import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { hash } from "bcrypt";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { CreateHotelDto } from "./dto/create-hotel.dto";
import { CreateRoomDto } from "./dto/create-room.dto";
import { createOpaqueToken, sha256 } from "../../common/security/hash";
import { decryptSecretOrNull, encryptSecret } from "../../common/security/encryption";

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

  /** Agent 계정만 삭제하며 기존 상담 기록은 Agent 관계를 null로 바꿔 운영 이력을 보존합니다. */
  async deleteAgent(id: string) {
    const agent = await this.prisma.agent.findFirst({ where: { id, role: "AGENT" }, select: { id: true } });
    if (!agent) throw new NotFoundException("삭제할 Agent를 찾을 수 없습니다.");
    await this.prisma.agent.delete({ where: { id } });
    return { deletedId: id };
  }

  listHotels() { return this.prisma.hotel.findMany({ orderBy: { name: "asc" } }); }

  /** 동일한 이름도 운영상 혼동되므로 대소문자를 무시해 중복을 거부한다. */
  async createHotel(dto: CreateHotelDto) {
    const name = dto.name.trim();
    if (await this.prisma.hotel.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })) throw new ConflictException("같은 이름의 호텔이 이미 있습니다.");
    return this.prisma.hotel.create({ data: { name } });
  }

  /** 호텔 삭제는 DB 연쇄 삭제 규칙으로 하위 룸·접근키·상담·메시지를 한 작업에서 함께 제거합니다. */
  async deleteHotel(id: string) {
    const hotel = await this.prisma.hotel.findUnique({ where: { id }, select: { id: true } });
    if (!hotel) throw new NotFoundException("삭제할 호텔을 찾을 수 없습니다.");
    await this.prisma.hotel.delete({ where: { id } });
    return { deletedId: id };
  }

  /** 관리자 룸 목록에는 활성 접근 키를 복호화한 투숙객 주소를 포함하되 키 자체 필드는 노출하지 않습니다. */
  async listRooms(hotelId?: string) {
    const rooms = await this.prisma.room.findMany({ where: hotelId ? { hotelId } : undefined, include: { hotel: true, accessKeys: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: [{ hotel: { name: "asc" } }, { roomNumber: "asc" }] });
    return rooms.map((room) => this.roomView(room));
  }

  async createRoom(dto: CreateRoomDto) {
    if (!(await this.prisma.hotel.findUnique({ where: { id: dto.hotelId } }))) throw new NotFoundException("호텔을 찾을 수 없습니다.");
    const accessKey = createOpaqueToken();
    try {
      const room = await this.prisma.room.create({ data: { hotelId: dto.hotelId, roomNumber: dto.roomNumber.trim(), accessKeys: { create: { keyHash: sha256(accessKey), encryptedKey: encryptSecret(accessKey) } } }, include: { hotel: true, accessKeys: true } });
      return this.roomView(room);
    }
    catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ConflictException("해당 호텔에 같은 객실 번호가 이미 있습니다."); throw error; }
  }

  /** 룸 삭제 시 접근키와 해당 룸의 상담·메시지가 연쇄 삭제되므로 관리자 확인 후에만 호출합니다. */
  async deleteRoom(id: string) {
    const room = await this.prisma.room.findUnique({ where: { id }, select: { id: true } });
    if (!room) throw new NotFoundException("삭제할 룸을 찾을 수 없습니다.");
    await this.prisma.room.delete({ where: { id } });
    return { deletedId: id };
  }

  /** 브라우저에서 바로 열 수 있는 주소를 만들고 DB 내부 암호문과 관계 배열은 응답에서 제거합니다. */
  private roomView(room: any) {
    const { accessKeys, ...safeRoom } = room; const encryptedKey = accessKeys?.[0]?.encryptedKey as string | undefined;
    const guestBaseUrl = (process.env.GUEST_PUBLIC_URL ?? "http://localhost:5174").replace(/\/$/, "");
    // 예전 비밀값으로 암호화된 키는 복원할 수 없지만, 해당 룸만 주소 없음으로 표시하고 전체 관리자 목록은 유지합니다.
    const accessKey = encryptedKey ? decryptSecretOrNull(encryptedKey) : null;
    return { ...safeRoom, guestUrl: accessKey ? `${guestBaseUrl}/?accessKey=${encodeURIComponent(accessKey)}` : null };
  }
}
