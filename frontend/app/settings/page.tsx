"use client";

import { useState } from "react";
import { useApp } from "@/components/AppContext";
import { ThemeSwitch } from "@/components/Sidebar";
import { PageHeader, Panel } from "@/components/ui";
import { api } from "@/lib/api";

const LABELS: Record<string, { label: string; help: string; unit: string }> = {
  yellow_threshold: { label: "노랑 기준값", help: "미완료 Task의 남은 여유가 이 값 이하이면 노랑입니다.", unit: "영업일" },
  absorb_limit_task: { label: "흡수 한도 Task", help: "지연을 흡수하는 구간의 마지막 Task(시제품 수령 전 구간 끝)입니다.", unit: "번" },
};

export default function SettingsPage() {
  const { settings } = useApp();
  return (
    <>
      <PageHeader title="판정·흡수 설정" desc="신호등 기준값과 흡수 한도는 예시 값이며 훈련에서 정합니다. 사내 위젯(v07) 값은 대조용으로만 씁니다." />

      <Panel pad={false} title="판정 기준">
        <div className="divide-y divide-line">
          {Object.keys(LABELS).map((k) => (
            <SettingRow key={k} k={k} cur={settings[k]?.value ?? ""} note={settings[k]?.note ?? ""} />
          ))}
        </div>
      </Panel>

      <Panel title="화면">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-ink">테마</div>
            <div className="text-xs text-muted">시스템을 고르면 운영체제의 밝게·어둡게 설정을 따릅니다.</div>
          </div>
          <div className="w-64"><ThemeSwitch /></div>
        </div>
      </Panel>
    </>
  );
}

function SettingRow({ k, cur, note }: { k: string; cur: string; note: string }) {
  const { run, reloadBase } = useApp();
  const [draft, setDraft] = useState<string | null>(null);
  const v = draft ?? cur;
  const L = LABELS[k];
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{L.label}</div>
        <div className="text-xs text-muted">{L.help}</div>
        {note && <div className="mt-0.5 text-[11px] text-faint">{note}</div>}
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input value={v} onChange={(e) => setDraft(e.target.value)} inputMode="numeric" aria-label={L.label}
                 className="input num w-28 pr-12 text-right" />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-faint">{L.unit}</span>
        </div>
        <button className="btn" disabled={v === cur} onClick={async () => {
          const r = await run(() => api.putSetting(k, v));
          if (r) { setDraft(null); reloadBase(); }
        }}>저장</button>
      </div>
    </div>
  );
}
