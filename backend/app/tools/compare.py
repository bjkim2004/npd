"""엔진 값 ↔ 엑셀(NB Scheduling) 값 비교. 한 명령: python -m app.tools.compare"""
from __future__ import annotations

import csv
import sys
from datetime import date
from pathlib import Path

from ..engine.backcalc import TaskDef, schedule
from ..engine.calendar import BusinessCalendar

DATA = Path(__file__).resolve().parents[2] / "data"


def load_tasks(path: Path = DATA / "tasks_seed.csv") -> list[TaskDef]:
    out = []
    with open(path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            i = lambda k: int(r[k]) if (r.get(k) or "").strip() else None  # noqa: E731
            preds = [int(x) for x in (r.get("predecessors") or "").split(",") if x.strip()]
            out.append(TaskDef(int(r["no"]), r["name"], i("start_offset"), i("duration"),
                               r.get("basis") or "완료", r.get("phase") or None, preds, i("buffer_days")))
    return out


def load_calendar(path: Path = DATA / "holidays.csv") -> BusinessCalendar:
    with open(path, encoding="utf-8-sig") as f:
        return BusinessCalendar([date.fromisoformat(r["date"]) for r in csv.DictReader(f)])


def load_expected(path: Path = DATA / "excel_expected.csv") -> list[dict]:
    with open(path, encoding="utf-8-sig") as f:
        return [r for r in csv.DictReader(f) if (r.get("task_no") or "").strip()]


def compare(expected: list[dict], tasks: list[TaskDef], cal: BusinessCalendar) -> dict:
    cache: dict[date, dict] = {}
    match, rows = 0, []
    for e in expected:
        launch = date.fromisoformat(e["launch_date"])
        if launch not in cache:
            cache[launch] = {t.no: t for t in schedule(launch, tasks, cal)}
        t = cache[launch].get(int(e["task_no"]))
        eng_s = t.start.isoformat() if t and t.start else "확인 필요"
        eng_e = t.end.isoformat() if t and t.end else "확인 필요"
        if eng_s == e["excel_start"] and eng_e == e["excel_end"]:
            match += 1
        else:
            rows.append({"task_no": e["task_no"], "task_name": e["task_name"],
                         "excel_start": e["excel_start"], "excel_end": e["excel_end"],
                         "engine_start": eng_s, "engine_end": eng_e})
    return {"match": match, "mismatch": len(rows), "rows": rows}


def format_report(r: dict) -> str:
    lines = [f"일치 {r['match']}건 / 어긋남 {r['mismatch']}건"]
    if r["rows"]:
        lines.append("| No | Task | 엑셀 시작 | 엑셀 종료 | 엔진 시작 | 엔진 종료 |")
        lines.append("|---|---|---|---|---|---|")
        for x in r["rows"]:
            lines.append(f"| {x['task_no']} | {x['task_name']} | {x['excel_start']} | {x['excel_end']} "
                         f"| {x['engine_start']} | {x['engine_end']} |")
    return "\n".join(lines)


if __name__ == "__main__":
    exp = load_expected()
    if not exp:
        print("확인 필요: data/excel_expected.csv 에 엑셀 Task별 시작일·종료일이 없습니다.")
        sys.exit(2)
    rep = compare(exp, load_tasks(), load_calendar())
    print(format_report(rep))
    sys.exit(0 if rep["mismatch"] == 0 else 1)
