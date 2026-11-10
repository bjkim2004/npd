"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppContext";
import { Empty, Notice, PageHeader, Panel } from "@/components/ui";
import { api, type ActionItem, type ActionSources, type ActionStatus } from "@/lib/api";

const STATUSES: ActionStatus[] = ["할 일", "진행 중", "완료"];
const STATUS_CHIP: Record<ActionStatus, string> = {
  "할 일": "bg-sunken text-muted",
  "진행 중": "bg-accent-soft text-accent",
  완료: "bg-ok-soft text-ok",
};
type Filter = "열린 일" | ActionStatus | "전체";
const FILTERS: Filter[] = ["열린 일", "할 일", "진행 중", "완료", "전체"];

export default function ActionsPage() {
  const { asOf, products } = useApp();
  const [items, setItems] = useState<ActionItem[] | null>(null);
  const [src, setSrc] = useState<ActionSources | null>(null);
  const [filter, setFilter] = useState<Filter>("열린 일");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [newIds, setNewIds] = useState<Set<number>>(new Set());
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState("");
  const [days, setDays] = useState(7);

  const load = useCallback(() => {
    Promise.all([api.actions(), api.actionSources()])
      .then(([a, s]) => { setItems(a); setSrc(s); })
      .catch((e: Error) => setMsg({ tone: "bad", text: e.message }));
  }, []);
  useEffect(load, [load]);

  async function extract(kind: "slack" | "text") {
    setBusy(kind);
    setMsg(null);
    try {
      const r = kind === "slack" ? await api.extractSlack(days) : await api.extractText(text);
      setNewIds(new Set(r.created.map((a) => a.id)));
      setMsg({
        tone: "ok",
        text: r.messages === 0 ? "새 메시지가 없습니다."
          : `메시지 ${r.messages}건을 읽어 Action Item ${r.created.length}건을 새로 저장했습니다.` +
            (r.created.length === 0 ? " (할 일이 없거나 이미 저장된 항목입니다)" : ""),
      });
      if (kind === "text" && r.created.length) { setText(""); setShowText(false); }
      load();
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function patch(id: number, b: Parameters<typeof api.patchAction>[1]) {
    try {
      const u = await api.patchAction(id, b);
      setItems((xs) => xs?.map((x) => (x.id === id ? u : x)) ?? null);
    } catch (e) {
      setMsg({ tone: "bad", text: (e as Error).message });
    }
  }

  const owners = useMemo(() => [...new Set((items ?? []).map((a) => a.owner).filter(Boolean))] as string[], [items]);
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { "열린 일": 0, "할 일": 0, "진행 중": 0, 완료: 0, 전체: 0 };
    for (const a of items ?? []) {
      c[a.status]++;
      c.전체++;
      if (a.status !== "완료") c["열린 일"]++;
    }
    return c;
  }, [items]);
  const overdue = (items ?? []).filter((a) => a.status !== "완료" && a.due && a.due < asOf).length;
  const shown = (items ?? []).filter((a) =>
    (filter === "전체" || (filter === "열린 일" ? a.status !== "완료" : a.status === filter)) && (!owner || a.owner === owner));

  return (
    <>
      <PageHeader
        title="Action Item"
        desc={<>Slack 채널 대화에서 LLM({src?.model ?? "Upstage Solar"})이 할 일·담당자·기한을 뽑아 저장합니다. 뽑힌 내용은 틀릴 수 있으니 확인하고 고쳐 쓰세요.</>}
      >
        <label className="flex items-center gap-1.5 text-xs text-muted">
          처음 가져올 기간
          <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} disabled={!!src?.last_synced}
                  title={src?.last_synced ? "이미 가져온 적이 있어 마지막으로 읽은 메시지 뒤부터 읽습니다" : undefined}>
            {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d}일</option>)}
          </select>
        </label>
        <button className="btn-quiet h-9" onClick={() => setShowText((v) => !v)}>대화 붙여 넣기</button>
        <button className="btn" disabled={!!busy || !src?.slack || !src?.llm} onClick={() => extract("slack")}
                title={!src?.slack ? "backend/.env에 SLACK_BOT_TOKEN이 필요합니다" : undefined}>
          {busy === "slack" ? "Slack 읽는 중…" : "Slack에서 가져오기"}
        </button>
      </PageHeader>

      {src && !src.llm && <Notice tone="bad"><span><b>LLM 미설정</b> backend/.env에 UPSTAGE_API_KEY를 넣고 백엔드를 다시 켜세요.</span></Notice>}
      {src && !src.slack && (
        <Notice tone="warn">
          <span>
            Slack 채널({src.channel})을 읽으려면 <code>backend/.env</code>에 <code>SLACK_BOT_TOKEN</code>(xoxb-, 권한 <code>channels:history</code>·<code>users:read</code>)을
            넣고 봇을 채널에 초대해야 합니다. 그 전에는 「대화 붙여 넣기」로 Slack 대화를 복사해 넣어 추출할 수 있습니다.
          </span>
        </Notice>
      )}
      {msg && <Notice tone={msg.tone === "ok" ? "info" : "bad"}><span>{msg.text}</span></Notice>}

      {showText && (
        <Panel title="대화 붙여 넣기" aside={<span className="text-xs text-faint">Slack 대화나 회의록을 그대로 복사해 넣으세요</span>}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} maxLength={50000}
                    placeholder="Slack 대화나 회의록을 붙여 넣으세요. 줄 앞에 [월/일 시:분] 날짜가 있으면 기한 계산에 씁니다."
                    className="input h-auto w-full resize-y py-2 font-mono text-[13px] leading-relaxed" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-faint">날짜가 있으면 「금요일까지」 같은 기한을 그 날짜 기준으로 계산합니다.</span>
            <button className="btn" disabled={!!busy || !text.trim() || !src?.llm} onClick={() => extract("text")}>
              {busy === "text" ? "추출 중…" : "Action Item 추출"}
            </button>
          </div>
        </Panel>
      )}

      <Panel
        pad={false}
        title={<>목록 {overdue > 0 && <span className="ml-2 rounded-full bg-bad-soft px-2 py-0.5 text-[11px] font-semibold text-bad">기한 지남 {overdue}</span>}</>}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" className="flex gap-0.5 rounded-lg bg-sunken p-0.5">
              {FILTERS.map((f) => (
                <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
                        className={`h-7 rounded-md px-2.5 text-xs font-medium transition ${filter === f ? "bg-raised text-ink shadow-panel" : "text-faint hover:text-ink"}`}>
                  {f} <span className="num text-faint">{counts[f]}</span>
                </button>
              ))}
            </div>
            <select aria-label="담당자" className="input h-8 text-xs" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">담당자 전체</option>
              {owners.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        }
      >
        {items === null ? <Empty title="불러오는 중…" />
          : shown.length === 0 ? (
            <Empty title={items.length ? "조건에 맞는 Action Item이 없습니다" : "아직 Action Item이 없습니다"}>
              {items.length ? "필터를 바꿔 보세요." : "「Slack에서 가져오기」나 「대화 붙여 넣기」로 만들어 보세요."}
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr><th className="w-28">상태</th><th>할 일</th><th className="w-32">담당</th><th className="w-40">기한</th><th className="w-32">제품</th><th className="w-28">출처</th><th className="w-20" /></tr>
                </thead>
                <tbody>
                  {shown.map((a) => {
                    const late = a.status !== "완료" && a.due && a.due < asOf;
                    return (
                      <tr key={a.id} className={newIds.has(a.id) ? "bg-accent-soft/40" : undefined}>
                        <td>
                          <select aria-label="상태" value={a.status} onChange={(e) => patch(a.id, { status: e.target.value as ActionStatus })}
                                  className={`h-7 rounded-full border-0 px-2.5 text-xs font-semibold ${STATUS_CHIP[a.status]}`}>
                            {STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="min-w-64">
                          <div className={`font-medium ${a.status === "완료" ? "text-faint line-through" : "text-ink"}`}>
                            {newIds.has(a.id) && <span className="mr-1.5 rounded bg-accent px-1 text-[10px] font-semibold text-accent-ink">새</span>}
                            {a.title}
                          </div>
                          {a.detail && <div className="mt-0.5 text-xs text-muted">{a.detail}</div>}
                        </td>
                        <td>
                          <InlineText value={a.owner ?? ""} placeholder="미정" onSave={(v) => patch(a.id, { owner: v || null })} />
                        </td>
                        <td>
                          <input type="date" aria-label="기한" value={a.due ?? ""} onChange={(e) => patch(a.id, { due: e.target.value || null })}
                                 className={`input num h-8 w-36 text-xs ${late ? "border-bad/50 text-bad" : ""}`} />
                        </td>
                        <td>
                          <select aria-label="제품" value={a.product ?? ""} onChange={(e) => patch(a.id, { product: e.target.value || null })}
                                  className="input h-8 text-xs">
                            <option value="">—</option>
                            {products.map((p) => <option key={p.id}>{p.name}</option>)}
                          </select>
                        </td>
                        <td>
                          <SourceCell a={a} />
                        </td>
                        <td className="text-right">
                          <button className="btn-quiet whitespace-nowrap hover:!bg-bad-soft hover:!text-bad" onClick={async () => {
                            if (!confirm(`「${a.title}」을 삭제할까요?`)) return;
                            try { await api.deleteAction(a.id); setItems((xs) => xs?.filter((x) => x.id !== a.id) ?? null); }
                            catch (e) { setMsg({ tone: "bad", text: (e as Error).message }); }
                          }}>삭제</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        {src?.last_synced && (
          <p className="border-t border-line px-5 py-2.5 text-[11px] text-faint">Slack 마지막으로 읽은 메시지: {src.last_synced.replace("T", " ")} · 다음에는 그 뒤 메시지만 읽습니다.</p>
        )}
      </Panel>
    </>
  );
}

function SourceCell({ a }: { a: ActionItem }) {
  const label = a.source === "slack" ? "Slack" : "붙여 넣기";
  const tip = [a.source_text, a.created_by && `추출: ${a.created_by}`].filter(Boolean).join("\n\n");
  return a.source_link ? (
    <a href={a.source_link} target="_blank" rel="noreferrer" title={tip}
       className="text-xs font-medium text-accent underline-offset-2 hover:underline">{label} 원문 ↗</a>
  ) : (
    <span title={tip} className="cursor-help text-xs text-muted underline decoration-dotted underline-offset-2">{label}</span>
  );
}

function InlineText({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input value={draft ?? value} placeholder={placeholder} aria-label="담당"
           onChange={(e) => setDraft(e.target.value)}
           onBlur={() => { if (draft !== null && draft.trim() !== value) onSave(draft.trim()); setDraft(null); }}
           onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setDraft(null); }}
           className="input h-8 w-28 border-transparent bg-transparent text-xs hover:border-line focus:bg-surface" />
  );
}
