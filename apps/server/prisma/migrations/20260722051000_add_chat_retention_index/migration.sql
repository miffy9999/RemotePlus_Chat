-- 종료 시각 기준 30일 보존 정리가 전체 상담을 훑지 않도록 상태·종료 시각 복합 인덱스를 추가합니다.
CREATE INDEX "ChatSession_status_closedAt_idx" ON "ChatSession"("status", "closedAt");
