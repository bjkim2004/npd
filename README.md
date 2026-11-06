# NPD 일정·이력 관리 (PBL 2일차)

- `backend/` — Python FastAPI · SQLAlchemy · Supabase(Postgres). 연결 실패 시 `backend/local.db`(SQLite)로 대체하고 `/api/health`의 `db` 값에 표시
- `frontend/` — Next.js 16 · React 19 · Tailwind CSS 4

## 실행

```bash
# 백엔드 (http://localhost:8000, 문서 /docs)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000

# 프런트엔드 (http://localhost:3000)
cd frontend
npm install
npm run dev
```

DB 접속 정보는 `backend/.env` (git 제외). `DB_FORCE_SQLITE=1`이면 SQLite만 쓴다.

## 로그인·회원가입

- 화면: `/login`, `/signup`. 로그인하지 않으면 모든 화면이 `/login?next=원래경로`로 이동하고, 로그인 후 원래 경로로 돌아간다
- API: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me` (`backend/app/auth.py`). `/api/health`를 뺀 모든 API는 `Authorization: Bearer <토큰>` 필요
- 비밀번호는 8자 이상·영문+숫자, scrypt 해시로 `npd_users`에 저장. 토큰은 HMAC 서명, 기본 12시간(`AUTH_TOKEN_TTL_HOURS`)
- 서명 키 `AUTH_SECRET`은 `backend/.env`에 둔다. 없으면 기동할 때마다 임시 키가 생겨 재기동 시 다시 로그인해야 한다

## 시험 — 한 명령

```bash
cd backend
python -m pytest tests -v          # 전체 (역산·신호등·동시 진행·흡수 3건)
python -m app.tools.compare        # 1교시: 엔진 ↔ 엑셀 일치 표 (일치 수 / 어긋남 수 / 어긋난 Task 표)
```

`data/excel_expected.csv`(열: `launch_date,task_no,task_name,excel_start,excel_end`)에 엑셀 값을 옮겨 넣어야 1교시 비교가 돈다. 비어 있으면 「확인 필요」로 건너뛴다.

## 데이터

| 파일 | 내용 | 상태 |
|---|---|---|
| `data/tasks_seed.csv` | Task 39행 (`no,name,phase,start_offset,duration,basis,predecessors,buffer_days,note`) | 16개만 값 있음(회신 v08 부록 B, NEW\|표준). 23개 「확인 필요」 |
| `data/holidays.csv` | 2026–2027 공휴일 28건 | 엑셀 29건과 대조 필요, 공동연차 미입력 |

엑셀 39개 기준 데이터는 화면의 「Task CSV 가져오기」 또는 `POST /api/tasks/import`로 넣는다.

## 규칙 (엔진)

- 착수일 = 출시일 − 착수 역산일수(영업일), 종료일 = 출시일 − (착수 역산일수 − 소요일수)
- D-주차 = 역산 영업일수 ÷ 5 올림 (C-02)
- 공휴일 미등록 연도의 출시일은 제품 생성 거부 (C-05)
- 신호등: 초록 = 기한 내 완료 또는 남은 여유 > 기준값 / 노랑 = 남은 여유 ≤ 기준값 / 빨강 = 기한 지남·미완료 또는 지연 완료
- 지연 흡수(C-01): 출시일 고정, 늦은 Task 뒤 ~ 「흡수 한도 Task」까지 번호 순으로 여유에서 흡수, 남으면 출시일 영향(영업일·날짜)과 지연 알림. 의사코드는 `backend/app/engine/absorb.py` 머리말
