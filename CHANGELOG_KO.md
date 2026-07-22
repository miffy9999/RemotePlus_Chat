# 프로젝트 변경 이력

## 2026-07-22 11:46:15 +09:00

### 수정한 파일

- 인증 입력 정책과 테스트: `apps/server/src/modules/auth/dto/login.dto.ts`, `apps/server/src/modules/admin/dto/create-agent.dto.ts`, `apps/server/tests/password-policy.spec.ts`, `apps/server/tests/auth-service.spec.ts`
- 테스트 계정 시드와 기존 DB 갱신: `apps/server/prisma/seed.ts`, `apps/server/prisma/migrations/20260722022000_reset_free_test_credentials/migration.sql`
- 로컬·Render 환경 설정: `.env.example`, `compose.yaml`, `render.yaml`
- 관리자 화면: `apps/agent-web/src/main.tsx`, `apps/agent-web/src/i18n.tsx`
- 사양·결정·배포·보안 문서: `docs/Hotel_CallCenter_Chat_MVP_Design.md`, `docs/00_Base_Specification.md`, `docs/10_Decision_Log.md`, `docs/11_User_Manual.md`, `docs/12_Feature_Status.md`, `docs/12_Free_Deployment_Guide.md`, `docs/13_Commercial_Release_Checklist_KO.md`, `README.md`

### 수정 내용

- 무료 테스트 관리자 계정을 `admin / admin`, Agent 계정을 `agent01 / agent01`로 변경했습니다.
- 로그인과 관리자 Agent 생성에서 비밀번호 길이·문자 조합 제한을 제거했습니다. 로그인 ID·이름·역할 검증은 유지합니다.
- 새 테스트 환경의 시드 기본값과 Docker·Render 설정을 같은 계정으로 맞췄습니다.
- 현재 Render DB처럼 이미 생성된 계정도 바뀌도록 bcrypt cost 12 해시만 포함하는 일회성 데이터 마이그레이션을 추가했습니다.
- 상업 배포 전 강한 개별 비밀번호 정책을 복원해야 한다는 차단 항목을 문서에 명시했습니다.

### 수정 이유

현재 무료 테스트 단계에서 단순한 공용 계정으로 빠르게 로그인하려는 사용자 결정과 기존 서버의 8자·영문 숫자 조합 제한이 충돌해 이를 제거했습니다. 편의를 위해 제한은 없애되 데이터베이스 평문 저장은 피하고 기존 bcrypt 검증 흐름을 유지했습니다.

### 확인 방법

- `pnpm test`: 서버 22개, Agent 웹 11개, Guest 웹 4개 등 총 37개 테스트가 통과했습니다.
- `pnpm lint`, `pnpm build`: 전체 워크스페이스 타입 검사와 프로덕션 빌드가 통과했습니다.
- 마이그레이션에 포함한 두 bcrypt 해시가 각각 `admin`, `agent01`과 일치함을 회귀 테스트로 확인했습니다.
- `pnpm audit --prod`: 알려진 production 의존성 취약점이 0건임을 확인했습니다.
- `git diff --check`와 Render 마이그레이션 배포 후 실제 두 계정 로그인을 최종 확인합니다.

## 2026-07-22 11:04:58 +09:00

### 수정한 파일

- QR 생성·테스트·관리자 UI: `apps/agent-web/src/qr-code.ts`, `apps/agent-web/src/qr-code.test.ts`, `apps/agent-web/src/main.tsx`, `apps/agent-web/src/styles.css`, `apps/agent-web/src/i18n.tsx`, `apps/agent-web/public/third-party-notices.txt`
- 의존성과 라이선스 고지: `apps/agent-web/package.json`, `pnpm-lock.yaml`, `THIRD_PARTY_NOTICES.md`
- 원본 사양·설계·흐름·매뉴얼·기능 현황: `docs/Hotel_CallCenter_Chat_MVP_Design.md`, `docs/00_Base_Specification.md`, `docs/03_User_Flows.md`, `docs/07_UI_Structure.md`, `docs/08_System_Blueprint.md`, `docs/10_Decision_Log.md`, `docs/11_User_Manual.md`, `docs/12_Feature_Status.md`, `README.md`

### 수정 내용

- 관리자 룸 목록에 활성 `QR 보기` 버튼을 추가하고 호텔명·객실 번호·고객 URL을 확인할 수 있는 반응형 미리보기 모달을 구현했습니다.
- 현재 고객 URL을 오류 정정 등급 H, 4모듈 흰 여백, 약 1024px 고해상도 PNG로 브라우저 안에서만 생성하고 내려받도록 구현했습니다. QR 모듈을 흐리지 않도록 실제 한 변은 URL 길이에 따라 목표 크기보다 몇 px 작을 수 있습니다.
- 객실에 인쇄하여 장기간 비치한다는 운영 결정에 따라 QR 정기 만료·갱신·재발급은 두지 않았습니다. 객실·접근 키 삭제와 고객 도메인 변경의 영향을 화면과 문서에 명시했습니다.
- 상업 인쇄 전 운영 고객 도메인 확정, 실제 휴대전화 스캔 시험, 가로·세로 3cm 이상 인쇄, QR 흰 여백 유지 안내를 추가했습니다.
- MIT 라이선스의 `qrcode` 1.5.4와 타입 정의를 고정 버전으로 추가하고 제3자 고지와 전체 라이선스 분포를 갱신했습니다. 실제 Agent 웹 배포물에도 원저작권과 MIT 전문을 포함하고 QR 모달에서 열 수 있게 했습니다.

### 수정 이유

호텔별 객실에 한 번 인쇄해 계속 사용할 수 있는 영구 QR 진입 경로를 제공하면서, QR URL을 외부 서비스에 노출하거나 서버에 중복 저장하지 않고 상업 배포 시 오픈소스 라이선스 고지 의무도 지키기 위해 수정했습니다.

### 확인 방법

