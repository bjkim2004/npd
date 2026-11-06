"""역산 엔진.

규칙(요구사항정의서 회신 v08 부록 B·C-02):
- 착수 역산일수 S: 출시일에서 영업일 S일 앞이 착수일.
- 완료 역산일수 = S − 소요일수: 출시일에서 그만큼 앞이 종료일.
- 마일스톤 판정 역산일수 = 완료 기준이면 완료 역산일수, 착수 기준(입점 제안)이면 S.
- D-주차 = 역산 영업일수 ÷ 5, 올림.
값이 비어 있는 Task는 계산하지 않고 「확인 필요」로 남긴다.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field, asdict
from datetime import date

from .calendar import BusinessCalendar

NEEDS_CHECK = "확인 필요"


@dataclass
class TaskDef:
    no: int
    name: str
    start_offset: int | None
    duration: int | None
    basis: str = "완료"  # 완료 | 착수
    phase: str | None = None
    predecessors: list[int] = field(default_factory=list)
    buffer_days: int | None = None
    note: str | None = None

    @property
    def complete(self) -> bool:
        return self.start_offset is not None and self.duration is not None

    @property
    def end_offset(self) -> int | None:
        return None if not self.complete else self.start_offset - self.duration

    @property
    def milestone_offset(self) -> int | None:
        if self.basis == "착수":
            return self.start_offset
        return self.end_offset


def d_week(offset: int) -> int:
    """C-02: 역산 영업일수 ÷ 5, 올림."""
    return math.ceil(offset / 5)


@dataclass
class ScheduledTask:
    no: int
    name: str
    phase: str | None
    basis: str
    start_offset: int | None
    duration: int | None
    end_offset: int | None
    milestone_offset: int | None
    start: date | None
    end: date | None
    d_week_start: int | None
    d_week_end: int | None
    predecessors: list[int]
    buffer_days: int | None
    status: str  # "계산됨" | "확인 필요"
    note: str | None

    def to_dict(self) -> dict:
        d = asdict(self)
        d["start"] = self.start.isoformat() if self.start else None
        d["end"] = self.end.isoformat() if self.end else None
        return d


def schedule(launch: date, tasks: list[TaskDef], cal: BusinessCalendar) -> list[ScheduledTask]:
    out: list[ScheduledTask] = []
    for t in sorted(tasks, key=lambda x: x.no):
        if t.complete:
            start = cal.sub(launch, t.start_offset)
            end = cal.sub(launch, t.end_offset)
            out.append(ScheduledTask(
                t.no, t.name, t.phase, t.basis, t.start_offset, t.duration, t.end_offset,
                t.milestone_offset, start, end, d_week(t.start_offset), d_week(t.end_offset),
                t.predecessors, t.buffer_days, "계산됨", t.note,
            ))
        else:
            out.append(ScheduledTask(
                t.no, t.name, t.phase, t.basis, t.start_offset, t.duration, None, None,
                None, None, None, None, t.predecessors, t.buffer_days, NEEDS_CHECK, t.note,
            ))
    return out
