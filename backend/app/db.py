"""DB 연결. Supabase(Postgres)에 붙고, 실패하면 로컬 SQLite로 대체한다(/api/health에 표시)."""
from __future__ import annotations

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")
log = logging.getLogger("npd.db")


class Base(DeclarativeBase):
    pass


def _pg_url() -> URL | None:
    if not os.getenv("DB_HOST"):
        return None
    return URL.create(
        "postgresql+psycopg",
        username=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        host=os.environ["DB_HOST"],
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_NAME", "postgres"),
    )


def _make_engine():
    if os.getenv("DB_FORCE_SQLITE") != "1":
        url = _pg_url()
        if url is not None:
            try:
                eng = create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 10})
                with eng.connect() as c:
                    c.execute(text("select 1"))
                return eng, "postgres"
            except Exception as e:  # noqa: BLE001
                log.warning("Postgres 연결 실패, SQLite로 대체: %s", str(e).splitlines()[0])
    path = os.getenv("SQLITE_PATH", str(BASE_DIR / "local.db"))
    return create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False}), "sqlite"


engine, DB_KIND = _make_engine()
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
