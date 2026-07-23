import { BadRequestException, ConflictException } from "@nestjs/common";
import { isUUID } from "class-validator";

export const MAX_MESSAGE_LENGTH = 1000;

/**
 * WebSocket 입력은 REST 전역 ValidationPipe를 거치지 않으므로 메시지 서비스에서 직접 검증합니다.
 * 검증된 문자열을 반환해 저장 계층이 원본 입력을 다시 신뢰하지 않게 합니다.
 */
export function validateMessageInput(input: { sessionId?: unknown; clientMessageId?: unknown; content?: unknown }) {
  if (typeof input.sessionId !== "string" || !isUUID(input.sessionId)) throw new BadRequestException("올바른 상담 ID가 필요합니다.");
  if (typeof input.clientMessageId !== "string" || !isUUID(input.clientMessageId)) throw new BadRequestException("올바른 clientMessageId가 필요합니다.");
  if (typeof input.content !== "string") throw new BadRequestException("텍스트 메시지만 전송할 수 있습니다.");
  const content = input.content.trim();
  if (!content || content.length > MAX_MESSAGE_LENGTH) throw new BadRequestException(`메시지는 1자 이상 ${MAX_MESSAGE_LENGTH}자 이하여야 합니다.`);
  return { sessionId: input.sessionId, clientMessageId: input.clientMessageId, content };
}

/**
 * Guest는 WAITING에서도 문의를 미리 저장할 수 있지만 Agent는 담당 배정된 ACTIVE에서만 답변합니다.
 * ACTIVE에는 Agent가 대화를 연 시점에 계산한 만료시각이 반드시 있어야 합니다.
 */
export function assertSessionWritable(status: string, expiresAt: Date | null, senderKind: "guest" | "staff", now: Date = new Date()): void {
  if (senderKind === "guest" && status === "WAITING") return;
  if (status !== "ACTIVE") throw new ConflictException("진행 가능한 상담에서만 메시지를 보낼 수 있습니다.");
  if (!expiresAt || expiresAt.getTime() <= now.getTime()) throw new ConflictException("상담 제한 시간이 만료되었습니다.");
}
