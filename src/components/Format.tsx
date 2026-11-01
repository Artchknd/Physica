"use client";
import type { Readout } from "@/lab/types";

export function fmtNum(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) return v.toExponential(Math.max(1, Math.min(digits - 1, 4)));
  return v.toFixed(Math.max(0, Math.min(digits, a >= 100 ? Math.min(digits, 3) : digits)));
}

export function ReadoutTable({ rows, t, tempC }: { rows: Readout[]; t: (k: string, p?: Record<string, string | number>) => string; tempC: boolean }) {
  return (
    <table className="rt">
      <tbody>
        {rows.map((r, i) => {
          const [k, suffix] = r.label.split(":");
          let val: string;
          let unit = r.unit ?? "";
          if (typeof r.value === "number") {
            let v = r.value;
            if (r.temp && tempC) { v -= 273.15; unit = "°C"; }
            val = fmtNum(v, r.digits ?? 4);
          } else val = r.tr ? t(r.value) : r.value;
          return (
            <tr key={i} className={r.tone ?? ""}>
              <td>{t(k)}{suffix ? ` ${suffix}` : ""}</td>
              <td className="v">{val}{unit && <em> {unit}</em>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
