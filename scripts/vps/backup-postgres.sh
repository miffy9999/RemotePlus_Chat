#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.vps"
COMPOSE_FILE="${PROJECT_ROOT}/compose.vps.yaml"
BACKUP_DIR="${PROJECT_ROOT}/backups/postgres"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env.vps가 없습니다." >&2
  exit 1
fi

retention_days="$(sed -n 's/^BACKUP_RETENTION_DAYS=//p' "${ENV_FILE}" | tail -n 1 | tr -d '\r')"
retention_days="${retention_days:-14}"
if [[ ! "${retention_days}" =~ ^[0-9]+$ ]] || (( retention_days < 1 )); then
  echo "BACKUP_RETENTION_DAYS는 1 이상의 정수여야 합니다." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"
timestamp="$(date '+%Y%m%d_%H%M%S')"
target="${BACKUP_DIR}/remoteplus_chat_${timestamp}.dump"
compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")

# 비밀번호를 명령행에 노출하지 않고 컨테이너 내부의 DB 환경변수와 로컬 소켓을 사용한다.
"${compose[@]}" exec -T postgres sh -c 'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' > "${target}"
if [[ ! -s "${target}" ]]; then
  rm -f "${target}"
  echo "백업 파일이 비어 있어 실패로 처리했습니다." >&2
  exit 1
fi
chmod 600 "${target}"

# 지정된 폴더의 이 프로젝트 백업 이름만 대상으로 보존 기간을 적용한다.
find "${BACKUP_DIR}" -maxdepth 1 -type f -name 'remoteplus_chat_*.dump' -mtime "+${retention_days}" -delete
echo "백업 완료: ${target}"
echo "같은 VPS 고장에 대비해 이 파일을 회사 소유의 별도 저장소에도 복사해 주세요."
