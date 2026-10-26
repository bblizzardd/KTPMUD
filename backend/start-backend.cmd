@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  ) else (
    echo Can cai Node.js 24 tro len, sau do chay npm install trong thu muc backend.
    pause
    exit /b 1
  )
)
if not exist node_modules\express (
  echo Chay npm install trong thu muc backend truoc khi khoi dong.
  pause
  exit /b 1
)
node --env-file-if-exists=.env src/server.js
pause
