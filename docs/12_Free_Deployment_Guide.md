# Vercel + Render 무료 테스트 배포 가이드

이 문서는 하나의 GitHub 모노레포에서 Agent/관리자 웹과 Guest 웹은 Vercel Hobby에, NestJS API와 PostgreSQL은 Render 무료 플랜에 배포하는 절차를 설명합니다.

## 배포 구조

- Vercel 프로젝트 1: `apps/agent-web` — Agent 및 관리자 화면
- Vercel 프로젝트 2: `apps/guest-web` — 객실 Guest 화면
- Render Blueprint: `render.yaml` — API Web Service와 PostgreSQL
- 저장소는 분리하지 않습니다. 공통 패키지와 단일 잠금 파일을 유지해야 배포 버전 불일치를 줄일 수 있습니다.

## 1. Render Blueprint 생성

1. Render Dashboard에서 **New > Blueprint**를 선택합니다.
2. GitHub 저장소 `miffy9999/RemotePlus_Chat`을 연결합니다.
3. Blueprint 파일은 저장소 루트의 `render.yaml`을 선택합니다.
4. 무료 리소스 `remoteplus-api`, `remoteplus-db`가 생성되는지 확인합니다.
5. 입력을 요구하는 환경변수에는 다음 값을 설정합니다.

   - `WEB_ORIGINS`: 최초에는 `https://example.invalid`을 입력하고 Vercel 주소가 정해진 뒤 교체합니다.
   - `GUEST_PUBLIC_URL`: 최초에는 `https://example.invalid`을 입력하고 Guest Vercel 주소가 정해진 뒤 교체합니다.
   - `SEED_ADMIN_PASSWORD`: 현재 무료 테스트 값 `admin`
   - `SEED_AGENT_PASSWORD`: 현재 무료 테스트 값 `agent01`
   - `ALLOW_INSECURE_TEST_PASSWORDS`: 무료 테스트에서만 `true`
   - `SEED_RESET_EXISTING_PASSWORDS`: 기존 테스트 계정을 시드 값으로 맞출 때만 `true`
   - `SEED_ROOM_ACCESS_KEY`: 12자 이상의 첫 번째 객실 접속 키
   - `SEED_SECOND_ROOM_ACCESS_KEY`: 12자 이상의 두 번째 객실 접속 키

`JWT_SECRET`, `ACCESS_KEY_ENCRYPTION_SECRET`, `DATABASE_URL`은 Blueprint가 자동으로 생성·연결합니다. 현재 고정 계정은 무료 테스트 전용이며 상업 배포에서는 `ALLOW_INSECURE_TEST_PASSWORDS=false`로 되돌리고 강한 비밀번호를 Render 비밀 환경변수로 설정합니다. 비밀번호와 접속 키는 Vercel의 `VITE_` 환경변수에 넣지 않습니다.

API 배포가 완료되면 `https://remoteplus-api.onrender.com/api/health` 형식의 주소에서 `status: ok`를 확인합니다. 서비스 이름 중복 시 실제 Render 주소가 달라질 수 있으므로 Dashboard의 주소를 기준으로 합니다.

## 2. Vercel Agent 프로젝트 생성

1. Vercel에서 **Add New > Project**를 선택하고 같은 GitHub 저장소를 Import합니다.
2. 프로젝트 이름을 예를 들어 `remoteplus-agent`로 지정합니다.
3. Root Directory를 `apps/agent-web`으로 지정합니다.
4. 저장소 루트의 공통 패키지를 읽도록 **Include source files outside of the Root Directory**를 활성화합니다.
5. 환경변수를 Production과 Preview에 추가합니다.

   - `VITE_API_URL=https://<실제-render-주소>/api`
   - `VITE_SOCKET_URL=https://<실제-render-주소>/chat`

6. 배포 후 `https://<agent-project>.vercel.app/login`과 `/admin/login`을 확인합니다.

## 3. Vercel Guest 프로젝트 생성

1. 같은 GitHub 저장소를 다시 Import해 별도 프로젝트를 만듭니다.
2. 프로젝트 이름을 예를 들어 `remoteplus-guest`로 지정합니다.
3. Root Directory를 `apps/guest-web`으로 지정합니다.
4. Agent 프로젝트와 동일한 두 환경변수를 추가합니다.
5. 배포 후 `https://<guest-project>.vercel.app/?accessKey=<SEED_ROOM_ACCESS_KEY>`로 접속합니다.

각 앱 폴더의 `vercel.json`이 모노레포 설치·빌드와 SPA 새로고침 라우팅을 처리합니다.

## 4. Render CORS 확정

두 Vercel 주소가 확정되면 Render `remoteplus-api`의 `WEB_ORIGINS`를 쉼표로 연결해 수정합니다.

```text
https://<agent-project>.vercel.app,https://<guest-project>.vercel.app
```

환경변수를 저장한 뒤 API를 재배포합니다. 끝에 `/`를 붙이지 않습니다. Preview URL을 추가로 시험하려면 해당 URL도 쉼표로 추가하고, 테스트가 끝난 뒤 제거합니다.

같은 화면에서 `GUEST_PUBLIC_URL`은 Guest 프로젝트의 주소 하나로 설정합니다. 이 값은 관리자가 객실별 고객 링크를 확인할 때 사용됩니다.

## 5. 검증 순서

1. Render `/api/health`가 200인지 확인합니다.
2. Vercel 관리자 화면에서 시드 관리자 계정으로 로그인합니다.
3. Guest URL에서 상담을 생성합니다.
4. Agent 화면에서 어느 호텔과 객실에서 온 요청인지 확인하고 수락합니다.
5. 양쪽에서 메시지를 한 번씩 보내 실시간 수신을 확인합니다.
6. 브라우저 새로고침 후 로그인 및 Guest 화면이 정상 복구되는지 확인합니다.

## 무료 플랜 제한

- Render 무료 Web Service는 15분간 HTTP 요청이나 WebSocket 메시지가 없으면 중지되며, 첫 재접속에는 최대 약 1분의 준비 시간이 생길 수 있습니다.
- 무료 PostgreSQL은 생성 후 30일에 만료되고, 용량은 1GB이며 백업과 관리형 연결 풀을 제공하지 않습니다.
- 무료 Web Service는 Shell, SSH, one-off job, 수평 확장을 제공하지 않습니다.
- 따라서 이 구성은 테스트 전용입니다. 실제 호텔 운영 전에는 최소한 유료 API와 영구 PostgreSQL, 외부 백업으로 전환해야 합니다.

## 문제 해결

- API가 시작되지 않으면 Render 로그에서 `WEB_ORIGINS`, 시드 비밀번호 길이, DB 마이그레이션 결과를 확인합니다.
- Vercel에서 `Failed to fetch`가 나오면 두 `VITE_` URL이 HTTPS Render 주소인지와 Render `WEB_ORIGINS`에 현재 Vercel Origin이 있는지 확인합니다.
- 화면 새로고침에서 404가 나오면 해당 앱의 `vercel.json`이 배포에 포함됐는지 확인합니다.
- 최초 무료 API 호출이 느린 것은 콜드 스타트일 수 있습니다. `/api/health`를 먼저 열어 API가 준비된 뒤 다시 시도합니다.
