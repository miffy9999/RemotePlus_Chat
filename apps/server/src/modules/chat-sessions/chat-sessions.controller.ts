import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, Query, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "../auth/auth.service";
import { optionalStaff, requireGuestAccess, requireStaff } from "../auth/request-auth";
import { ChatSessionsService } from "./chat-sessions.service";
import { CreateSessionDto } from "./dto/create-session.dto";
import { ListSessionsDto } from "./dto/list-sessions.dto";

/** 투숙객과 직원이 함께 사용하는 상담 세션 REST API입니다. */
@Controller("chat-sessions")
export class ChatSessionsController {
  constructor(private readonly sessions: ChatSessionsService, private readonly auth: AuthService) {}

  /** 접근 키 검증 JWT를 확인한 뒤 새 WAITING 상담을 생성합니다. */
  @Post()
  create(@Req() request: Request, @Body() dto: CreateSessionDto) {
    return this.sessions.create(requireGuestAccess(request, this.auth), dto.language);
  }

  /** 직원 Bearer 토큰 또는 투숙객 `x-guest-token` 중 하나로 상담을 조회합니다. */
  @Get(":sessionId")
  async get(@Param("sessionId", new ParseUUIDPipe()) id: string, @Req() request: Request, @Headers("x-guest-token") guestToken?: string) {
    return this.sessions.get(id, await optionalStaff(request, this.auth), guestToken);
  }

  /** 재연결 시 저장된 메시지를 시간 순으로 복구합니다. */
  @Get(":sessionId/messages")
  async messages(@Param("sessionId", new ParseUUIDPipe()) id: string, @Req() request: Request, @Headers("x-guest-token") guestToken?: string) {
    return this.sessions.messages(id, await optionalStaff(request, this.auth), guestToken);
  }

  /** 담당 Agent 또는 관리자만 상담을 수동 종료할 수 있습니다. */
  @Post(":sessionId/close")
  async close(@Param("sessionId", new ParseUUIDPipe()) id: string, @Req() request: Request) {
    return this.sessions.close(id, await requireStaff(request, this.auth, ["AGENT", "ADMIN"]));
  }
}

/** Agent 전용 목록과 수락 API를 별도 경로로 분리해 권한 경계를 분명히 합니다. */
@Controller("agent/chat-sessions")
export class AgentChatSessionsController {
  constructor(private readonly sessions: ChatSessionsService, private readonly auth: AuthService) {}

  /** 대기·진행·종료 상태를 선택적으로 필터링해 조회합니다. */
  @Get()
  async list(@Req() request: Request, @Query() query: ListSessionsDto) {
    await requireStaff(request, this.auth, ["AGENT", "ADMIN"]);
    return this.sessions.list(query.status, query.scope);
  }

  /** WAITING 상담을 현재 Agent에게 원자적으로 배정하고 ACTIVE로 전환합니다. */
  @Post(":sessionId/accept")
  async accept(@Param("sessionId", new ParseUUIDPipe()) id: string, @Req() request: Request) {
    return this.sessions.accept(id, await requireStaff(request, this.auth, ["AGENT"]));
  }
}
