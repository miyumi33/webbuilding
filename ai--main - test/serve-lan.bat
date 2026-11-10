@echo off
rem ============================================================
rem  NEXUS AI - publish this website on the local network
rem  Double-click, keep the window open, then open the printed
rem  URL on a phone connected to the same Wi-Fi.
rem ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "PORT=8000"

set "PY="
where python >nul 2>nul
if not errorlevel 1 set "PY=python"

if not defined PY (
  set "BUNDLED=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
  if exist "!BUNDLED!" set "PY=!BUNDLED!"
)

if not defined PY (
  where py >nul 2>nul
  if not errorlevel 1 set "PY=py -3"
)

if not defined PY (
  echo Python was not found. Install Python 3, then run this file again.
  pause
  exit /b 1
)

echo ============================================================
echo  NEXUS AI - website on the local network
echo  Site   : %CD%\index.html
echo  Port   : %PORT%
echo ------------------------------------------------------------
echo  This computer : http://127.0.0.1:%PORT%/
echo  Phone / tablet (same Wi-Fi):
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4"') do (
  set "ADDR=%%A"
  set "ADDR=!ADDR: =!"
  echo                 http://!ADDR!:%PORT%/
)
echo ------------------------------------------------------------
echo  Only index.html, styles.css and the site scripts are served.
echo  If another device cannot open it, allow the port once
echo  (Administrator PowerShell):
echo    netsh advfirewall firewall add rule name="NEXUS AI LAN %PORT%" dir=in action=allow protocol=TCP localport=%PORT%
echo ------------------------------------------------------------
echo  Press Ctrl+C to stop.
echo.

%PY% "%~dp0serve-web.py" %PORT%

echo.
echo Server stopped.
pause
