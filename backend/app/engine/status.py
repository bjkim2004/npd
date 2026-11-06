"""신호등 판정(2교시 판정 기준표).

초록: 예정 종료일 안에 완료, 또는 (미완료이고) 남은 여유 > 기준값
노랑: 미완료이고 0 ≤ 남은 여유 ≤ 기준값
빨강: 예정 종료일이 지났는데 미완료, 또는 예정 종료일보다 늦게 완료(지연 완료)
남은 여유 = 기준일(as_of)부터 예정 종료일까지 영업일 수.
기준값은 설정 값이다(위젯 v07 값은 예시).
"""
from __future__ import annotations

from datetime import date

from .calendar import BusinessCalendar

GREEN, YELLOW, RED, NONE = "초록", "노랑", "빨강", "확인 필요"


def judge(planned_end: date | None, actual_end: date | None, as_of: date,
          threshold: int, cal: BusinessCalendar) -> dict:
    if planned_end is None:
        return {"signal": NONE, "slack": None, "reason": "예정 종료일 없음"}
    if actual_end is not None:
        late = cal.between(planned_end, actual_end)
        if actual_end <= planned_end:
            return {"signal": GREEN, "slack": None, "reason": "예정 종료일 안에 완료"}
        return {"signal": RED, "slack": -late, "reason": f"지연 완료 {late}영업일"}
    slack = cal.between(as_of, planned_end)
    if as_of > planned_end:
        return {"signal": RED, "slack": slack, "reason": "예정 종료일 지남, 미완료"}
    if slack <= threshold:
        return {"signal": YELLOW, "slack": slack, "reason": f"남은 여유 {slack} ≤ 기준값 {threshold}"}
    return {"signal": GREEN, "slack": slack, "reason": f"남은 여유 {slack} > 기준값 {threshold}"}
