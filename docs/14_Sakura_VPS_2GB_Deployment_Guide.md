# Sakura VPS 2GB 운영·이전 가이드

이 문서는 Ubuntu 24.04가 설치된 Sakura VPS 2GB 한 대에서 Agent 웹, Guest 웹, API/WebSocket, PostgreSQL을 운영하는 절차다. 운영 경로는 `compose.vps.yaml`, 로컬 개발은 기존 `compose.yaml`을 사용하므로 서로 영향을 주지 않는다.

Sakura가 DB와 웹을 물리적으로 나눠 제공하는 것은 아니다. 2GB 단일 VM 안에서 아래 컨테이너들이 논리적으로 분리되며, VPS 전원·디스크·호스트 장애는 모두에게 영향을 준다. 현재 비용과 트래픽 조건에서는 이 단일 서버 구성을 사용하고 외부 DB 백업으로 보완한다.

## 1. 최종 구조

```text
인터넷
  └─ Caddy :80/:443 (자동 HTTPS)
       ├─ staff.example.com → Agent/Admin 정적 웹
       ├─ chat.example.com  → Guest 정적 웹
       └─ api.example.com   → NestJS REST + Socket.IO
                                  └─ 내부 전용 PostgreSQL
```

- VPS 외부에 공개하는 포트: SSH 22, HTTP 80, HTTPS 443
- 외부에 공개하지 않는 포트: PostgreSQL 5432, API 4000, 정적 웹 컨테이너 80
- 평상시 메모리 상한: PostgreSQL 512MB, API 512MB, Caddy 128MB, 정적 웹 각 96MB
- PostgreSQL 데이터와 TLS 인증서는 Docker named volume에 보존한다.
- 서버에는 2GB swap을 추가하고 앱 이미지를 하나씩 빌드해 2GB RAM의 순간 OOM을 줄인다.
- 서버 런타임 이미지는 개발·테스트 도구를 제외한 다단계 빌드이며, 웹 이미지는 해당 웹과 shared 의존성만 설치한다.

## 2. 신청·DNS 준비

1. Sakura VPS 2GB, Ubuntu 24.04 표준 OS, 공인 IPv4 한 개로 신청한다.
2. 회사 소유 도메인에 아래 A 레코드 세 개를 만들고 모두 VPS 공인 IPv4로 지정한다.
   - `staff.회사도메인`: Agent/Admin
   - `chat.회사도메인`: Guest/객실 QR
   - `api.회사도메인`: API/WebSocket
3. 방화벽은 OS의 UFW 한 곳에서 22, 80, 443 TCP만 허용한다. Sakura 패킷 필터와 UFW를 함께 쓰면 규칙이 겹치므로, UFW 설정을 마친 뒤 컨트롤 패널의 Sakura 패킷 필터는 `이용하지 않음`으로 둔다.
4. Ubuntu 24.04 표준 OS의 IPv6는 기본 비활성이다. 현재 서비스는 IPv4만 사용하므로 공격 표면과 이중 방화벽 관리를 늘리는 IPv6를 임의로 활성화하지 않는다.

고정 QR을 인쇄하기 전 `chat.회사도메인`을 확정해야 한다. Vercel 기본 주소가 들어간 QR은 Sakura 이전 뒤 자동으로 주소가 바뀌지 않는다. 회사 도메인을 QR에 사용하면 향후 서버를 다시 옮겨도 DNS만 변경하면 인쇄물을 계속 쓸 수 있다.

## 3. 최초 서버 설정

Windows PowerShell에서 접속한다. 이 PC처럼 OpenSSH가 PATH에 없다면 전체 경로를 사용한다.

```powershell
& "C:\Windows\System32\OpenSSH\ssh.exe" ubuntu@서버공인IP
```

서버에서 코드를 배치한다. 현재 공개 저장소는 인증 없이 clone할 수 있지만, 인턴 개인 저장소를 회사의 유일한 원본으로 남기지 말고 인수인계 전에 회사 저장소나 암호화된 회사 백업에 전체 소스를 별도로 보관한다.

```bash
sudo mkdir -p /opt/remoteplus-chat
sudo chown ubuntu:ubuntu /opt/remoteplus-chat
git clone https://github.com/miffy9999/RemotePlus_Chat.git /opt/remoteplus-chat
cd /opt/remoteplus-chat
sudo bash scripts/vps/setup-ubuntu.sh
```

설치가 끝나면 SSH에서 로그아웃하고 다시 접속해 docker 그룹 권한을 적용한다.

회사 담당자 두 명의 서로 다른 SSH 공개키를 `~/.ssh/authorized_keys`에 등록하고 두 PC 모두 접속되는 것을 확인한다. 그 다음에만 SSH 비밀번호 로그인을 끈다. 인턴 개인키 하나만 서버의 유일한 접속 수단으로 남기지 않는다. SSH가 막혀도 Sakura 컨트롤 패널의 VNC/시리얼 콘솔로 복구할 수 있다.

## 4. 운영 비밀값 설정

```bash
cd /opt/remoteplus-chat
cp .env.vps.example .env.vps
chmod 600 .env.vps
nano .env.vps
```

임의 값은 `openssl rand -hex 32`를 여러 번 실행해 각각 다른 64자리 값으로 만든다. 출력값을 다음 항목에 서로 다르게 넣는다.

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `ACCESS_KEY_ENCRYPTION_SECRET`
- `SEED_ROOM_ACCESS_KEY`, `SEED_SECOND_ROOM_ACCESS_KEY`

