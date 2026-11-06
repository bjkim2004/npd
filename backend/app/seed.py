"""CSV → DB. 비어 있을 때만 넣는다(기준 데이터는 덮어쓰지 않음)."""
from __future__ import annotations

import csv
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Holiday, Product, Setting, Task

DATA = Path(__file__).resolve().parent.parent / "data"

DEFAULT_SETTINGS = {
    "yellow_threshold": ("3", "노랑 기준값(영업일). 예시 값 — 훈련에서 정함"),
    "absorb_limit_task": ("17", "흡수 한도 Task 번호(시제품 수령 전 구간 끝). 예시 값 — 확인 필요"),
}


def _int(v: str) -> int | None:
    v = (v or "").strip()
    return int(v) if v else None


def parse_task_rows(rows: list[dict]) -> list[Task]:
    out = []
    for r in rows:
        out.append(Task(
            no=int(r["no"]), name=r["name"].strip(), phase=(r.get("phase") or "").strip() or None,
            start_offset=_int(r.get("start_offset", "")), duration=_int(r.get("duration", "")),
            basis=(r.get("basis") or "완료").strip() or "완료",
            predecessors=(r.get("predecessors") or "").strip() or None,
            buffer_days=_int(r.get("buffer_days", "")), note=(r.get("note") or "").strip() or None,
        ))
    return out


def seed(db: Session) -> None:
    if db.scalar(select(Task).limit(1)) is None:
        with open(DATA / "tasks_seed.csv", encoding="utf-8") as f:
            db.add_all(parse_task_rows(list(csv.DictReader(f))))
    if db.scalar(select(Holiday).limit(1)) is None:
        with open(DATA / "holidays.csv", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                db.add(Holiday(date=date.fromisoformat(r["date"]), name=r["name"],
                               kind=r["kind"] or "공휴일", note=r.get("note") or None))
    for k, (v, note) in DEFAULT_SETTINGS.items():
        if db.get(Setting, k) is None:
            db.add(Setting(key=k, value=v, note=note))
    if db.scalar(select(Product).limit(1)) is None:
        db.add_all([
            Product(name="제품A", launch_date=date(2027, 3, 26), product_type="NEW", process="표준"),
            Product(name="제품B", launch_date=date(2027, 4, 23), product_type="NEW", process="표준"),
        ])
    db.commit()
