# Hotel Call Center Chat

호텔 객실의 투숙객과 콜센터 Agent를 연결하는 15분 제한 실시간 채팅 MVP입니다.

## 현재 구현 상태

- React/Vite 기반 관리자·Agent 운영 웹 초기 화면
- React/Vite 기반 투숙객 모바일 채팅 초기 화면
- NestJS 서버, 헬스 체크와 Phase 1 REST API
- 인증·방 격리·양방향 메시지·재연결을 지원하는 Phase 2 Socket.IO 서버
- PostgreSQL/Prisma 핵심 데이터 모델
- Docker Compose PostgreSQL 개발 환경
- 공통 상담 상태와 WebSocket 이벤트 계약

Phase 1 REST API, Phase 2 WebSocket 메시지 처리, Phase 3 투숙객·Agent 실제 화면이 구현되었습니다. 관리자 CRUD는 Phase 3A 범위입니다.

## 준비 사항

- Node.js 22 이상
- pnpm 10 이상
- Docker Desktop

## 로컬 실행

```bash
copy .env.example .env
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Agent 로그인: `http://127.0.0.1:5173/login`
- 관리자 자리표시자: `http://127.0.0.1:5173/admin`
- 투숙객 테스트 링크: `http://127.0.0.1:5174/?accessKey=demo-room-access-1201`
- 서버 헬스 체크: `http://localhost:4000/api/health`

로컬 시드 계정과 접근 키는 `.env.example`에 있으며 개발 환경에서만 사용합니다.

Phase 1 REST 흐름 반복 검증:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tests\integration\verify-phase1.ps1
```

`ExecutionPolicy Bypass`는 이 테스트 프로세스에만 적용되며 시스템의 PowerShell 정책을 변경하지 않습니다.

Phase 2 WebSocket 흐름 검증:

```powershell
pnpm --filter @hotel-chat/server test:phase2
```

## 먼저 읽을 문서

1. `docs/Hotel_CallCenter_Chat_MVP_Design.md`
2. `ROADMAP.md`
3. `docs/08_System_Blueprint.md`
4. `docs/09_Analysis_Roadmap.md`
5. `CHANGELOG_KO.md`
6. `docs/11_User_Manual.md`

관리자 로그인은 `http://127.0.0.1:5173/admin/login`, Agent 로그인은 `http://127.0.0.1:5173/login`, 투숙객 테스트 링크는 `http://127.0.0.1:5174/?accessKey=demo-room-access-1201`입니다.
