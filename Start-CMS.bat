@echo off
setlocal

cd /d "%~dp0"

set PORT=3000
if not "%CMS_PORT%"=="" set PORT=%CMS_PORT%

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js LTS, then try again.
  pause
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo npm is not available.
  echo Install Node.js - it includes npm - then try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies for the first run...
  npm install
  if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
  )
)

set FOUND_PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  set FOUND_PID=%%a
)

if defined FOUND_PID (
  echo CMS already running on port %PORT% - PID %FOUND_PID%.
) else (
  echo Starting CMS on port %PORT%...
  start "" /min cmd /k "set PORT=%PORT%&& npm run cms"
  timeout /t 2 /nobreak >nul
)

start "" "http://localhost:%PORT%/admin/"
endlocal
