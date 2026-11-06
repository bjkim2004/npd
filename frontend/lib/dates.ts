// 날짜는 모두 "YYYY-MM-DD" 문자열, UTC 자정 기준으로 다룬다(시간대 영향 없음).
export const DAY = 86_400_000;

export const toMs = (s: string) => Date.parse(`${s}T00:00:00Z`);
export const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function mondayOf(s: string): string {
  const ms = toMs(s);
  const wd = (new Date(ms).getUTCDay() + 6) % 7; // 월=0
  return toIso(ms - wd * DAY);
}

/** a(제외) ~ b(포함) 영업일 수. 백엔드 BusinessCalendar.between 과 같은 규칙. */
export function bizBetween(a: string, b: string, holidays: Set<string>): number {
  if (a === b) return 0;
  const sign = b > a ? 1 : -1;
  let lo = toMs(a < b ? a : b);
  const hi = toMs(a < b ? b : a);
  let n = 0;
  while (lo < hi) {
    lo += DAY;
    const wd = new Date(lo).getUTCDay();
    if (wd !== 0 && wd !== 6 && !holidays.has(toIso(lo))) n++;
  }
  return sign * n;
}

/** C-02: 출시일까지 남은 영업일 ÷ 5 올림 → D-n주 */
export function dWeekLabel(s: string, launch: string, holidays: Set<string>): string {
  const n = bizBetween(s, launch, holidays);
  if (n < 0) return `D+${Math.ceil(-n / 5)}주`;
  return `D-${Math.ceil(n / 5)}주`;
}
