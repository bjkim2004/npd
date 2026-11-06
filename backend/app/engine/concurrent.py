"""동시 진행: 제품 2개 이상에서 같은 주(월요일 시작)에 겹치는 Task 목록."""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from .backcalc import ScheduledTask


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def overlaps(products: list[tuple[str, list[ScheduledTask]]]) -> list[dict]:
    weeks: dict[date, list[dict]] = defaultdict(list)
    for pname, tasks in products:
        for t in tasks:
            if t.start is None or t.end is None:
                continue
            w = _monday(t.start)
            while w <= t.end:
                weeks[w].append({"product": pname, "task_no": t.no, "task_name": t.name,
                                 "start": t.start.isoformat(), "end": t.end.isoformat()})
                w += timedelta(days=7)
    out = []
    for w in sorted(weeks):
        entries = weeks[w]
        if len({e["product"] for e in entries}) >= 2:
            out.append({"week_start": w.isoformat(), "entries": entries})
    return out
