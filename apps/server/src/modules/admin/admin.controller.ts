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
  private authorize(request: Request): void { requireStaff(request, this.auth, ["ADMIN"]); }
  @Get("agents") listAgents(@Req() req: Request) { this.authorize(req); return this.admin.listAgents(); }
  @Post("agents") createAgent(@Req() req: Request, @Body() dto: CreateAgentDto) { this.authorize(req); return this.admin.createAgent(dto); }
  @Delete("agents/:id") deleteAgent(@Req() req: Request, @Param("id", new ParseUUIDPipe()) id: string) { this.authorize(req); return this.admin.deleteAgent(id); }
  @Get("hotels") listHotels(@Req() req: Request) { this.authorize(req); return this.admin.listHotels(); }
  @Post("hotels") createHotel(@Req() req: Request, @Body() dto: CreateHotelDto) { this.authorize(req); return this.admin.createHotel(dto); }
  @Delete("hotels/:id") deleteHotel(@Req() req: Request, @Param("id", new ParseUUIDPipe()) id: string) { this.authorize(req); return this.admin.deleteHotel(id); }
  @Get("rooms") listRooms(@Req() req: Request, @Query("hotelId") hotelId?: string) { this.authorize(req); return this.admin.listRooms(hotelId); }
  @Post("rooms") createRoom(@Req() req: Request, @Body() dto: CreateRoomDto) { this.authorize(req); return this.admin.createRoom(dto); }
  @Delete("rooms/:id") deleteRoom(@Req() req: Request, @Param("id", new ParseUUIDPipe()) id: string) { this.authorize(req); return this.admin.deleteRoom(id); }
}
