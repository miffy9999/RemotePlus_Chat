-- Render 실DB에서 앞선 복구 파일도 이미 적용된 이름으로 인식된 경우를 위해 더 최신 이름으로 두 무료 테스트 계정을 마지막 한 번 복구합니다.
-- 매 서버 시작이 아니라 이 마이그레이션이 처음 적용될 때만 실행되며 기존 무기한 JWT는 tokenVersion 증가로 폐기합니다.
UPDATE "Agent"
SET "passwordHash" = '$2b$12$f2enOfSK8xp/M0fif.OsvOWIZxAcfyCtVWF0ATQTCbfDA8pk1Cxxu',
    "tokenVersion" = "tokenVersion" + 1
WHERE "loginId" = 'admin'
  AND "role" = 'ADMIN';

UPDATE "Agent"
SET "passwordHash" = '$2b$12$XsEeaq5aAQZstcnGEzBmQuDgvJM76bV8hB66eCby45qi/OylqpziG',
    "tokenVersion" = "tokenVersion" + 1
WHERE "loginId" = 'agent01'
  AND "role" = 'AGENT';
