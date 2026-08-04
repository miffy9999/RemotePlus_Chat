#!/usr/bin/env bash
set -Eeuo pipefail

# Sakura VPS의 새 Ubuntu 24.04 서버에서 한 번만 실행하는 기반 설치 스크립트다.
# SSH 연결이 끊겨도 다시 실행할 수 있도록 이미 완료된 작업은 건너뛴다.
if [[ "${EUID}" -ne 0 ]]; then
  echo "sudo bash scripts/vps/setup-ubuntu.sh 로 실행해 주세요." >&2
  exit 1
fi

source /etc/os-release
if [[ "${ID:-}" != "ubuntu" || "${VERSION_ID:-}" != "24.04" ]]; then
  echo "이 스크립트는 Sakura VPS의 Ubuntu 24.04 표준 OS 전용입니다." >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades
timedatectl set-timezone Asia/Tokyo
# 보안 패치는 자동 적용하되 커널 재부팅은 운영자가 상담이 없는 시간에 직접 확인 후 수행한다.
DEBIAN_FRONTEND=noninteractive dpkg-reconfigure unattended-upgrades

# Docker 공식 저장소의 서명키와 배포판 정보를 사용해 엔진·Compose 플러그인을 설치한다.
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu %s stable\n' \
  "$(dpkg --print-architecture)" "${VERSION_CODENAME}" > /etc/apt/sources.list.d/docker.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker

# 2GB RAM에서 최초 Node.js 이미지 빌드가 순간적으로 메모리를 많이 써도 OOM으로 중단되지 않게 2GB swap을 둔다.
if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
fi
if ! swapon --show=NAME --noheadings | grep -qx '/swapfile'; then
  swapon /swapfile
fi
if ! grep -q '^/swapfile ' /etc/fstab; then
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
fi
printf 'vm.swappiness=10\n' > /etc/sysctl.d/99-remoteplus-chat.conf
sysctl --system >/dev/null

# 먼저 SSH를 허용한 다음 웹 포트를 열어 원격 관리 연결이 방화벽 때문에 끊기지 않게 한다.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# sudo로 실행한 실제 운영 사용자만 docker 그룹에 넣고, root 자체에는 불필요한 처리를 하지 않는다.
if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
  usermod -aG docker "${SUDO_USER}"
fi

echo "기반 설치가 끝났습니다. docker 그룹 적용을 위해 SSH에서 로그아웃한 뒤 다시 접속해 주세요."
