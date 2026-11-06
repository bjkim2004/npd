"""지연 흡수(5교시 규칙 C-01, 출시일 고정).

의사코드
--------
absorb(늦은 Task k, 지연 d영업일):
    d ≤ 0 이면 → 흡수 없음, 영향 0
    구간 = k보다 번호가 뒤이고 「흡수 한도 Task(시제품 수령)」 번호 이하인 Task
            (값이 확인된 Task만, 번호 순)
    남은 지연 = d
    구간의 Task t마다 차례로:
        여유(t) = t.buffer_days 가 있으면 그 값
                  아니면 max(0, 선행 종료 역산일수 − t 착수 역산일수)
                  선행 = t.predecessors 가 있으면 그중 가장 늦게 끝나는 Task,
                         없으면 구간에서 바로 앞 Task(첫 Task는 k)
        흡수 = min(남은 지연, 여유(t));  남은 지연 −= 흡수
        남은 지연 = 0 이면 멈춤
    출시일은 바꾸지 않는다.
    남은 지연 > 0 이면 → 출시일 영향 = 남은 지연 영업일, 영향 날짜 = 출시일 + 남은 지연(영업일)
                        → 「지연 알림」
주의: Task 간 선후관계(정비기록 v5 §2.2 15개 규칙)가 입력되기 전에는 「번호 순 직렬」로 가정한다(확인 필요).
"""
from __future__ import annotations

from datetime import date

from .backcalc import ScheduledTask
from .calendar import BusinessCalendar


def absorb(tasks: list[ScheduledTask], delayed_no: int, delay: int, limit_no: int,
           launch: date, cal: BusinessCalendar) -> dict:
    by_no = {t.no: t for t in tasks}
    if delayed_no not in by_no:
        raise ValueError(f"Task {delayed_no} 없음")
    k = by_no[delayed_no]
    if k.end_offset is None:
        raise ValueError(f"Task {delayed_no} 값이 「확인 필요」라 계산할 수 없습니다")

    result = {"delayed_task": delayed_no, "delay": delay, "limit_task": limit_no,
              "absorbed": [], "remaining": 0, "launch": launch.isoformat(),
              "launch_impact_days": 0, "impacted_launch": launch.isoformat(), "alert": None,
              "assumption": "선후관계 미입력 Task는 번호 순 직렬로 가정"}
    if delay <= 0:
        return result

    window = [t for t in tasks if delayed_no < t.no <= limit_no and t.end_offset is not None]
    window.sort(key=lambda t: t.no)
    remaining = delay
    prev = k
    for t in window:
        if t.buffer_days is not None:
            slack, src = t.buffer_days, "입력 여유"
        else:
            preds = [by_no[p] for p in t.predecessors if p in by_no and by_no[p].end_offset is not None]
            ref = min(preds, key=lambda p: p.end_offset) if preds else prev
            slack, src = max(0, ref.end_offset - t.start_offset), f"Task {ref.no} 종료와의 간격"
        take = min(remaining, slack)
        remaining -= take
        result["absorbed"].append({"task_no": t.no, "task_name": t.name, "slack": slack,
                                   "absorbed": take, "slack_source": src})
        prev = t
        if remaining == 0:
            break

    result["remaining"] = remaining
    if remaining > 0:
        impacted = cal.add(launch, remaining)
        result["launch_impact_days"] = remaining
        result["impacted_launch"] = impacted.isoformat()
        result["alert"] = (f"지연 알림: Task {delayed_no} {k.name} {delay}영업일 지연 중 "
                           f"{remaining}영업일을 흡수하지 못해 출시일이 {impacted.isoformat()}로 밀릴 수 있습니다.")
    return result
