-- 과거에 같은 이름의 데이터 마이그레이션이 먼저 적용된 Render DB를 현재 문서의 무료 테스트 계정 값으로 한 번만 복구합니다.
-- 실제 해시가 다른 행만 갱신하고 tokenVersion을 올려 변경 전 비밀번호로 발급된 무기한 JWT도 즉시 폐기합니다.
UPDATE "Agent"
SET "passwordHash" = '$2b$12$f2enOfSK8xp/M0fif.OsvOWIZxAcfyCtVWF0ATQTCbfDA8pk1Cxxu',
    "tokenVersion" = "tokenVersion" + 1
WHERE "loginId" = 'admin'
  AND "role" = 'ADMIN'
  AND "passwordHash" <> '$2b$12$f2enOfSK8xp/M0fif.OsvOWIZxAcfyCtVWF0ATQTCbfDA8pk1Cxxu';

UPDATE "Agent"
SET "passwordHash" = '$2b$12$XsEeaq5aAQZstcnGEzBmQuDgvJM76bV8hB66eCby45qi/OylqpziG',
    "tokenVersion" = "tokenVersion" + 1
WHERE "loginId" = 'agent01'
  AND "role" = 'AGENT'
  AND "passwordHash" <> '$2b$12$XsEeaq5aAQZstcnGEzBmQuDgvJM76bV8hB66eCby45qi/OylqpziG';
