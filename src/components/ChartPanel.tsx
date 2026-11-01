"use client";
import { useEffect, useRef } from "react";
import { Chart, LineController, ScatterController, LinearScale, PointElement, LineElement, Legend, Tooltip, Filler } from "chart.js";
import type { ChartSpec } from "@/lab/types";

Chart.register(LineController, ScatterController, LinearScale, PointElement, LineElement, Legend, Tooltip, Filler);

export function ChartView({ spec, t, theme, tempC }: { spec: ChartSpec | undefined; t: (k: string) => string; theme: "dark" | "light"; tempC: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    chart.current = new Chart(ref.current, {
      type: "scatter", data: { datasets: [] },
      options: { animation: false, responsive: true, maintainAspectRatio: false, parsing: false, normalized: true, interaction: { mode: "nearest", intersect: false },
        plugins: { legend: { labels: { boxWidth: 10, boxHeight: 2, font: { size: 10 } } }, tooltip: { enabled: true } },
        scales: { x: { type: "linear", title: { display: true, text: "" } }, y: { type: "linear", title: { display: true, text: "" } } } },
    });
    return () => { chart.current?.destroy(); chart.current = null; };
  }, []);
  useEffect(() => {
    const c = chart.current;
    if (!c || !spec) return;
    const fg = theme === "dark" ? "#a9b6cf" : "#44506a", grid = theme === "dark" ? "rgba(140,160,200,0.12)" : "rgba(40,60,100,0.12)";
    const cvt = (u: string | undefined, v: number) => (tempC && u === "K" ? v - 273.15 : v);
    c.data.datasets = spec.series.map((s) => ({
      label: t(s.label), borderColor: s.color, backgroundColor: s.color, showLine: !s.points, pointRadius: s.points ? 6 : 0, pointHoverRadius: 4,
      borderWidth: 1.6, borderDash: s.dashed ? [6, 4] : [], tension: 0, data: s.pts.map((p) => ({ x: cvt(spec.xUnit, p.x), y: cvt(spec.yUnit, p.y) })),
    })) as never;
    const ux = spec.xUnit === "K" && tempC ? "°C" : spec.xUnit, uy = spec.yUnit === "K" && tempC ? "°C" : spec.yUnit;
    const sc = c.options.scales as Record<string, { title: { text: string; color: string }; ticks: { color: string }; grid: { color: string } }>;
    sc.x.title.text = t(spec.xLabel) + (ux ? ` (${ux})` : ""); sc.y.title.text = t(spec.yLabel) + (uy ? ` (${uy})` : "");
    for (const k of ["x", "y"]) { sc[k].title.color = fg; sc[k].ticks.color = fg; sc[k].grid.color = grid; }
    const lg = c.options.plugins!.legend!.labels as { color: string };
    lg.color = fg;
    c.update("none");
  }, [spec, t, theme, tempC]);
  return <div className="chart-box"><canvas ref={ref} /></div>;
}
