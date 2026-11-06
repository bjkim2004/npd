"""영업일 달력. 토·일, 공휴일, 공동연차를 뺀다."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable


class HolidayNotRegistered(ValueError):
    """공휴일이 등록되지 않은 연도에 날짜를 계산하려 할 때(C-05)."""


class BusinessCalendar:
    def __init__(self, holidays: Iterable[date], registered_years: Iterable[int] | None = None):
        self.holidays = set(holidays)
        years = set(registered_years) if registered_years is not None else {d.year for d in self.holidays}
        self.registered_years = years

    def is_business_day(self, d: date) -> bool:
        return d.weekday() < 5 and d not in self.holidays

    def _check_year(self, d: date) -> None:
        if d.year not in self.registered_years:
            raise HolidayNotRegistered(
                f"{d.year}년 공휴일이 등록되지 않았습니다. 등록 연도: {sorted(self.registered_years)}"
            )

    def shift(self, base: date, n: int) -> date:
        """base에서 영업일 n일 이동. n<0이면 과거로. n=0이면 base 그대로."""
        self._check_year(base)
        step = 1 if n > 0 else -1
        d, left = base, abs(n)
        while left > 0:
            d += timedelta(days=step)
            self._check_year(d)
            if self.is_business_day(d):
                left -= 1
        return d

    def sub(self, base: date, n: int) -> date:
        return self.shift(base, -n)

    def add(self, base: date, n: int) -> date:
        return self.shift(base, n)

    def between(self, a: date, b: date) -> int:
        """a에서 b까지 영업일 수(a 제외, b 포함). b<a면 음수."""
        if a == b:
            return 0
        sign = 1 if b > a else -1
        lo, hi = (a, b) if b > a else (b, a)
        cnt, d = 0, lo
        while d < hi:
            d += timedelta(days=1)
            if self.is_business_day(d):
                cnt += 1
        return sign * cnt
