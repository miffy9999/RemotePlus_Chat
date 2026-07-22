-- 무료 DB에서 매 목록 조회마다 메시지 전체를 집계하지 않도록 상담 행에 최근 활동 시각을 비정규화합니다.
ALTER TABLE "ChatSession" ADD COLUMN "lastActivityAt" TIMESTAMP(3);

-- 기존 상담은 마지막 메시지 시각을 우선하고 메시지가 없으면 상담 생성 시각을 사용해 최초 정렬도 정확하게 맞춥니다.
UPDATE "ChatSession" AS session
SET "lastActivityAt" = COALESCE(
  (SELECT MAX(message."createdAt") FROM "Message" AS message WHERE message."sessionId" = session."id"),
  session."createdAt"
);

ALTER TABLE "ChatSession" ALTER COLUMN "lastActivityAt" SET NOT NULL;
ALTER TABLE "ChatSession" ALTER COLUMN "lastActivityAt" SET DEFAULT CURRENT_TIMESTAMP;

-- 전체 상담 목록에서 최근 활동순을 바로 읽어 Render 무료 PostgreSQL의 정렬·집계 부하를 제한합니다.
CREATE INDEX "ChatSession_lastActivityAt_idx" ON "ChatSession"("lastActivityAt");
