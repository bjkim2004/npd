"use client";

import { useState } from "react";
import Gantt from "@/components/Gantt";
import { useApp } from "@/components/AppContext";
import { useCountdown } from "@/components/AppShell";
import { Empty, SignalBar, countSignals } from "@/components/ui";
import { api } from "@/lib/api";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

export default function GanttPage() {
  const { sched, holidays, asOf, activeId, run, reloadSched } = useApp();
  const cd = useCountdown();
  const [hideUnknown, setHideUnknown] = useState(false);

  const onActual = async (no: number, d: string | null) => {
    if (activeId == null) return;
    await run(() => api.putActual(activeId, no, d));
    reloadSched();
  };

  if (!sched || !cd) return <Empty title="일정을 불러오는 중입니다">제품이 없으면 「제품 관리」에서 먼저 추가하세요.</Empty>;
  const p = sched.product;
  const counts = countSignals(sched.tasks);
  const calc = sched.tasks.filter((t) => t.end);
  const done = calc.filter((t) => t.actual_end).length;
  const shown = hideUnknown ? sched.tasks.filter((t) => t.status !== "확인 필요") : sched.tasks;
  const wd = WD[new Date(`${p.launch_date}T00:00:00Z`).getUTCDay()];

  return (
    <>
      {/* 출시 카운트다운 */}
      <section className="panel grid gap-6 overflow-hidden p-6 lg:grid-cols-[auto_1fr_minmax(280px,360px)] lg:items-center lg:gap-10 lg:p-7">
        <div>
          <div className="text-[13px] font-medium text-muted">{p.name} 출시까지</div>
          <div className={`num mt-1 flex items-baseline font-semibold leading-none tracking-[-0.045em] ${cd.days < 0 ? "text-bad" : "text-ink"}`}>
            <span className="text-[64px] lg:text-[76px]">{cd.days >= 0 ? `D-${cd.weeks}` : `D+${-cd.weeks}`}</span>
            <span className="ml-1.5 text-2xl font-medium tracking-normal text-muted">주</span>
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-6 lg:border-l lg:border-line lg:pl-10">
          <div>
            <dt className="text-xs text-muted">출시일</dt>
            <dd className="num mt-1 text-lg font-semibold text-ink">{p.launch_date} <span className="text-sm font-normal text-muted">({wd})</span></dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{cd.days >= 0 ? "남은 영업일" : "지난 영업일"}</dt>
            <dd className="num mt-1 text-lg font-semibold text-ink">{Math.abs(cd.days)}<span className="ml-0.5 text-sm font-normal text-muted">일</span></dd>
          </div>
          <div>
            <dt className="text-xs text-muted">실적 완료</dt>
            <dd className="num mt-1 text-lg font-semibold text-ink">{done}<span className="text-sm font-normal text-muted"> / {calc.length} Task</span></dd>
          </div>
        </dl>

        <div>
          <div className="mb-2.5 flex items-baseline justify-between">
            <span className="text-xs text-muted">신호등 분포</span>
            <span className="num text-xs text-faint">기준일 {asOf}</span>
          </div>
          <SignalBar counts={counts} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Task {sched.tasks.length}개 타임라인</h2>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={hideUnknown} onChange={(e) => setHideUnknown(e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
          값이 없는 Task 숨기기
        </label>
      </div>
      <Gantt tasks={shown} launch={p.launch_date} holidays={holidays} asOf={asOf} onActual={onActual} />
    </>
  );
}
