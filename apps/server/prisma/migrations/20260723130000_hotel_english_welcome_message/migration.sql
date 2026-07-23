-- 영어 UI Guest에게 해당 호텔의 영어 자동 안내문을 첫 SYSTEM 메시지로 저장합니다.
ALTER TABLE "Hotel"
ADD COLUMN "welcomeMessageEn" TEXT NOT NULL
DEFAULT 'Hello. This is the hotel customer support team. Please send us your request.';
