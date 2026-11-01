"use client";
import { MATERIALS } from "@/lab/materials";
import { ENV_G, type LabEngine, type Live, type Tool, type VecKey } from "@/lab/engine";
import { presetById } from "@/lab/presets";
import { volumeOf } from "@/lab/shapes";
import type { EnvKey, MaterialKey, ObjData, ParamDef, V3 } from "@/lab/types";
import { Btn, Field, Section, Seg, Toggle, Vec3 } from "./ui";
import { ReadoutTable, fmtNum } from "./Format";
import { objName } from "./LeftPanel";

type T = (k: string, p?: Record<string, string | number>) => string;
const MATS = Object.keys(MATERIALS) as MaterialKey[];
const D2R = Math.PI / 180;

export function RightPanel({ eng, t, live, tab, setTab }: { eng: LabEngine; t: T; live: Live; tab: string; setTab: (s: string) => void }) {
  const mech = live.cat === "mechanics";
  const tabs = [["exp", "tab.experiment"], ...(mech ? [["props", "tab.properties"]] : []), ["data", "tab.data"], ["env", "tab.settings"]];
  const cur = !mech && tab === "props" ? "exp" : tab;
  return (
    <aside className="panel right">
      <div className="tabs">{tabs.map(([k, l]) => <button key={k} className={cur === k ? "on" : ""} onClick={() => setTab(k)}>{t(l)}</button>)}</div>
      <div className="scroll">
        {cur === "exp" && <ExpTab eng={eng} t={t} live={live} />}
        {cur === "props" && <PropsTab eng={eng} t={t} />}
        {cur === "data" && <DataTab eng={eng} t={t} live={live} />}
        {cur === "env" && <SettingsTab eng={eng} t={t} />}
      </div>
    </aside>
  );
}

function ParamControl({ d, t, tempC, onSet }: { d: ParamDef; t: (k: string) => string; tempC: boolean; onSet: (v: number) => void }) {
  if (d.type === "button") return <Btn onClick={() => onSet(1)}>{t(d.label)}</Btn>;
  if (d.type === "toggle") return <Toggle label={t(d.label)} value={d.value >= 0.5} onChange={(v) => onSet(v ? 1 : 0)} />;
  if (d.type === "select") {
    return (
      <div className="field"><div className="field-label">{t(d.label)}</div>
        <select value={d.value} onChange={(e) => onSet(parseFloat(e.target.value))}>{d.options!.map((o) => <option key={o.v} value={o.v}>{t(o.label)}</option>)}</select>
      </div>
    );
  }
  const isK = d.unit === "K" && tempC;
  const off = isK ? 273.15 : 0;
  return <Field label={t(d.label)} value={+(d.value - off).toFixed(4)} min={d.min - off} max={d.max - off} step={d.step} unit={isK ? "°C" : d.unit} onChange={(v) => onSet(v + off)} tip={d.hint ? t(d.hint) : undefined} />;
}

function ExpTab({ eng, t, live }: { eng: LabEngine; t: T; live: Live }) {
  const tempC = eng.settings.tempUnit === "C";
  const mech = live.cat === "mechanics";
  const p = eng.presetId ? presetById(eng.presetId) : null;
  const mod = eng.module;
  return (
    <>
      {mech ? (
        <>
          <Section title={p ? t("pre." + p.id) : t("exp.sandbox")}>
            <p className="desc">{p ? t("pre." + p.id + ".desc") : t("exp.sandboxDesc")}</p>
            {p?.params?.map((d) => (
              <ParamControl key={d.key} d={{ ...d, value: eng.presetValues[d.key] ?? d.value }} t={t} tempC={tempC} onSet={(v) => eng.setPresetParam(d.key, v)} />
            ))}
          </Section>
          <Section title={t("sec.modelNote")} open={false}><p className="desc small">{t("model.rigid")}</p></Section>
        </>
      ) : mod ? (
        <>
          <Section title={t(mod.modes.find((m) => m.id === mod.mode)?.label ?? "")}>
            <p className="desc">{live.moduleInfo ? t(live.moduleInfo.desc) : ""}</p>
            {mod.params().map((d) => <ParamControl key={d.key} d={d} t={t} tempC={tempC} onSet={(v) => eng.setModuleParam(d.key, v)} />)}
          </Section>
          <Section title={t("sec.modelNote")}><p className="desc small">{live.moduleInfo ? t(live.moduleInfo.model) : ""}</p></Section>
        </>
      ) : <p className="hint">{t("msg.loading")}</p>}
    </>
  );
}

