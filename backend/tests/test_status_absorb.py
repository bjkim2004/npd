from datetime import date

from app.engine.absorb import absorb
from app.engine.backcalc import TaskDef, schedule
from app.engine.calendar import BusinessCalendar, HolidayNotRegistered
from app.engine.concurrent import overlaps
from app.engine.status import judge

import pytest

CAL = BusinessCalendar([date(2027, 3, 1)], registered_years=[2026, 2027])
LAUNCH = date(2027, 3, 26)


# ---- 4교시 신호등 ----
def test_late_actual_is_red():
    r = judge(date(2027, 3, 10), date(2027, 3, 15), date(2027, 3, 16), 3, CAL)
    assert r["signal"] == "빨강"


def test_on_time_is_green_and_overdue_red_and_near_yellow():
    assert judge(date(2027, 3, 10), date(2027, 3, 10), date(2027, 3, 20), 3, CAL)["signal"] == "초록"
    assert judge(date(2027, 3, 10), None, date(2027, 3, 11), 3, CAL)["signal"] == "빨강"
    assert judge(date(2027, 3, 10), None, date(2027, 3, 8), 3, CAL)["signal"] == "노랑"
    assert judge(date(2027, 3, 31), None, date(2027, 3, 8), 3, CAL)["signal"] == "초록"


def test_unregistered_year_blocks():
    with pytest.raises(HolidayNotRegistered):
        schedule(date(2028, 5, 1), [TaskDef(1, "a", 10, 5)], CAL)


# ---- 동시 진행 ----
def test_overlap_two_products():
    t = [TaskDef(1, "가", 10, 5)]
    a = schedule(LAUNCH, t, CAL)
    b = schedule(date(2027, 3, 29), t, CAL)
    res = overlaps([("제품A", a), ("제품B", b)])
    assert res and {e["product"] for e in res[0]["entries"]} == {"제품A", "제품B"}


# ---- 6교시 흡수 시험 3건 ----
# 직렬 Task: 1(30→25) · 2(22→18, 여유 3) · 3(15→10, 여유 3) · 4(8→2, 한도 밖)
TASKS = [TaskDef(1, "T1", 30, 5), TaskDef(2, "T2", 22, 4), TaskDef(3, "T3", 15, 5), TaskDef(4, "T4", 8, 6)]
S = schedule(LAUNCH, TASKS, CAL)


def test_absorb_zero_delay():
    r = absorb(S, 1, 0, 3, LAUNCH, CAL)
    assert r["absorbed"] == [] and r["remaining"] == 0 and r["alert"] is None


def test_absorb_within_slack():
    r = absorb(S, 1, 5, 3, LAUNCH, CAL)
    assert [(x["task_no"], x["absorbed"]) for x in r["absorbed"]] == [(2, 3), (3, 2)]
    assert r["remaining"] == 0 and r["launch_impact_days"] == 0
    assert r["impacted_launch"] == "2027-03-26" and r["alert"] is None


def test_absorb_over_slack_impacts_launch():
    r = absorb(S, 1, 8, 3, LAUNCH, CAL)
    assert sum(x["absorbed"] for x in r["absorbed"]) == 6
    assert r["remaining"] == 2 and r["launch_impact_days"] == 2
    assert r["impacted_launch"] == "2027-03-30"  # 금 + 2영업일 = 화
    assert r["alert"].startswith("지연 알림")
