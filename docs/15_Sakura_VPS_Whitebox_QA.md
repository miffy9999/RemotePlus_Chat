# Sakura VPS 2GB 화이트박스 QA 보고서

검증 시각: 2026-08-03 12:43:53 +09:00

## 전제와 판정

Sakura VPS 2GB는 DB 서버와 웹 서버를 물리적으로 따로 제공하는 상품이 아니라 3 vCPU, RAM 2GB, SSD 100GB의 단일 VM이다. 이 프로젝트는 한 VM 안에서 Caddy, Agent 웹, Guest 웹, API, PostgreSQL을 별도 컨테이너와 네트워크로 분리한다. 프로세스·포트·권한·자원은 분리되지만 VPS 자체 장애에는 모두 함께 영향을 받는 단일 장애점이다.

현재 규모의 중앙 콜센터 MVP는 2GB에서 운용 가능한 구조로 판정한다. 실제 VPS 개통 뒤 회사 DNS/TLS, Render 데이터 이전, 외부 백업과 실제 동시 상담 부하 확인은 남아 있다.

## 1회차 — 구조·보안·자원 정적 QA

검증 범위:

- `compose.vps.yaml` 전체 해석과 외부 공개 포트 자동 단언
- Docker edge/backend 네트워크와 PostgreSQL 격리
- 컨테이너 메모리 상한, PostgreSQL 연결·버퍼, Node.js 힙 설정
- CORS, Caddy 한 단계 신뢰 프록시, 실제 접속 IP 처리
- 설치·배포·상태·백업·복구 Bash 문법
- 전체 lint와 단위·회귀 테스트

발견 및 수정:

- Sakura 패킷 필터는 IPv4만 지원하고 OS 방화벽과 중복될 수 있으므로 UFW 단독 관리로 통일했다.
- Ubuntu 24.04 표준 OS의 IPv6 기본 비활성을 유지하고, 초기 swap 미설정에 맞춰 2GB swap을 추가했다.
- Agent/Guest 정적 웹에 컨테이너 헬스 체크를 추가하고 Caddy가 두 웹의 정상 상태 뒤 시작하도록 했다.
- 상태 점검에서 필수 서비스, OOM 종료 이력, 디스크 85% 경계, 메모리·CPU를 함께 확인하도록 했다.
- Sakura HTTPS 서버 감시와 회사 알림, IP를 유지하는 4GB 스케일업 기준을 운영 문서에 반영했다.

결과:

- 공개 포트: Caddy의 TCP 80/443만 존재
- PostgreSQL: backend 내부망 단독, 호스트 포트 없음
- Bash 문법, Compose 구성, `git diff --check`, lint 통과
- 서버 59개, Agent 92개, Guest 18개 테스트 통과

## 2회차 — 운영 이미지·임시 전체 스택 동적 QA

검증 범위:

- 서버, Agent 웹, Guest 웹 운영 이미지 순차 빌드
- Caddy 공식 컨테이너의 format/validate
- 임시 Docker 내부망과 tmpfs PostgreSQL에서 15개 마이그레이션 전체 적용
- 운영 시드, API 헬스 체크, ADMIN/AGENT 로그인
- Agent/Guest Nginx 실제 응답과 컨테이너 메모리 사용

발견 및 수정:

- 고정 pnpm 10.12.1이 지원하지 않는 `allowBuilds` 때문에 Prisma·bcrypt·esbuild 설치 스크립트 허용 설정이 무시됐다. 해당 버전용 `onlyBuiltDependencies`로 수정했다.
- 웹 이미지가 불필요한 서버 의존성까지 설치하던 과정을 각 웹과 shared 워크스페이스만 설치하도록 축소했다.
- 서버 이미지를 빌드/런타임 다단계로 바꾸고 테스트 도구를 제외했다. 약 1.27GB에서 약 761MB로 줄었다.
- 첫 경량 이미지에서 deploy 후 Prisma Client가 빠져 시드가 실패하는 결함을 발견했다. 운영 node_modules 위치에서 Client를 재생성하도록 수정한 뒤 같은 전체 흐름을 재실행했다.
- Caddyfile을 공식 formatter 형식으로 정리했다.

최종 결과:

- 세 운영 이미지 빌드 통과, Prisma 스키마와 bcrypt Linux 런타임 확인
- Caddy 구성 검증 통과
- 임시 PostgreSQL 마이그레이션·시드·API·ADMIN/AGENT 로그인·두 웹 응답 통과
- 유휴 QA 측정: PostgreSQL 약 73MiB, API 약 58MiB, Agent 웹 약 12MiB, Guest 웹 약 11MiB
- 전체 lint, 169개 테스트, 프로덕션 빌드 재통과

## 확인된 잔여 위험

- 단일 VPS 장애 시 웹과 DB가 함께 중단된다. 현재 비용 조건에서는 허용하되 DB 외부 백업과 복구 시험이 필수다.
- `pnpm audit --prod`는 React Router의 RSC 전용 `GHSA-qwww-vcr4-c8h2`를 보고한다. 공식 권고상 unstable RSC API 사용자만 영향받으며 이 프로젝트는 Vite 정적 SPA라 해당 코드 경로를 사용하지 않는다. 향후 RSC/서버 렌더링을 도입하면 React Router 8.3.0 이상으로 먼저 올려야 한다.
- 실제 도메인 인증서 발급, Sakura 서버 감시 알림, Render 데이터 건수 대조와 동시 상담 부하는 실서버 정보가 생긴 뒤 최종 확인한다.

참고: [Sakura VPS 2GB 사양](https://vps.sakura.ad.jp/specification/), [Ubuntu 24.04와 swap](https://manual.sakura.ad.jp/vps/os-packages/ubuntu-24.04.html), [패킷 필터 주의사항](https://manual.sakura.ad.jp/vps/network/packetfilter.html), [서버 감시](https://manual.sakura.ad.jp/vps/network/servermonitor.html)
