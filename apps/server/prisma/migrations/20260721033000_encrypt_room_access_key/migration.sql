-- 관리자만 룸 접속 주소를 다시 확인할 수 있도록 접근 키 암호문을 선택적으로 저장합니다.
-- 기존 keyHash는 투숙객 검증용으로 계속 사용하며 평문은 저장하지 않습니다.
ALTER TABLE "RoomAccessKey" ADD COLUMN "encryptedKey" TEXT;
