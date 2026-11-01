"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function NumInput({ value, onChange, min, max, step = 0.1, disabled, width }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; disabled?: boolean; width?: number }) {
  const [txt, setTxt] = useState(fmt(value));
  const focus = useRef(false);
  useEffect(() => { if (!focus.current) setTxt(fmt(value)); }, [value]);
  return (
    <input
      className="num" type="text" inputMode="decimal" disabled={disabled} value={txt} style={width ? { width } : undefined}
      onFocus={() => (focus.current = true)}
      onBlur={() => { focus.current = false; setTxt(fmt(value)); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          const d = (e.key === "ArrowUp" ? 1 : -1) * step * (e.shiftKey ? 10 : 1);
          let v = value + d; if (min !== undefined) v = Math.max(min, v); if (max !== undefined) v = Math.min(max, v);
          onChange(+v.toFixed(6)); setTxt(fmt(v));
        } else if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      onChange={(e) => {
        setTxt(e.target.value);
        const v = parseFloat(e.target.value.replace(",", "."));
        if (Number.isFinite(v)) { let x = v; if (min !== undefined) x = Math.max(min, x); if (max !== undefined) x = Math.min(max, x); onChange(x); }
      }}
    />
  );
}
export function fmt(v: number, d = 4) {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(2);
  return String(+v.toFixed(d));
}

export function Field({ label, value, onChange, min, max, step = 0.1, unit, slider = true, disabled, tip }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number; unit?: string; slider?: boolean; disabled?: boolean; tip?: string }) {
  return (
    <div className="field" title={tip}>
      <div className="field-row">
        <span className="field-label">{label}</span>
        <span className="field-val"><NumInput value={value} onChange={onChange} min={min} max={max} step={step} disabled={disabled} />{unit && <em>{unit}</em>}</span>
      </div>
      {slider && <input type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} disabled={disabled} onChange={(e) => onChange(parseFloat(e.target.value))} />}
    </div>
  );
}

export function Vec3({ label, value, onChange, step = 0.1, unit, disabled }: { label: string; value: [number, number, number]; onChange: (v: [number, number, number]) => void; step?: number; unit?: string; disabled?: boolean }) {
  return (
    <div className="vec3">
      <span className="field-label">{label}{unit && <em> {unit}</em>}</span>
      <div className="vec3-in">
        {[0, 1, 2].map((i) => (
          <label key={i} className={`ax ax${i}`}>
            <b>{"XYZ"[i]}</b>
            <NumInput value={value[i]} step={step} disabled={disabled} onChange={(v) => { const n = [...value] as [number, number, number]; n[i] = v; onChange(n); }} />
          </label>
        ))}
      </div>
    </div>
  );
}

export function Section({ title, children, open = true, right }: { title: string; children: ReactNode; open?: boolean; right?: ReactNode }) {
  const [o, setO] = useState(open);
  return (
    <section className={`sec ${o ? "open" : ""}`}>
      <header onClick={() => setO(!o)}><span className="chev">▸</span><h4>{title}</h4><span onClick={(e) => e.stopPropagation()}>{right}</span></header>
      {o && <div className="sec-body">{children}</div>}
    </section>
  );
}

export function Btn({ children, onClick, active, tip, disabled, kind, small }: { children: ReactNode; onClick?: () => void; active?: boolean; tip?: string; disabled?: boolean; kind?: "primary" | "danger" | "ghost"; small?: boolean }) {
  return <button className={`btn ${active ? "active" : ""} ${kind ?? ""} ${small ? "small" : ""}`} onClick={onClick} title={tip} disabled={disabled} aria-label={tip}>{children}</button>;
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode; tip?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => <button key={String(o.v)} className={o.v === value ? "on" : ""} title={o.tip} onClick={() => onChange(o.v)}>{o.label}</button>)}
    </div>
  );
}

export function Toggle({ label, value, onChange, tip }: { label: string; value: boolean; onChange: (v: boolean) => void; tip?: string }) {
  return (
    <label className="toggle" title={tip}>
      <span>{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}
