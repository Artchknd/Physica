"use client";
import { useRef, useState } from "react";
import type { LabEngine } from "@/lab/engine";
import { SceneError, chartsToCSV, deleteScene, download, duplicateScene, encodeShare, listScenes, parseSceneText, renameScene, saveScene, type SavedScene } from "@/lab/scenes";
import { Btn } from "./ui";

type T = (k: string, p?: Record<string, string | number>) => string;

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-bg" onMouseDown={onClose}>
      <div className={`modal ${wide ? "wide" : ""}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header><h3>{title}</h3><button className="x" onClick={onClose} aria-label="close">✕</button></header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

export function ScenesDialog({ eng, t, onClose }: { eng: LabEngine; t: T; onClose: () => void }) {
  const [list, setList] = useState<SavedScene[]>(() => listScenes());
  const [name, setName] = useState(eng.data.name && eng.data.name !== "Scene" ? eng.data.name : t("scene.untitled"));
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const guard = (fn: () => void) => { try { fn(); } catch (e) { eng.notice(e instanceof SceneError ? e.key : "err.storage", "error"); } };
  const refresh = () => setList(listScenes());
  const load = async (s: SavedScene) => { await eng.loadSceneData(s.data); eng.notice("msg.loaded", "ok", { name: s.name }); onClose(); };
  return (
    <Modal title={t("menu.scenes")} onClose={onClose} wide>
      <div className="row-gap">
        <input className="txt grow" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("scene.name")} />
        <Btn kind="primary" onClick={() => guard(() => { eng.data.name = name; saveScene(name, eng.getSceneData()); refresh(); eng.notice("msg.saved", "ok", { name }); })}>💾 {t("act.save")}</Btn>
      </div>
      <div className="scene-list">
        {list.length === 0 && <p className="hint">{t("scene.empty")}</p>}
        {list.map((s) => (
          <div key={s.id} className="scene-row">
            {editing === s.id ? (
              <input className="txt grow" autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { guard(() => renameScene(s.id, editName || s.name)); setEditing(null); refresh(); } if (e.key === "Escape") setEditing(null); }} />
            ) : (
              <div className="grow"><b>{s.name}</b><small>{new Date(s.ts).toLocaleString()} · {s.data.objects.length} {t("scene.objects")}{s.data.module ? ` · ${t("cat." + s.data.module.cat)}` : ""}</small></div>
            )}
            <Btn small kind="primary" onClick={() => load(s)}>{t("act.load")}</Btn>
            <Btn small onClick={() => { setEditing(s.id); setEditName(s.name); }}>{t("act.rename")}</Btn>
            <Btn small onClick={() => guard(() => { duplicateScene(s.id, t("scene.copySuffix")); refresh(); })}>{t("act.duplicate")}</Btn>
            <Btn small onClick={() => download(`${s.name}.json`, JSON.stringify(s.data, null, 2), "application/json")}>{t("act.exportJson")}</Btn>
            <Btn small kind="danger" onClick={() => guard(() => { deleteScene(s.id); refresh(); })}>{t("act.delete")}</Btn>
          </div>
        ))}
      </div>
      <div className="row-gap wrap">
        <Btn onClick={() => download(`${name || "scene"}.json`, JSON.stringify(eng.getSceneData(), null, 2), "application/json")}>⭳ {t("act.exportJson")}</Btn>
        <Btn onClick={() => file.current?.click()}>⭱ {t("act.importJson")}</Btn>
        <Btn onClick={async () => { try { await navigator.clipboard.writeText(encodeShare(eng.getSceneData())); eng.notice("msg.linkCopied", "ok"); } catch { eng.notice("err.clipboard", "error"); } }}>🔗 {t("act.share")}</Btn>
        <Btn onClick={() => { const c = eng.getCharts(true); if (!c.some((x) => x.series.some((s) => s.pts.length))) { eng.notice("msg.noData", "warn"); return; } download("physlab-data.csv", chartsToCSV(c, t), "text/csv"); }}>⭳ {t("act.exportCsv")}</Btn>
        <Btn kind="danger" onClick={() => { eng.clearScene(); onClose(); }}>{t("act.clearScene")}</Btn>
        <input ref={file} type="file" accept=".json,application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = "";
          if (!f) return;
          try { const d = parseSceneText(await f.text()); await eng.loadSceneData(d); eng.notice("msg.imported", "ok"); onClose(); }
          catch (err) { eng.notice(err instanceof SceneError ? err.key : "err.invalidFile", "error"); }
        }} />
      </div>
    </Modal>
  );
}

export function HelpDialog({ t, onClose }: { t: T; onClose: () => void }) {
  const keys: [string, string][] = [["Space", "key.play"], [". / N", "key.step"], ["Shift+R", "key.reset"], ["Q / W / E / R", "key.gizmo"], ["Del / ⌫", "key.delete"], ["Ctrl+Z / Ctrl+Y", "key.undo"], ["Ctrl+D", "key.duplicate"], ["Ctrl+G / Ctrl+Shift+G", "key.group"], ["Ctrl+A", "key.selectAll"], ["Ctrl+S", "key.save"], ["F", "key.focus"], ["Home", "key.camera"], ["G", "key.snap"], ["Shift + click", "key.multi"], ["Esc", "key.deselect"], ["?", "key.help"]];
  return (
    <Modal title={t("menu.help")} onClose={onClose}>
      <p className="desc">{t("help.intro")}</p>
      <table className="rt keys"><tbody>{keys.map(([k, d]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{t(d)}</td></tr>)}</tbody></table>
      <p className="desc small">{t("help.mouse")}</p>
      <p className="desc small">{t("help.honesty")}</p>
    </Modal>
  );
}