- `pnpm test`: 서버 19개, Agent 웹 11개, Guest 웹 4개 등 총 34개 테스트가 통과했습니다.
- `pnpm lint`, `pnpm build`: 전체 워크스페이스 타입 검사와 프로덕션 빌드가 통과했습니다.
- `pnpm audit --prod`: 알려진 production 의존성 취약점이 0건임을 확인했습니다.
- `pnpm licenses list --prod --json`에서 production 의존성은 MIT 235, Apache-2.0 13, ISC 17, BSD-3-Clause 6, BSD-2-Clause 2, 0BSD 1, CC-BY-4.0 1개이며 GPL·AGPL·LGPL·SSPL 계열이 없음을 확인했습니다.
- `git diff --check`로 공백 오류가 없음을 확인했습니다.

## 2026-07-21 16:54:34 +09:00

### 수정한 파일

- Agent 인증·API·화면·스타일·HTML: `apps/agent-web/src/auth-storage.ts`, `apps/agent-web/src/auth-storage.test.ts`, `apps/agent-web/src/api.ts`, `apps/agent-web/src/main.tsx`, `apps/agent-web/src/styles.css`, `apps/agent-web/index.html`
- 고객 화면·스타일·HTML: `apps/guest-web/src/main.tsx`, `apps/guest-web/src/styles.css`, `apps/guest-web/index.html`
- 서버 직원 인증 경계와 테스트: `apps/server/src/modules/auth/auth.service.ts`, `apps/server/src/modules/auth/request-auth.ts`, `apps/server/src/modules/admin/admin.controller.ts`, `apps/server/src/modules/chat-sessions/chat-sessions.controller.ts`, `apps/server/src/modules/realtime/chat.gateway.ts`, `apps/server/tests/auth-service.spec.ts`
- 실행 설정: `.env.example`, `compose.yaml`, `render.yaml`, `package.json`
- 라이선스·상업 출시 문서: `THIRD_PARTY_NOTICES.md`, `docs/13_Commercial_Release_Checklist_KO.md`, `README.md`
- 설계·매뉴얼·기능 현황: `docs/07_UI_Structure.md`, `docs/08_System_Blueprint.md`, `docs/10_Decision_Log.md`, `docs/11_User_Manual.md`, `docs/12_Feature_Status.md`

### 수정 내용

- Agent·관리자 인증은 사용자 결정에 따라 `sessionStorage`를 유지하면서 저장 형식과 구버전 JWT 만료를 검증하고, 401 응답 시 자동 로그아웃하도록 보완했습니다.
- 24시간 콜센터 PC에서 재로그인을 요구하지 않도록 직원 JWT의 만료 시각을 제거했습니다. 대신 모든 REST·WebSocket 인증에서 DB의 계정 존재·활성 상태·역할을 다시 확인합니다.
- Agent와 고객 채팅에 메시지 컨테이너 전용 자동 스크롤을 추가하고, 상담 목록으로 돌아갈 때 기존 문서 스크롤 위치를 복원했습니다.
- 게스트 모바일 채팅을 최우선으로 바깥 카드·그림자 없는 전체화면 메신저 구조로 구성하고, 동적 뷰포트 전체 높이·안전 영역·가상 키보드 리사이즈·44px 이상 입력 동작 영역을 적용했습니다. Agent 상담 목록과 관리자 표도 모바일 카드 UI로 전환했습니다.
- 두 웹 앱에 완전한 HTML 문서, viewport·theme-color 메타데이터와 모바일 안전 영역 설정을 추가했습니다.
- 현재 의존성의 라이선스 분포와 상업 이용 조건을 점검해 제3자 고지와 상업 출시 체크리스트를 추가했습니다.

### 수정 이유

상시 운영 콜센터의 반복 로그인, 새 메시지를 놓치는 채팅 스크롤, 상담 종료 후 페이지가 맨 위로 이동하는 현상, 모바일에서 PC 표를 그대로 보여 읽기 어려운 문제를 해결하기 위해 수정했습니다. 테스트 운영 이후 상업 출시를 준비할 때 오픈소스 고지와 개인정보·운영 보완 항목을 빠뜨리지 않도록 별도 문서로 관리합니다.

### 확인 방법

- `pnpm test`: 서버 19개, Agent 웹 8개, Guest 웹 4개 테스트가 모두 통과했습니다.
- `pnpm lint`: 공유 패키지와 서버·Agent 웹·Guest 웹 타입 검사가 모두 통과했습니다.
- `pnpm build`: 서버와 두 웹 앱의 프로덕션 빌드가 모두 통과했습니다.
- `pnpm audit --prod`: 알려진 production 의존성 취약점이 0건임을 확인했습니다.
- `pnpm licenses list --prod --json`: GPL·AGPL·LGPL·SSPL 계열이 없고 MIT·Apache-2.0·BSD·ISC·0BSD·CC-BY-4.0 구성임을 확인했습니다.
- Chrome 500×844 렌더링으로 모바일 로그인·고객 동의 화면의 카드 너비, 입력 요소, 안전 여백을 확인했습니다.
- `git diff --check`로 공백 오류를 확인합니다.

## 2026-07-21 16:29:29 +09:00

### 수정한 파일

- REST 요청 제한기: `apps/server/src/main.ts`
- WebSocket 게이트웨이: `apps/server/src/modules/realtime/chat.gateway.ts`
- 공통 요청 제한기: `apps/server/src/common/security/fixed-window-rate-limiter.ts`
- 요청 제한기 회귀 테스트: `apps/server/tests/fixed-window-rate-limiter.spec.ts`
- 기능 현황: `docs/12_Feature_Status.md`

### 수정 내용

- 만료된 REST 요청 제한 기록을 1분 간격으로 정리하도록 보완했습니다.
- Socket.IO 연결이 종료되면 해당 연결의 메시지 제한 기록을 즉시 제거하도록 보완했습니다.
- 다른 활성 소켓의 기록은 유지하면서 종료된 소켓 기록만 제거하는 회귀 테스트를 추가했습니다.

### 수정 이유

공개 고객 링크의 접속과 동적 상담 API 호출이 누적될 때 이미 끝난 요청 제한 기록이 메모리에 계속 남아, 장기 운용 서버의 메모리 사용량이 불필요하게 증가하는 문제를 방지하기 위해 수정했습니다.

### 확인 방법

