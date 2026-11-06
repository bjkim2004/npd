@echo off
chcp 65001 > nul
setlocal
title NPD 일정·이력 관리 - 기동

rem ===== 한글 깨짐 방지: 콘솔 UTF-8 + Python 입출력 UTF-8 =====
set "PYTHONUTF8=1"
set "PYTHONIOENCODING=utf-8"
set "ROOT=%~dp0"

echo.
echo  NPD 일정·이력 관리 서버를 기동합니다.
echo  - 백엔드  : http://localhost:8000  (API 문서 /docs)
echo  - 프런트엔드: http://localhost:3000
echo.

rem ===== 포트 사용 중인지 확인 =====
netstat -ano | findstr /r /c:":8000 .*LISTENING" > nul && echo  [경고] 8000번 포트가 이미 사용 중입니다. 기존 백엔드를 먼저 종료하세요.
netstat -ano | findstr /r /c:":3000 .*LISTENING" > nul && echo  [경고] 3000번 포트가 이미 사용 중입니다. 기존 프런트엔드를 먼저 종료하세요.

rem ===== 백엔드 (FastAPI) =====
where python > nul 2>&1 || (echo  [오류] python 을 찾을 수 없습니다. & pause & exit /b 1)
pushd "%ROOT%backend"
python -c "import fastapi, uvicorn, sqlalchemy, psycopg, dotenv, multipart" > nul 2>&1
if errorlevel 1 (
  echo  백엔드 패키지를 설치합니다...
  python -m pip install -r requirements.txt
)
popd
start "NPD 백엔드 :8000" cmd /k "chcp 65001 > nul & cd /d "%ROOT%backend" & python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

rem ===== 프런트엔드 (Next.js) =====
where npm > nul 2>&1 || (echo  [오류] npm 을 찾을 수 없습니다. & pause & exit /b 1)
if not exist "%ROOT%frontend\node_modules" (
  echo  프런트엔드 패키지를 설치합니다...
  pushd "%ROOT%frontend"
  call npm install
  popd
)
start "NPD 프런트엔드 :3000" cmd /k "chcp 65001 > nul & cd /d "%ROOT%frontend" & npm run dev"

rem ===== 백엔드 응답을 기다린 뒤 브라우저 열기 (최대 60초) =====
echo  백엔드가 응답할 때까지 기다립니다...
set /a WAIT=0
:wait_backend
curl -s -o nul http://127.0.0.1:8000/api/health && goto backend_ok
set /a WAIT+=2
if %WAIT% geq 60 (
  echo  [경고] 60초 안에 백엔드가 응답하지 않았습니다. 「NPD 백엔드 :8000」 창의 오류를 확인하세요.
  goto open_browser
)
timeout /t 2 /nobreak > nul
goto wait_backend
:backend_ok
echo  백엔드 응답 확인.
timeout /t 3 /nobreak > nul
:open_browser
start "" http://localhost:3000

echo.
echo  기동 완료. 서버를 끄려면 각 창에서 Ctrl+C 를 누르거나 창을 닫으세요.
endlocal
