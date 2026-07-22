# Hotel Call Center Chat

Vercel + Render 무료 테스트 배포 절차는 [`docs/12_Free_Deployment_Guide.md`](docs/12_Free_Deployment_Guide.md)를 참고하세요.

상업 출시 전 점검 항목은 [`docs/13_Commercial_Release_Checklist_KO.md`](docs/13_Commercial_Release_Checklist_KO.md), 오픈소스 고지는 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)를 참고하세요.

호텔 객실의 고객과 콜센터 상담원을 연결하는 실시간 채팅 MVP입니다. 관리자 웹, Agent 웹, 고객 웹, NestJS/Socket.IO 서버, PostgreSQL을 포함합니다.

## Docker로 가장 빠르게 실행하기

필수 프로그램은 Docker Desktop 하나입니다. 프로젝트를 어느 폴더에 두더라도 `compose.yaml`이 있는 현재 폴더를 기준으로 빌드되므로 절대경로 설정은 필요하지 않습니다.

Windows에서는 프로젝트 루트의 `서버_실행.cmd`를 더블클릭하면 Docker 확인, `.env` 생성, 전체 빌드와 실행을 자동으로 처리한다.

```powershell
cd C:\Users\전성현\Desktop\00_2026_Summer_Internship\Remote_plus\chat_app
Copy-Item .env.example .env
docker compose up -d --build
docker compose ps
```

최초 실행에서는 이미지 빌드, DB 마이그레이션, 초기 데이터 입력 때문에 시간이 걸릴 수 있습니다. `server`, `agent-web`, `guest-web`, `postgres`가 모두 `running` 또는 `healthy`이면 준비된 상태입니다.

| 화면/기능 | 주소 |
|---|---|
| 관리자 로그인 | http://127.0.0.1:5173/admin/login |
| Agent 로그인 | http://127.0.0.1:5173/login |
| 서버 상태 확인 | http://127.0.0.1:4100/api/health |
| 고객 웹 | 관리자 페이지의 룸 목록에서 생성된 주소 사용 |

개발용 초기 계정은 관리자 `admin / Admin1234!`, Agent `agent01 / Agent1234!`입니다.

### 로그 확인과 종료

```powershell
docker compose logs -f
docker compose down
```

`Ctrl+C`는 로그 보기만 종료합니다. 컨테이너와 DB 데이터를 모두 삭제하고 완전히 처음부터 다시 시작하려면 다음 명령을 사용합니다.

```powershell
docker compose down -v --remove-orphans
docker compose up -d --build
```

`-v`는 PostgreSQL 데이터 볼륨까지 삭제하므로 저장된 호텔, 룸, 상담 기록도 복구할 수 없습니다.

## 관리자에서 고객 룸 주소 만들기

관리자 로그인 후 호텔을 추가하고, 해당 호텔을 선택하여 룸을 추가합니다. 서버가 추측하기 어려운 접근키를 자동 생성하며 룸 테이블에서 다음 기능을 제공합니다.

- `상담 링크 열기`: 새 탭에서 해당 룸의 고객 화면 열기
- `주소 복사`: 고객에게 전달할 전체 주소를 클립보드에 복사
- `QR 보기`: 객실 고객 주소를 담은 고정 QR 미리보기 및 약 1024px 고해상도 PNG 다운로드

QR은 객실 또는 접근 키가 삭제되지 않는 한 만료·갱신되지 않습니다. 인쇄된 QR은 고객 웹 주소를 그대로 담으므로 상업 인쇄 전 운영 도메인을 확정하고 실제 휴대전화로 스캔 시험하세요.

접근키 원문은 DB에 그대로 저장하지 않고 AES-256-GCM으로 암호화합니다. `.env`의 `ACCESS_KEY_ENCRYPTION_SECRET`을 바꾸면 기존 룸 주소를 복원할 수 없으므로 운영 중에는 반드시 안전하게 백업하고 유지해야 합니다.

## 코드로 직접 개발하기

Node.js 22 이상, pnpm 10 이상, Docker Desktop이 필요합니다.

```powershell
docker compose up -d postgres
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

품질 검사는 다음 순서로 실행합니다.

```powershell
pnpm lint
pnpm test
pnpm build
```

## 문서 읽는 순서

1. `docs/Hotel_CallCenter_Chat_MVP_Design.md` — 원본 사양서
2. `ROADMAP.md` — 제작 단계와 완료 여부
3. `docs/08_System_Blueprint.md` — 전체 설계도
4. `docs/09_Analysis_Roadmap.md` — 코드를 이해하는 순서
5. `docs/11_User_Manual.md` — 실행·운영 매뉴얼
6. `CHANGELOG_KO.md` — 시간순 수정 이력
7. `docs/12_Feature_Status.md` — 현재 구현·부분 구현·미구현 기능표
8. `docs/13_Commercial_Release_Checklist_KO.md` — 상업 출시 전 라이선스·개인정보·운영 점검표
