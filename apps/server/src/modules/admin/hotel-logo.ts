export const MAX_HOTEL_LOGO_BYTES = 512 * 1024;

/** 확장자와 브라우저 MIME 표시는 신뢰하지 않고 실제 파일 시그니처로 허용 형식을 판별합니다. */
export function detectHotelLogoContentType(data: Buffer): "image/png" | "image/jpeg" | "image/webp" | null {
  if (
    data.length >= 8 &&
    data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}
