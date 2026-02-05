@echo off
setlocal

cd /d "%~dp0"

set PORT=3000
if not "%CMS_PORT%"=="" set PORT=%CMS_PORT%

set FOUND=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr /r /c:":%PORT% .*LISTENING"') do (
  set FOUND=1
  echo Stopping CMS (PID %%a) on port %PORT%...
  taskkill /PID %%a /F >nul 2>&1
)

if not defined FOUND (
  echo No process is listening on port %PORT%.
)

endlocal

