"use client";
import { useState } from "react";
import { PRESETS, presetById } from "@/lab/presets";
import { SHAPES } from "@/lab/shapes";
import type { Cat, LabEngine, Live } from "@/lab/engine";
import type { JointKind, ObjData, V3 } from "@/lab/types";
import { Btn, Field, Section, Seg, Toggle, Vec3 } from "./ui";

type T = (k: string, p?: Record<string, string | number>) => string;
const CATS: { id: Cat; icon: string }[] = [{ id: "mechanics", icon: "⚙" }, { id: "optics", icon: "◐" }, { id: "waves", icon: "∿" }, { id: "em", icon: "⚡" }, { id: "thermo", icon: "♨" }];
const ICON: Record<string, string> = { cube: "◼", sphere: "●", cylinder: "▮", cone: "▲", capsule: "⬬", plane: "▬", pyramid: "△", wall: "▯", platform: "▭", ramp: "◢", beam: "━", rod: "╽", wheel: "◎", gear: "⚙", container: "⬒", pulley: "◉", spring: "⌇", rope: "⛓", pendulum: "⏲" };
const ASSEMBLIES = ["spring", "rope", "pendulum", "pulley_a"] as const;

export function objName(o: ObjData, t: T, idx: number) { return o.name || `${t("obj." + o.kind)} ${idx + 1}`; }

export function LeftPanel({ eng, t, live, tab, setTab }: { eng: LabEngine; t: T; live: Live; tab: string; setTab: (s: string) => void }) {
  return (
    <aside className="panel left">
      <div className="tabs">
        {[["exp", "tab.experiments"], ["lib", "tab.objects"], ["tree", "tab.scene"]].map(([k, l]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{t(l)}</button>
        ))}
      </div>
      <div className="scroll">
        {tab === "exp" && <Experiments eng={eng} t={t} live={live} />}
        {tab === "lib" && <Library eng={eng} t={t} live={live} />}
        {tab === "tree" && <Hierarchy eng={eng} t={t} />}
      </div>
    </aside>
  );
}

function Experiments({ eng, t, live }: { eng: LabEngine; t: T; live: Live }) {
  const cat = live.cat;
  const mod = eng.module;
  return (
    <>
      <div className="cats">
        {CATS.map((c) => (
          <button key={c.id} className={cat === c.id ? "on" : ""} onClick={() => eng.setCategory(c.id)} title={t("cat." + c.id)}>
            <span>{c.icon}</span><small>{t("cat." + c.id)}</small>
          </button>
        ))}
      </div>
      {cat === "mechanics" ? (
        <Section title={t("sec.mechPresets")}>
          <Btn onClick={() => eng.newSandbox()} active={!eng.presetId} tip={t("tip.sandbox")}>{t("exp.sandbox")}</Btn>
          <div className="list">
            {PRESETS.filter((p) => p.cat === "mechanics").map((p) => (
              <button key={p.id} className={`item ${eng.presetId === p.id ? "on" : ""}`} onClick={() => eng.loadPreset(p.id)} title={t("pre." + p.id + ".desc")}>
                <span>{t("pre." + p.id)}</span>
              </button>
            ))}
          </div>
        </Section>
      ) : (
        <>
          <Section title={t("sec.featured")}>
            <div className="list">
              {PRESETS.filter((p) => p.cat === cat).map((p) => (
                <button key={p.id} className={`item ${eng.presetId === p.id ? "on" : ""}`} onClick={() => eng.loadPreset(p.id)} title={t("pre." + p.id + ".desc")}><span>{t("pre." + p.id)}</span></button>
              ))}
            </div>
          </Section>
          <Section title={t("sec.experiments")}>
            <div className="list">
              {mod?.modes.map((m) => (
                <button key={m.id} className={`item ${mod.mode === m.id && !eng.presetId ? "on" : ""}`} onClick={() => eng.setModuleMode(m.id)}><span>{t(m.label)}</span></button>
              )) ?? <small>{t("msg.loading")}</small>}
            </div>
          </Section>
        </>
      )}
      <p className="hint">{t("exp.hintUnits")}</p>
    </>
  );
}

