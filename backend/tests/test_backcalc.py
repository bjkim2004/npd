"""1교시: 역산 엔진 ↔ 엑셀 일치 시험.  실행: python -m pytest tests -v"""
from datetime import date

import pytest

from app.engine.backcalc import d_week, schedule
from app.tools.compare import compare, format_report, load_calendar, load_expected, load_tasks

# 회신 v08 부록 B: 기준일정 마일스톤 역산일수 (NEW|표준)
APPENDIX_B = {2: 154, 4: 148, 11: 78, 3: 153, 31: 6, 25: 36, 5: 128, 26: 16, 27: 16,
              13: 75, 18: 55, 10: 93, 23: 44, 17: 83, 30: 11, 33: 1}


def test_task_count_is_39():
    assert len(load_tasks()) == 39


def test_appendix_b_milestone_offsets():
    tasks = {t.no: t for t in load_tasks()}
    bad = {n: (tasks[n].milestone_offset, v) for n, v in APPENDIX_B.items() if tasks[n].milestone_offset != v}
    assert bad == {}, f"부록 B와 어긋남(Task: (엔진, 문서)): {bad}"


def test_dweek_rounds_up():
    assert [d_week(x) for x in (0, 1, 5, 6, 159)] == [0, 1, 1, 2, 32]


def test_hand_checked_dates_launch_20270326():
    """손 계산: 출시 2027-03-26(금), 3월 공휴일은 3/1뿐."""
    s = {t.no: t for t in schedule(date(2027, 3, 26), load_tasks(), load_calendar())}
    assert (s[33].start, s[33].end) == (date(2027, 3, 18), date(2027, 3, 25))
    assert (s[31].start, s[31].end) == (date(2027, 3, 9), date(2027, 3, 18))


def test_holidays_are_skipped():
    cal = load_calendar()
    # 2026-10-09(금, 한글날) 다음 영업일은 10-12(월); 10-05(월)는 대체공휴일
    assert cal.add(date(2026, 10, 8), 1) == date(2026, 10, 12)
    assert cal.sub(date(2026, 10, 6), 1) == date(2026, 10, 2)


def test_engine_matches_excel():
    exp = load_expected()
    if not exp:
        pytest.skip("확인 필요: data/excel_expected.csv에 엑셀(NB Scheduling) 값을 옮겨 넣어야 비교할 수 있음")
    rep = compare(exp, load_tasks(), load_calendar())
    print("\n" + format_report(rep))
    assert rep["mismatch"] == 0, format_report(rep)
