-- 진행 상담의 제한시간 기준을 "Agent가 방을 연 시각"에서 "Agent가 첫 메시지를 저장한 시각"으로 보정합니다.
-- 첫 Agent 메시지가 이미 있는 상담은 그 메시지 시각을 기준으로 15분을 다시 계산합니다.
WITH "FirstAgentMessage" AS (
  SELECT
    "sessionId",
    MIN("createdAt") AS "firstAgentMessageAt"
  FROM "Message"
  WHERE "senderType" = 'AGENT'
  GROUP BY "sessionId"
)
UPDATE "ChatSession" AS "session"
SET
  "startedAt" = "first"."firstAgentMessageAt",
  "expiresAt" = "first"."firstAgentMessageAt" + INTERVAL '15 minutes'
FROM "FirstAgentMessage" AS "first"
WHERE "session"."id" = "first"."sessionId"
  AND "session"."status" = 'ACTIVE';

-- 아직 Agent가 답하지 않은 진행 상담은 타이머를 시작하지 않은 ACTIVE 상태로 되돌립니다.
UPDATE "ChatSession" AS "session"
SET
  "startedAt" = NULL,
  "expiresAt" = NULL
WHERE "session"."status" = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1
    FROM "Message"
    WHERE "Message"."sessionId" = "session"."id"
      AND "Message"."senderType" = 'AGENT'
  );
