-- 대기 상담에는 제한 시간 만료값을 두지 않고, 기존 진행 상담은 실제 수락 시각 기준으로 보정합니다.
ALTER TABLE "ChatSession" ALTER COLUMN "expiresAt" DROP NOT NULL;

UPDATE "ChatSession"
SET "expiresAt" = NULL
WHERE "status" = 'WAITING';

UPDATE "ChatSession"
SET "expiresAt" = "startedAt" + INTERVAL '15 minutes'
WHERE "status" = 'ACTIVE'
  AND "startedAt" IS NOT NULL;
