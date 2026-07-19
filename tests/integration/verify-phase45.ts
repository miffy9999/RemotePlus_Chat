import { PrismaClient } from "@prisma/client";
import { sign } from "jsonwebtoken";

const API = process.env.API_URL ?? "http://127.0.0.1:4000/api";
const prisma = new PrismaClient();

/** JSON REST 호출의 상태와 본문을 함께 반환해 성공·실패 계약을 모두 검사한다. */
async function call(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } });
  return { status: response.status, body: await response.json().catch(() => ({})) as any };
}

async function main(): Promise<void> {
  const suffix = Date.now().toString(36); const createdIds: { agent?: string; room?: string; hotel?: string; session?: string } = {};
  const checks: Record<string, boolean> = {};
  try {
    const adminLogin = await call("/auth/admin/login", { method: "POST", body: JSON.stringify({ loginId: "admin", password: "Admin1234!" }) });
    const adminToken = adminLogin.body.accessToken as string; const adminHeaders = { authorization: `Bearer ${adminToken}` };
    checks.adminLogin = adminLogin.status === 201 && Boolean(adminToken);

    const agent = await call("/admin/agents", { method: "POST", headers: adminHeaders, body: JSON.stringify({ name: "자동검증", loginId: `check_${suffix}`, password: "Check1234", role: "AGENT" }) });
    createdIds.agent = agent.body.id; checks.agentCreated = agent.status === 201 && agent.body.loginId === `check_${suffix}`;
    const hotel = await call("/admin/hotels", { method: "POST", headers: adminHeaders, body: JSON.stringify({ name: `검증호텔-${suffix}` }) });
    createdIds.hotel = hotel.body.id; checks.hotelCreated = hotel.status === 201;
    const room = await call("/admin/rooms", { method: "POST", headers: adminHeaders, body: JSON.stringify({ hotelId: hotel.body.id, roomNumber: "T101" }) });
    createdIds.room = room.body.id; checks.roomCreated = room.status === 201 && room.body.hotelId === hotel.body.id;
    const filtered = await call(`/admin/rooms?hotelId=${hotel.body.id}`, { headers: adminHeaders });
    checks.hotelFilter = filtered.status === 200 && filtered.body.length === 1 && filtered.body[0].id === room.body.id;

    // 만료 작업 검증용 세션은 DB에 직접 준비하되 서비스가 5초 주기로 상태를 바꾸는지만 API로 관찰한다.
    const session = await prisma.chatSession.create({ data: { roomId: room.body.id, language: "ko", guestTokenHash: `phase45-${suffix}`, expiresAt: new Date(Date.now() - 1000) } });
    createdIds.session = session.id; await new Promise((resolve) => setTimeout(resolve, 6_000));
    const expired = await prisma.chatSession.findUnique({ where: { id: session.id } });
    checks.automaticExpiration = expired?.status === "EXPIRED" && expired.closeReason === "TIME_LIMIT";

    const unauthorized = await call("/admin/hotels"); checks.adminUnauthorizedBlocked = unauthorized.status === 401;
    // 정상 서명이더라도 exp가 지난 JWT는 인증 서비스에서 반드시 거부해야 한다.
    const expiredToken = sign({ sub: "expired-check", role: "ADMIN", kind: "staff" }, process.env.JWT_SECRET ?? "phase1-local-integration-test-secret-2026", { expiresIn: -1 });
    const expiredTokenResult = await call("/admin/hotels", { headers: { authorization: `Bearer ${expiredToken}` } }); checks.expiredTokenBlocked = expiredTokenResult.status === 401;
    const invalidKey = await call("/guest/access/verify", { method: "POST", body: JSON.stringify({ accessKey: "not-a-real-key" }) }); checks.invalidAccessKeyBlocked = invalidKey.status >= 400 && invalidKey.status < 500;

    // 관리자 로그인 경로만 분리해 31번째 반복 요청이 429가 되는지 확인하고 Agent 테스트에는 영향을 주지 않는다.
    let lastStatus = 0; for (let index = 0; index < 31; index += 1) lastStatus = (await call("/auth/admin/login", { method: "POST", body: JSON.stringify({ loginId: "none", password: "Wrong1234" }) })).status;
    checks.loginRateLimited = lastStatus === 429;
  } finally {
    // 자동 테스트가 개발 목록에 가짜 데이터를 남기지 않도록 생성 역순으로 정확한 ID만 정리한다.
    if (createdIds.session) await prisma.chatSession.deleteMany({ where: { id: createdIds.session } });
    if (createdIds.room) await prisma.room.deleteMany({ where: { id: createdIds.room } });
    if (createdIds.hotel) await prisma.hotel.deleteMany({ where: { id: createdIds.hotel } });
    if (createdIds.agent) await prisma.agent.deleteMany({ where: { id: createdIds.agent } });
    await prisma.$disconnect();
  }
  if (Object.values(checks).some((value) => !value)) { console.error(JSON.stringify(checks)); process.exit(1); }
  console.log(JSON.stringify(checks));
}

void main();