- `pnpm test`: 서버 17개, Agent 웹 3개, Guest 웹 3개 테스트가 모두 통과했습니다.
- `pnpm lint`: 공유 패키지와 서버·Agent 웹·Guest 웹 타입 검사가 모두 통과했습니다.
- `pnpm build`: 서버와 두 웹 앱의 프로덕션 빌드가 모두 통과했습니다.
- `git diff --check`로 공백 오류를 추가 확인합니다.

## 2026-07-21 15:42:30 +09:00

### 수정한 파일

- 라이선스: `LICENSE`
- 무료 배포 문서: `docs/12_Free_Deployment_Guide.md`
- 변경 이력: `CHANGELOG_KO.md`

### 수정 내용

- 공식 GitHub 원본 저장소를 `miffy9999/RemotePlus_Chat`으로 변경했습니다.
- 새 저장소의 MIT 라이선스를 프로젝트에 포함했습니다.
- Vercel 운영 도메인을 Agent `remoteplus-agent.vercel.app`, Guest `remoteplus-guest.vercel.app` 기준으로 연결합니다.

### 수정 이유

저장소 소유권 때문에 제한되던 Vercel Git 연동을 사용자 소유 저장소로 전환하고 `main` 푸시 자동 배포를 사용하기 위해 수정했습니다.

### 확인 방법

- 새 저장소에 전체 Git 기록이 존재하는지 확인합니다.
- 새 저장소 `main` 푸시 후 Vercel 두 프로젝트와 Render API의 자동 배포 상태를 확인합니다.

## 2026-07-21 15:23:50 +09:00

### 수정한 파일

- 운영 시드: `apps/server/prisma/seed.ts`
- 환경 예시 및 Render 설정: `.env.example`, `render.yaml`

### 수정 내용

- `ALLOW_INSECURE_TEST_PASSWORDS=true`인 테스트 배포에서만 8자 이상의 공용 시드 비밀번호를 허용했습니다.
- `SEED_RESET_EXISTING_PASSWORDS=true`이면 기존 관리자와 직원 계정의 비밀번호 해시도 시드 값으로 갱신하도록 했습니다.
- 비밀번호는 테스트 모드에서도 데이터베이스에 평문이 아닌 bcrypt 해시로 저장합니다.

### 수정 이유

무료 테스트 배포의 관리자와 직원 로그인을 동일한 테스트 비밀번호로 바꾸되, 운영 기본값과 저장 보안은 유지하기 위해 수정했습니다.

### 확인 방법

- 전체 린트와 테스트를 실행한 뒤 Render 테스트 환경에서 두 계정 로그인을 확인합니다.

## 2026-07-21 14:43:48 +09:00

### 수정한 파일

- 배포 설정: `render.yaml`, `apps/agent-web/vercel.json`, `apps/guest-web/vercel.json`
- 서버 환경 및 실행: `apps/server/src/common/config/environment.ts`, `apps/server/src/main.ts`, `apps/server/src/modules/realtime/chat.gateway.ts`, `apps/server/package.json`
- 서버 환경 테스트: `apps/server/tests/environment.spec.ts`
- 운영 시드 보호: `apps/server/prisma/seed.ts`
- 로그인 기본값 제거: `apps/agent-web/src/main.tsx`
- 환경 예시 및 런타임 범위: `.env.example`, `package.json`
- 배포 문서: `docs/12_Free_Deployment_Guide.md`, `README.md`

### 수정 내용

- Render 무료 Blueprint에서 싱가포르 리전의 API와 30일 테스트용 PostgreSQL을 함께 만들도록 구성했다.
- 무료 서비스에서도 Prisma 마이그레이션이 실행되도록 시작 명령에 `prisma migrate deploy`를 포함하고, 최초 배포 훅에서 시드를 한 번 실행하도록 구성했다.
- Render가 제공하는 `PORT`와 `0.0.0.0` 바인딩을 지원하고 REST 및 Socket.IO가 공통 `WEB_ORIGINS` 목록을 사용하도록 변경했다.
- Nest 빌드 산출물의 실제 경로인 `dist/src/main.js`를 운영 시작 명령으로 사용하도록 구성했다.
- 운영 환경에서 DB, JWT, CORS 또는 안전한 시드 비밀값이 없으면 배포가 조기에 실패하도록 검증을 추가했다.
- Vercel의 두 Vite 프로젝트가 모노레포 공통 패키지를 빌드하고 SPA 경로를 `index.html`로 되돌리도록 설정했다.
- 공개 빌드에 테스트 비밀번호가 기본 입력값으로 포함되지 않도록 Agent와 관리자 비밀번호 필드를 비웠다.

### 수정 이유

하나의 GitHub 모노레포를 유지하면서 Vercel Hobby와 Render 무료 플랜으로 REST·WebSocket·PostgreSQL을 함께 검증하고, 테스트용 기본 비밀값이 공개 배포로 유출되는 위험을 줄이기 위해 수정했다.

### 확인 방법

- `pnpm lint`, `pnpm test`, `pnpm build`로 전체 TypeScript, 단위 테스트, 운영 빌드를 확인한다.
- `NODE_ENV=production` 환경 검증과 Render 시작 명령의 Prisma 배포 마이그레이션을 확인한다.
- 두 Vercel 앱의 빌드 결과와 SPA rewrite 설정을 확인한다.

모든 시각은 Asia/Tokyo(UTC+09:00)를 기준으로 기록한다. 최신 변경을 위에 추가한다.

## 2026-07-21 12:12:26 +09:00

### 수정한 파일

- Agent 테스트: `apps/agent-web/src/chat-utils.ts`, `apps/agent-web/src/chat-utils.test.ts`, `apps/agent-web/src/main.tsx`
- 투숙객 테스트: `apps/guest-web/src/chat-utils.ts`, `apps/guest-web/src/chat-utils.test.ts`, `apps/guest-web/src/main.tsx`
- 루트 테스트 명령: `package.json`
- 변경 이력: `CHANGELOG_KO.md`

### 수정 내용

- 양쪽 채팅 화면의 메시지 중복 제거·시간순 정렬과 남은 시간 계산을 독립 유틸리티로 분리했다.
- Agent와 투숙객 웹에 각각 3개씩 실제 Vitest 단위 테스트를 추가했다.
- 전체 테스트 전에 shared 패키지를 자동 빌드하는 `pretest` 명령을 추가했다.

### 수정 이유

