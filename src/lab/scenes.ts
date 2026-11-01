import { SHAPES } from "./shapes";
import { MATERIALS } from "./materials";
import { uid, type ChartSpec, type EnvData, type JointData, type JointKind, type MaterialKey, type ObjData, type SceneData, type ShapeKind, type V3 } from "./types";

export class SceneError extends Error {
  constructor(public key: string) { super(key); }
}

const num = (x: unknown, d: number, lo = -1e6, hi = 1e6) => (typeof x === "number" && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d);
const v3 = (x: unknown, d: V3): V3 => (Array.isArray(x) && x.length === 3 ? [num(x[0], d[0]), num(x[1], d[1]), num(x[2], d[2])] : [...d]);
const KINDS: JointKind[] = ["fixed", "revolute", "prismatic", "spherical", "spring", "distance", "pulley", "gear"];

export function sanitizeScene(raw: unknown): SceneData {
  if (!raw || typeof raw !== "object") throw new SceneError("err.invalidFile");
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.objects)) throw new SceneError("err.invalidFile");
  if (r.objects.length > 400) throw new SceneError("err.tooLarge");
  const objects: ObjData[] = [];
  const ids = new Set<string>();
  for (const o of r.objects as Record<string, unknown>[]) {
    if (!o || typeof o !== "object") continue;
    const kind = o.kind as ShapeKind;
    if (!SHAPES.includes(kind)) continue;
    const mat = (typeof o.material === "string" && o.material in MATERIALS ? o.material : "plastic") as MaterialKey;
    let id = typeof o.id === "string" && o.id ? o.id : uid();
    if (ids.has(id)) id = uid();
    ids.add(id);
    const sc = v3(o.scale, [1, 1, 1]).map((s) => Math.max(0.02, Math.abs(s))) as V3;
    objects.push({
      id, kind, name: typeof o.name === "string" ? o.name.slice(0, 60) : undefined,
      pos: v3(o.pos, [0, 0.5, 0]), rot: v3(o.rot, [0, 0, 0]), scale: sc,
      color: typeof o.color === "string" && /^#[0-9a-fA-F]{6}$/.test(o.color) ? o.color : MATERIALS[mat].color, material: mat,
      roughness: num(o.roughness, MATERIALS[mat].rough, 0, 1), metalness: num(o.metalness, MATERIALS[mat].metal, 0, 1),
      opacity: num(o.opacity, 1, 0.02, 1), emissive: num(o.emissive, 0, 0, 10),
      mass: num(o.mass, 1, 0.001, 1e6), friction: num(o.friction, 0.5, 0, 10), restitution: num(o.restitution, 0.3, 0, 1.5),
      gravityScale: num(o.gravityScale, 1, -10, 10), linDamp: num(o.linDamp, 0, 0, 100), angDamp: num(o.angDamp, 0.02, 0, 100),
      isStatic: !!o.isStatic, locked: !!o.locked, ghost: o.ghost ? true : undefined, group: typeof o.group === "string" ? o.group : null,
      lv: v3(o.lv, [0, 0, 0]), av: v3(o.av, [0, 0, 0]), force: v3(o.force, [0, 0, 0]), torque: v3(o.torque, [0, 0, 0]),
    });
  }
  if (objects.length === 0 && !r.module) throw new SceneError("err.empty");
  const joints: JointData[] = [];
  if (Array.isArray(r.joints)) {
    for (const j of r.joints as Record<string, unknown>[]) {
      if (!j || typeof j !== "object" || !KINDS.includes(j.kind as JointKind)) continue;
      if (typeof j.a !== "string" || !ids.has(j.a)) continue;
      const b = typeof j.b === "string" ? j.b : null;
      if (b !== null && !ids.has(b)) continue;
      joints.push({
        id: typeof j.id === "string" ? j.id : uid("j"), kind: j.kind as JointKind, a: j.a, b,
        pa: v3(j.pa, [0, 0, 0]), pb: v3(j.pb, [0, 0, 0]), axA: v3(j.axA, [0, 0, 1]), axB: v3(j.axB, [0, 0, 1]),
        k: num(j.k, 50, 0, 1e6), c: num(j.c, 0, 0, 1e5), len: num(j.len, 1, 0, 1e3),
        lim: Array.isArray(j.lim) && j.lim.length === 2 ? [num(j.lim[0], -1), num(j.lim[1], 1)] : null,
        pts: Array.isArray(j.pts) ? (j.pts as unknown[]).slice(0, 4).map((p) => v3(p, [0, 0, 0])) : [],
        wheel: typeof j.wheel === "string" && ids.has(j.wheel) ? j.wheel : undefined,
      });
    }
  }
  const e = (r.env ?? {}) as Record<string, unknown>;
  const presets = ["earth", "moon", "mars", "zero", "custom"];
  const env: EnvData = {
    preset: (presets.includes(e.preset as string) ? e.preset : "earth") as EnvData["preset"],
    g: num(e.g, 9.80665, 0, 100), air: !!e.air, rho: num(e.rho, 1.225, 0, 1000),
  };
  const out: SceneData = { v: 1, name: typeof r.name === "string" && r.name ? r.name.slice(0, 80) : "Scene", objects, joints, env };
  const m = r.module as Record<string, unknown> | undefined;
  if (m && typeof m.cat === "string" && typeof m.mode === "string") {
    const values: Record<string, number> = {};
    if (m.values && typeof m.values === "object") for (const [k, v] of Object.entries(m.values as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v)) values[k] = v;
    out.module = { cat: m.cat, mode: m.mode, values, data: m.data };
  }
  if (typeof r.presetId === "string") out.presetId = r.presetId;
  if (r.presetValues && typeof r.presetValues === "object") {
    out.presetValues = {};
    for (const [k, v] of Object.entries(r.presetValues as Record<string, unknown>)) if (typeof v === "number" && Number.isFinite(v)) out.presetValues[k] = v;
  }
  return out;
}

