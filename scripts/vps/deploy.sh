#!/usr/bin/env bash
set -Eeuo pipefail

# 두 웹 이미지의 공통 의존성 레이어를 재사용하면서도 2GB VPS에서 동시 빌드 OOM이 나지 않도록 순차 배포한다.
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.vps"
COMPOSE_FILE="${PROJECT_ROOT}/compose.vps.yaml"
BOOTSTRAP=false

if [[ "${1:-}" == "--bootstrap" ]]; then
  BOOTSTRAP=true
elif [[ $# -gt 0 ]]; then
  echo "사용법: $0 [--bootstrap]" >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env.vps가 없습니다. .env.vps.example을 복사하고 운영 값을 입력해 주세요." >&2
  exit 1
fi
if grep -q 'CHANGE_ME\|example\.com' "${ENV_FILE}"; then
  echo ".env.vps에 예시 값이 남아 있습니다. 모든 CHANGE_ME와 example.com을 교체해 주세요." >&2
  exit 1
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker Engine과 Docker Compose 플러그인이 필요합니다." >&2
  exit 1
fi

compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
"${compose[@]}" config --quiet

# 기존 운영 DB가 있으면 코드·스키마 변경 전에 자동 백업해 잘못된 배포를 복구할 기준점을 남긴다.
if "${compose[@]}" ps --status running --services 2>/dev/null | grep -qx 'postgres'; then
  bash "${PROJECT_ROOT}/scripts/vps/backup-postgres.sh"
fi

# 기반 이미지를 먼저 갱신한 뒤 애플리케이션 이미지는 하나씩 빌드해 메모리 피크를 낮춘다.
"${compose[@]}" pull postgres caddy
"${compose[@]}" build server
"${compose[@]}" build agent-web
"${compose[@]}" build guest-web

# 마이그레이션 성공을 server의 시작 조건으로 두어 스키마가 맞지 않는 코드가 먼저 트래픽을 받지 않게 한다.
"${compose[@]}" up -d postgres
"${compose[@]}" up -d migrate
"${compose[@]}" up -d server agent-web guest-web caddy

if [[ "${BOOTSTRAP}" == true ]]; then
  # 운영 시드는 최초 빈 DB 구축에서만 명시적으로 실행한다. 업데이트 배포에서는 절대 자동 실행하지 않는다.
  "${compose[@]}" --profile bootstrap run --rm seed
fi

"${compose[@]}" ps
echo "배포가 끝났습니다. 상태 확인: scripts/vps/health-check.sh"