function PropsTab({ eng, t }: { eng: LabEngine; t: T }) {
  const sel = eng.selection.map((id) => eng.obj(id)).filter(Boolean) as ObjData[];
  if (!sel.length) return <p className="hint pad">{t("props.none")}</p>;
  const o = sel[0], ids = sel.map((x) => x.id), idx = eng.data.objects.indexOf(o);
  const set = (patch: Partial<ObjData>, tag = "p") => eng.edit(ids, patch, tag);
  const vol = volumeOf(o.kind, o.scale);
  const rotDeg = o.rot.map((r) => +(r / D2R).toFixed(2)) as V3;
  return (
    <>
      <Section title={sel.length > 1 ? t("props.multi", { n: sel.length }) : objName(o, t, idx)}>
        {sel.length === 1 && (
          <label className="sel-row"><span>{t("props.name")}</span><input className="txt" value={o.name ?? ""} placeholder={objName({ ...o, name: undefined }, t, idx)} onChange={(e) => eng.renameObject(o.id, e.target.value)} /></label>
        )}
        <div className="btnrow">
          <Toggle label={t("props.static")} value={o.isStatic} onChange={(v) => set({ isStatic: v }, "st")} tip={t("tip.static")} />
          <Toggle label={t("props.locked")} value={o.locked} onChange={(v) => set({ locked: v }, "lk")} tip={t("tip.lock")} />
          <Toggle label={t("props.ghost")} value={!!o.ghost} onChange={(v) => set({ ghost: v || undefined }, "gh")} tip={t("tip.ghost")} />
        </div>
      </Section>
      <Section title={t("sec.transform")}>
        <Vec3 label={t("props.position")} unit="m" value={o.pos} onChange={(v) => set({ pos: v }, "pos")} disabled={o.locked} />
        <Vec3 label={t("props.rotation")} unit="°" step={5} value={rotDeg} onChange={(v) => set({ rot: v.map((d) => d * D2R) as V3 }, "rot")} disabled={o.locked} />
        <Vec3 label={t("props.scale")} unit="m" value={o.scale} onChange={(v) => set({ scale: v }, "scl")} disabled={o.locked} />
      </Section>
      <Section title={t("sec.physics")}>
        {!o.isStatic && (
          <>
            <Field label={t("props.mass")} unit="kg" value={+o.mass.toFixed(4)} min={0.01} max={500} step={0.05} onChange={(v) => set({ mass: v }, "mass")} />
            <Field label={t("props.density")} unit="kg/m³" value={+(o.mass / vol).toFixed(2)} min={10} max={20000} step={10} onChange={(v) => set({ mass: Math.max(0.001, v * vol) }, "dens")} slider={false} tip={t("tip.density")} />
          </>
        )}
        <Field label={t("props.friction")} value={o.friction} min={0} max={2} step={0.01} onChange={(v) => set({ friction: v }, "fr")} tip={t("tip.friction")} />
        <Field label={t("props.restitution")} value={o.restitution} min={0} max={1} step={0.01} onChange={(v) => set({ restitution: v }, "re")} tip={t("tip.restitution")} />
        {!o.isStatic && (
          <>
            <Field label={t("props.gravityScale")} value={o.gravityScale} min={-2} max={3} step={0.05} onChange={(v) => set({ gravityScale: v }, "gs")} tip={t("tip.gravityScale")} />
            <Field label={t("props.linDamp")} value={o.linDamp} min={0} max={5} step={0.01} onChange={(v) => set({ linDamp: v }, "ld")} />
            <Field label={t("props.angDamp")} value={o.angDamp} min={0} max={5} step={0.01} onChange={(v) => set({ angDamp: v }, "ad")} />
            <Vec3 label={t("props.lv")} unit="m/s" value={o.lv} onChange={(v) => set({ lv: v }, "lv")} />
            <Vec3 label={t("props.av")} unit="rad/s" value={o.av} onChange={(v) => set({ av: v }, "av")} />
            <Vec3 label={t("props.force")} unit="N" value={o.force} onChange={(v) => set({ force: v }, "f")} />
            <Vec3 label={t("props.torque")} unit="N·m" value={o.torque} onChange={(v) => set({ torque: v }, "tq")} />
          </>
        )}
      </Section>
      <Section title={t("sec.material")}>
        <div className="mats">
          {MATS.map((m) => <button key={m} className={`mat ${o.material === m ? "on" : ""}`} style={{ ["--c" as string]: MATERIALS[m].color }} onClick={() => eng.setMaterial(ids, m)} title={t("mat." + m)}><i /><small>{t("mat." + m)}</small></button>)}
        </div>
        <label className="sel-row"><span>{t("props.color")}</span><input type="color" value={o.color} onChange={(e) => set({ color: e.target.value }, "col")} /></label>
        <Field label={t("props.roughness")} value={o.roughness} min={0} max={1} step={0.01} onChange={(v) => set({ roughness: v }, "rou")} />
        <Field label={t("props.metalness")} value={o.metalness} min={0} max={1} step={0.01} onChange={(v) => set({ metalness: v }, "met")} />
        <Field label={t("props.opacity")} value={o.opacity} min={0.05} max={1} step={0.01} onChange={(v) => set({ opacity: v }, "opa")} tip={t("tip.opacity")} />
        <Field label={t("props.emissive")} value={o.emissive} min={0} max={5} step={0.05} onChange={(v) => set({ emissive: v }, "emi")} />
      </Section>
    </>
  );
}

