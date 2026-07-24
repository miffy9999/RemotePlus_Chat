-- 완료 상담 Log를 상태로 제한한 뒤 최근 활동 순서로 100건씩 읽을 때 전체 정렬 비용을 줄입니다.
CREATE INDEX "ChatSession_status_lastActivityAt_idx"
ON "ChatSession"("status", "lastActivityAt");
