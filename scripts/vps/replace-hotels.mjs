import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const CONFIRMATION = "REPLACE_ALL_HOTELS_AND_ROOMS";

function fail(message) {
  throw new Error(message);
}

function normalizedText(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must not be blank.`);
  return value.trim();
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function encryptAccessKey(value, secret) {
  const key = createHash("sha256").update(secret, "utf8").digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decryptAccessKey(value, secret) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) fail("Generated access key encryption format is invalid.");
  const key = createHash("sha256").update(secret, "utf8").digest();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.hotels) || !Array.isArray(payload.rooms)) {
    fail("The import JSON must contain hotels and rooms arrays.");
  }

  const hotelIds = new Set();
  const hotelNames = new Set();
  const hotels = payload.hotels.map((item, index) => {
    const sourceId = normalizedText(item?.sourceId, `Hotel ${index + 1} sourceId`);
    const name = normalizedText(item?.name, `Hotel ${index + 1} name`).replaceAll("?", " ");
    const normalizedName = name.toLocaleLowerCase("ja-JP");
    if (hotelIds.has(sourceId)) fail(`Duplicate hotel sourceId: ${sourceId}`);
    if (hotelNames.has(normalizedName)) fail(`Duplicate hotel name: ${name}`);
    hotelIds.add(sourceId);
    hotelNames.add(normalizedName);
    return { sourceId, name };
  });

  const roomKeys = new Set();
  const rooms = payload.rooms.map((item, index) => {
    const hotelSourceId = normalizedText(item?.hotelSourceId, `Room ${index + 1} hotelSourceId`);
    const roomNumber = normalizedText(item?.roomNumber, `Room ${index + 1} roomNumber`);
    if (!hotelIds.has(hotelSourceId)) fail(`Room references an unknown hotel: ${hotelSourceId}`);
    const roomKey = `${hotelSourceId}\u0000${roomNumber}`;
    if (roomKeys.has(roomKey)) fail(`Duplicate room: ${hotelSourceId}/${roomNumber}`);
    roomKeys.add(roomKey);
    return { hotelSourceId, roomNumber };
  });

  if (hotels.length === 0 || rooms.length === 0) fail("At least one hotel and one room are required.");
  return { hotels, rooms };
}

if (process.env.REPLACE_HOTEL_DATA_CONFIRM !== CONFIRMATION) {
  fail(`Set REPLACE_HOTEL_DATA_CONFIRM=${CONFIRMATION} to confirm the destructive replacement.`);
}

const encryptionSecret = process.env.ACCESS_KEY_ENCRYPTION_SECRET ?? "";
if (encryptionSecret.length < 32) fail("ACCESS_KEY_ENCRYPTION_SECRET is missing or too short.");

const inputPath = process.argv[2];
if (!inputPath) fail("Import JSON path is required.");
const payload = validatePayload(JSON.parse(await readFile(inputPath, "utf8")));
const prisma = new PrismaClient();

try {
  const before = {
    hotels: await prisma.hotel.count(),
    rooms: await prisma.room.count(),
    accessKeys: await prisma.roomAccessKey.count(),
    sessions: await prisma.chatSession.count(),
    messages: await prisma.message.count(),
    agents: await prisma.agent.count(),
  };

  const hotelIdBySource = new Map(payload.hotels.map((hotel) => [hotel.sourceId, randomUUID()]));
  const hotels = payload.hotels.map((hotel) => ({ id: hotelIdBySource.get(hotel.sourceId), name: hotel.name }));
  const rooms = payload.rooms.map((room) => ({
    id: randomUUID(),
    hotelId: hotelIdBySource.get(room.hotelSourceId),
    roomNumber: room.roomNumber,
  }));
  const accessKeys = rooms.map((room) => {
    const value = randomBytes(32).toString("base64url");
    return {
      id: randomUUID(),
      roomId: room.id,
      keyHash: sha256(value),
      encryptedKey: encryptAccessKey(value, encryptionSecret),
    };
  });

  const firstAccessKey = accessKeys[0];
  if (!firstAccessKey?.encryptedKey || sha256(decryptAccessKey(firstAccessKey.encryptedKey, encryptionSecret)) !== firstAccessKey.keyHash) {
    fail("Generated room access key encryption verification failed.");
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.hotel.deleteMany();
    await transaction.hotel.createMany({ data: hotels });
    await transaction.room.createMany({ data: rooms });
    await transaction.roomAccessKey.createMany({ data: accessKeys });

    const [hotelCount, roomCount, accessKeyCount, agentCount] = await Promise.all([
      transaction.hotel.count(),
      transaction.room.count(),
      transaction.roomAccessKey.count(),
      transaction.agent.count(),
    ]);
    if (hotelCount !== hotels.length || roomCount !== rooms.length || accessKeyCount !== rooms.length) {
      fail("Imported database counts do not match the input data.");
    }
    if (agentCount !== before.agents) fail("Agent account count changed during the import.");
  }, { maxWait: 10_000, timeout: 60_000 });

  const after = {
    hotels: await prisma.hotel.count(),
    rooms: await prisma.room.count(),
    accessKeys: await prisma.roomAccessKey.count(),
    sessions: await prisma.chatSession.count(),
    messages: await prisma.message.count(),
    agents: await prisma.agent.count(),
  };

  process.stdout.write(`${JSON.stringify({ before, after })}\n`);
} finally {
  await prisma.$disconnect();
}