프런트 패키지에 테스트 명령만 있고 테스트 파일이 없어 새 clone의 `pnpm test`가 종료 코드 1로 실패하던 문제를 해결하고, 재연결과 만료 표시의 핵심 화면 로직을 실제로 검증하기 위해서다.

### 확인 방법

- `pnpm test`로 Agent 3개, 투숙객 3개, 서버 9개 테스트가 모두 통과하는지 확인한다.

## 2026-07-21 12:09:36 +09:00

### 수정한 파일

- 루트 실행 명령: `package.json`
- 변경 이력: `CHANGELOG_KO.md`

### 수정 내용

- `pnpm lint` 실행 전에 `@hotel-chat/shared` 타입 패키지를 자동으로 빌드하는 `prelint` 명령을 추가했다.
- `pnpm dev` 실행 전에도 shared 패키지를 자동 빌드하는 `predev` 명령을 추가했다.

### 수정 이유

새 clone에서는 Git에서 제외된 `packages/shared/dist`가 없기 때문에 서버가 `@hotel-chat/shared`의 타입과 실행 파일을 찾지 못했다. 사용자가 별도 선행 명령을 외우지 않아도 lint와 개발 서버가 정상 실행되도록 하기 위해서다.

### 확인 방법

- `packages/shared/dist`가 없는 상태에서 `pnpm lint`를 실행해 shared 빌드 후 전체 TypeScript 검사가 통과하는지 확인한다.

## 2026-07-21 11:53:31 +09:00

### 수정한 파일

- 시드 실행 파일: `apps/server/prisma/seed.ts`
- 서버 명령 설정: `apps/server/package.json`
- 변경 이력: `CHANGELOG_KO.md`

### 수정 내용

- 데이터베이스 시드 실행 파일을 서버 패키지의 Prisma 폴더 안에서 실행하도록 배치했다.
- `prisma:seed` 명령이 `tsx prisma/seed.ts`를 실행하도록 변경했다.
- 실행한 터미널의 현재 폴더와 무관하게 프로젝트 루트 `.env`를 파일 위치 기준으로 불러오도록 수정했다.
- 루트 데이터베이스 명령이 `dotenv-cli`로 `.env`를 먼저 로드한 뒤 Prisma 마이그레이션과 시드를 실행하도록 보완했다.

### 수정 이유

pnpm의 엄격한 패키지 격리 환경에서 프로젝트 루트의 `database/seeds/seed.ts`가 서버 패키지에 선언된 `dotenv`, `bcrypt`, `@prisma/client`를 찾지 못하는 문제를 해결하기 위해서다.

### 확인 방법

- 새 의존성 설치 구조와 같은 상태에서 `pnpm db:migrate`, `pnpm db:seed`를 순서대로 실행해 테이블과 초기 데이터가 정상 생성되는지 확인한다.

## 2026-07-19 19:43:51 +09:00

### 수정한 파일

- Git 제외 설정: `.gitignore`
- 변경 이력: `CHANGELOG_KO.md`

### 수정 내용

- TypeScript 증분 빌드 캐시인 `*.tsbuildinfo`를 Git 추적 대상에서 제외했다.
- Prisma가 자동 생성하는 `apps/server/src/generated/` 전체를 Git 추적 대상에서 제외했다.
- Prisma 원본 스키마와 마이그레이션은 기존대로 Git에서 관리한다.

### 수정 이유

빌드와 Prisma 생성 명령으로 복구 가능한 환경별 파일이 `git status`에 반복 표시되거나 GitHub에 올라가는 일을 방지하기 위해서다.

### 확인 방법

- `git status --short`에서 TypeScript 빌드 캐시와 Prisma 생성 폴더가 표시되지 않는지 확인한다.

## 2026-07-19 19:24:05 +09:00

### 수정한 파일

- Agent 화면: `apps/agent-web/src/main.tsx`, `apps/agent-web/src/styles.css`
- 화면 설계: `docs/07_UI_Structure.md`

### 수정 내용

- Agent 로그인·상담 목록·채팅 화면을 투숙객 화면과 동일한 밝은 카드형 디자인 체계로 정리했다.
- 대기·진행·종료 요약 카드, 상태 배지, 버튼 피드백, 포커스 표시를 개선했다.
- Agent와 투숙객 메시지를 파란색·회색 말풍선으로 구분하고 채팅 영역의 스크롤과 입력창 레이아웃을 안정화했다.
- 모바일에서 사이드바 숨김, 요약 카드 세로 배치, 상담 표 가로 스크롤을 적용했다.
- 종료 상담 버튼과 입력창의 비활성 상태를 시각적으로 명확하게 표시했다.

### 수정 이유

Agent 상담 UI도 투숙객 상담 UI처럼 직관적이고 일관된 화면으로 다듬어 상담원이 상태와 메시지를 빠르게 구분하도록 하기 위해서다.

### 확인 방법

- Agent 웹 TypeScript 검사
- Agent 로그인·목록·종료 상담 기록 화면 브라우저 확인
- 데스크톱 화면에서 카드, 표, 상태 배지, 말풍선과 입력창 레이아웃 확인

## 2026-07-19 19:04:09 +09:00

### 수정한 파일

- 관리자 서버: `apps/server/src/modules/admin`, `apps/server/src/app.module.ts`
- 운영 안정성: `apps/server/src/main.ts`, `health.controller.ts`, `auth.service.ts`, `chat-sessions.service.ts`, `chat.gateway.ts`
- 관리자 화면: `apps/agent-web/src/api.ts`, `apps/agent-web/src/main.tsx`, `apps/agent-web/src/styles.css`
- 테스트: `tests/integration/verify-phase45.ts`, `apps/server/package.json`
- 문서: `ROADMAP.md`, `README.md`, `docs/06_Acceptance_Checklist.md`, `docs/08_System_Blueprint.md`, `docs/09_Analysis_Roadmap.md`, `docs/10_Decision_Log.md`, `docs/11_User_Manual.md`

### 수정 내용

