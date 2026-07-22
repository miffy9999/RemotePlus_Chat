-- 비밀번호 변경 시 기존 무기한 직원 JWT를 모두 폐기할 수 있도록 계정별 버전을 저장합니다.
ALTER TABLE "Agent" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
