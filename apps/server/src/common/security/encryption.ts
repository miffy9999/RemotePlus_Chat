import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/** 환경변수의 긴 비밀문자열을 AES-256에 필요한 32바이트 키로 고정 변환합니다. */
function encryptionKey(): Buffer {
  const secret = process.env.ACCESS_KEY_ENCRYPTION_SECRET;
  if (!secret || secret === "replace-with-another-long-random-secret") throw new Error("ACCESS_KEY_ENCRYPTION_SECRET에 충분히 긴 임의 값을 설정해야 합니다.");
  return createHash("sha256").update(secret, "utf8").digest();
}

/** 룸 접근 키 원문을 AES-256-GCM으로 암호화해 DB 유출 시 바로 사용할 수 없게 저장합니다. */
export function encryptSecret(value: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

/** 관리자 인증을 통과한 룸 목록에서만 암호문을 복호화해 투숙객 주소를 구성합니다. */
export function decryptSecret(value: string): string {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("저장된 접근 키 암호문 형식이 올바르지 않습니다.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

/**
 * 이전 비밀값으로 생성되었거나 손상된 암호문은 복호화할 수 없으므로 null을 반환합니다.
 * 관리자 목록 하나의 오래된 접근키 때문에 Agent·호텔·전체 룸 조회까지 실패하지 않게 할 때 사용합니다.
 */
export function decryptSecretOrNull(value: string): string | null {
  try {
    return decryptSecret(value);
  } catch {
    return null;
  }
}
