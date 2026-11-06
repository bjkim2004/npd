"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Empty, PageHeader, Panel } from "@/components/ui";
import { api, type OverlapWeek } from "@/lib/api";

// 제품마다 구분되는 표식 색(신호등 색과 겹치지 않게)
const PRODUCT_TONE = ["bg-bar", "bg-today", "bg-[#a855f7]", "bg-[#ec4899]", "bg-[#64748b]"];

export default function ConcurrentPage() {
  const { products, selected, setSelected, baseVer, setError } = useApp();
  const [overlap, setOverlap] = useState<OverlapWeek[] | null>(null);

  useEffect(() => {
    if (selected.length < 2) return;
    let alive = true;
    api.concurrent(selected)
      .then((r) => alive && setOverlap(r))
      .catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [selected, baseVer, setError]);

  const enough = selected.length >= 2;
  const tone = (name: string) => PRODUCT_TONE[Math.max(0, products.findIndex((p) => p.name === name)) % PRODUCT_TONE.length];

  return (
    <>
      <PageHeader title="동시 진행" desc="고른 제품의 Task가 같은 주(월요일 시작)에 겹치는 경우를 모읍니다. 연구소 관능, 시생산 라인, 디자인처럼 자원이 겹치는 구간을 미리 찾는 데 씁니다." />

      <div className="flex flex-wrap gap-2" role="group" aria-label="비교할 제품">
        {products.map((p) => {
          const on = selected.includes(p.id);
          return (
            <button key={p.id} aria-pressed={on}
                    onClick={() => setSelected((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                    className={`flex h-9 items-center gap-2 rounded-full border px-4 text-[13px] transition-colors ${
                      on ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line bg-surface text-muted hover:border-line-strong hover:text-ink"}`}>
              <span className={`h-2 w-2 rounded-full ${tone(p.name)}`} />
              {p.name}
              <span className="num text-xs font-normal opacity-70">{p.launch_date}</span>
            </button>
          );
        })}
      </div>

      <Panel pad={false} title={<>겹치는 주 {enough && overlap ? <span className="num ml-1 font-normal text-muted">{overlap.length}주</span> : null}</>}>
        {!enough ? <Empty title="제품을 2개 이상 고르세요">위에서 비교할 제품을 누르면 바로 계산합니다.</Empty>
          : !overlap?.length ? <Empty title="겹치는 주가 없습니다" /> : (
          <div className="max-h-[62vh] overflow-auto">
            <table className="tbl">
              <thead className="sticky top-0 bg-surface"><tr><th className="w-32">주(월요일)</th><th>제품</th><th>Task</th><th>기간</th></tr></thead>
              <tbody>
                {overlap.flatMap((w) => w.entries.map((e, i) => (
                  <tr key={`${w.week_start}-${e.product}-${e.task_no}`} className={i === 0 ? "[&>td]:border-t [&>td]:border-t-line-strong" : ""}>
                    <td className="num font-medium text-ink">{i === 0 ? w.week_start : ""}</td>
                    <td><span className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${tone(e.product)}`} />{e.product}</span></td>
                    <td><span className="num mr-1.5 text-faint">{e.task_no}</span>{e.task_name}</td>
                    <td className="num text-muted">{e.start} ~ {e.end}</td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