`SEED_ADMIN_PASSWORD`, `SEED_AGENT_PASSWORD`도 회사에서 관리할 12자 이상의 초기 비밀번호로 교체한다. `.env.vps`는 Git에 포함되지 않으며 회사 비밀번호 관리자에 별도 보관한다. 특히 `ACCESS_KEY_ENCRYPTION_SECRET`을 잃거나 임의로 변경하면 DB에 보관된 기존 객실 QR 접근키를 관리자 화면에서 복원할 수 없다.

## 5. 신규 설치와 Render 데이터 이전

### 새 데이터로 시작

DNS가 VPS를 가리키는 것을 확인한 뒤 최초 한 번만 bootstrap을 사용한다.

```bash
cd /opt/remoteplus-chat
bash scripts/vps/deploy.sh --bootstrap
bash scripts/vps/health-check.sh
```

`--bootstrap`은 초기 호텔·객실·관리자·Agent만 생성한다. 이후 코드 업데이트에서는 붙이지 않는다.

### 기존 Render 데이터 유지

Render의 PostgreSQL 외부 접속 URL로 덤프를 만든다. URL은 화면이나 명령 기록에 붙여 넣지 않도록 숨김 입력을 사용한다.

```bash
cd /opt/remoteplus-chat
read -rsp "Render External Database URL: " SOURCE_DATABASE_URL && echo
docker run --rm postgres:17-alpine pg_dump --dbname="$SOURCE_DATABASE_URL" --format=custom > render-before-sakura.dump
unset SOURCE_DATABASE_URL
docker compose --env-file .env.vps -f compose.vps.yaml up -d postgres
bash scripts/vps/restore-postgres.sh "$PWD/render-before-sakura.dump"
bash scripts/vps/deploy.sh
bash scripts/vps/health-check.sh
```

이 경우 `--bootstrap`을 사용하지 않는다. 기존 QR 접근키 복호화를 위해 Render의 `ACCESS_KEY_ENCRYPTION_SECRET`을 Sakura `.env.vps`에 동일하게 옮겨야 한다. 기존 직원 로그인을 당장 유지하려면 `JWT_SECRET`도 동일하게 옮기고, 완전한 강제 재로그인이 필요할 때만 새 값으로 변경한다.

## 6. 일반 업데이트

공동 작업 내용을 받은 뒤 아래 명령으로 업데이트한다. 배포 스크립트는 실행 중인 DB를 먼저 백업하고 이미지를 순차 빌드한 뒤 마이그레이션 성공 시에만 새 API를 시작한다.

```bash
cd /opt/remoteplus-chat
git pull --ff-only
bash scripts/vps/deploy.sh
bash scripts/vps/health-check.sh
```

상태와 오류 로그는 다음처럼 확인한다.

```bash
docker compose --env-file .env.vps -f compose.vps.yaml ps
docker compose --env-file .env.vps -f compose.vps.yaml logs --tail=200 server caddy postgres
```

## 7. 자동 백업과 복구

아래 명령으로 일본 시간 매일 03:15 자동 백업을 등록한다.

```bash
sudo cp infra/systemd/remoteplus-chat-backup.service /etc/systemd/system/
sudo cp infra/systemd/remoteplus-chat-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now remoteplus-chat-backup.timer
systemctl list-timers remoteplus-chat-backup.timer
```

백업은 `/opt/remoteplus-chat/backups/postgres`에 생성되고 기본 14일 보존된다. 같은 VPS의 디스크 장애에는 함께 사라지므로, 회사 OneDrive/NAS 등 회사 소유의 다른 위치로 매일 추가 복사해야 한다. 복구 전에는 스크립트가 현재 DB를 한 번 더 백업하고 `RESTORE` 확인을 요구한다.

```bash
bash scripts/vps/restore-postgres.sh /절대경로/remoteplus_chat_YYYYMMDD_HHMMSS.dump
```

## 8. 전환과 인수인계 완료 조건

- Agent/Admin 로그인, 비밀번호 변경, 호텔·객실 관리 확인
- 실제 휴대폰으로 Guest QR 접속, 상담 생성, 실시간 송수신, 상담 종료 확인
- Caddy HTTPS와 WebSocket 재연결 확인
- Render의 상담 로그 건수와 Sakura 이전 후 건수 비교
- 자동 백업 파일 생성과 시험 복구 확인
- 회사가 Sakura 로그인, 도메인/DNS, `.env.vps`, SSH 키, 소스 백업에 접근 가능한지 확인
- Sakura 컨트롤 패널의 서버 감시에 `https`, SNI 활성, `api.회사도메인/api/health`, 정상 코드 200을 등록하고 회사 메일 알림을 확인
- Vercel/Render는 최소 1~2주 병행한 뒤 DNS와 기능이 안정된 것을 확인하고 종료

VPS는 Render 무료 플랜처럼 sleep하지 않지만, 2GB 한 대에는 장애 시 자동 대체 서버가 없다. 백업·복구 시험과 회사 명의 접근권한이 실제 운영에서 가장 중요한 인수인계 항목이다. 평상시 메모리 사용이 계속 80%를 넘거나 swap 사용이 계속 증가하거나 OOM 종료가 한 번이라도 발생하면 4GB로 스케일업한다. Sakura 스케일업은 기존 IP를 유지할 수 있으므로 도메인과 인쇄 QR은 그대로 사용할 수 있다.
