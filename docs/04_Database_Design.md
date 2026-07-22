# 데이터베이스 설계

실제 Prisma 스키마는 `apps/server/prisma/schema.prisma`, 마이그레이션은 `apps/server/prisma/migrations`에 둔다.

## 핵심 제약조건

- `Room(hotelId, roomNumber)`: 호텔 안에서 룸 번호 중복 금지
- `RoomAccessKey.keyHash`: 접근 키 해시 중복 금지
- `Agent.loginId`: 로그인 ID 중복 금지
- `ChatSession.guestTokenHash`: 투숙객 상담 토큰 해시 중복 금지
- `Message(sessionId, clientMessageId)`: 같은 상담에서 재전송된 메시지 중복 저장 금지

## 주요 조회 인덱스

- 룸: `hotelId + status`
- 접근 키: `roomId + status`
- 상담: `status + createdAt`, `roomId + status`, `status + closedAt`(30일 보존 만료 정리)
- 메시지: `sessionId + createdAt`

## 보안 저장 원칙

- Agent 비밀번호는 bcrypt 해시만 저장한다.
- 룸 접근 키와 투숙객 상담 토큰은 SHA-256 해시만 저장한다.
- API 응답에는 `passwordHash`, `keyHash`, `guestTokenHash`를 포함하지 않는다.

## Phase 1 시간 규칙

상담 생성 시 `expiresAt`을 생성 시각에서 15분 뒤로 기록한다. Agent 수락 시 `startedAt`을 기록하지만 만료 시각을 연장하지 않는다.

## 상담 기록 보존 규칙

- `CLOSED`, `EXPIRED`, `CANCELLED`, `BLOCKED` 상태이면서 `closedAt`이 서버 시각 기준 30일 이전인 상담을 삭제한다.
- 진행 가능한 `WAITING`, `ACTIVE` 상담과 `closedAt`이 없는 데이터는 자동 삭제하지 않는다.
- `ChatSession` 삭제 시 외래 키의 `onDelete: Cascade`로 하위 `Message`도 같은 트랜잭션에서 삭제한다.
- 무료 플랜 DB 부하를 제한하기 위해 서버 시작 후 한 번 확인하고 이후 24시간에 한 번만 인덱스 조건의 `deleteMany`를 실행한다.