- ADMIN 전용 로그인·API 권한과 Agent 추가·목록, 호텔 추가, 룸 추가·호텔 필터를 구현했다.
- 룸 테이블에 MVP 이후 QR 관리를 위한 비활성 액션 열을 마련했다.
- 서버 시작 직후와 5초 주기의 DB 기준 자동 만료 및 Socket.IO 종료 알림을 구현했다.
- REST 요청과 WebSocket 메시지의 속도 제한, DB 헬스 체크, 구조화 운영 로그를 추가했다.
- 관리자 CRUD·자동 만료·권한·잘못된 키·요청 제한 통합 테스트를 추가했다.
- MVP 승인 체크리스트 14개와 Phase 3A·4·5 로드맵을 검증 근거에 따라 완료 처리했다.
- 설치, 관리자, Agent, 투숙객, 장애 확인 절차를 설명하는 사용자 설명서를 작성했다.

### 수정 이유

원본 사양서의 관리자 MVP와 로드맵 Phase 4·5를 완료하고 비개발자도 앱을 실행하고 사용할 수 있게 하기 위해서다.

### 확인 방법

- 전체 TypeScript lint
- 서버 단위 테스트와 Phase 1·2·4/5 통합 테스트
- 관리자 로그인·목록과 기존 투숙객–Agent 전체 흐름 브라우저 E2E
- 전체 프로덕션 build와 Prisma 마이그레이션 상태 확인

## 2026-07-19 18:33:10 +09:00

### 수정한 파일

- 투숙객 화면: `apps/guest-web/src/api.ts`, `apps/guest-web/src/main.tsx`, `apps/guest-web/src/styles.css`
- Agent 화면: `apps/agent-web/src/api.ts`, `apps/agent-web/src/main.tsx`, `apps/agent-web/src/styles.css`
- 서버 CORS·상담 생성: `apps/server/src/main.ts`, `apps/server/src/modules/realtime/chat.gateway.ts`, `apps/server/src/modules/chat-sessions/chat-sessions.service.ts`
- 데이터베이스: `apps/server/prisma/migrations/20260719084000_one_open_session_per_room/migration.sql`
- 문서: `README.md`, `ROADMAP.md`, `docs/03_User_Flows.md`, `docs/08_System_Blueprint.md`, `docs/09_Analysis_Roadmap.md`, `docs/10_Decision_Log.md`

### 수정 내용

- 투숙객 접근 키 검증, 언어 선택, 이용 동의, 상담 생성, 새로고침 복구, 실시간 채팅과 종료 안내 화면을 구현했다.
- Agent 로그인, 대기·진행·종료 목록, 상담 수락, 실시간 채팅, 남은 시간, 종료 확인 대화상자와 기록 조회를 구현했다.
- 새 상담 수 증가 시 간단한 알림음을 재생하고 연결 상태와 오류를 화면에 표시했다.
- React StrictMode 중복 실행과 동시 생성 요청으로 같은 객실에 열린 상담이 중복될 수 있는 문제를 클라이언트 가드와 PostgreSQL 부분 고유 인덱스로 해결했다.
- 로컬 개발 웹의 `localhost`와 `127.0.0.1` 포트를 허용하도록 REST와 Socket.IO CORS 설정을 맞췄다.
- Phase 3 로드맵 8개 항목을 실제 브라우저 검증 후 `[x]`로 표시했다.

### 수정 이유

원본 사양서와 로드맵 Phase 3에 따라 투숙객과 Agent가 두 브라우저에서 전체 상담 흐름을 수행할 수 있게 하기 위해서다.

### 확인 결과

- 투숙객 동의 전 상담 생성 차단과 동의 후 `WAITING` 생성 확인
- Agent 로그인·상담 수락 후 양방향 메시지 실시간 수신 확인
- 화면 내 종료 확인 후 투숙객 입력 차단과 Agent 종료 기록 표시 확인
- 전체 workspace lint와 프로덕션 build 통과
- 서버 단위 테스트 9개와 WebSocket 통합 검사 10개 통과
- Prisma 마이그레이션 2개 적용 및 데이터베이스 최신 상태 확인

## 2026-07-19 17:27:54 +09:00

### 수정한 파일

- 실시간 통신: `apps/server/src/modules/realtime`
- 메시지 처리: `apps/server/src/modules/messages`
- 상담 이벤트 연동: `apps/server/src/modules/chat-sessions`
- 공통 계약: `packages/shared/src/index.ts`
- 테스트: `apps/server/tests/message-policy.spec.ts`, `tests/integration/verify-phase2.ts`
- 시드: `database/seeds/seed.ts`, `.env.example`
- 문서: `README.md`, `ROADMAP.md`, `docs/05_API_Specification.yaml`, `docs/08_System_Blueprint.md`, `docs/09_Analysis_Roadmap.md`, `docs/10_Decision_Log.md`

### 수정 내용

- `/chat` Socket.IO 네임스페이스와 직원·투숙객 선행 연결 인증을 구현했다.
- 세션별 방 입장 권한, 메시지 입력·권한·상태·만료 검증을 구현했다.
- 메시지를 PostgreSQL에 저장한 뒤 송신자 승인과 상대방 전달을 수행하도록 구현했다.
- `sessionId + clientMessageId` 고유 제약 충돌 시 기존 메시지를 반환하는 멱등 처리를 구현했다.
- 상담 수락·종료·만료 상태를 실시간 이벤트로 방송하도록 연결했다.
- 재연결 후 REST 메시지 이력을 조회하는 복구 흐름을 검증했다.
- 두 상담방 격리를 검증하기 위한 두 번째 개발용 룸과 접근 키 시드를 추가했다.
- Phase 2 로드맵 8개 항목을 모두 `[x]`로 표시했다.

### 수정 이유

원본 사양서의 실시간 메시지 시퀀스와 로드맵 Phase 2를 실제 Socket.IO·PostgreSQL 기반으로 완성하기 위해서다.

### 확인 방법과 결과

- 서버 TypeScript 검사 성공.
- 메시지·상담 정책 단위 테스트 9개 성공.
- Phase 2 통합 테스트 10개 성공: 상태 변경, 저장 후 승인, 양방향 전달, 방 격리, 중복 방지, 이력 저장, 재연결 복구, 종료 방송, 무인증 연결 차단.
- `pnpm lint`: 공통 패키지, 서버, 운영 웹, 투숙객 웹 전체 성공.
- `pnpm build`: NestJS 서버와 두 Vite 웹 앱 프로덕션 빌드 성공.

