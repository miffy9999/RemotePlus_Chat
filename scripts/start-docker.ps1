$ErrorActionPreference = "Stop"

# 배치파일의 위치와 관계없이 실제 프로젝트 루트의 compose.yaml을 사용하도록 작업 폴더를 고정합니다.
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot

# Docker 명령 설치 여부와 Docker Desktop 엔진 준비 상태를 별도로 검사하여 원인을 명확히 안내합니다.
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  Write-Host "[ERROR] Docker command was not found. Install Docker Desktop first." -ForegroundColor Red
  exit 1
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Docker Desktop is not running. Start Docker Desktop and try again." -ForegroundColor Red
  exit 1
}

# 최초 실행에만 예제 설정을 복사하며, 기존 비밀값이 들어 있는 .env 파일은 절대로 덮어쓰지 않습니다.
if (-not (Test-Path -LiteralPath ".env")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env"
  Write-Host "[READY] Created .env from .env.example."
}

# 예제의 금지된 비밀값이 남아 있으면 로컬 전용 무작위 값을 만들어 시드 암호화와 JWT 발급이 즉시 동작하게 합니다.
$environmentPath = Join-Path $projectRoot ".env"
$utf8WithoutBom = New-Object System.Text.UTF8Encoding($false)
$environmentText = [System.IO.File]::ReadAllText($environmentPath, $utf8WithoutBom)
$jwtSecret = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
$accessKeySecret = ([guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N"))
$environmentText = $environmentText.Replace("replace-with-a-long-random-secret", $jwtSecret)
$environmentText = $environmentText.Replace("replace-with-another-long-random-secret", $accessKeySecret)
[System.IO.File]::WriteAllText($environmentPath, $environmentText, $utf8WithoutBom)

Write-Host "[START] Building and starting Hotel Chat containers. The first run may take a few minutes."
docker compose up -d --build
if ($LASTEXITCODE -ne 0) {
  Write-Host "[ERROR] Docker Compose failed. Review the error shown above." -ForegroundColor Red
  exit $LASTEXITCODE
}

# 사용자가 현재 컨테이너 상태와 접속 주소를 한 화면에서 바로 확인할 수 있게 출력합니다.
Write-Host ""
docker compose ps
Write-Host ""
Write-Host "[OK] Admin and Agent : http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "[OK] Guest web       : http://127.0.0.1:5174" -ForegroundColor Green
Write-Host "[OK] Server health   : http://127.0.0.1:4100/api/health" -ForegroundColor Green
Write-Host "[INFO] To stop: docker compose down"
exit 0
