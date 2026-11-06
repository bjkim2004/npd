"use client";

import { useSyncExternalStore } from "react";
import { THEME_KEY as KEY } from "@/lib/themeScript";

export type ThemePref = "light" | "dark" | "system";
const listeners = new Set<() => void>();

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePref) {
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setTheme(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref); } catch {}
  apply(pref);
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSys = () => { if (read() === "system") { apply("system"); cb(); } };
  mq.addEventListener("change", onSys);
  return () => { listeners.delete(cb); mq.removeEventListener("change", onSys); };
}

export function useThemePref(): ThemePref {
  return useSyncExternalStore(subscribe, read, () => "system");
}
