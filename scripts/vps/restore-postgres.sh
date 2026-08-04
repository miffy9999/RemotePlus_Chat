#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.vps"
COMPOSE_FILE="${PROJECT_ROOT}/compose.vps.yaml"
BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" || ! -f "${BACKUP_FILE}" ]]; then
  echo "사용법: $0 /절대경로/백업파일.dump" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env.vps가 없습니다." >&2
  exit 1
fi

read -r -p "현재 DB를 백업한 뒤 ${BACKUP_FILE}로 복원합니다. RESTORE를 입력하세요: " confirmation
if [[ "${confirmation}" != "RESTORE" ]]; then
  echo "복원을 취소했습니다."
  exit 1
fi

compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
bash "${PROJECT_ROOT}/scripts/vps/backup-postgres.sh"

# 기존 운영 중이면 API 쓰기를 멈춘 동안만 객체를 교체한다. 최초 Render 이전처럼 아직 server 이미지가
# 없는 상황에는 복원 스크립트가 존재하지 않는 이미지를 억지로 시작하지 않게 기존 실행 상태를 기억한다.
server_was_running=false
if "${compose[@]}" ps --status running --services 2>/dev/null | grep -qx 'server'; then
  server_was_running=true
  "${compose[@]}" stop server
fi
restart_server() {
  if [[ "${server_was_running}" == true ]]; then
    "${compose[@]}" up -d server
  fi
}
trap restart_server EXIT
"${compose[@]}" exec -T postgres sh -c 'exec pg_restore --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --if-exists --no-owner --no-privileges' < "${BACKUP_FILE}"
restart_server
trap - EXIT
echo "복원이 끝났습니다. scripts/vps/health-check.sh로 확인해 주세요."
