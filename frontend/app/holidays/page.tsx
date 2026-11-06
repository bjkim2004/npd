"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Metric, PageHeader, Panel } from "@/components/ui";
import { api, type Holiday } from "@/lib/api";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

export default function HolidaysPage() {
  const { baseVer, setError } = useApp();
  const [rows, setRows] = useState<Holiday[]>([]);

  useEffect(() => {
    let alive = true;
    api.holidays().then((r) => alive && setRows(r)).catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [baseVer, setError]);

  const byYear = useMemo(() => {
    const m = new Map<string, Holiday[]>();
    rows.forEach((h) => m.set(h.date.slice(0, 4), [...(m.get(h.date.slice(0, 4)) ?? []), h]));
    return [...m.entries()];
  }, [rows]);
  const leave = rows.filter((r) => r.kind === "공동연차").length;

  return (
    <>
      <PageHeader title="공휴일" desc="영업일을 셀 때 빼는 날입니다. 여기에 없는 연도에 출시하는 제품은 만들 수 없습니다(C-05)." />

      <Panel>
        <div className="grid grid-cols-3 gap-6">
          <Metric label="등록" value={rows.length} unit="건" />
          <Metric label="등록 연도" value={byYear.map(([y]) => y).join(", ") || "–"} />
          <Metric label="공동연차" value={leave} unit="건 · 확인 필요" tone="warn" />
        </div>
        <p className="mt-4 text-xs text-faint">엑셀 역산 계산기는 29건(마지막 2027-12-27)입니다. 이 목록과 1건 차이가 있어 대조가 필요합니다.</p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        {byYear.map(([y, hs]) => (
          <Panel key={y} pad={false} title={<>{y}년 <span className="num ml-1 font-normal text-muted">{hs.length}건</span></>}>
            <table className="tbl">
              <thead><tr><th>날짜</th><th>요일</th><th>이름</th><th>구분</th></tr></thead>
              <tbody>
                {hs.map((h) => (
                  <tr key={h.date}>
                    <td className="num font-medium text-ink">{h.date.slice(5).replace("-", "/")}</td>
                    <td className="text-muted">{WD[new Date(`${h.date}T00:00:00Z`).getUTCDay()]}</td>
                    <td>{h.name}</td>
                    <td className="text-muted">{h.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
      </div>
    </>
  );
}
