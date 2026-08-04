#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env.vps"
COMPOSE_FILE="${PROJECT_ROOT}/compose.vps.yaml"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo ".env.vps가 없습니다." >&2
  exit 1
fi

compose=(docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}")
"${compose[@]}" ps

# 마이그레이션은 정상 종료되는 일회성 컨테이너이므로 제외하고, 상시 서비스 다섯 개가 모두 실행 중인지 확인한다.
running_services="$("${compose[@]}" ps --status running --services)"
for required_service in postgres server agent-web guest-web caddy; do
  if ! grep -qx "${required_service}" <<< "${running_services}"; then
    echo "필수 서비스가 실행 중이 아닙니다: ${required_service}" >&2
    exit 1
  fi
done

# Docker가 메모리 초과로 강제 종료한 이력이 있으면 현재 재시작되었더라도 용량 부족으로 판정한다.
for container_id in $("${compose[@]}" ps -q); do
  if [[ "$(docker inspect --format '{{.State.OOMKilled}}' "${container_id}")" == "true" ]]; then
    echo "OOM 종료 이력이 있는 컨테이너가 있습니다: ${container_id}" >&2
    exit 1
  fi
done

# 외부 DNS/TLS와 내부 API 상태를 각각 확인해 도메인 문제와 앱 문제를 구분한다.
api_domain="$(sed -n 's/^API_DOMAIN=//p' "${ENV_FILE}" | tail -n 1 | tr -d '\r')"
if [[ -z "${api_domain}" ]]; then
  echo "API_DOMAIN을 읽을 수 없습니다." >&2
  exit 1
fi
curl --fail --silent --show-error --max-time 10 "https://${api_domain}/api/health"

# Sakura의 100GB 디스크가 로그·이미지·백업으로 85%% 이상 차면 장애 전에 운영자에게 실패로 알린다.
disk_used="$(df -P / | awk 'NR == 2 { gsub(/%/, "", $5); print $5 }')"
if [[ ! "${disk_used}" =~ ^[0-9]+$ ]] || (( disk_used >= 85 )); then
  echo "루트 디스크 사용률을 확인해 주세요: ${disk_used:-unknown}%" >&2
  exit 1
fi

printf '\n전체 외부 헬스 체크가 통과했습니다.\n'
free -h
df -h /
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}\t{{.CPUPerc}}'