### 검증 중 수정한 문제

- 첫 통합 테스트에서 Socket.IO `connect`와 비동기 `handleConnection` 인증 사이의 경쟁 조건을 발견했다.
- 인증을 Socket.IO 선행 미들웨어로 이동해 신원 저장이 끝나기 전에는 연결 자체가 성공하지 않도록 수정했다.

## 2026-07-19 17:18:05 +09:00

### 작업 내용

- 사용자 확인을 위해 관리자·Agent 운영 웹과 투숙객 웹 개발 서버를 백그라운드로 실행했다.
- REST API 헬스 체크를 포함한 네 개 접속 주소를 확인했다.

### 확인 결과

- `/admin`, `/agent`, 투숙객 웹, `/api/health` 모두 HTTP 200 응답을 확인했다.
- 코드 및 데이터베이스 스키마 변경은 없다.

## 2026-07-19 17:01:49 +09:00

### 수정한 파일

- 서버 인증: `apps/server/src/modules/auth`
- 룸 접근 검증: `apps/server/src/modules/rooms`
- 상담 API: `apps/server/src/modules/chat-sessions`
- 데이터베이스: `apps/server/prisma/schema.prisma`, `apps/server/prisma/migrations`, `database/seeds/seed.ts`
- 테스트: `apps/server/tests/session-policy.spec.ts`, `tests/integration/verify-phase1.ps1`
- 설정: `apps/server/package.json`, `.env.example`
- 문서: `README.md`, `ROADMAP.md`, `docs/04_Database_Design.md`, `docs/05_API_Specification.yaml`, `docs/08_System_Blueprint.md`, `docs/09_Analysis_Roadmap.md`, `docs/10_Decision_Log.md`

### 수정 내용

- 관리자와 Agent 역할별 로그인 및 JWT 발급을 구현했다.
- 룸 접근 키 원문을 SHA-256 해시로 검증하고 상담 생성용 10분 JWT를 발급하도록 구현했다.
- 동일 룸의 중복 상담을 차단하고 WAITING 상담을 생성하도록 구현했다.
- 상담 상세, 이전 메시지, 상태별 목록, Agent 수락, 담당 Agent·관리자 종료 API를 구현했다.
- 상담 수락 시 조건부 갱신으로 동시 수락 경쟁을 방지했다.
- 비밀번호는 bcrypt, 접근 키와 투숙객 상담 토큰은 단방향 해시로 저장했다.
- PostgreSQL 초기 마이그레이션과 반복 실행 가능한 개발 시드를 추가했다.
- Phase 1 완료 항목 7개를 로드맵에서 `[x]`로 표시했다.

### 수정 이유

원본 사양서와 로드맵 Phase 1의 핵심 데이터·인증·상담 REST 흐름을 실제 데이터베이스 기반으로 완성하기 위해서다.

### 확인 방법과 결과

- `pnpm --filter @hotel-chat/server lint`: 성공.
- `pnpm --filter @hotel-chat/server test`: 상태 전환과 만료 판단 단위 테스트 5개 성공.
- Prisma 초기 마이그레이션 `20260719075723_init`: PostgreSQL 적용 성공.
- 접근 키 검증 → 상담 생성 → 대기 목록 → Agent 수락 → 투숙객 조회 → Agent 종료: 6개 정상 흐름 성공.
- 잘못된 접근 키, 동일 룸 중복 상담, 익명 상담 조회 거부: 모두 예상 상태 코드로 거부됨.
- 관리자에 의한 상담 종료: 성공.
- PostgreSQL의 `expiresAt`을 과거로 변경한 뒤 조회 API 호출 시 `EXPIRED`와 `TIME_LIMIT`으로 전환됨을 확인했다.
- `tests/integration/verify-phase1.ps1`: 정상 흐름 6개 모두 성공. Windows 기본 실행 정책 때문에 테스트 프로세스에만 `ExecutionPolicy Bypass`를 적용했다.

### 검증 중 수정한 문제

- DTO의 Prisma enum 상대 경로와 Express 요청 타입 의존성을 수정했다.
- 커스텀 생성 Prisma Client가 NestJS 빌드 결과에 포함되지 않는 문제를 발견해 표준 `@prisma/client` 사용 방식으로 변경했다.
- 만료 통합 테스트의 초기 `psql` 따옴표 전달이 실패해 DB 값이 바뀌지 않았으며, SQL을 표준입력으로 전달하는 방식으로 수정해 실제 상태 전환을 재검증했다.

## 2026-07-19 16:29:54 +09:00

### 수정한 파일

