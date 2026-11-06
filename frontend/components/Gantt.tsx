"use client";

import { useMemo } from "react";
import type { SchedTask } from "@/lib/api";
import { DAY, dWeekLabel, mondayOf, toIso, toMs } from "@/lib/dates";
import { SIGNAL_STYLE } from "@/components/ui";

const ROW_H = 36;
const HEAD_H = 56;
const PX = 7; // 하루 너비(px)
const COLS = [48, 200, 76, 92, 92, 140]; // No, Task, 신호등, 시작, 종료, 실적 완료일
const LEFT_W = COLS.reduce((a, b) => a + b, 0);
const HEADS = ["No", "Task", "신호등", "시작", "종료", "실적 완료일"];

type Row = { kind: "phase"; label: string; count: number } | { kind: "task"; t: SchedTask };

const HATCH = "repeating-linear-gradient(135deg, var(--bar) 0 3px, color-mix(in srgb, var(--bar) 45%, transparent) 3px 6px)";

export default function Gantt({ tasks, launch, holidays, asOf, onActual }: {
  tasks: SchedTask[];
  launch: string;
  holidays: Set<string>;
  asOf: string;
  onActual: (no: number, date: string | null) => void;
}) {
  const rows = useMemo<Row[]>(() => {
    const groups = new Map<string, SchedTask[]>();
    for (const t of tasks) {
      const k = t.phase ?? "단계 미지정";
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    const out: Row[] = [];
    for (const [label, ts] of groups) {
      out.push({ kind: "phase", label, count: ts.length });
      ts.forEach((t) => out.push({ kind: "task", t }));
    }
    return out;
  }, [tasks]);

  const dated = tasks.filter((t) => t.start && t.end);
  const first = dated.length ? dated.reduce((m, t) => (t.start! < m ? t.start! : m), launch) : launch;
  const t0 = toMs(mondayOf(first)) - 7 * DAY;
  const t1 = toMs(launch) + 14 * DAY;
  const width = Math.round((t1 - t0) / DAY) * PX;
  const x = (s: string) => ((toMs(s) - t0) / DAY) * PX;

  const weeks: string[] = [];
  for (let w = t0; w <= t1; w += 7 * DAY) weeks.push(toIso(w));
  const months: { label: string; x: number }[] = [];
  for (let d = t0; d <= t1; d += DAY) {
    const iso = toIso(d);
    if (iso.endsWith("-01")) months.push({ label: `${iso.slice(0, 4)}년 ${Number(iso.slice(5, 7))}월`, x: x(iso) });
  }

  const rowIndex = new Map<number, number>();
  rows.forEach((r, i) => r.kind === "task" && rowIndex.set(r.t.no, i));
  const byNo = new Map(tasks.map((t) => [t.no, t]));
  const links: string[] = [];
  for (const t of dated) {
    for (const p of t.predecessors) {
      const pt = byNo.get(p);
      if (!pt?.end || !rowIndex.has(p)) continue;
      const x1 = x(pt.end) + PX, y1 = rowIndex.get(p)! * ROW_H + ROW_H / 2;
      const x2 = x(t.start!), y2 = rowIndex.get(t.no)! * ROW_H + ROW_H / 2;
      links.push(`M${x1},${y1} H${x1 + 6} V${y2} H${x2}`);
    }
  }
  const bodyH = rows.length * ROW_H;
  const launchX = x(launch) + PX;
  const todayIn = toMs(asOf) >= t0 && toMs(asOf) <= t1;

  return (
    <div className="panel overflow-hidden">
      <div className="max-h-[68vh] overflow-auto">
        <div className="relative" style={{ width: LEFT_W + width }}>
          {/* 머리글 */}
          <div className="sticky top-0 z-30 flex border-b border-line bg-surface" style={{ height: HEAD_H }}>
            <div className="sticky left-0 z-40 flex border-r border-line bg-surface">
              {HEADS.map((h, i) => (
                <div key={h} style={{ width: COLS[i] }} className="flex items-end px-3 pb-2 text-xs font-medium text-muted">{h}</div>
              ))}
            </div>
            <div className="relative" style={{ width }}>
              {months.map((m) => (
                <div key={m.label} className="absolute top-2 whitespace-nowrap border-l border-line-strong pl-1.5 text-xs font-medium text-ink" style={{ left: m.x }}>
                  {m.label}
                </div>
              ))}
              {weeks.map((w) => (
                <div key={w} className="num absolute bottom-0 h-6 pl-1 text-[10.5px] leading-6 text-faint" style={{ left: x(w), width: 7 * PX }} title={`${w} 주`}>
                  {dWeekLabel(w, launch, holidays)}
                </div>
              ))}
              <div className="absolute bottom-0 z-10 -translate-x-1/2 translate-y-1/2 rounded-full bg-bad px-2 py-0.5 text-[10.5px] font-semibold text-white dark:text-bg"
                   style={{ left: launchX }}>
                출시 {launch.slice(5).replace("-", "/")}
              </div>
            </div>
          </div>

          {/* 본문 */}
          <div className="relative">
            {rows.map((r) =>
              r.kind === "phase" ? (
                <div key={`p-${r.label}`} className="flex bg-sunken" style={{ height: ROW_H }}>
                  <div className="sticky left-0 z-20 flex items-center gap-2 border-r border-line bg-sunken px-3 text-xs font-semibold text-ink" style={{ width: LEFT_W }}>
                    {r.label}<span className="num font-normal text-faint">{r.count}개</span>
                  </div>
                  <div style={{ width }} />
                </div>
              ) : (
                <TaskRow key={r.t.no} t={r.t} width={width} x={x} onActual={onActual} />
              ),
            )}

            <svg className="pointer-events-none absolute top-0 z-10" style={{ left: LEFT_W }} width={width} height={bodyH}>
              <defs>
                <marker id="arr" viewBox="0 0 6 6" refX="6" refY="3" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L6,3 L0,6 z" fill="var(--muted)" />
                </marker>
              </defs>
              {links.map((d, i) => <path key={i} d={d} fill="none" stroke="var(--muted)" strokeWidth={1.2} markerEnd="url(#arr)" />)}
              {todayIn && <line x1={x(asOf)} x2={x(asOf)} y1={0} y2={bodyH} stroke="var(--today)" strokeWidth={1.5} strokeDasharray="3 4" />}
              <line x1={launchX} x2={launchX} y1={0} y2={bodyH} stroke="var(--bad)" strokeWidth={2} />
            </svg>
          </div>
        </div>
      </div>
      <Legend />
    </div>
  );
}

function TaskRow({ t, width, x, onActual }: {
  t: SchedTask; width: number; x: (s: string) => number; onActual: (no: number, d: string | null) => void;
}) {
  const unknown = t.status === "확인 필요";
  const red = t.signal === "빨강";
  return (
    <div className="group flex border-b border-line/60" style={{ height: ROW_H }} data-task={t.no}>
      <div className="sticky left-0 z-20 flex items-center border-r border-line bg-surface text-[13px] transition-colors group-hover:bg-sunken">
        <div style={{ width: COLS[0] }} className="num px-3 text-faint">{t.no}</div>
        <div style={{ width: COLS[1] }} className={`flex items-center gap-1.5 truncate px-3 ${unknown ? "text-faint" : "font-medium text-ink"}`} title={t.note ?? t.name}>
          <span className="truncate">{t.name}</span>
          {t.basis === "착수" && <span className="shrink-0 rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold leading-4 text-accent">착수</span>}
        </div>
        <div style={{ width: COLS[2] }} className="flex items-center gap-1.5 px-3 text-xs" title={t.reason} data-signal={t.signal}>
          <span className={`h-2.5 w-2.5 rounded-full ${SIGNAL_STYLE[t.signal]}`} />
          <span className={unknown ? "text-faint" : "text-ink"}>{unknown ? "–" : t.signal}</span>
        </div>
        <div style={{ width: COLS[3] }} className={`num px-3 text-xs ${unknown ? "text-faint" : "text-ink"}`}>{t.start ?? "확인 필요"}</div>
        <div style={{ width: COLS[4] }} className={`num px-3 text-xs ${unknown ? "text-faint" : "text-ink"}`}>{t.end ?? "확인 필요"}</div>
        <div style={{ width: COLS[5] }} className="px-2">
          {t.end && (
            <input type="date" value={t.actual_end ?? ""} aria-label={`Task ${t.no} 실적 완료일`}
                   onChange={(e) => onActual(t.no, e.target.value || null)}
                   className={`num h-7 w-full rounded-md border bg-transparent px-1.5 text-xs transition-colors focus:border-accent focus:outline-none ${
                     t.actual_end ? (red ? "border-bad/50 text-bad" : "border-line text-ink") : "border-transparent text-faint hover:border-line"}`} />
          )}
        </div>
      </div>
      <div className="relative transition-colors group-hover:bg-sunken/50"
           style={{ width, backgroundImage: `repeating-linear-gradient(to right, var(--line) 0 1px, transparent 1px ${7 * PX}px)`, backgroundPositionX: `${7 * PX}px` }}>
        {t.start && t.end && (
          <div className={`absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full ${red ? "bg-bad" : t.basis === "착수" ? "" : "bg-bar"}`}
               style={{ left: x(t.start), width: Math.max(x(t.end) - x(t.start) + PX, 6), ...(t.basis === "착수" && !red ? { backgroundImage: HATCH } : {}) }}
               title={`Task ${t.no} ${t.name}\n${t.start} ~ ${t.end}\nD-${t.d_week_start}주 ~ D-${t.d_week_end}주`}
               data-start={t.start} data-end={t.end} />
        )}
        {t.actual_end && t.start && (
          <div className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 border-surface bg-ink"
               style={{ left: x(t.actual_end) + PX / 2 }} title={`실적 완료 ${t.actual_end}`} />
        )}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-line px-5 py-3 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-full bg-bar" />완료 기준 Task</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-full" style={{ backgroundImage: HATCH }} />착수 기준 Task</span>
      <span className="flex items-center gap-1.5"><span className="h-2.5 w-6 rounded-full bg-bad" />빨강(지연)</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rotate-45 rounded-[1px] bg-ink" />실적 완료일</span>
      <span className="flex items-center gap-1.5"><span className="h-3.5 w-0.5 bg-bad" />출시일</span>
      <span className="flex items-center gap-1.5"><span className="h-3.5 w-0 border-l-[1.5px] border-dashed border-today" />기준일</span>
      <span className="ml-auto text-faint">실적 완료일이 비어 있으면 미완료로 봅니다.</span>
    </div>
  );
}
