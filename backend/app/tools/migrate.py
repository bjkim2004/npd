"""로컬 SQLite(local.db)의 데이터를 .env에 설정한 Postgres(Supabase)로 옮긴다.

    python -m app.tools.migrate              # 대상이 비어 있거나 기본 데이터만 있으면 옮김
    python -m app.tools.migrate --overwrite  # 대상 npd_* 테이블에 데이터가 있어도 지우고 옮김

- 원본: SQLITE_PATH 또는 backend/local.db
- 대상: backend/.env 의 DB_HOST·DB_USER·DB_PASSWORD 등 (npd_* 테이블만 다룸)
- 옮긴 뒤 자동 증가 번호(id)를 원본 최댓값 다음으로 맞춘다.
"""
from __future__ import annotations

import os
import sys

from sqlalchemy import create_engine, func, select, text

from .. import auth, notify  # noqa: F401  (User·AlertLog 테이블 등록)
from .. import models  # noqa: F401
from ..db import BASE_DIR, Base, _pg_url

# 외래 키 순서
ORDER = ["npd_tasks", "npd_holidays", "npd_settings", "npd_products", "npd_actuals", "npd_users", "npd_alert_log"]


def main() -> int:
    overwrite = "--overwrite" in sys.argv
    url = _pg_url()
    if url is None:
        print("대상 없음: backend/.env 에 DB_HOST 등을 넣으세요")
        return 1
    src = create_engine(f"sqlite:///{os.getenv('SQLITE_PATH', str(BASE_DIR / 'local.db'))}")
    dst = create_engine(url, connect_args={"connect_timeout": 10})
    print(f"원본: {src.url}\n대상: {url.render_as_string(hide_password=True)}")

    Base.metadata.create_all(dst)
    tables = [Base.metadata.tables[n] for n in ORDER]

    with src.connect() as s, dst.begin() as d:
        src_n = {t.name: s.scalar(select(func.count()).select_from(t)) for t in tables}
        dst_n = {t.name: d.scalar(select(func.count()).select_from(t)) for t in tables}
        print("\n테이블            원본  대상(지금)")
        for t in tables:
            print(f"{t.name:16} {src_n[t.name]:5} {dst_n[t.name]:5}")

        # 서버를 먼저 켜서 들어간 기본 데이터(seed)만 있으면 덮어써도 됨. 사용자·실적이 있으면 --overwrite 필요
        if (dst_n["npd_users"] or dst_n["npd_actuals"]) and not overwrite:
            print("\n대상에 이미 사용자·실적 데이터가 있습니다. 지우고 옮기려면 --overwrite 를 붙이세요.")
            return 2

        for t in reversed(tables):
            d.execute(t.delete())
        for t in tables:
            rows = [dict(r._mapping) for r in s.execute(select(t))]
            if rows:
                d.execute(t.insert(), rows)
        # id 시퀀스 맞추기
        for name in ["npd_products", "npd_actuals", "npd_users"]:
            d.execute(text(f"select setval(pg_get_serial_sequence('{name}', 'id'), "
                           f"coalesce((select max(id) from {name}), 0) + 1, false)"))
        got = {t.name: d.scalar(select(func.count()).select_from(t)) for t in tables}

    bad = [n for n in ORDER if got[n] != src_n[n]]
    print("\n옮긴 뒤 대상:", ", ".join(f"{n}={got[n]}" for n in ORDER))
    print("완료" if not bad else f"불일치: {bad}")
    return 0 if not bad else 3


if __name__ == "__main__":
    raise SystemExit(main())
