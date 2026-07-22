-- 현재 무료 테스트 배포의 고정 계정을 사용자 지정 값으로 한 번만 재설정합니다.
-- 평문은 저장하지 않고 bcrypt cost 12로 미리 계산한 해시만 기록합니다.
UPDATE "Agent"
SET "passwordHash" = '$2b$12$f2enOfSK8xp/M0fif.OsvOWIZxAcfyCtVWF0ATQTCbfDA8pk1Cxxu'
WHERE "loginId" = 'admin' AND "role" = 'ADMIN';

UPDATE "Agent"
SET "passwordHash" = '$2b$12$XsEeaq5aAQZstcnGEzBmQuDgvJM76bV8hB66eCby45qi/OylqpziG'
WHERE "loginId" = 'agent01' AND "role" = 'AGENT';
