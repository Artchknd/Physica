"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LabEngine, type Live } from "@/lab/engine";
import { I18nCtx, translate, type Lang } from "@/lab/i18n";
import { decodeShare, chartsToCSV, download, saveScene, SceneError } from "@/lab/scenes";
import { presetById } from "@/lab/presets";
import type { ChartSpec, Notice } from "@/lab/types";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";
import { ChartView } from "./ChartPanel";
import { HelpDialog, ScenesDialog } from "./Dialogs";
import { Btn, Seg } from "./ui";
import { fmtNum } from "./Format";

interface Toast extends Notice { id: number }
const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 4];

export default function LabApp() {
  const [lang, setLangS] = useState<Lang>(() => { try { const l = localStorage.getItem("physlab.lang"); return l === "en" ? "en" : "zh-TW"; } catch { return "zh-TW"; } });
  const [, setTick] = useState(0);
  const [live, setLive] = useState<Live | null>(null);
  const [charts, setCharts] = useState<ChartSpec[]>([]);
  const [chartTab, setChartTab] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [ctx, setCtx] = useState<{ x: number; y: number; id: string | null } | null>(null);
  const [dlg, setDlg] = useState<null | "scenes" | "help">(null);
  const [lTab, setLTab] = useState("exp");
  const [rTab, setRTab] = useState("exp");
  const [lOpen, setLOpen] = useState(true);
  const [rOpen, setROpen] = useState(true);
  const [bOpen, setBOpen] = useState(true);
  const [theme, setThemeS] = useState<"dark" | "light">("dark");
  const host = useRef<HTMLDivElement>(null);
  const engRef = useRef<LabEngine | null>(null);
  const frozenRef = useRef(false);
  frozenRef.current = frozen;
  const langRef = useRef(lang);
  langRef.current = lang;

  const t = useCallback((k: string, p?: Record<string, string | number>) => translate(lang, k, p), [lang]);
  const i18n = useMemo(() => ({ lang, t, setLang: (l: Lang) => { setLangS(l); try { localStorage.setItem("physlab.lang", l); } catch { /* ignore */ } } }), [lang, t]);

  useEffect(() => { document.documentElement.lang = lang === "en" ? "en" : "zh-Hant"; document.title = translate(lang, "app.title"); }, [lang]);
  useEffect(() => { if (window.innerWidth < 1100) { setLOpen(false); setROpen(false); }
    if (window.innerWidth < 760 || window.innerHeight < 500) setBOpen(false); }, []);

  // engine lifecycle
  useEffect(() => {
    if (!host.current) return;
    const eng = new LabEngine();
    let dead = false, ok = false;
    let raf = 0;
    eng.onChange = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; setTick((x) => x + 1); }); };
    eng.onNotice = (n) => { const id = Date.now() + Math.random(); setToasts((a) => [...a.slice(-3), { ...n, id }]); setTimeout(() => setToasts((a) => a.filter((x) => x.id !== id)), 4200); };
    eng.onContext = (c) => setCtx(c);
    eng.init(host.current).then(async () => {
      if (dead) { eng.dispose(); return; }
      ok = true; engRef.current = eng;
      const shared = decodeShare(location.hash);
      if (shared) { await eng.loadSceneData(shared); eng.notice("msg.sharedLoaded", "ok"); } else eng.newSandbox();
      eng.resetHistory();
      setReady(true); setLive(eng.getLive());
    }).catch((e: Error) => { console.error(e); if (!dead) setErr(e.message === "webgl" ? "err.webgl" : "err.physics"); });
    return () => { dead = true; if (raf) cancelAnimationFrame(raf); if (ok) { eng.dispose(); engRef.current = null; setReady(false); } };
  }, []);

  // polling
  useEffect(() => {
    const a = setInterval(() => { const e = engRef.current; if (e) setLive(e.getLive()); }, 120);
    const b = setInterval(() => { const e = engRef.current; if (e && !frozenRef.current) setCharts(e.getCharts()); }, 260);
    return () => { clearInterval(a); clearInterval(b); };
  }, []);

  const eng = engRef.current;
  useEffect(() => { if (eng) eng.setTheme(theme); }, [theme, eng, ready]);

  // keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const en = engRef.current;
      const el = e.target as HTMLElement;
      if (!en || ["INPUT", "SELECT", "TEXTAREA"].includes(el.tagName) && !(el as HTMLInputElement).type?.match(/range|checkbox/)) return;
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (dlg && k !== "escape") return;
      let used = true;
      if (k === " ") en.toggleRun();
      else if (k === "." || (k === "n" && !ctrl)) en.stepOnce();
      else if (k === "r" && e.shiftKey) en.reset();
      else if (ctrl && k === "z") { e.shiftKey ? en.redo() : en.undo(); }
      else if (ctrl && k === "y") en.redo();
      else if (ctrl && k === "d") en.duplicateSelected();
      else if (ctrl && k === "g") { e.shiftKey ? en.ungroupSelected() : en.groupSelected(); }
      else if (ctrl && k === "a") en.selectAll();
      else if (ctrl && k === "s") quickSave(en);
      else if (k === "delete" || k === "backspace") en.deleteSelected();
      else if (k === "q" && !ctrl) en.setGizmo("select");
      else if (k === "w" && !ctrl) en.setGizmo("translate");
      else if (k === "e" && !ctrl) en.setGizmo("rotate");
      else if (k === "r" && !ctrl) en.setGizmo("scale");
      else if (k === "f" && !ctrl) en.focusSelection();
      else if (k === "home") en.resetCamera();
      else if (k === "g" && !ctrl) { en.settings.snap = !en.settings.snap; en.applySettings(); en.emit(); }
      else if (k === "escape") { setDlg(null); setCtx(null); en.selectIds([]); en.setTool("none"); }
      else if (e.key === "?") setDlg("help");
      else used = false;
      if (used) e.preventDefault();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  const quickSave = (en: LabEngine) => {
    try { const name = en.data.name && en.data.name !== "Scene" ? en.data.name : `${translate(langRef.current, "scene.untitled")} ${new Date().toLocaleTimeString()}`; en.data.name = name; saveScene(name, en.getSceneData()); en.notice("msg.saved", "ok", { name }); }
    catch (e) { en.notice(e instanceof SceneError ? e.key : "err.storage", "error"); }
  };

  const ci = Math.min(chartTab, Math.max(0, charts.length - 1));
  const l = live;
  const mech = l?.cat === "mechanics";
  const title = !eng || !l ? "" : mech ? (eng.presetId ? t("pre." + eng.presetId) : t("exp.sandbox")) : eng.module ? t(eng.module.modes.find((m) => m.id === eng.module!.mode)?.label ?? "") : "";
  const env = eng?.data.env;
  void presetById;
  const tempC = eng?.settings.tempUnit === "C";

  return (
    <I18nCtx.Provider value={i18n}>
      <div className="app" data-theme={theme}>
        <header className="topbar">
          <div className="brand"><span className="logo">⚛</span><div><b>{t("app.title")}</b><small>{t("app.current")}: <em>{title}</em></small></div></div>
          <div className="top-actions">
            <Btn small tip={t("tip.leftPanel")} active={lOpen} onClick={() => setLOpen(!lOpen)}>☰</Btn>
            <span className="sep" />
            <Btn small tip={t("act.undo") + " (Ctrl+Z)"} disabled={!eng?.canUndo() || !mech} onClick={() => eng?.undo()}>↶</Btn>
            <Btn small tip={t("act.redo") + " (Ctrl+Y)"} disabled={!eng?.canRedo() || !mech} onClick={() => eng?.redo()}>↷</Btn>
            <span className="sep" />
            <Btn small tip={t("tip.save") + " (Ctrl+S)"} onClick={() => eng && quickSave(eng)}>💾 {t("act.save")}</Btn>
            <Btn small tip={t("tip.load")} onClick={() => setDlg("scenes")}>📂 {t("act.load")}</Btn>
          </div>
          <div className="top-right">
            <div className="langsw" role="group" aria-label={t("menu.language")}>
              <button className={lang === "zh-TW" ? "on" : ""} onClick={() => i18n.setLang("zh-TW")}>繁體中文</button>
              <button className={lang === "en" ? "on" : ""} onClick={() => i18n.setLang("en")}>English</button>
            </div>
            <Btn small tip={t("tip.theme")} onClick={() => setThemeS(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀" : "🌙"}</Btn>
            <Btn small tip={t("menu.help") + " (?)"} onClick={() => setDlg("help")}>?</Btn>
            <Btn small tip={t("tip.rightPanel")} active={rOpen} onClick={() => setROpen(!rOpen)}>⚙</Btn>
          </div>
        </header>

        <div className={`main ${lOpen ? "" : "no-l"} ${rOpen ? "" : "no-r"}`}>
          {lOpen && eng && l && <LeftPanel eng={eng} t={t} live={l} tab={lTab} setTab={setLTab} />}
          <div className="center">
            <div className="viewport">
              <div ref={host} className="canvas-host" onContextMenu={(e) => e.preventDefault()} />
              {!ready && !err && <div className="overlay"><div className="spinner" /><p>{t("msg.loading")}</p></div>}
              {err && <div className="overlay error"><h3>⚠ {t(err)}</h3><p>{t(err + "Hint")}</p><Btn kind="primary" onClick={() => location.reload()}>{t("act.reload")}</Btn></div>}
              {eng && l && (
                <>
                  <div className="vp-tools">
                    {mech && <Seg value={eng.settings.gizmo} onChange={(v) => eng.setGizmo(v)} options={[
                      { v: "select", label: "⬚", tip: t("gizmo.select") + " (Q)" }, { v: "translate", label: "✥", tip: t("gizmo.translate") + " (W)" },
                      { v: "rotate", label: "⟳", tip: t("gizmo.rotate") + " (E)" }, { v: "scale", label: "⤢", tip: t("gizmo.scale") + " (R)" }]} />}
                    {mech && <Btn small active={eng.settings.snap} tip={t("tip.snap") + " (G)"} onClick={() => { eng.settings.snap = !eng.settings.snap; eng.applySettings(); eng.emit(); }}>⌗ {t("set.snapShort")}</Btn>}
                    <Seg value={eng.settings.ortho ? "o" : "p"} onChange={(v) => eng.setOrtho(v === "o")} options={[{ v: "p", label: t("cam.persp"), tip: t("tip.persp") }, { v: "o", label: t("cam.ortho"), tip: t("tip.ortho") }]} />
                    <Btn small tip={t("cam.reset") + " (Home)"} onClick={() => eng.resetCamera()}>⌂ {t("cam.reset")}</Btn>
                    {mech && <Btn small tip={t("cam.focus") + " (F)"} disabled={!eng.selection.length} onClick={() => eng.focusSelection()}>◎</Btn>}
                  </div>
                  <div className="vp-status">
                    <span className="chip env">{t("env.active")}: {env && t("env." + env.preset)} · g = {env ? fmtNum(env.g, 2) : ""} m/s²</span>
                    <span className="chip">{eng.settings.adaptive && l.quality < 1 ? "↓" : ""}{l.fps.toFixed(0)} FPS</span>
                    {mech && eng.selection.length > 0 && <span className="chip sel">{t("props.multi", { n: eng.selection.length })}</span>}
                  </div>
                  <div className="toasts">{toasts.map((n) => <div key={n.id} className={`toast ${n.tone ?? "info"}`}>{t(n.key, n.params ? { ...n.params, name: n.params.name && String(n.params.name).startsWith("pre.") ? t(String(n.params.name)) : n.params.name } : undefined)}</div>)}</div>
                  {mech && eng.data.objects.length === 0 && !err && ready && <div className="empty-hint">{t("msg.emptyViewport")}</div>}
                  {ctx && <ContextMenu eng={eng} t={t} ctx={ctx} close={() => setCtx(null)} />}
                </>
              )}
            </div>

            {eng && l && (
              <div className={`bottom ${bOpen ? "" : "collapsed"}`}>
                <div className="controls">
                  <Btn kind="primary" tip={(l.running ? t("act.pause") : t("act.play")) + " (Space)"} onClick={() => eng.toggleRun()}>{l.running ? "⏸ " + t("act.pause") : "▶ " + t("act.play")}</Btn>
                  <Btn tip={t("act.step") + " (.)"} onClick={() => eng.stepOnce()}>⏭ {t("act.step")}</Btn>
                  <Btn tip={t("act.reset") + " (Shift+R)"} onClick={() => eng.reset()}>⟲ {t("act.reset")}</Btn>
                  <div className="speed"><span>{t("ctl.speed")}</span>
                    <Seg value={eng.speed} onChange={(v) => eng.setSpeed(v)} options={SPEEDS.map((s) => ({ v: s, label: `${s}×` }))} /></div>
                  <span className={`status ${l.running ? "run" : "pause"}`}><i />{l.running ? t("ctl.running") : t("ctl.paused")} · t = {l.simTime.toFixed(3)} s</span>
                  {mech && (
                    <div className="timeline" title={t("tip.timeline")}>
                      <span>{t("ctl.timeline")}</span>
                      <input type="range" min={0} max={Math.max(l.maxTime, 0.01)} step={0.01} value={Math.min(l.simTime, Math.max(l.maxTime, 0.01))} onChange={(e) => eng.seek(parseFloat(e.target.value))} />
                      <small>{l.maxTime.toFixed(1)} s</small>
                    </div>
                  )}
                  <span className="grow" />
                  <Btn small tip={t("tip.bottom")} onClick={() => setBOpen(!bOpen)}>{bOpen ? "▾" : "▴"}</Btn>
                </div>
                {bOpen && (
                  <div className="charts">
                    <div className="chart-bar">
                      <div className="seg">{charts.map((c, i) => <button key={c.id} className={i === ci ? "on" : ""} onClick={() => setChartTab(i)}>{t(c.title)}</button>)}</div>
                      <span className="grow" />
                      <Btn small active={frozen} tip={t("tip.chartPause")} onClick={() => setFrozen(!frozen)}>{frozen ? "▶ " + t("act.resumeChart") : "⏸ " + t("act.pauseChart")}</Btn>
                      <Btn small tip={t("tip.chartClear")} onClick={() => { if (mech) { eng.hist = []; } else eng.module?.reset(); setCharts(eng.getCharts()); }}>🗑 {t("act.clear")}</Btn>
                      <Btn small tip={t("tip.csv")} onClick={() => { const c = eng.getCharts(true); if (!c.some((x) => x.series.some((s) => s.pts.length))) { eng.notice("msg.noData", "warn"); return; } download("physlab-data.csv", chartsToCSV(c, t), "text/csv"); }}>⭳ CSV</Btn>
                    </div>
                    <div className="chart-grid">
                      {charts.length === 0 && <p className="hint pad">{t("msg.noChart")}</p>}
                      {charts[ci] && <ChartView spec={charts[ci]} t={t} theme={theme} tempC={!!tempC} />}
                      {charts.length > 1 && <ChartView spec={charts[(ci + 1) % charts.length]} t={t} theme={theme} tempC={!!tempC} />}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {rOpen && eng && l && <RightPanel eng={eng} t={t} live={l} tab={rTab} setTab={setRTab} />}
        </div>
        {dlg === "scenes" && eng && <ScenesDialog eng={eng} t={t} onClose={() => setDlg(null)} />}
        {dlg === "help" && <HelpDialog t={t} onClose={() => setDlg(null)} />}
      </div>
    </I18nCtx.Provider>
  );
}

function ContextMenu({ eng, t, ctx, close }: { eng: LabEngine; t: (k: string) => string; ctx: { x: number; y: number; id: string | null }; close: () => void }) {
  const o = ctx.id ? eng.obj(ctx.id) : null;
  const rect = eng.container.getBoundingClientRect();
  const act = (f: () => void) => () => { f(); close(); };
  return (
    <>
      <div className="ctx-bg" onMouseDown={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
      <div className="ctx" style={{ left: Math.min(ctx.x - rect.left, rect.width - 190), top: Math.min(ctx.y - rect.top, rect.height - 260) }}>
        {o ? (
          <>
            <button onClick={act(() => eng.duplicateSelected())}>⧉ {t("act.duplicate")}</button>
            <button onClick={act(() => eng.deleteSelected())}>🗑 {t("act.delete")}</button>
            <button onClick={act(() => eng.toggleLock())}>🔒 {o.locked ? t("act.unlock") : t("act.lock")}</button>
            <button onClick={act(() => eng.edit(eng.selection, { isStatic: !o.isStatic }, "ctxst"))}>{o.isStatic ? t("ctx.makeDynamic") : t("ctx.makeStatic")}</button>
            <button onClick={act(() => eng.groupSelected())}>{t("act.group")}</button>
            <button onClick={act(() => eng.ungroupSelected())}>{t("act.ungroup")}</button>
            <button onClick={act(() => eng.focusSelection())}>◎ {t("cam.focus")}</button>
          </>
        ) : (
          <>
            <button onClick={act(() => eng.selectAll())}>{t("act.selectAll")}</button>
            <button onClick={act(() => eng.resetCamera())}>⌂ {t("cam.reset")}</button>
            <button onClick={act(() => eng.undo())}>↶ {t("act.undo")}</button>
          </>
        )}
      </div>
    </>
  );
}
