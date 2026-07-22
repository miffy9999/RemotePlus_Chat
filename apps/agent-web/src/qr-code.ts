import QRCode from "qrcode";

// QR 모듈을 흐리지 않는 정수 배율을 우선하므로 실제 한 변은 URL 길이에 따라 목표값보다 몇 px 작을 수 있습니다.
const QR_TARGET_SIZE_PX = 1024;

/**
 * 객실 고객 URL을 인쇄용 PNG 데이터 URL로 변환합니다.
 *
 * 입력은 HTTP(S) URL만 허용해 `javascript:` 같은 실행 가능한 스킴이 QR에 들어가는 것을 막습니다.
 * 오류 정정 등급 H와 4모듈 여백을 사용해 종이 오염이나 인쇄 오차에도 스캔 성공률을 확보합니다.
 */
export async function createRoomQrDataUrl(guestUrl: string): Promise<string> {
  const parsed = new URL(guestUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("QR에는 HTTP(S) 고객 주소만 사용할 수 있습니다.");
  }

  return QRCode.toDataURL(parsed.toString(), {
    errorCorrectionLevel: "H",
    margin: 4,
    width: QR_TARGET_SIZE_PX,
    color: { dark: "#101828", light: "#FFFFFFFF" }
  });
}

/**
 * 호텔명과 객실 번호를 알아볼 수 있는 파일명으로 만듭니다.
 * Windows를 포함한 주요 운영체제의 금지 문자를 하이픈으로 바꿔 다운로드 실패를 예방합니다.
 */
export function createRoomQrFileName(hotelName: string, roomNumber: string): string {
  const safePart = (value: string): string => value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-").replace(/[. ]+$/g, "") || "room";
  return `remoteplus-${safePart(hotelName)}-${safePart(roomNumber)}-qr.png`;
}

/** 브라우저 다운로드 링크를 잠깐 만들어 서버 업로드 없이 생성된 QR PNG를 저장합니다. */
export function downloadRoomQr(dataUrl: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
}