export function parseSceneText(text: string): SceneData {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new SceneError("err.badJson"); }
  return sanitizeScene(raw);
}

// ---------------- local storage ----------------
export interface SavedScene { id: string; name: string; ts: number; data: SceneData }
const KEY = "physlab.scenes.v1";
export function listScenes(): SavedScene[] {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(a) ? a.filter((x) => x && x.id && x.data) : [];
  } catch { return []; }
}
function write(a: SavedScene[]) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { throw new SceneError("err.storage"); }
}
export function saveScene(name: string, data: SceneData, id?: string): SavedScene {
  const a = listScenes();
  const s: SavedScene = { id: id ?? uid("s"), name, ts: Date.now(), data: { ...data, name } };
  const i = a.findIndex((x) => x.id === s.id);
  if (i >= 0) a[i] = s; else a.unshift(s);
  write(a);
  return s;
}
export function renameScene(id: string, name: string) { write(listScenes().map((s) => (s.id === id ? { ...s, name, data: { ...s.data, name } } : s))); }
export function deleteScene(id: string) { write(listScenes().filter((s) => s.id !== id)); }
export function duplicateScene(id: string, suffix: string) {
  const a = listScenes(), s = a.find((x) => x.id === id);
  if (!s) return;
  const c: SavedScene = { id: uid("s"), name: s.name + suffix, ts: Date.now(), data: { ...s.data, name: s.name + suffix } };
  write([c, ...a]);
}

// ---------------- sharing ----------------
export function encodeShare(data: SceneData): string {
  const json = JSON.stringify(data);
  const b = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${location.origin}${location.pathname}#scene=${b}`;
}
export function decodeShare(hash: string): SceneData | null {
  const m = /scene=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m) return null;
  try {
    const b = m[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b + "=".repeat((4 - (b.length % 4)) % 4))));
    return sanitizeScene(JSON.parse(json));
  } catch { return null; }
}

// ---------------- CSV ----------------
export function chartsToCSV(charts: ChartSpec[], t: (k: string) => string): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const rows = ["chart,series,x,y,x_unit,y_unit"];
  for (const c of charts) for (const s of c.series) for (const p of s.pts) rows.push([esc(t(c.title)), esc(t(s.label)), p.x, p.y, esc(c.xUnit ?? ""), esc(c.yUnit ?? "")].join(","));
  return "\uFEFF" + rows.join("\n");
}

export function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
