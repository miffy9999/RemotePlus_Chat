CREATE TABLE "HotelWelcomeMessage" (
  "hotelId" UUID NOT NULL,
  "language" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HotelWelcomeMessage_pkey" PRIMARY KEY ("hotelId", "language"),
  CONSTRAINT "HotelWelcomeMessage_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "HotelWelcomeMessage_language_idx" ON "HotelWelcomeMessage"("language");

INSERT INTO "HotelWelcomeMessage" ("hotelId", "language", "message")
SELECT "id", 'ja', 'ようこそ、' || "name" || 'へ。ご滞在中のお困りごとやご希望を、こちらへお気軽にお送りください。' FROM "Hotel"
UNION ALL
SELECT "id", 'en', 'Welcome to ' || "name" || '. Please send us any questions or requests about your stay.' FROM "Hotel"
UNION ALL
SELECT "id", 'ko', "name" || '에 오신 것을 환영합니다. 투숙 중 궁금한 점이나 요청 사항을 편하게 보내 주세요.' FROM "Hotel"
UNION ALL
SELECT "id", 'zh', '欢迎光临' || "name" || '。入住期间如有任何疑问或需求，请随时给我们留言。' FROM "Hotel";
