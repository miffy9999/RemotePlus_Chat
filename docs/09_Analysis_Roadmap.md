# 프로그램 이해를 위한 분석 로드맵

## 이 문서를 사용하는 방법

아래 순서대로 문서와 코드를 읽으면 전체 프로그램을 빠르게 이해할 수 있다. 각 단계에서 제시한 질문에 스스로 답할 수 있으면 다음 단계로 이동한다.

## 1단계 — 제품이 해결하는 문제 이해

읽을 문서:

1. `Hotel_CallCenter_Chat_MVP_Design.md`
2. `01_MVP_Requirements.md`
3. `06_Acceptance_Checklist.md`

확인할 질문:

- 투숙객, Agent, 관리자는 각각 무엇을 할 수 있는가?
- MVP에 포함되지 않는 기능은 무엇인가?
- 상담이 종료되는 두 가지 주요 조건은 무엇인가?

## 2단계 — 화면과 사용자 흐름 이해

읽을 문서:

1. `07_UI_Structure.md`
2. `03_User_Flows.md`
3. `08_System_Blueprint.md`의 화면 영역

확인할 질문:

- 관리자 페이지와 Agent 페이지는 왜 분리되는가?
- 투숙객은 어떤 순서로 상담에 들어오는가?
- Agent는 대기 상담을 어떻게 ACTIVE 상태로 바꾸는가?

## 3단계 — 데이터와 상태 이해

읽을 문서와 코드:

1. `04_Database_Design.md`
2. `database/migrations`
3. 서버의 `chat-sessions`, `messages`, `rooms` 모듈

확인할 질문:

- RoomAccessKey는 왜 원문이 아닌 해시로 저장되는가?
- ChatSession의 상태는 어디에서 변경되는가?
- 메시지 중복을 막는 키는 무엇인가?

## 4단계 — REST 요청 흐름 따라가기

읽을 문서와 코드:

1. `05_API_Specification.yaml`
2. 서버 라우터 또는 컨트롤러
3. 서비스 계층
4. 저장소 또는 ORM 계층

분석 방법:

하나의 API를 골라 `요청 → 입력 검증 → 권한 검사 → 서비스 → DB → 응답` 순서로 호출 경로를 메모한다. 먼저 상담 생성 API를 따라가는 것을 권장한다.

Phase 1 코드 읽기 순서:

1. `modules/rooms/rooms.controller.ts`와 `rooms.service.ts`에서 접근 키 검증 흐름을 읽는다.
2. `modules/auth/auth.controller.ts`와 `auth.service.ts`에서 Agent JWT 발급 흐름을 읽는다.
3. `modules/chat-sessions/chat-sessions.controller.ts`에서 역할별 API 경계를 확인한다.
4. `chat-sessions.service.ts`에서 중복 상담 방지, 수락 경쟁 처리와 종료 권한을 확인한다.
5. `session-view.ts`에서 REST·WebSocket 공개 응답이 인증 내부 필드를 제거하는 경계를 확인한다.
6. `session-policy.ts`와 테스트에서 허용·거부 상태를 함께 확인한다.

## 5단계 — WebSocket 메시지 흐름 따라가기

읽을 코드:

1. WebSocket 연결 인증
2. `chat:join`
3. `chat:message`
4. 메시지 서비스의 검증과 저장
5. `chat:message-accepted` 및 상대방 전달

확인할 질문:

- 연결만 성공하면 아무 상담방에나 들어갈 수 있는가?
- 메시지는 저장 전과 저장 후 중 언제 전달되는가?
- 재연결 시 빠진 메시지는 어떻게 복구하는가?

Phase 2 코드 읽기 순서:

1. `modules/realtime/chat.gateway.ts`의 연결 미들웨어에서 직원과 투숙객 인증 차이를 확인한다.
2. 같은 파일의 `chat:join`에서 세션별 방 입장 권한을 확인한다.
3. `modules/messages/message-policy.ts`에서 UUID, 길이, 상태와 만료 검증을 읽는다.
4. `messages.service.ts`에서 발신 권한, 저장, `clientMessageId` 중복 처리를 확인한다.
5. Gateway로 돌아와 저장 후 승인·상대방 전파 순서를 확인한다.
6. `tests/integration/verify-phase2.ts`에서 두 방 격리와 재연결 흐름을 따라간다.

## 6단계 — 15분 만료와 보안 이해

읽을 코드:

1. 세션 만료 작업
2. 메시지 전송 전 `expiresAt` 검사
3. 인증·권한 미들웨어
4. 요청 횟수 제한과 입력 검증

중요 원칙:

브라우저 화면의 남은 시간은 사용자 안내일 뿐이다. 실제 차단은 서버가 데이터베이스의 `expiresAt`과 현재 시각을 비교해 수행한다.

## 7단계 — 화면 코드 이해

권장 순서:

1. API/WebSocket 클라이언트
2. 인증 상태 관리
3. 상담 목록 상태 관리
4. 채팅 메시지 상태 관리
5. 화면 컴포넌트

UI부터 읽기보다 데이터가 들어오고 저장되는 경로를 먼저 이해하면 화면 동작을 고치기 쉽다.

Phase 3 화면 코드 읽기 순서:

1. `apps/guest-web/src/api.ts`에서 접근 검증·세션 생성·이력 조회의 요청 헤더를 확인한다.
2. `apps/guest-web/src/main.tsx`에서 동의, 세션 복구, WAITING/ACTIVE/CLOSED 상태 전환을 따라간다.
3. `apps/agent-web/src/api.ts`에서 로그인·목록·수락·종료 요청을 확인한다.
4. `apps/agent-web/src/main.tsx`에서 목록 폴링, 상담 선택, Socket.IO 메시지 병합과 종료 확인창을 읽는다.
5. 서버의 `chat.gateway.ts`와 `chat-sessions.service.ts`로 이동해 화면 요청이 최종 검증되는 지점을 확인한다.
6. `20260719084000_one_open_session_per_room` 마이그레이션에서 객실별 열린 상담 중복 방지 조건을 확인한다.

Phase 3A~5 코드 읽기 순서:

1. `modules/admin/admin.controller.ts`에서 ADMIN 권한 경계를 확인한다.
2. `admin.service.ts`에서 비밀번호 해시와 중복 처리, 공개 응답 필드를 읽는다.
3. `main.ts`의 REST 요청 제한과 `chat.gateway.ts`의 WebSocket 제한을 비교한다.
4. `chat-sessions.service.ts`의 `onModuleInit`과 `expireDueSessions`로 재시작 복구 흐름을 따라간다.
5. `verify-phase45.ts`에서 관리자 CRUD, 만료, 권한, 잘못된 키와 속도 제한 검증을 확인한다.
6. `docs/11_User_Manual.md`의 실제 사용자 동작과 코드 상태 전환을 대응시킨다.

## 8단계 — 안전하게 직접 수정하기

1. 변경하려는 동작의 원본 사양서 항목을 찾는다.
2. 관련 API, 이벤트, 데이터 모델과 화면을 목록으로 적는다.
3. 먼저 실패하는 테스트를 추가한다.
4. 한국어 주석으로 변경 이유와 예외 조건을 설명한다.
5. 구현 후 단위·통합·E2E 테스트 중 관련 범위를 실행한다.
6. `CHANGELOG_KO.md`에 수정 시각, 내용, 이유, 확인 결과를 기록한다.
7. 설계가 달라졌다면 `08_System_Blueprint.md`도 갱신한다.