- 루트 개발 환경: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.env.example`, `compose.yaml`, `README.md`
- 공통 계약: `packages/shared`
- 서버: `apps/server`, `database/schema.prisma`
- 운영 화면: `apps/agent-web`
- 투숙객 화면: `apps/guest-web`
- 문서: `ROADMAP.md`, `docs/10_Decision_Log.md`, `CHANGELOG_KO.md`

### 수정 내용

- React/Vite, NestJS, Socket.IO, PostgreSQL/Prisma, pnpm 모노레포 기술 스택을 확정했다.
- PostgreSQL 개발 컨테이너와 환경변수 예시를 추가했다.
- Hotel, Room, RoomAccessKey, Agent, ChatSession, Message 모델과 주요 고유 제약·인덱스를 작성했다.
- 서버 시작, 전역 입력 검증, CORS, 보안 헤더, Prisma 연결, 헬스 체크 기반을 작성했다.
- 관리자·Agent 역할별 초기 운영 화면과 투숙객 채팅 화면을 작성했다.
- QR 기능은 MVP 이후임을 관리자 룸 테이블의 비활성 버튼으로 명확히 표시했다.

### 수정 이유

원본 사양서와 로드맵의 Phase 0을 시작하고, 이후 REST API와 WebSocket 기능을 안전하게 추가할 수 있는 실행 기반을 마련하기 위해서다.

### 확인 방법

- `pnpm install`: 성공. pnpm 11의 `allowBuilds` 허용 목록에는 Prisma, bcrypt, esbuild만 등록했다.
- `pnpm db:generate`: 성공. Prisma Client 6.19.3 생성 완료.
- `pnpm lint`: 성공. 공통 패키지, 서버, 운영 웹, 투숙객 웹 TypeScript 검사 통과.
- `pnpm build`: 성공. NestJS 서버와 두 Vite 웹 앱의 프로덕션 빌드 통과.
- 브라우저 확인: `/admin`의 Agent·호텔·룸 테이블과 비활성 QR 버튼이 정상 표시됨.
- 브라우저 확인: `/agent` 이동과 대기·진행·종료 현황 및 대기 상담 테이블이 정상 표시됨.
- PostgreSQL 마이그레이션은 데이터베이스 컨테이너 실행 단계에서 추가 확인한다.

### 검증 중 수정한 문제

- Prisma enum 값을 한 줄에 작성해 발생한 스키마 오류를 표준 줄 단위 문법으로 수정했다.
- 외부 `database` 폴더의 Prisma 스키마가 pnpm 의존성을 찾지 못하던 문제를 해결하기 위해 실제 스키마를 `apps/server/prisma/schema.prisma`로 이동했다.
- pnpm 11의 설치 스크립트 기본 차단에 맞춰 필요한 네이티브·생성 패키지만 `allowBuilds`로 허용했다.

## 2026-07-19 16:22:13 +09:00

### 수정한 파일

- `AGENTS.md`
- `CHANGELOG_KO.md`
- `docs/08_System_Blueprint.md`
- `docs/09_Analysis_Roadmap.md`
- `docs/10_Decision_Log.md`

### 수정 내용

- 원본 사양서를 최우선 기준으로 사용하는 프로젝트 작업 규칙을 추가했다.
- 모든 변경에서 수정 시각, 내용, 이유, 검증 결과를 기록하도록 규정했다.
- 모든 코드에 상세한 한국어 주석을 작성하도록 규정했다.
- 프로그램 전체 구조를 빠르게 파악할 수 있는 시스템 설계도를 작성했다.
- 입문자가 코드를 읽고 혼자 수정하기 위한 분석 로드맵을 작성했다.
- 구현 전에 확정해야 할 기술 선택 사항을 결정 기록에 정리했다.

### 수정 이유

향후 개발 과정과 코드의 의도를 추적하고, 사용자가 프로그램을 독립적으로 이해하고 수정할 수 있게 하기 위해서다.

### 확인 방법

- 생성된 문서의 UTF-8 인코딩과 필수 제목을 확인한다.
- 원본 사양서 경로와 로드맵 참조가 실제 프로젝트 구조와 일치하는지 확인한다.
# 2026-07-21 12:23:08 +09:00

## 수정한 파일

- Docker: `compose.yaml`, `Dockerfile.server`, `Dockerfile.web`, `.dockerignore`, `infra/nginx/default.conf`, `.env.example`
- 서버: Prisma 스키마·마이그레이션·시드, 접근키 암호화 모듈, 관리자 서비스
- 관리자 웹: API 타입, 관리자 화면, 스타일
- 테스트와 문서: 암호화 테스트, `README.md`, 설계도, 결정 기록, 사용 매뉴얼, 수정 이력

## 수정 내용과 이유

- 현재 프로젝트 폴더만으로 전체 앱을 재현하도록 Docker 구성을 확장했다.
- 룸 생성 시 접근키와 고객 주소를 자동 생성하고 관리자 화면에 주소 열기·복사를 추가했다.
- 접근키 원문 대신 검증용 해시와 AES-256-GCM 암호문을 저장한다.
- 실행·종료·초기화·룸 주소 사용법과 암호화 비밀값 주의사항을 문서에 반영했다.

## 확인 방법과 결과

- `pnpm db:generate`, `pnpm lint`, `pnpm test`, `pnpm build`로 확인한다.
- `docker compose up -d --build` 후 컨테이너 상태, `/api/health`, 관리자 룸 주소를 확인한다.
- 실제 결과는 최종 검증 뒤 갱신한다.
# 2026-07-21 12:50:48 +09:00 — 최종 Docker 검증 보완

- `서버_실행.cmd`를 추가해 Docker 확인, `.env` 최초 생성, 전체 빌드·실행과 접속 주소 안내를 자동화했다.
- Windows 예약 포트 범위와 충돌한 4000번 대신 호스트 API 포트를 4100번으로 구성하고 두 웹 빌드 주소와 문서를 맞췄다.
- Docker 서버 이미지에 OpenSSL을 설치하고 NestJS 실행 경로를 실제 결과물인 `dist/src/main.js`로 수정했다.
- 초기 호텔 ID를 표준 UUID v4 형식으로 바꿔 관리자 룸 추가 검증을 통과하게 했다.
- `docker compose down -v --remove-orphans` 후 새 볼륨에서 전체 스택 재생성에 성공했다.
- `server`, `postgres`는 healthy, 두 웹은 running 상태이며 `/api/health`의 `status`와 `database`가 모두 `ok`임을 확인했다.
- 새 룸 `TEST-125048` 생성 결과 고객 주소가 발급되었고, 주소의 접근키로 고객 인증 토큰 발급에 성공했다.
# 2026-07-21 12:54:00 +09:00 — 기능 구현 현황 문서 추가

- `docs/12_Feature_Status.md`를 추가하여 완료, 부분 구현, 미구현 기능을 영역별로 구분했다.
- 기능 변경 때 이 문서를 반드시 갱신하도록 `AGENTS.md`의 프로젝트 작업 규칙에 추가했다.
- README의 문서 읽는 순서에 기능 구현 현황 문서를 추가했다.
# 2026-07-21 13:02:00 +09:00 — 서버 실행 배치파일 인코딩 수정

- Windows `cmd.exe`가 UTF-8 한글 명령을 깨뜨려 실행하던 문제를 확인했다.
- `서버_실행.cmd`를 ASCII 전용 실행기로 단순화하고 실제 Docker 로직을 `scripts/start-docker.ps1`로 분리했다.
- Docker 설치·실행 검사, `.env` 보존, Compose 시작, 상태·주소 출력 동작을 유지했다.
- 새 `.env`에 예제 비밀값이 남아 있으면 로컬 전용 무작위 JWT·접근키 암호화 비밀값으로 자동 교체하도록 보완했다.
# 2026-07-21 13:18:00 +09:00 — 관리자 목록과 추가 기능 오류 수정

- 브라우저에서 관리자 로그인 후 `Internal server error`, 빈 Agent 목록, 빈 호텔 선택창을 재현했다.
- `.env` 암호화 비밀값 변경 전에 만들어진 룸의 접근키 복호화 실패가 `Promise.all` 전체를 중단시키는 원인이었다.
- 복호화할 수 없는 룸은 해당 주소만 `null`로 반환하고 Agent·호텔·다른 룸 목록은 정상 제공하도록 격리했다.
- 손상된 암호문이 `null`로 처리되는 단위 테스트를 추가했다.
- 수정 후 Agent 추가, 호텔 추가, 호텔 선택, 룸 추가, 고객 주소 발급을 브라우저 QA한다.

## QA 결과 — 2026-07-21 13:39:14 +09:00

- `pnpm lint`: 성공.
- `pnpm test`: 서버 11개, Agent 웹 3개, 고객 웹 3개 테스트 성공.
- Docker `server`, `postgres` healthy 및 두 웹 running 확인.
- 관리자 재로그인 후 Agent·호텔·룸 목록 정상 표시 확인.
- Agent `qa08711819` 추가 후 목록 즉시 반영 확인.
- 호텔 `QA 호텔 08711819` 추가 후 룸 호텔 선택창과 필터에 즉시 표시 확인.
- 새 호텔을 선택하여 룸 `QA-101` 추가 및 고객 주소 자동 발급 확인.
- 발급된 고객 주소로 접속하여 언어 선택·동의·상담 시작 화면 정상 표시 확인.
- 과거 비밀값으로 암호화된 `TEST-125048` 룸만 `주소 없음`으로 격리되고 다른 관리 기능은 정상 동작함을 확인.
# 2026-07-21 13:45:00 +09:00 — Docker 중복 이미지 정리

- 실제 컨테이너 참조 상태를 확인하여 앱 이미지와 무관한 `nginx:latest`를 삭제 대상으로 확정했다.
- 서버와 동일한 1.24GB 이미지를 별도로 만들던 `hotel-chat-migrate` 서비스를 `hotel-chat-server:latest` 재사용 구조로 변경했다.
- PostgreSQL 데이터 볼륨과 실행 중 데이터는 유지한 채 Compose를 재기동하고 두 불필요 이미지만 삭제한다.
- 검증: migrate 컨테이너가 `hotel-chat-server:latest`를 사용해 정상 종료(0)했고 서버·DB healthy, 두 웹 running을 확인했다. 로컬 이미지가 앱에 필요한 4개만 남았음을 확인했다.
# 2026-07-21 13:55:00 +09:00 — 관리자 삭제 기능 추가

- ADMIN 전용 Agent·호텔·룸 DELETE API를 추가했다.
- Agent 삭제 시 상담 기록은 보존하고 기존 상담의 Agent 관계만 null로 변경한다.
- 호텔 삭제 시 룸·접근키·상담·메시지, 룸 삭제 시 접근키·상담·메시지가 DB 외래 키로 원자적으로 연쇄 삭제되도록 마이그레이션을 추가했다.
- 관리자 화면에 Agent 삭제, 선택 호텔 삭제, 룸별 삭제 버튼과 영향 범위 확인창을 추가했다.
- 원본 사양서, 사용 매뉴얼, 기능 구현 현황을 함께 갱신했다.

## 검증 결과 — 2026-07-21 14:01:26 +09:00

- `pnpm db:generate`, `pnpm lint`, `pnpm test`, `pnpm build`: 모두 성공. 서버 11개와 두 웹 각 3개 테스트 통과.
- Docker 마이그레이션 `20260721044500_admin_cascade_delete`: 적용 성공.
- QA 전용 Agent 삭제 후 Agent 0건, 룸 단독 삭제 후 같은 호텔의 다른 룸 1건 유지 확인.
- 상담이 생성된 하위 룸을 포함한 QA 호텔 삭제 후 호텔 0건, 룸 0건, 상담 0건을 DB에서 확인.
- 관리자 화면에서 Agent 행 삭제, 선택 호텔 삭제, 룸 행 삭제 버튼과 관리 열이 표시되는지 확인.
- 서버·PostgreSQL healthy, 관리자 웹·고객 웹 running 확인.
# 2026-07-21 14:10:00 +09:00 — 기본 로그인 역할 선택 화면

- Agent 로그인으로 바로 이동하던 기본 주소(`/`)를 관리자 로그인·Agent 로그인 선택 화면으로 변경했다.
- 두 역할은 선택 후 각자의 기존 로그인 화면으로 이동하며, 기존 직접 로그인 주소도 계속 지원한다.
- 반응형 역할 선택 UI와 사용 매뉴얼·기능 현황을 갱신했다.
- 확인: Agent 웹 lint·테스트(3개)·빌드 통과, Docker 컨테이너 정상 실행, 기본 역할 선택 화면과 관리자 로그인 이동 동작 확인.

# 2026-07-21 16:13:02 +09:00 — 한국어·일본어 UI 전환

- `apps/agent-web/src/i18n.tsx`, `apps/guest-web/src/i18n.tsx`에 한국어·일본어 UI 사전, 언어 컨텍스트, 브라우저 저장 기반 선택 유지 기능을 추가했다.
- 역할 선택·Agent/관리자 로그인·Agent 상담 목록과 채팅·관리자 관리 화면·고객 동의와 채팅을 포함한 모든 화면에 UI 언어 선택기를 제공했다.
- 고객의 상담 언어 선택과 화면 표시 언어를 분리하여 기존 영어·중국어 상담 요청도 그대로 유지했다.
- 날짜와 시각 표시는 선택한 UI 언어의 로케일을 사용하도록 변경했다.
- 수정 파일: 두 웹 앱의 `main.tsx`, `styles.css`, `i18n.tsx`와 `CHANGELOG_KO.md`.
- 변경 이유: 관리자·Agent·고객이 어느 화면에서든 한국어와 일본어 UI를 즉시 전환할 수 있어야 하기 때문이다.
- 검증: Agent 웹 프로덕션 빌드 성공. 고객 웹 TypeScript 오류를 수정한 뒤 재검증했다.
