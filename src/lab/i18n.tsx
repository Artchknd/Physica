"use client";
import { createContext, useContext } from "react";
import { en, zh } from "./dict";

export type Lang = "zh-TW" | "en";
export interface I18n { lang: Lang; t: (k: string, p?: Record<string, string | number>) => string; setLang: (l: Lang) => void }

export function translate(lang: Lang, k: string, p?: Record<string, string | number>): string {
  const d = lang === "en" ? en : zh;
  let s = d[k] ?? en[k] ?? k;
  if (p) for (const [a, b] of Object.entries(p)) s = s.replace(new RegExp(`\\{${a}\\}`, "g"), String(b));
  return s;
}
export const I18nCtx = createContext<I18n>({ lang: "zh-TW", t: (k) => k, setLang: () => {} });
export const useI18n = () => useContext(I18nCtx);
