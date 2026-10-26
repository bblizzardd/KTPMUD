@echo off
setlocal
cd /d "%~dp0"
title An Tam v1.0

where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "PATH=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin;%PATH%"
  ) else (
    echo Can cai Node.js 24 tro len: https://nodejs.org
    pause
    exit /b 1
  )
)

if not exist backend\node_modules\express (
  echo [1/4] Cai thu vien Backend...
  pushd backend & call npm install & popd
)
if not exist frontend\node_modules\vite (
  echo [1/4] Cai thu vien Frontend...
  pushd frontend & call npm install & popd
)

if not exist backend\.env (
  echo [2/4] Tao cau hinh chay thu backend\.env
  > backend\.env (
    echo HOST=127.0.0.1
    echo PORT=8080
    echo BASE_URL=http://127.0.0.1:8080
    echo CORS_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
    echo DATA_DIR=./data
    echo DEMO_EMAIL=demo@antam.vn
    echo DEMO_PASSWORD=AnTam@2026
    echo ENABLE_DEV_TOOLS=true
  )
)

if not exist frontend\.env.local (
  > frontend\.env.local echo VITE_DEMO_ACCOUNT=demo@antam.vn:AnTam@2026
)

echo [3/4] Dung giao dien Web...
pushd frontend
call npm run build --silent
if errorlevel 1 (
  popd
  echo Build giao dien that bai.
  pause
  exit /b 1
)
popd

if not exist backend\data\antam.sqlite (
  echo [4/4] Tao du lieu mau...
  pushd backend & call npm run seed --silent & popd
)

echo.
echo  An Tam v1.0: http://127.0.0.1:8080
echo  Tai khoan demo: demo@antam.vn / AnTam@2026
echo  Dong cua so nay de tat may chu.
echo.
if not defined ANTAM_NO_BROWSER start "" /b cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8080"
pushd backend
call npm start
popd
pause
