import { createHash } from "node:crypto";

interface RestRateContext {
  ip: string;
  method: string;
  path: string;
  authorization?: string;
}

/** 요청 종류에 맞는 고정 창 키와 분당 상한을 계산하며 인증 원문은 키에 남기지 않습니다. */
export function restRateLimitPolicy(context: RestRateContext): { key: string; limit: number } {
  const staffListPolling = context.method === "GET" && context.path.endsWith("/agent/chat-sessions");
  if (staffListPolling && context.authorization) {
    const fingerprint = createHash("sha256").update(context.authorization).digest("hex").slice(0, 24);
    return { key: `${context.ip}:staff-list:${fingerprint}`, limit: 30 };
  }

  const sensitive = /\/(login|verify|chat-sessions)/.test(context.path);
  return { key: `${context.ip}:${context.method}:${context.path}`, limit: sensitive ? 30 : 120 };
}
