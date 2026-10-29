@echo off
REM ============================================================
REM  MODBAY local dev server stopper  (ASCII only, see start.bat)
REM ============================================================
cd /d "%~dp0"
setlocal

echo Stopping MODBAY server on port 8321 ...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8321 " ^| findstr "LISTENING"') do (
  echo   killing PID %%a
  taskkill /PID %%a /F >nul 2>nul
)

taskkill /FI "WINDOWTITLE eq MODBAY-SERVER*" /T /F >nul 2>nul
timeout /t 1 /nobreak >nul

netstat -ano | findstr ":8321 " | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [WARN] Port 8321 is still in use. End the node process in Task Manager.
) else (
  echo [OK] stopped
)
pause
