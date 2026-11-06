"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, type Product, type Schedule, type Settings } from "@/lib/api";
import { getToken } from "@/lib/auth";

type Health = { db: string; tasks: number; tasks_needing_check: number };

interface AppState {
  health: Health | null;
  products: Product[];
  holidays: Set<string>;
  settings: Settings;
  activeId: number | null;
  setActiveId: (id: number) => void;
  selected: number[];
  setSelected: (f: (s: number[]) => number[]) => void;
  asOf: string;
  setAsOf: (d: string) => void;
  sched: Schedule | null;
  error: string | null;
  setError: (e: string | null) => void;
  absorbAlert: string | null;
  setAbsorbAlert: (a: string | null) => void;
  baseVer: number;
  reloadBase: () => void;
  reloadSched: () => void;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("AppProvider 밖에서 useApp 호출");
  return v;
}

const today = () => new Date().toISOString().slice(0, 10);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [holidays, setHolidays] = useState<Set<string>>(new Set());
  const [settings, setSettings] = useState<Settings>({});
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [asOf, setAsOf] = useState(today());
  const [sched, setSched] = useState<Schedule | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [absorbAlert, setAbsorbAlert] = useState<string | null>(null);
  const [baseVer, setBaseVer] = useState(0);
  const [schedVer, setSchedVer] = useState(0);

  const reloadBase = useCallback(() => setBaseVer((v) => v + 1), []);
  const reloadSched = useCallback(() => setSchedVer((v) => v + 1), []);
  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    try {
      const r = await fn();
      setError(null);
      return r;
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!getToken()) return; // 로그인 전(하이드레이션 중)에는 부르지 않음
    let alive = true;
    Promise.all([api.health(), api.products(), api.holidays(), api.settings()])
      .then(([h, ps, hs, st]) => {
        if (!alive) return;
        setHealth(h);
        setProducts(ps);
        setHolidays(new Set(hs.map((x) => x.date)));
        setSettings(st);
        setActiveId((cur) => (cur != null && ps.some((p) => p.id === cur) ? cur : ps[0]?.id ?? null));
        setSelected((cur) => {
          const keep = cur.filter((id) => ps.some((p) => p.id === id));
          return keep.length ? keep : ps.slice(0, 2).map((p) => p.id);
        });
        setError(null);
      })
      .catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [baseVer]);

  useEffect(() => {
    if (activeId == null || !getToken()) return;
    let alive = true;
    api.schedule(activeId, asOf)
      .then((r) => alive && setSched(r))
      .catch((e: Error) => alive && setError(e.message));
    return () => { alive = false; };
  }, [activeId, asOf, schedVer, baseVer]);

  const value: AppState = {
    health, products, holidays, settings, activeId,
    setActiveId: (id) => { setActiveId(id); setAbsorbAlert(null); },
    selected, setSelected, asOf, setAsOf, sched, error, setError,
    absorbAlert, setAbsorbAlert, baseVer, reloadBase, reloadSched, run,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