function Row({ k, v, u, t }: { k: string; v: string; u?: string; t: T }) { return <tr><td>{t(k)}</td><td className="v">{v}{u && <em> {u}</em>}</td></tr>; }
const f3 = (a: V3, d = 3) => `(${a.map((x) => fmtNum(x, d)).join(", ")})`;

function DataTab({ eng, t, live }: { eng: LabEngine; t: T; live: Live }) {
  const tempC = eng.settings.tempUnit === "C";
  const o = live.obs;
  const mech = live.cat === "mechanics";
  const selObj = live.obsId ? eng.obj(live.obsId) : null;
  const sw = live.stopwatch;
  const vk: VecKey[] = ["v", "a", "F", "p", "g"];
  return (
    <>
      {mech && o && (
        <Section title={`${t("sec.liveObject")}: ${selObj ? objName(selObj, t, eng.data.objects.indexOf(selObj)) : ""}`} right={<small className="badge">{t("data.fromSim")}</small>}>
          <table className="rt"><tbody>
            <Row t={t} k="m.pos" v={f3(o.p)} u="m" />
            <Row t={t} k="m.rot" v={f3(o.rot.map((r) => r / D2R) as V3, 1)} u="°" />
            <Row t={t} k="m.vel" v={f3(o.v)} u="m/s" />
            <Row t={t} k="m.speed" v={fmtNum(o.speed)} u="m/s" />
            <Row t={t} k="m.angvel" v={f3(o.w)} u="rad/s" />
            <Row t={t} k="m.acc" v={f3(o.a)} u="m/s²" />
            <Row t={t} k="m.mass" v={fmtNum(o.mass)} u="kg" />
            <Row t={t} k="m.force" v={f3(o.F)} u="N" />
            <Row t={t} k="m.mom" v={f3(o.mom)} u="kg·m/s" />
            <Row t={t} k="m.angmom" v={f3(o.L)} u="kg·m²/s" />
            <Row t={t} k="m.ekT" v={fmtNum(o.ekT)} u="J" />
            <Row t={t} k="m.ekR" v={fmtNum(o.ekR)} u="J" />
            <Row t={t} k="m.ep" v={fmtNum(o.ep)} u="J" />
            <Row t={t} k="m.etot" v={fmtNum(o.e)} u="J" />
          </tbody></table>
          {live.sys && <table className="rt sys"><tbody>
            <Row t={t} k="m.sysEk" v={fmtNum(live.sys.ek)} u="J" /><Row t={t} k="m.sysEp" v={fmtNum(live.sys.ep)} u="J" />
            <Row t={t} k="m.sysEs" v={fmtNum(live.sys.es)} u="J" /><Row t={t} k="m.sysE" v={fmtNum(live.sys.total)} u="J" />
            <Row t={t} k="m.sysP" v={fmtNum(live.sys.pmag)} u="kg·m/s" />
          </tbody></table>}
          {live.dist2 !== null && <table className="rt"><tbody><Row t={t} k="m.dist2" v={fmtNum(live.dist2)} u="m" /></tbody></table>}
        </Section>
      )}
      {live.readouts.length > 0 && <Section title={t(mech ? "sec.theoryMeas" : "sec.readouts")}><ReadoutTable rows={live.readouts} t={t} tempC={tempC} /></Section>}
      {mech && (
        <Section title={t("sec.vectors")}>
          {vk.map((k) => <Toggle key={k} label={t("vec." + k)} value={eng.settings.vec[k]} onChange={(v) => { eng.settings.vec[k] = v; eng.emit(); }} />)}
          <Field label={t("vec.scale")} value={eng.settings.vecScale} min={0.2} max={5} step={0.1} onChange={(v) => { eng.settings.vecScale = v; eng.emit(); }} tip={t("tip.vecScale")} />
          <Toggle label={t("vec.trails")} value={eng.settings.trails} onChange={(v) => { eng.settings.trails = v; eng.applySettings(); eng.emit(); }} />
          <p className="hint">{t("vec.note")}</p>
        </Section>
      )}
      {mech && (
        <Section title={t("sec.tools")}>
          <Seg<Tool> value={live.measure.tool} onChange={(v) => eng.setTool(v)} options={[
            { v: "none", label: "✋", tip: t("tool.none") }, { v: "ruler", label: "📏", tip: t("tool.ruler") }, { v: "protractor", label: "📐", tip: t("tool.protractor") }, { v: "inspect", label: "⌖", tip: t("tool.inspect") }]} />
          <p className="hint">{t("tool." + live.measure.tool + ".hint", { n: live.measure.n })}</p>
          {live.measure.result && (
            <table className="rt"><tbody>
              {live.measure.result.kind === "distance" ? (<>
                <Row t={t} k="tool.distance" v={fmtNum(live.measure.result.value, 4)} u="m" />
                <Row t={t} k="tool.delta" v={f3([live.measure.result.dx!, live.measure.result.dy!, live.measure.result.dz!])} u="m" />
              </>) : <Row t={t} k="tool.angle" v={fmtNum(live.measure.result.value, 3)} u="°" />}
            </tbody></table>
          )}
          {live.measure.tool === "inspect" && <table className="rt"><tbody><Row t={t} k="tool.coords" v={live.inspect ? f3(live.inspect, 3) : "—"} u="m" /></tbody></table>}
          {live.measure.tool !== "none" && <Btn small onClick={() => eng.clearMeasure()}>{t("act.clear")}</Btn>}
        </Section>
      )}
      <Section title={t("sec.stopwatch")}>
        <div className="stopwatch">{sw.toFixed(3)} <em>s</em></div>
        <div className="btnrow"><Btn onClick={() => eng.swToggle()} kind="primary">{live.swRunning ? t("act.stop") : t("act.start")}</Btn><Btn onClick={() => eng.swReset()}>{t("act.reset")}</Btn></div>
        <p className="hint">{t("tip.stopwatch")}</p>
      </Section>
    </>
  );
}

