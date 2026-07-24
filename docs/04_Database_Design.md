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
- 상담: `status + createdAt`, `roomId + status`, `status + closedAt`(30일 보존 만료 정리), `status + lastActivityAt`(완료 로그 최신순 페이지네이션)
- 메시지: `sessionId + createdAt`

## 보안 저장 원칙

- Agent 비밀번호는 bcrypt 해시만 저장한다.
- 룸 접근 키와 투숙객 상담 토큰은 SHA-256 해시만 저장한다.
- API 응답에는 `passwordHash`, `keyHash`, `guestTokenHash`를 포함하지 않는다.

## 상담 시간 및 호텔 자동 안내문 규칙

- 상담 생성 시 `WAITING`, `startedAt=null`, `expiresAt=null`로 저장하며 대기 시간으로 만료하지 않는다.
- Agent가 처음 대화를 열 때는 `ACTIVE`와 `agentId`만 원자적으로 기록하고 `startedAt`, `expiresAt`은 null로 유지한다.
- 담당 Agent의 첫 `Message(senderType=AGENT)` 저장 트랜잭션에서 `startedAt=현재`, `expiresAt=현재+15분`을 함께 기록한다. 동시에 들어온 첫 답변은 `expiresAt IS NULL` 조건으로 하나만 타이머를 시작한다.
- 기준 변경 마이그레이션은 기존 ACTIVE 상담의 첫 Agent 메시지 시각을 찾아 타이머를 보정하고, Agent 메시지가 없는 ACTIVE는 두 시각을 null로 되돌린다.
- `Hotel.welcomeMessage`는 일본어와 현재 MVP 기본 대체 원문, `welcomeMessageEn`은 영어 Guest용 첫 안내문이다.
- 상담 생성 트랜잭션에서 선택 언어에 맞는 안내문을 첫 `SYSTEM` 메시지로 복사해 과거 안내 기록을 보존한다.

## 상담 기록 보존 규칙

- `CLOSED`, `EXPIRED`, `CANCELLED`, `BLOCKED` 상태이면서 `closedAt`이 서버 시각 기준 30일 이전인 상담을 삭제한다.
- 진행 가능한 `WAITING`, `ACTIVE` 상담과 `closedAt`이 없는 데이터는 자동 삭제하지 않는다.
- `ChatSession` 삭제 시 외래 키의 `onDelete: Cascade`로 하위 `Message`도 같은 트랜잭션에서 삭제한다.
- 무료 플랜 DB 부하를 제한하기 위해 서버 시작 후 한 번 확인하고 이후 24시간에 한 번만 인덱스 조건의 `deleteMany`를 실행한다.

## 완료 로그 페이지네이션 규칙

- 완료 상태(`CLOSED`, `EXPIRED`, `CANCELLED`, `BLOCKED`)만 서버에서 조회하며 한 페이지 크기는 최대 100건으로 고정한다.
- 서버는 검색어·호텔·언어 조건을 Prisma `where`에 포함하고 `skip=(page-1)*100`, `take=100`과 동일 조건의 `count`를 실행한다.
- 최신 활동 순서가 같은 행도 페이지 간 순서가 흔들리지 않도록 `lastActivityAt`, `createdAt`, `id`를 차례로 내림차순 정렬한다.
- `ChatSession(status, lastActivityAt)` 복합 인덱스는 완료 상태 범위를 먼저 좁히고 최신 기록부터 읽도록 돕는다.
