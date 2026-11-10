"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/AppContext";
import { ThemeSwitch } from "@/components/Sidebar";
import { PageHeader, Panel } from "@/components/ui";
import { api, type SlackStatus } from "@/lib/api";

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

      <SlackPanel />

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

function SlackPanel() {
  const [st, setSt] = useState<SlackStatus | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.slackStatus().then(setSt).catch((e: Error) => setMsg({ tone: "bad", text: e.message }));
  }, []);

  async function act(fn: () => Promise<string>) {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ tone: "ok", text: await fn() });
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title="Slack 지연 알림">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-ink">
            <span className={`h-2 w-2 rounded-full ${st?.configured ? "bg-ok" : st ? "bg-warn" : "bg-none"}`} />
            {st == null ? "확인 중" : st.configured
              ? `연결됨 · ${st.mode === "webhook" ? "Incoming Webhook" : `봇 → 채널 ${st.channel}`}`
              : "설정 안 됨"}
          </div>
          <div className="max-w-[72ch] text-xs text-muted">
            빨강 Task가 새로 생기면(기한 지남·미완료, 지연 완료) Task마다 한 번, 지연 흡수 결과 출시일에 영향이 생기면 한 번 보냅니다.
            {st?.configured && st.interval_min > 0 && ` 서버가 ${st.interval_min}분마다 자동 점검합니다.`}
          </div>
          {st && !st.configured && (
            <div className="text-[11px] text-faint">
              <code>backend/.env</code>에 <code>SLACK_WEBHOOK_URL</code> 또는 <code>SLACK_BOT_TOKEN</code>(+ <code>SLACK_CHANNEL</code>)을 넣고 백엔드를 다시 켜세요.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-quiet h-9" disabled={busy || !st?.configured}
                  onClick={() => act(async () => { await api.slackTest(); return "시험 메시지를 보냈습니다. 채널을 확인하세요."; })}>
            시험 발송
          </button>
          <button className="btn" disabled={busy || !st?.configured}
                  onClick={() => act(async () => {
                    const r = await api.alertsCheck();
                    const n = Object.values(r.queued).reduce<number>((a, v) => a + (typeof v === "number" ? v : 0), 0);
                    return n ? `새 빨강 Task ${n}건을 보냅니다.` : "새로 보낼 지연 알림이 없습니다(이미 보낸 Task는 다시 보내지 않음).";
                  })}>
            지금 점검
          </button>
        </div>
      </div>
      {msg && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-[13px] ${msg.tone === "ok" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`}>{msg.text}</p>
      )}
    </Panel>
  );
}
