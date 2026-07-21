const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
];

/**
 * REST와 WebSocket이 동일한 허용 출처 목록을 사용하도록 환경변수를 정규화합니다.
 * WEB_ORIGINS는 쉼표로 여러 주소를 받을 수 있으며 운영 환경에서는 명시된 주소만 허용합니다.
 */
export function allowedWebOrigins(): string[] {
  const configured = [process.env.WEB_ORIGINS, process.env.AGENT_WEB_ORIGIN, process.env.GUEST_WEB_ORIGIN]
    .flatMap((value) => value?.split(",") ?? [])
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const local = process.env.NODE_ENV === "production" ? [] : LOCAL_ORIGINS;
  return [...new Set([...configured, ...local])];
}

/** Render의 PORT를 우선 사용하고 로컬에서는 기존 SERVER_PORT를 유지합니다. */
export function serverPort(): number {
  const value = Number(process.env.PORT ?? process.env.SERVER_PORT ?? 4000);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) throw new Error("PORT 또는 SERVER_PORT에 유효한 포트를 설정해야 합니다.");
  return value;
}

/** 운영 배포가 예시 비밀값이나 누락된 CORS 설정으로 시작되지 않도록 조기에 차단합니다. */
export function validateRuntimeEnvironment(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL 환경변수가 필요합니다.");
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < 32 || secret === "replace-with-a-long-random-secret") throw new Error("JWT_SECRET에 32자 이상의 운영용 임의 값을 설정해야 합니다.");
  const encryptionSecret = process.env.ACCESS_KEY_ENCRYPTION_SECRET ?? "";
  if (encryptionSecret.length < 32 || encryptionSecret === "replace-with-another-long-random-secret") throw new Error("ACCESS_KEY_ENCRYPTION_SECRET에 32자 이상의 운영용 임의 값을 설정해야 합니다.");
  if (allowedWebOrigins().length === 0) throw new Error("WEB_ORIGINS에 허용할 Vercel 출처를 설정해야 합니다.");
  if (!process.env.GUEST_PUBLIC_URL) throw new Error("GUEST_PUBLIC_URL에 Guest Vercel 주소를 설정해야 합니다.");
  serverPort();
}
