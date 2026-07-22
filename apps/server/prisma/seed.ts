import { config } from "dotenv";
import { hash } from "bcrypt";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { encryptSecret } from "../src/common/security/encryption";

// pnpm filter가 작업 폴더를 apps/server로 바꾸더라도 파일 위치를 기준으로 루트 .env를 정확히 읽습니다.
const currentDirectory = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(currentDirectory, "../../../.env") });

const prisma = new PrismaClient();

/** 운영 시드는 예시 비밀번호나 접속 키를 허용하지 않고 Render에 입력한 값만 사용합니다. */
function seedSecret(name: string, fallback: string, minimumLength = 12): string {
  const value = process.env[name]?.trim();
  if (process.env.NODE_ENV === "production" && (!value || value === fallback || value.length < minimumLength)) {
    throw new Error(`${name}에 ${minimumLength}자 이상의 운영용 임의 값을 설정해야 합니다.`);
  }
  return value || fallback;
}

/**
 * 무료 테스트 배포는 사용자 결정에 따라 짧은 고정 비밀번호를 허용합니다.
 * 테스트 플래그가 없는 운영 환경에서는 실수로 약한 시드 비밀번호를 쓰지 않도록 기존 12자 경계를 유지합니다.
 */
function seedPassword(name: string, fallback: string): string {
  const value = process.env[name];
  const allowInsecure = process.env.ALLOW_INSECURE_TEST_PASSWORDS === "true";
  if (process.env.NODE_ENV === "production" && !allowInsecure && (!value || value === fallback || value.length < 12)) {
    throw new Error(`${name}에 12자 이상의 운영용 임의 값을 설정하거나 테스트 허용 플래그를 켜야 합니다.`);
  }
  return value ?? fallback;
}

/** 개발용 접근 키도 운영 코드와 같은 SHA-256 규칙으로 저장합니다. */
function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * 로컬 개발을 위한 최소 호텔, 객실, 접근 키, 관리자와 Agent를 반복 실행 가능하게 생성합니다.
 * 운영 환경에서는 기본 비밀번호를 사용하지 말고 별도 안전한 계정 생성 절차를 사용해야 합니다.
 */
async function seed(): Promise<void> {
  // DTO의 UUID 검증과 같은 표준 v4 형태를 사용하여 관리자 화면에서 이 호텔에 룸을 추가할 수 있게 합니다.
  const seedHotelId = "11111111-1111-4111-8111-111111111111";
  const hotel = await prisma.hotel.upsert({ where: { id: seedHotelId }, update: {}, create: { id: seedHotelId, name: "도쿄 센트럴 호텔" } });
  const room = await prisma.room.upsert({ where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber: "1201" } }, update: {}, create: { hotelId: hotel.id, roomNumber: "1201" } });
  const accessKey = seedSecret("SEED_ROOM_ACCESS_KEY", "demo-room-access-1201");
  await prisma.roomAccessKey.upsert({ where: { keyHash: sha256(accessKey) }, update: { status: "ACTIVE", encryptedKey: encryptSecret(accessKey) }, create: { roomId: room.id, keyHash: sha256(accessKey), encryptedKey: encryptSecret(accessKey) } });

  // 두 상담방의 메시지가 섞이지 않는지 통합 테스트하기 위한 두 번째 개발용 객실입니다.
  const secondRoom = await prisma.room.upsert({ where: { hotelId_roomNumber: { hotelId: hotel.id, roomNumber: "1202" } }, update: {}, create: { hotelId: hotel.id, roomNumber: "1202" } });
  const secondAccessKey = seedSecret("SEED_SECOND_ROOM_ACCESS_KEY", "demo-room-access-1202");
  await prisma.roomAccessKey.upsert({ where: { keyHash: sha256(secondAccessKey) }, update: { status: "ACTIVE", encryptedKey: encryptSecret(secondAccessKey) }, create: { roomId: secondRoom.id, keyHash: sha256(secondAccessKey), encryptedKey: encryptSecret(secondAccessKey) } });

  // 명시적으로 테스트 모드를 켠 배포에서만 짧은 공용 비밀번호와 기존 계정 재설정을 허용합니다.
  const resetExistingPasswords = process.env.SEED_RESET_EXISTING_PASSWORDS === "true";
  const adminPassword = await hash(seedPassword("SEED_ADMIN_PASSWORD", "admin"), 12);
  const agentPassword = await hash(seedPassword("SEED_AGENT_PASSWORD", "agent01"), 12);
  await prisma.agent.upsert({ where: { loginId: "admin" }, update: resetExistingPasswords ? { passwordHash: adminPassword } : {}, create: { name: "시스템 관리자", loginId: "admin", passwordHash: adminPassword, role: "ADMIN" } });
  await prisma.agent.upsert({ where: { loginId: "agent01" }, update: resetExistingPasswords ? { passwordHash: agentPassword } : {}, create: { name: "김상담", loginId: "agent01", passwordHash: agentPassword, role: "AGENT" } });
}

seed().finally(async () => prisma.$disconnect());
