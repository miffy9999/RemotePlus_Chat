@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-docker.ps1"
set "START_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %START_RESULT%
