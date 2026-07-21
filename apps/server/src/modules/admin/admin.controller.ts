import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { requireStaff } from "../auth/request-auth";
import { AdminService } from "./admin.service";
import { CreateAgentDto } from "./dto/create-agent.dto";
import { CreateHotelDto } from "./dto/create-hotel.dto";
import { CreateRoomDto } from "./dto/create-room.dto";

/** `/admin` 아래의 모든 API는 각 요청마다 ADMIN 역할 JWT를 다시 검사한다. */
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService, private readonly auth: AuthService) {}
  /** 만료 없는 관리자 JWT라도 현재 계정이 활성 상태인지 DB에서 확인합니다. */
  private async authorize(request: Request): Promise<void> { await requireStaff(request, this.auth, ["ADMIN"]); }
  @Get("agents") async listAgents(@Req() req: Request) { await this.authorize(req); return this.admin.listAgents(); }
  @Post("agents") async createAgent(@Req() req: Request, @Body() dto: CreateAgentDto) { await this.authorize(req); return this.admin.createAgent(dto); }
  @Delete("agents/:id") async deleteAgent(@Req() req: Request, @Param("id", new ParseUUIDPipe()) id: string) { await this.authorize(req); return this.admin.deleteAgent(id); }
  @Get("hotels") async listHotels(@Req() req: Request) { await this.authorize(req); return this.admin.listHotels(); }
  @Post("hotels") async createHotel(@Req() req: Request, @Body() dto: CreateHotelDto) { await this.authorize(req); return this.admin.createHotel(dto); }
  @Delete("hotels/:id") async deleteHotel(@Req() req: Request, @Param("id", new ParseUUIDPipe()) id: string) { await this.authorize(req); return this.admin.deleteHotel(id); }
  @Get("rooms") async listRooms(@Req() req: Request, @Query("hotelId") hotelId?: string) { await this.authorize(req); return this.admin.listRooms(hotelId); }
  @Post("rooms") async createRoom(@Req() req: Request, @Body() dto: CreateRoomDto) { await this.authorize(req); return this.admin.createRoom(dto); }
  @Delete("rooms/:id") async deleteRoom(@Req() req: Request, @Param("id", new ParseUUIDPipe()) id: string) { await this.authorize(req); return this.admin.deleteRoom(id); }
}
