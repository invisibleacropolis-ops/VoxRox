@echo off
setlocal EnableExtensions
title VoxRox Launcher

rem ============================================================
rem  VoxRox launcher
rem    1. preflight  - verify the venv and node_modules exist
rem    2. free ports - stop whatever still holds 8000 / 5173
rem    3. backend    - uvicorn, then wait for /api/health
rem    4. frontend   - vite, then wait for the port to answer
rem    5. browser    - open a dedicated app window
rem
rem  Usage:  VoxRox.bat            full launch
rem          VoxRox.bat nobrowser  start the servers only
rem          VoxRox.bat stop       free the ports and exit
rem ============================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "BACKEND_PORT=8000"
set "FRONTEND_PORT=5173"
set "PY=%ROOT%\backend\.venv\Scripts\python.exe"
set "APP_URL=http://localhost:%FRONTEND_PORT%"
set "MODE=%~1"

echo.
echo   V O X R O X
echo   multi-voice TTS narration
echo   ------------------------------------------------
echo.

if /i "%MODE%"=="stop" goto :freeports

rem ---------------------------------------------------------- 1. preflight
if not exist "%PY%" (
  echo   [X] Backend virtualenv missing:
  echo       %PY%
  echo.
  echo       Create it with:
  echo         py -3.11 -m venv backend\.venv
  echo         backend\.venv\Scripts\python -m pip install -e "backend[dev]"
  echo.
  pause
  exit /b 1
)

if not exist "%ROOT%\frontend\node_modules" (
  echo   [X] Frontend dependencies missing.
  echo       Install them with:  npm install --prefix frontend
  echo.
  pause
  exit /b 1
)

echo   [1/5] Preflight OK.

rem ------------------------------------------------------- 2. free the ports
:freeports
echo   [2/5] Releasing ports %BACKEND_PORT% and %FRONTEND_PORT% ...
call :KillPort %BACKEND_PORT%
call :KillPort %FRONTEND_PORT%

if /i "%MODE%"=="stop" (
  echo.
  echo   Ports released. Nothing started.
  echo.
  exit /b 0
)

rem ------------------------------------------------------------ 3. backend
echo   [3/5] Starting backend on port %BACKEND_PORT% ...
start "VoxRox Backend" cmd /k "cd /d "%ROOT%\backend" && "%PY%" -m uvicorn voxrox.app:app --host 127.0.0.1 --port %BACKEND_PORT%"

call :WaitHealth %BACKEND_PORT%
if errorlevel 1 (
  echo   [X] Backend never became healthy. Check the "VoxRox Backend" window.
  echo.
  pause
  exit /b 1
)
echo         backend healthy.

rem ----------------------------------------------------------- 4. frontend
echo   [4/5] Starting frontend on port %FRONTEND_PORT% ...
start "VoxRox Frontend" cmd /k "cd /d "%ROOT%\frontend" && npm run dev"

call :WaitPort %FRONTEND_PORT%
if errorlevel 1 (
  echo   [X] Frontend never started. Check the "VoxRox Frontend" window.
  echo.
  pause
  exit /b 1
)
echo         frontend serving.

rem ------------------------------------------------------------ 5. browser
if /i "%MODE%"=="nobrowser" (
  echo   [5/5] Skipping browser ^(nobrowser^).
  goto :done
)

echo   [5/5] Opening VoxRox window ...
set "BROWSER="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) do (
  if not defined BROWSER if exist %%P set "BROWSER=%%~P"
)

if defined BROWSER (
  rem --app gives a chromeless standalone window instead of a tab in an
  rem existing session, so VoxRox behaves like its own desktop application.
  start "" "%BROWSER%" --new-window --app="%APP_URL%" --window-size=1500,950
) else (
  echo         No Chrome/Edge found - using the default browser.
  start "" "%APP_URL%"
)

:done
echo.
echo   ------------------------------------------------
echo    VoxRox is running.
echo      app        %APP_URL%
echo      health     http://127.0.0.1:%BACKEND_PORT%/api/health
echo      api docs   http://127.0.0.1:%BACKEND_PORT%/docs
echo.
echo    Logs are in the "VoxRox Backend" and "VoxRox
echo    Frontend" windows. Closing THIS window does not
echo    stop them - run  VoxRox.bat stop  (or just
echo    relaunch, which clears the ports first).
echo   ------------------------------------------------
echo.
exit /b 0


rem ============================================================ subroutines

:KillPort
rem Stops only the process actually listening on the given port. PIDs 0 and 4
rem are System/Idle and are never touched.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=%~1; $ids=@(Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique); $hit=$false; foreach($id in $ids){ if([int]$id -gt 4){ $proc=Get-Process -Id $id -ErrorAction SilentlyContinue; if($proc){ Write-Host ('        stopping ' + $proc.ProcessName + ' (pid ' + $id + ') on port ' + $p); Stop-Process -Id $id -Force -ErrorAction SilentlyContinue; $hit=$true } } }; if($hit){ Start-Sleep -Milliseconds 600 } else { Write-Host ('        port ' + $p + ' already free') }"
exit /b 0

:WaitHealth
rem Polls /api/health for up to ~45s. The first backend start is slow only if
rem Python is cold; model loading happens later, on first render.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 90;$i++){ try { $r=Invoke-RestMethod ('http://127.0.0.1:%~1/api/health') -TimeoutSec 2; if($r.status -eq 'ok'){ $ok=$true; break } } catch { Start-Sleep -Milliseconds 500 } }; if(-not $ok){ exit 1 }"
exit /b %errorlevel%

:WaitPort
rem Waits for a TCP listener to accept a connection on the given port.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ok=$false; for($i=0;$i -lt 90;$i++){ try { $c=New-Object Net.Sockets.TcpClient; $c.Connect('127.0.0.1',%~1); $c.Close(); $ok=$true; break } catch { Start-Sleep -Milliseconds 500 } }; if(-not $ok){ exit 1 }"
exit /b %errorlevel%
