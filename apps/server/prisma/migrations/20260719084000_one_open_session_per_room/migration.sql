-- 애플리케이션의 선행 조회만으로는 동시에 들어온 두 생성 요청을 완전히 막을 수 없습니다.
-- PostgreSQL이 룸별 WAITING 또는 ACTIVE 상담을 하나만 허용하도록 최종 무결성을 보장합니다.
CREATE UNIQUE INDEX "ChatSession_one_open_per_room"
ON "ChatSession" ("roomId")
WHERE "status" IN ('WAITING', 'ACTIVE');