function Library({ eng, t, live }: { eng: LabEngine; t: T; live: Live }) {
  const mech = live.cat === "mechanics";
  const [kind, setKind] = useState<JointKind>("revolute");
  const [axis, setAxis] = useState<0 | 1 | 2>(2);
  const [off, setOff] = useState<V3>([0, 1.5, 0]);
  const [k, setK] = useState(50);
  const [c, setC] = useState(1);
  const [limit, setLimit] = useState(false);
  const [lo, setLo] = useState(-0.8);
  const [hi, setHi] = useState(0.8);
  if (!mech) return <p className="hint">{t("msg.mechOnly")}</p>;
  const sel = eng.selection.length;
  return (
    <>
      <Section title={t("sec.library")}>
        <div className="grid4">
          {SHAPES.map((s) => (
            <button key={s} className="tile" onClick={() => eng.addObject(s)} title={t("tip.add", { name: t("obj." + s) })}><b>{ICON[s]}</b><small>{t("obj." + s)}</small></button>
          ))}
          {ASSEMBLIES.map((s) => {
            const a = s === "pulley_a" ? "pulley" : s;
            return <button key={s} className="tile asm" onClick={() => eng.addAssembly(a)} title={t("tip.assembly")}><b>{s === "pulley_a" ? "⛭" : ICON[s]}</b><small>{t("asm." + a)}</small></button>;
          })}
        </div>
      </Section>
      <Section title={t("sec.edit")}>
        <div className="btnrow">
          <Btn onClick={() => eng.duplicateSelected()} disabled={!sel} tip={t("tip.duplicate")}>⧉ {t("act.duplicate")}</Btn>
          <Btn onClick={() => eng.deleteSelected()} disabled={!sel} kind="danger" tip={t("tip.delete")}>🗑 {t("act.delete")}</Btn>
          <Btn onClick={() => eng.groupSelected()} disabled={sel < 2} tip={t("tip.group")}>{t("act.group")}</Btn>
          <Btn onClick={() => eng.ungroupSelected()} disabled={!sel} tip={t("tip.ungroup")}>{t("act.ungroup")}</Btn>
          <Btn onClick={() => eng.toggleLock()} disabled={!sel} tip={t("tip.lock")}>🔒 {t("act.lock")}</Btn>
          <Btn onClick={() => eng.selectAll()} tip={t("tip.selectAll")}>{t("act.selectAll")}</Btn>
        </div>
        <div className="sub">{t("act.align")}</div>
        {[0, 1, 2].map((ax) => (
          <div key={ax} className="btnrow tight">
            <span className={`axl ax${ax}`}>{"XYZ"[ax]}</span>
            {(["min", "center", "max"] as const).map((m) => <Btn key={m} small disabled={sel < 2} onClick={() => eng.align(ax as 0 | 1 | 2, m)} tip={t("tip.align")}>{t("align." + m)}</Btn>)}
          </div>
        ))}
      </Section>
      <Section title={t("sec.connect")}>
        <p className="hint">{t("conn.hint", { n: sel })}</p>
        <label className="sel-row"><span>{t("conn.type")}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as JointKind)}>
            {(["fixed", "revolute", "prismatic", "spherical", "spring", "distance"] as JointKind[]).map((j) => <option key={j} value={j}>{t("joint." + j)}</option>)}
          </select>
        </label>
        {(kind === "revolute" || kind === "prismatic") && (
          <>
            <div className="sub">{t("conn.axis")}</div>
            <Seg value={axis} onChange={setAxis} options={[{ v: 0, label: "X" }, { v: 1, label: "Y" }, { v: 2, label: "Z" }]} />
            <Toggle label={t("conn.limit")} value={limit} onChange={setLimit} />
            {limit && <><Field label={t("conn.lo")} value={lo} min={-3.1} max={0} step={0.05} onChange={setLo} unit={kind === "revolute" ? "rad" : "m"} /><Field label={t("conn.hi")} value={hi} min={0} max={3.1} step={0.05} onChange={setHi} unit={kind === "revolute" ? "rad" : "m"} /></>}
          </>
        )}
        {kind === "spring" && (<><Field label={t("conn.k")} value={k} min={1} max={1000} step={1} onChange={setK} unit="N/m" /><Field label={t("conn.c")} value={c} min={0} max={50} step={0.1} onChange={setC} unit="N·s/m" /></>)}
        {sel === 1 && <Vec3 label={t("conn.offset")} value={off} onChange={setOff} unit="m" />}
        <Btn kind="primary" disabled={sel < 1 || sel > 2} onClick={() => eng.addJoint(kind, { axis, off, k, c, limit, lo, hi })}>{t("conn.create")}</Btn>
      </Section>
    </>
  );
}

