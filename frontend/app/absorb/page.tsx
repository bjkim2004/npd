"use client";

import { useState } from "react";
import { useApp } from "@/components/AppContext";
import { Empty, Field, Metric, PageHeader, Panel } from "@/components/ui";
import { api, type AbsorbResult } from "@/lib/api";

export default function AbsorbPage() {
  const { sched, activeId, settings, run, setAbsorbAlert } = useApp();
  const [result, setResult] = useState<AbsorbResult | null>(null);
  const [no, setNo] = useState<number | null>(null);
  const [days, setDays] = useState(5);

  if (!sched || activeId == null) return <Empty title="일정을 불러오는 중입니다">제품이 없으면 「제품 관리」에서 먼저 추가하세요.</Empty>;
  const calc = sched.tasks.filter((t) => t.end);
  const taskNo = no != null && calc.some((t) => t.no === no) ? no : calc[0]?.no ?? 1;
  const limit = settings.absorb_limit_task?.value ?? "?";
  const shown = result && result.launch === sched.product.launch_date ? result : null;
  const total = shown ? shown.absorbed.reduce((a, x) => a + x.absorbed, 0) : 0;

  return (
    <>
      <PageHeader
        title="지연 흡수"
        desc={<>출시일은 고정합니다(C-01). 늦어진 Task 뒤에서 Task {limit}(시제품 수령 전 구간 끝)까지 각 Task의 여유로 차례대로 흡수하고, 모자라면 출시일이 얼마나 밀리는지 계산합니다.</>}
      />

      <Panel>
        <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => {
          e.preventDefault();
          const r = await run(() => api.absorb(activeId, taskNo, days));
          if (r) { setResult(r); setAbsorbAlert(r.alert); }
        }}>
          <Field label={`늦어진 Task (${sched.product.name})`}>
            <select value={taskNo} onChange={(e) => setNo(Number(e.target.value))} className="input min-w-64">
              {calc.map((t) => <option key={t.no} value={t.no}>{t.no}. {t.name}</option>)}
            </select>
          </Field>
          <Field label="늦어진 영업일">
            <input type="number" min={0} value={days} onChange={(e) => setDays(Number(e.target.value))} className="input num w-28" />
          </Field>
          <button className="btn">흡수 계산</button>
          {shown && <button type="button" className="btn-quiet h-9" onClick={() => { setResult(null); setAbsorbAlert(null); }}>결과 지우기</button>}
        </form>
      </Panel>

      {shown && (
        <Panel pad={false}>
          <div className="grid grid-cols-2 gap-6 border-b border-line p-6 md:grid-cols-4">
            <Metric label="지연" value={shown.delay} unit="영업일" />
            <Metric label="흡수" value={total} unit="영업일" tone={total ? "ok" : undefined} />
            <Metric label="남은 지연" value={shown.remaining} unit="영업일" tone={shown.remaining ? "bad" : undefined} />
            <Metric label="출시일 영향" tone={shown.launch_impact_days ? "bad" : "ok"}
                    value={shown.launch_impact_days ? shown.impacted_launch : "없음"}
                    unit={shown.launch_impact_days ? `+${shown.launch_impact_days}영업일` : shown.launch} />
          </div>

          {shown.delay > 0 && (
            <div className="border-b border-line px-6 py-4">
              <div className="mb-2 text-xs text-muted">지연 {shown.delay}영업일 처리</div>
              <div className="flex h-3 overflow-hidden rounded-full bg-sunken">
                <span className="h-full bg-ok" style={{ width: `${(total / shown.delay) * 100}%` }} />
                <span className="h-full bg-bad" style={{ width: `${(shown.remaining / shown.delay) * 100}%` }} />
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ok" />여유에서 흡수 {total}</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-bad" />출시일로 넘어감 {shown.remaining}</span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>순서</th><th>Task</th><th>여유</th><th>흡수량</th><th>여유 근거</th></tr></thead>
              <tbody>
                {shown.absorbed.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-muted">흡수한 Task가 없습니다.</td></tr>}
                {shown.absorbed.map((a, i) => (
                  <tr key={a.task_no}>
                    <td className="num text-faint">{i + 1}</td>
                    <td><span className="num mr-1.5 text-faint">{a.task_no}</span><span className="font-medium text-ink">{a.task_name}</span></td>
                    <td className="num">{a.slack}</td>
                    <td className={`num font-semibold ${a.absorbed ? "text-ok" : "text-faint"}`}>{a.absorbed}</td>
                    <td className="text-muted">{a.slack_source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-6 py-3 text-xs text-faint">가정(확인 필요): {shown.assumption}</p>
        </Panel>
      )}
    </>
  );
}
