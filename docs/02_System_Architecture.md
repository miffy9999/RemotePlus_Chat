# 시스템 아키텍처

투숙객 웹, 상담원 웹, REST API, WebSocket, 데이터베이스, 세션 만료 작업의 구성과 배포 구조를 기록합니다.

## Sakura VPS 2GB 운영 구조

운영 환경은 `compose.vps.yaml`을 기준으로 단일 Sakura VPS에 배치한다. Caddy만 호스트의 80/443 포트를 사용하며 Agent 웹, Guest 웹, NestJS API/Socket.IO, PostgreSQL은 Docker 네트워크에서 이름으로 연결한다. PostgreSQL은 `backend` 내부망에만 참여하고 호스트 포트를 발행하지 않는다.

- `staff.<회사도메인>` → Caddy → Agent/Admin Nginx 컨테이너
- `chat.<회사도메인>` → Caddy → Guest Nginx 컨테이너
- `api.<회사도메인>` → Caddy → NestJS REST 및 `/chat` Socket.IO namespace
- NestJS → 내부 `postgres:5432`; 외부 직접 접속 불가

Caddy는 TLS 인증서 발급·갱신과 WebSocket 업그레이드를 처리한다. NestJS는 신뢰 프록시 홉을 Caddy 한 단계로 제한해 실제 접속 IP를 요청 제한과 보안 로그에 사용한다. PostgreSQL named volume, 매일 custom-format dump, 별도 회사 저장소 사본을 함께 사용한다. 상세 절차는 `14_Sakura_VPS_2GB_Deployment_Guide.md`에 둔다.
