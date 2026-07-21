import { config } from "dotenv";
import { hash } from "bcrypt";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

// pnpm filter가 작업 폴더를 apps/server로 바꾸더라도 파일 위치를 기준으로 루트 .env를 정확히 읽습니다.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, "../../../.env") });

const prisma = new PrismaClient();

/** 개발용 접근 키도 운영 코드와 같은 SHA-256 규칙으로 저장합니다. */
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * 로컬 개발을 위한 최소 호텔, 객실, 접근 키, 관리자와 Agent를 반복 실행 가능하게 생성합니다.
 * 운영 환경에서는 기본 비밀번호를 사용하지 말고 별도 안전한 계정 생성 절차를 사용해야 합니다.
 */
async function seed(): Promise<void> {
  const hotel = await prisma.hotel.upsert({ where: { id: "00000000-0000-0000-0000-000000000001" }, update: {}, create: { id: "00000000-0000-0000-0000-000000000001", name: "도쿄 센트럴 호텔" } });
  const room = await prisma.room.upsert({ where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber: "1201" } }, update: {}, create: { hotelId: hotel.id, roomNumber: "1201" } });
  const accessKey = process.env.SEED_ROOM_ACCESS_KEY ?? "demo-room-access-1201";
  await prisma.roomAccessKey.upsert({ where: { keyHash: sha256(accessKey) }, update: { status: "ACTIVE" }, create: { roomId: room.id, keyHash: sha256(accessKey) } });

  // 두 상담방의 메시지가 섞이지 않는지 통합 테스트하기 위한 두 번째 개발용 객실입니다.
  const secondRoom = await prisma.room.upsert({ where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber: "1202" } }, update: {}, create: { hotelId: hotel.id, roomNumber: "1202" } });
  const secondAccessKey = process.env.SEED_SECOND_ROOM_ACCESS_KEY ?? "demo-room-access-1202";
  await prisma.roomAccessKey.upsert({ where: { keyHash: sha256(secondAccessKey) }, update: { status: "ACTIVE" }, create: { roomId: secondRoom.id, keyHash: sha256(secondAccessKey) } });

  const adminPassword = await hash(process.env.SEED_ADMIN_PASSWORD ?? "Admin1234!", 12);
  const agentPassword = await hash(process.env.SEED_AGENT_PASSWORD ?? "Agent1234!", 12);
  await prisma.agent.upsert({ where: { loginId: "admin" }, update: {}, create: { name: "시스템 관리자", loginId: "admin", passwordHash: adminPassword, role: "ADMIN" } });
  await prisma.agent.upsert({ where: { loginId: "agent01" }, update: {}, create: { name: "김상담", loginId: "agent01", passwordHash: agentPassword, role: "AGENT" } });
}

seed().finally(async () => prisma.$disconnect());
