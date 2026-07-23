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
| 관리자·Agent 통합 로그인 | http://127.0.0.1:5173/login |
| 서버 상태 확인 | http://127.0.0.1:4100/api/health |
| 고객 웹 | 관리자 페이지의 룸 목록에서 생성된 주소 사용 |

무료 테스트 계정은 관리자 `admin / admin`, Agent `agent01 / agent01`입니다. DB에는 bcrypt 해시로 저장되지만 비밀번호 자체가 매우 약하므로 외부 공개·상업 운영 전 반드시 교체해야 합니다.

로그인 후 관리자·Agent 화면의 `비밀번호 변경`에서 현재 비밀번호를 확인하고 새 비밀번호로 바꿀 수 있습니다. 변경하면 해당 계정의 기존 로그인 토큰이 모두 폐기되어 모든 기기에서 새 비밀번호로 다시 로그인해야 하며, 배포나 서버 재시작 뒤에도 변경값이 유지됩니다. 기본 테스트 비밀번호를 계속 사용하면 Chrome의 유출 비밀번호 경고가 표시될 수 있습니다.

직원 로그인 화면의 `아이디 저장`은 로그인 ID만 이 브라우저에 저장합니다. `로그인 정보 저장`은 비밀번호를 앱 저장소에 기록하지 않고 브라우저 비밀번호 관리자에 저장을 요청합니다. 선택한 버튼을 다시 누르면 해당 저장 모드가 해제됩니다.

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

통합 로그인에서 관리자 계정으로 로그인하면 상단 운영 지표와 `호텔 관리 / Agent 관리 / 상담 로그` 메뉴가 있는 대시보드가 표시됩니다. 데스크톱에서는 왼쪽 메뉴를 접어 작업 공간을 넓힐 수 있고 모바일에서는 가로 탭으로 전환됩니다. `호텔 관리`에서 호텔을 추가한 뒤 등록 호텔 칩 또는 선택창에서 대상 호텔을 골라 룸을 추가합니다. 서버가 추측하기 어려운 접근키를 자동 생성하며 룸 테이블에서 다음 기능을 제공합니다.

- `상담 링크 열기`: 새 탭에서 해당 룸의 고객 화면 열기
- `주소 복사`: 고객에게 전달할 전체 주소를 클립보드에 복사
- `QR 보기`: 객실 고객 주소를 담은 고정 QR 미리보기 및 약 1024px 고해상도 PNG 다운로드
- `호텔별 Guest 자동 안내문`: 日本語 / English 탭에서 신규 상담의 첫 SYSTEM 메시지 설정

QR은 객실 또는 접근 키가 삭제되지 않는 한 만료·갱신되지 않습니다. 인쇄된 QR은 고객 웹 주소를 그대로 담으므로 상업 인쇄 전 운영 도메인을 확정하고 실제 휴대전화로 스캔 시험하세요.

접근키 원문은 DB에 그대로 저장하지 않고 AES-256-GCM으로 암호화합니다. `.env`의 `ACCESS_KEY_ENCRYPTION_SECRET`을 바꾸면 기존 룸 주소를 복원할 수 없으므로 운영 중에는 반드시 안전하게 백업하고 유지해야 합니다.

## Agent 수신 알림 사용하기

Agent 화면은 LINE형 `Current chat room / Log` 구조이며 왼쪽 상단 계정 칩에서 현재 직원 이름을 확인하고, 표시 언어에서 한국어·일본어를 전환할 수 있습니다. 상담 입력창은 항상 화면 최하단에 있고 대화가 짧으면 최근 말풍선이 입력창 바로 위에 표시됩니다. Guest는 Agent가 열기 전에도 메시지를 보낼 수 있고, Agent가 새 문의를 여는 순간부터 15분 상담 시간이 시작됩니다.

Agent 화면을 열어 두면 새 대기 상담과 이 Agent에게 배정된 모든 진행 상담의 고객 메시지를 감지해 다음과 같이 알립니다.

- 앱 화면 우측 상단에 호텔·객실·메시지 미리보기 팝업을 약 8초간 표시
- 기본은 무음이며 `알림음 켜기/끄기`로 같은 브라우저의 소리 설정 유지
- 새 상담 팝업의 `대기 상담 보기`를 누르면 자동 수락하지 않고 대기 목록으로 이동
- 비활성 탭 제목 깜빡임과 최근 메시지 상담의 목록 맨 위 이동

앱 내부 팝업은 별도 권한 없이 동작합니다. 다른 탭이나 창을 보고 있을 때도 운영체제 알림을 받으려면 대기 상담 영역의 `브라우저 알림 켜기`를 누르고 브라우저 권한을 허용하세요. 같은 Agent ID를 여러 PC에서 공유하는 경우 브라우저 권한은 PC와 브라우저별로 각각 한 번 허용해야 합니다. 권한을 차단했다면 브라우저의 사이트 설정에서 이 사이트의 알림 권한을 다시 변경해야 합니다.

## 상담 기록 보존

종료·만료·취소·차단된 상담은 `closedAt` 기준 30일이 지나면 메시지와 함께 자동 삭제됩니다. 대기 중이거나 진행 중인 상담은 삭제하지 않으며, 무료 플랜 DB 부하를 줄이기 위해 서버 시작 시 한 번과 이후 24시간마다 한 번만 정리합니다. 필요한 법적·회계·분쟁 대응 보존 기간이 30일보다 길다면 상업 배포 전에 별도 익명 통계나 백업 정책을 정해야 합니다.

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
