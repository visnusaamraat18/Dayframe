@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
  py -3 serve_dayframe.py
) else (
  python serve_dayframe.py
)
if errorlevel 1 echo Python 3.10 or newer and a completed npm run build are required. Stop any other server using port 5173 first.
pause
