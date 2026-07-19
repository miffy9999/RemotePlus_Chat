# Phase 1 REST API의 정상 상담 흐름을 반복 검증하는 로컬 통합 테스트입니다.
# PostgreSQL, 시드 데이터와 NestJS 서버가 실행 중인 상태에서 사용합니다.
param([string]$BaseUrl = "http://localhost:4000/api")

$ErrorActionPreference = "Stop"

# 룸 접근 키를 검증하고, 이 검증으로 발급된 짧은 JWT로만 새 상담을 생성합니다.
$verify = Invoke-RestMethod -Method Post -Uri "$BaseUrl/guest/access/verify" -ContentType "application/json" -Body (@{ accessKey = "demo-room-access-1201" } | ConvertTo-Json)
$created = Invoke-RestMethod -Method Post -Uri "$BaseUrl/chat-sessions" -Headers @{ Authorization = "Bearer $($verify.accessToken)" } -ContentType "application/json" -Body (@{ language = "ko" } | ConvertTo-Json)

# Agent JWT로 대기 목록을 조회하고 방금 생성한 상담을 수락합니다.
$login = Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/agent/login" -ContentType "application/json" -Body (@{ loginId = "agent01"; password = "Agent1234!" } | ConvertTo-Json)
$staffHeaders = @{ Authorization = "Bearer $($login.accessToken)" }
$waiting = Invoke-RestMethod -Method Get -Uri "$BaseUrl/agent/chat-sessions?status=WAITING" -Headers $staffHeaders
$accepted = Invoke-RestMethod -Method Post -Uri "$BaseUrl/agent/chat-sessions/$($created.session.id)/accept" -Headers $staffHeaders

# 투숙객은 JWT가 아니라 생성 시 한 번 반환된 불투명 토큰으로 자기 상담만 조회합니다.
$guestView = Invoke-RestMethod -Method Get -Uri "$BaseUrl/chat-sessions/$($created.session.id)" -Headers @{ "x-guest-token" = $created.guestToken }
$closed = Invoke-RestMethod -Method Post -Uri "$BaseUrl/chat-sessions/$($created.session.id)/close" -Headers $staffHeaders

$checks = [ordered]@{
  AccessVerified = $verify.room.roomNumber -eq "1201"
  SessionCreated = $created.session.status -eq "WAITING"
  WaitingListContains = @($waiting).id -contains $created.session.id
  Accepted = $accepted.status -eq "ACTIVE"
  GuestCanRead = $guestView.id -eq $created.session.id
  Closed = $closed.status -eq "CLOSED"
}

# 하나라도 실패하면 CI나 개발자 터미널에서 즉시 실패로 인식할 수 있게 종료 코드 1을 반환합니다.
if ($checks.Values -contains $false) {
  $checks | ConvertTo-Json
  exit 1
}

$checks | ConvertTo-Json
