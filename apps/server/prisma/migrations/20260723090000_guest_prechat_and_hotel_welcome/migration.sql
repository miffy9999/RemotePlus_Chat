-- 호텔마다 Guest 채팅방 첫 화면에 저장·출력할 일본어 기본 자동 안내문을 관리합니다.
ALTER TABLE "Hotel"
ADD COLUMN "welcomeMessage" TEXT NOT NULL
DEFAULT 'こんにちは。ホテルのカスタマーサポートです。ご用件をメッセージでお送りください。';

-- 상담 만료는 Agent가 대화를 처음 연 시점부터 계산하므로 대기 중에는 만료시각을 두지 않습니다.
ALTER TABLE "ChatSession"
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- 배포 전에 생성되어 아직 대기 중인 상담도 새 정책에 맞춰 무제한 대기 상태로 전환합니다.
UPDATE "ChatSession"
SET "expiresAt" = NULL
WHERE "status" = 'WAITING';