function Hierarchy({ eng, t }: { eng: LabEngine; t: T }) {
  const [openJ, setOpenJ] = useState<string | null>(null);
  const objs = eng.data.objects;
  const name = (id: string | null) => { if (!id) return t("conn.world"); const i = objs.findIndex((o) => o.id === id); return i < 0 ? "?" : objName(objs[i], t, i); };
  const groups = [...new Set(objs.map((o) => o.group).filter(Boolean))] as string[];
  const gi = (g: string | null) => (g ? groups.indexOf(g) + 1 : 0);
  return (
    <>
      <Section title={`${t("sec.hierarchy")} (${objs.length})`}>
        {objs.length === 0 && <p className="hint">{t("msg.emptyScene")}</p>}
        <div className="list">
          {objs.map((o, i) => (
            <button key={o.id} className={`item ${eng.selection.includes(o.id) ? "on" : ""}`} onClick={(e) => eng.selectIds([o.id], e.shiftKey || e.ctrlKey || e.metaKey)}>
              <span><b className="ico">{ICON[o.kind] ?? "◼"}</b> {objName(o, t, i)}</span>
              <span className="tags">
                {o.group && <i className={`tag g${gi(o.group) % 5}`}>G{gi(o.group)}</i>}
                {o.isStatic && <i className="tag">S</i>}
                {o.locked && <i className="tag">🔒</i>}
              </span>
            </button>
          ))}
        </div>
      </Section>
      <Section title={`${t("sec.joints")} (${eng.data.joints.length})`}>
        {eng.data.joints.length === 0 && <p className="hint">{t("msg.noJoints")}</p>}
        {eng.data.joints.map((j) => (
          <div key={j.id} className="jrow">
            <div className="item" onClick={() => setOpenJ(openJ === j.id ? null : j.id)}>
              <span>{t("joint." + j.kind)}: {name(j.a)} → {name(j.b)}</span>
              <button className="x" onClick={(e) => { e.stopPropagation(); eng.removeJoint(j.id); }} title={t("act.delete")}>✕</button>
            </div>
            {openJ === j.id && (j.kind === "spring" || j.kind === "distance") && (
              <div className="jedit">
                {j.kind === "spring" && <Field label={t("conn.k")} value={j.k} min={1} max={2000} step={1} unit="N/m" onChange={(v) => eng.editJoint(j.id, { k: v })} />}
                {j.kind === "spring" && <Field label={t("conn.c")} value={j.c} min={0} max={100} step={0.1} unit="N·s/m" onChange={(v) => eng.editJoint(j.id, { c: v })} />}
                <Field label={t("conn.len")} value={j.len} min={0.05} max={20} step={0.05} unit="m" onChange={(v) => eng.editJoint(j.id, { len: v })} />
              </div>
            )}
          </div>
        ))}
      </Section>
    </>
  );
}

export { presetById };