function SettingsTab({ eng, t }: { eng: LabEngine; t: T }) {
  const s = eng.settings, env = eng.data.env;
  const upd = () => { eng.applySettings(); eng.emit(); };
  const envs: EnvKey[] = ["earth", "moon", "mars", "zero", "custom"];
  return (
    <>
      <Section title={t("sec.environment")}>
        <div className="envbadge">{t("env.active")}: <b>{t("env." + env.preset)}</b> — g = {fmtNum(env.g, 3)} m/s²</div>
        <div className="seg wrap">
          {envs.map((e) => <button key={e} className={env.preset === e ? "on" : ""} onClick={() => eng.setEnv(e)}>{t("env." + e)}{e !== "custom" && <small> {ENV_G[e as Exclude<EnvKey, "custom">].toFixed(2)}</small>}</button>)}
        </div>
        <Field label={t("env.g")} value={+env.g.toFixed(3)} min={0} max={30} step={0.01} unit="m/s²" onChange={(v) => eng.setEnv("custom", v)} />
        <Toggle label={t("env.air")} value={env.air} onChange={(v) => eng.setAir(v)} tip={t("tip.air")} />
        {env.air && <Field label={t("env.rho")} value={env.rho} min={0.05} max={10} step={0.05} unit="kg/m³" onChange={(v) => eng.setAir(true, v)} />}
      </Section>
      <Section title={t("sec.editing")}>
        <Toggle label={t("set.snap")} value={s.snap} onChange={(v) => { s.snap = v; upd(); }} tip={t("tip.snap")} />
        {s.snap && <><Field label={t("set.snapT")} value={s.snapT} min={0.05} max={2} step={0.05} unit="m" onChange={(v) => { s.snapT = v; upd(); }} /><Field label={t("set.snapR")} value={s.snapR} min={5} max={90} step={5} unit="°" onChange={(v) => { s.snapR = v; upd(); }} /></>}
        <Toggle label={t("set.grid")} value={s.showGrid} onChange={(v) => { s.showGrid = v; upd(); }} />
        <Toggle label={t("set.axes")} value={s.showAxes} onChange={(v) => { s.showAxes = v; upd(); }} />
        <div className="field-label">{t("set.tempUnit")}</div>
        <Seg value={s.tempUnit} onChange={(v) => { s.tempUnit = v; eng.emit(); }} options={[{ v: "K", label: "K" }, { v: "C", label: "°C" }]} />
      </Section>
      <Section title={t("sec.lighting")}>
        <Field label={t("light.ambient")} value={s.ambient} min={0} max={2} step={0.05} onChange={(v) => { s.ambient = v; upd(); }} />
        <Field label={t("light.sun")} value={s.sun} min={0} max={6} step={0.1} onChange={(v) => { s.sun = v; upd(); }} />
        <Field label={t("light.point")} value={s.point} min={0} max={3} step={0.05} onChange={(v) => { s.point = v; upd(); }} />
        <Field label={t("light.spot")} value={s.spot} min={0} max={3} step={0.05} onChange={(v) => { s.spot = v; upd(); }} />
        <div className="field-label">{t("set.shadows")}</div>
        <Seg value={s.shadows} onChange={(v) => { s.shadows = v; upd(); }} options={[{ v: "off", label: t("q.off") }, { v: "low", label: t("q.low") }, { v: "med", label: t("q.med") }, { v: "high", label: t("q.high") }]} />
        <Toggle label={t("set.adaptive")} value={s.adaptive} onChange={(v) => { s.adaptive = v; upd(); }} tip={t("tip.adaptive")} />
      </Section>
    </>
  );
}
