@echo off
REM ============================================================
REM  MODBAY local dev server launcher
REM  ASCII only on purpose: a UTF-8 .bat gets mis-parsed by the
REM  default GBK console codepage and breaks the command lines.
REM ============================================================
cd /d "%~dp0"
setlocal

echo ============================================
echo   MODBAY  -  local dev server
echo   http://127.0.0.1:8321
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js 18+ and add it to PATH.
  echo         https://nodejs.org
  pause
  exit /b 1
)

netstat -ano | findstr ":8321 " | findstr "LISTENING" >nul 2>nul
if not errorlevel 1 (
  echo [WARN] Port 8321 is already in use.
  echo        Run stop.bat first, or open http://127.0.0.1:8321 directly.
  pause
  exit /b 1
)

echo [1/3] starting server ...
start "MODBAY-SERVER" /min cmd /c "node server\server.js"
timeout /t 2 /nobreak >nul

echo [2/3] checking port ...
netstat -ano | findstr ":8321 " | findstr "LISTENING" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Server did not start.
  echo         Run "node server\server.js" in this folder to see the error.
  pause
  exit /b 1
)

echo [3/3] opening browser ...
start "" "http://127.0.0.1:8321/index.html"

echo.
echo   Server is running in a background window named MODBAY-SERVER.
echo   To stop it: run stop.bat
echo.
pause
