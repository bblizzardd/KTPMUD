@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Hay chay npm install truoc.
  pause
  exit /b 1
)
echo Mo http://localhost:5173 de su dung An Tam.
call npm.cmd run dev
pause
