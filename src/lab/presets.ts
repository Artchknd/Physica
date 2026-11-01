import { makeObject } from "./shapes";
import type { PhysicsSim } from "./physics";
import { uid, type EnvData, type JointData, type ObjData, type ParamDef, type Readout, type V3 } from "./types";

export interface Sample { t: number; p: V3; v: V3; a: V3; F: V3; ek: number; ep: number; e: number; sys: number }
export interface Ctx { sim: PhysicsSim; v: Record<string, number>; hist: Sample[]; t: number; ids: string[] }
export interface Built { objects: ObjData[]; joints: JointData[]; env?: Partial<EnvData>; track?: string; trails?: boolean; camera?: { pos: V3; target: V3 } }
export interface Preset {
  id: string;
  cat: "mechanics" | "optics" | "waves" | "em" | "thermo";
  module?: { mode: string; values?: Record<string, number> };
  params?: ParamDef[];
  build?: (v: Record<string, number>) => Built;
  readouts?: (c: Ctx) => Readout[];
}

const P = (key: string, min: number, max: number, step: number, value: number, unit?: string, extra: Partial<ParamDef> = {}): ParamDef =>
  ({ key, label: "pp." + key, min, max, step, value, unit, ...extra });

function J(p: Partial<JointData> & { kind: JointData["kind"]; a: string }): JointData {
  return { id: uid("j"), b: null, pa: [0, 0, 0], pb: [0, 0, 0], axA: [0, 0, 1], axB: [0, 0, 1], k: 0, c: 0, len: 0, lim: null, pts: [], ...p };
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const G = 9.80665;

/** period of oscillation from successive upward zero crossings of (f - level) */
export function measurePeriod(hist: Sample[], f: (s: Sample) => number, level: number): number {
  const cr: number[] = [];
  for (let i = 1; i < hist.length; i++) {
    const a = f(hist[i - 1]) - level, b = f(hist[i]) - level;
    if (a < 0 && b >= 0) cr.push(hist[i - 1].t + (hist[i].t - hist[i - 1].t) * (-a / (b - a)));
  }
  if (cr.length < 2) return NaN;
  const n = Math.min(3, cr.length - 1);
  return (cr[cr.length - 1] - cr[cr.length - 1 - n]) / n;
}
function agm(a: number, b: number) { for (let i = 0; i < 20; i++) { const x = (a + b) / 2; b = Math.sqrt(a * b); a = x; } return a; }

const last = (c: Ctx) => c.hist[c.hist.length - 1];

function collisionBuild(v: Record<string, number>, e: number): Built {
  const r = Math.sqrt(e);
  const base = { friction: 0, restitution: r, angDamp: 0, linDamp: 0 } as Partial<ObjData>;
  const s1 = Math.cbrt(v.m1 / 2), s2 = Math.cbrt(v.m2 / 2);
  const a = makeObject("cube", { id: "c1", mass: v.m1, scale: [s1, s1, s1], pos: [-5, s1 / 2 + 0.001, 0], lv: [v.v1, 0, 0], color: "#4f8cff", ...base });
  const b = makeObject("cube", { id: "c2", mass: v.m2, scale: [s2, s2, s2], pos: [0, s2 / 2 + 0.001, 0], color: "#ff9f1c", ...base });
  return { objects: [a, b], joints: [], track: "c1", camera: { pos: [-1, 4, 11], target: [-1, 0.5, 0] } };
}
function collisionReadouts(c: Ctx, e: number): Readout[] {
  const { m1, m2, v1 } = c.v;
  const o1 = c.sim.observe("c1"), o2 = c.sim.observe("c2");
  if (!o1 || !o2) return [];
  const p0 = m1 * v1, k0 = 0.5 * m1 * v1 * v1;
  const p = o1.mom[0] + o2.mom[0], k = o1.ekT + o2.ekT;
  return [
    { label: "ro.p0", value: p0, unit: "kg·m/s", digits: 3 }, { label: "ro.pNow", value: p, unit: "kg·m/s", digits: 3 },
    { label: "ro.dp", value: ((p - p0) / p0) * 100, unit: "%", digits: 3 },
    { label: "ro.ek0", value: k0, unit: "J", digits: 3 }, { label: "ro.ekNow", value: k, unit: "J", digits: 3 },
    { label: "ro.v1Theory", value: ((m1 - e * m2) * v1) / (m1 + m2), unit: "m/s", digits: 3 }, { label: "ro.v1Meas", value: o1.v[0], unit: "m/s", digits: 3 },
    { label: "ro.v2Theory", value: ((1 + e) * m1 * v1) / (m1 + m2), unit: "m/s", digits: 3 }, { label: "ro.v2Meas", value: o2.v[0], unit: "m/s", digits: 3 },
    { label: "ro.keLossTheory", value: 0.5 * ((m1 * m2) / (m1 + m2)) * (1 - e * e) * v1 * v1, unit: "J", digits: 3 },
  ];
}

function plankScene(angle: number, mu: number, bodyKind: "cube" | "sphere", mass: number, rolling: boolean): Built {
  const th = (angle * Math.PI) / 180, L = 9, t = 0.2, cs = Math.cos(th), sn = Math.sin(th);
  const cx = 0, cy = (L / 2) * sn + (t / 2) * cs + 0.02;
  const plank = makeObject("beam", { id: "plank", scale: [L, t, 3], pos: [cx, cy, 0], rot: [0, 0, -th], isStatic: true, friction: 1, material: "wood" });
  const sz = bodyKind === "cube" ? 0.9 : 0.8, s = -3.2;
  const u: [number, number] = [cs, -sn], n: [number, number] = [sn, cs];
  const off = t / 2 + sz / 2 + 0.004;
  const pos: V3 = [cx + u[0] * s + n[0] * off, cy + u[1] * s + n[1] * off, 0];
  const body = makeObject(bodyKind, { id: "blk", scale: [sz, sz, sz], mass, pos, rot: [0, 0, -th], friction: mu, restitution: 0, angDamp: rolling ? 0 : 0.02, color: "#4f8cff" });
  const stop = makeObject("cube", { id: "stop", scale: [0.3, 1, 3], pos: [L / 2 * cs + 0.9, 0.5, 0], isStatic: true, material: "concrete" });
  return { objects: [plank, body, stop], joints: [], track: "blk", camera: { pos: [0, 4.5, 14], target: [0, 2, 0] } };
}

export const PRESETS: Preset[] = [
  {
    id: "newton", cat: "mechanics",
    params: [P("F", 0, 60, 0.5, 20, "N"), P("m", 1, 20, 0.5, 5, "kg"), P("mu", 0, 0.6, 0.01, 0.1)],
    build: (v) => ({ objects: [makeObject("cube", { id: "blk", mass: v.m, friction: v.mu, restitution: 0, force: [v.F, 0, 0], pos: [-6, 0.51, 0], color: "#4f8cff", angDamp: 1 }),
      makeObject("cube", { id: "ref", mass: 20, scale: [0.3, 0.3, 0.3], pos: [4, 0.16, 2], isStatic: true, color: "#ffd166" })], joints: [], track: "blk", trails: false, camera: { pos: [0, 4, 13], target: [0, 0.5, 0] } }),
    readouts: (c) => {
      const o = c.sim.observe("blk"); if (!o) return [];
      const { F, m, mu } = c.v, fk = mu * m * G, aT = Math.max(0, (F - fk) / m), t = Math.max(c.t, 1e-6);
      return [{ label: "ro.fNet", value: Math.max(0, F - fk), unit: "N", digits: 3 }, { label: "ro.aTheory", value: aT, unit: "m/s²", digits: 3 },
        { label: "ro.aMeas", value: o.v[0] / t, unit: "m/s²", digits: 3 }, { label: "ro.fma", value: o.mass * (o.v[0] / t), unit: "N", digits: 3 },
        { label: "ro.fFric", value: Math.min(F, fk), unit: "N", digits: 3 }, { label: "ro.vNow", value: o.v[0], unit: "m/s", digits: 3 }];
    },
  },
  {
    id: "freefall", cat: "mechanics",
    params: [P("h", 1, 40, 0.5, 15, "m"), P("m", 0.1, 20, 0.1, 5, "kg"), P("air", 0, 1, 1, 0, undefined, { type: "toggle" })],
    build: (v) => ({
      objects: [makeObject("sphere", { id: "hv", scale: [0.5, 0.5, 0.5], mass: v.m, material: "metal", pos: [-1, v.h, 0], restitution: 0.3, friction: 0.5 }),
        makeObject("sphere", { id: "lt", scale: [0.5, 0.5, 0.5], mass: 0.02, material: "plastic", color: "#ffd166", pos: [1, v.h, 0], restitution: 0.3, friction: 0.5 })],
      joints: [], track: "hv", env: { air: v.air >= 0.5 }, camera: { pos: [0, v.h * 0.5 + 2, 14 + v.h * 0.6], target: [0, v.h * 0.45, 0] },
    }),
    readouts: (c) => {
      const h = c.v.h - 0.25, tT = Math.sqrt((2 * h) / c.sim.g), vT = Math.sqrt(2 * c.sim.g * h);
      // landing = first velocity reversal (bounce); time/speed extrapolated from the last sample before impact
      let land: { t: number; v: V3 } | undefined;
      for (let i = 1; i < c.hist.length; i++) {
        if (c.hist[i].v[1] > c.hist[i - 1].v[1] + 1 && c.hist[i - 1].v[1] < -0.5) {
          const a = c.hist[i - 1], tau = Math.max(0, (a.p[1] - 0.25) / Math.abs(a.v[1]));
          land = { t: a.t + tau, v: [0, a.v[1] - c.sim.g * tau, 0] };
          break;
        }
      }
      const o2 = c.sim.observe("lt");
      return [{ label: "ro.tFallTheory", value: c.sim.g > 0 ? tT : "∞", unit: "s", digits: 3 }, { label: "ro.tFallMeas", value: land ? land.t : "…", unit: "s", digits: 3 },
        { label: "ro.vImpTheory", value: vT, unit: "m/s", digits: 3 }, { label: "ro.vImpMeas", value: land ? Math.abs(land.v[1]) : "…", unit: "m/s", digits: 3 },
        { label: "ro.lightY", value: o2 ? o2.p[1] : 0, unit: "m", digits: 3 }, { label: "ro.airOn", value: c.sim.air ? "ON" : "OFF" }];
    },
  },
  {
    id: "projectile", cat: "mechanics",
    params: [P("v0", 5, 40, 0.5, 20, "m/s"), P("ang", 5, 85, 1, 45, "°"), P("h0", 0, 10, 0.5, 0, "m"), P("air", 0, 1, 1, 0, undefined, { type: "toggle" })],
    build: (v) => {
      const a = (v.ang * Math.PI) / 180, r = 0.25, bx = Math.cos(a) * 0.9, by = v.h0 + 0.5 + Math.sin(a) * 0.9;
      return { objects: [
        makeObject("cylinder", { id: "barrel", scale: [0.5, 1.6, 0.5], pos: [Math.cos(a) * 0.3, v.h0 + 0.5 + Math.sin(a) * 0.3, 0], rot: [0, 0, a - Math.PI / 2], isStatic: true, color: "#566074" }),
        makeObject("cube", { id: "pillar", scale: [1, v.h0 + 0.5, 1], pos: [0, (v.h0 + 0.5) / 2 - 0.0, 0], isStatic: true, material: "concrete" }),
        makeObject("sphere", { id: "ball", scale: [2 * r, 2 * r, 2 * r], mass: 1, pos: [bx, by, 0], lv: [v.v0 * Math.cos(a), v.v0 * Math.sin(a), 0], restitution: 0, friction: 0.6, color: "#ff6b6b" }),
      ], joints: [], track: "ball", trails: true, env: { air: v.air >= 0.5 }, camera: { pos: [(v.v0 * v.v0) / G / 2, 6, 38], target: [(v.v0 * v.v0) / G / 2, 3, 0] } };
    },
    readouts: (c) => {
      const { v0, ang, h0 } = c.v, a = (ang * Math.PI) / 180, g = c.sim.g;
      const vy = v0 * Math.sin(a), y0 = h0 + 0.5 + Math.sin(a) * 0.9 - 0.25, x0 = Math.cos(a) * 0.9;
      const tF = (vy + Math.sqrt(vy * vy + 2 * g * y0)) / g, R = x0 + v0 * Math.cos(a) * tF, H = y0 + (vy * vy) / (2 * g) + 0.25;
      let maxY = 0, landX: number | string = "…", landT: number | string = "…";
      for (const s of c.hist) { maxY = Math.max(maxY, s.p[1]); }
      for (let i = 1; i < c.hist.length; i++) if (c.hist[i].p[1] <= 0.252 && c.hist[i].t > 0.05) { landX = c.hist[i].p[0]; landT = c.hist[i].t; break; }
      const air = c.sim.air;
      return [{ label: "ro.rangeTheory", value: air ? "—" : R, unit: "m", digits: 3 }, { label: "ro.rangeMeas", value: landX, unit: "m", digits: 3 },
        { label: "ro.hMaxTheory", value: air ? "—" : H, unit: "m", digits: 3 }, { label: "ro.hMaxMeas", value: maxY, unit: "m", digits: 3 },
        { label: "ro.flightTheory", value: air ? "—" : tF, unit: "s", digits: 3 }, { label: "ro.flightMeas", value: landT, unit: "s", digits: 3 },
        { label: "ro.airOn", value: air ? "ON (no closed form)" : "OFF" }];
    },
  },
  {
    id: "incline", cat: "mechanics",
    params: [P("ang", 5, 60, 1, 30, "°"), P("mu", 0, 1, 0.01, 0.2), P("m", 1, 10, 0.5, 2, "kg")],
    build: (v) => plankScene(v.ang, v.mu, "cube", v.m, false),
    readouts: (c) => {
      const o = c.sim.observe("blk"); if (!o) return [];
      const th = (c.v.ang * Math.PI) / 180, g = c.sim.g, t = Math.max(c.t, 1e-6);
      const aT = Math.max(0, g * (Math.sin(th) - c.v.mu * Math.cos(th))), N = c.v.m * g * Math.cos(th);
      return [{ label: "ro.aTheory", value: aT, unit: "m/s²", digits: 3 }, { label: "ro.aMeas", value: o.speed / t, unit: "m/s²", digits: 3 },
        { label: "ro.normal", value: N, unit: "N", digits: 3 }, { label: "ro.fFric", value: c.v.mu * N, unit: "N", digits: 3 },
        { label: "ro.fPar", value: c.v.m * g * Math.sin(th), unit: "N", digits: 3 }, { label: "ro.stateSlide", value: Math.tan(th) > c.v.mu ? "ro.sliding" : "ro.static", tr: true }];
    },
  },
  {
    id: "elastic", cat: "mechanics",
    params: [P("m1", 0.5, 10, 0.5, 2, "kg"), P("m2", 0.5, 10, 0.5, 1, "kg"), P("v1", 1, 10, 0.5, 5, "m/s")],
    build: (v) => collisionBuild(v, 1), readouts: (c) => collisionReadouts(c, 1),
  },
  {
    id: "inelastic", cat: "mechanics",
    params: [P("m1", 0.5, 10, 0.5, 2, "kg"), P("m2", 0.5, 10, 0.5, 3, "kg"), P("v1", 1, 10, 0.5, 5, "m/s"), P("e", 0, 0.9, 0.05, 0, undefined)],
    build: (v) => collisionBuild(v, v.e), readouts: (c) => collisionReadouts(c, c.v.e),
  },
  {
    id: "momentum", cat: "mechanics",
    params: [P("m1", 0.5, 10, 0.5, 2, "kg"), P("m2", 0.5, 10, 0.5, 2, "kg"), P("v1", 1, 10, 0.5, 6, "m/s"), P("b", 0, 0.9, 0.05, 0.5, "m")],
    build: (v) => {
      const base = { friction: 0, restitution: 1, angDamp: 0, linDamp: 0 } as Partial<ObjData>;
      const r1 = 0.5 * Math.cbrt(v.m1 / 2) * 1, r2 = 0.5 * Math.cbrt(v.m2 / 2);
      return { objects: [
        makeObject("sphere", { id: "c1", mass: v.m1, scale: [2 * r1, 2 * r1, 2 * r1], pos: [-5, r1 + 0.001, v.b], lv: [v.v1, 0, 0], color: "#4f8cff", ...base }),
        makeObject("sphere", { id: "c2", mass: v.m2, scale: [2 * r2, 2 * r2, 2 * r2], pos: [0, r2 + 0.001, 0], color: "#ff9f1c", ...base })],
        joints: [], track: "c1", trails: true, camera: { pos: [0, 9, 8], target: [0, 0, 0] } };
    },
    readouts: (c) => {
      const o1 = c.sim.observe("c1"), o2 = c.sim.observe("c2"); if (!o1 || !o2) return [];
      const p0 = c.v.m1 * c.v.v1;
      return [{ label: "ro.p0", value: p0, unit: "kg·m/s", digits: 3 }, { label: "ro.pxNow", value: o1.mom[0] + o2.mom[0], unit: "kg·m/s", digits: 3 },
        { label: "ro.pzNow", value: o1.mom[2] + o2.mom[2], unit: "kg·m/s", digits: 4 },
        { label: "ro.ek0", value: 0.5 * c.v.m1 * c.v.v1 ** 2, unit: "J", digits: 3 }, { label: "ro.ekNow", value: o1.ekT + o2.ekT, unit: "J", digits: 3 },
        { label: "ro.angle1", value: (Math.atan2(o1.v[2], o1.v[0]) * 180) / Math.PI, unit: "°", digits: 2 }, { label: "ro.angle2", value: (Math.atan2(o2.v[2], o2.v[0]) * 180) / Math.PI, unit: "°", digits: 2 }];
    },
  },
  {
    id: "energy", cat: "mechanics",
    params: [P("ang", 10, 45, 1, 25, "°"), P("m", 0.5, 10, 0.5, 2, "kg")],
    build: (v) => {
      const b = plankScene(v.ang, 1, "sphere", v.m, true);
      b.objects[1].friction = 1;
      return b;
    },
    readouts: (c) => {
      const o = c.sim.observe("blk"), s0 = c.hist[0]; if (!o) return [];
      const th = (c.v.ang * Math.PI) / 180, t = Math.max(c.t, 1e-6);
      return [{ label: "ro.aRollTheory", value: (5 / 7) * c.sim.g * Math.sin(th), unit: "m/s²", digits: 3 }, { label: "ro.aMeas", value: o.speed / t, unit: "m/s²", digits: 3 },
        { label: "ro.ekT", value: o.ekT, unit: "J", digits: 3 }, { label: "ro.ekR", value: o.ekR, unit: "J", digits: 3 }, { label: "ro.epNow", value: o.ep, unit: "J", digits: 3 },
        { label: "ro.eTotal", value: o.e, unit: "J", digits: 4 }, { label: "ro.e0", value: s0 ? s0.e : o.e, unit: "J", digits: 4 },
        { label: "ro.ratioRot", value: o.ekT > 1e-9 ? o.ekR / o.ekT : "—", digits: 3 }];
    },
  },
  {
    id: "rotation", cat: "mechanics",
    params: [P("tau", 0.5, 30, 0.5, 8, "N·m"), P("m", 1, 10, 0.5, 4, "kg"), P("r", 0.4, 1.4, 0.05, 1, "m")],
    build: (v) => {
      const wheel = makeObject("wheel", { id: "wh", scale: [2 * v.r, 2 * v.r, 1], mass: v.m, pos: [0, 2.5, 0], torque: [0, 0, v.tau], angDamp: 0, friction: 0.5, color: "#e76f51" });
      const axle = makeObject("rod", { id: "axle", ghost: true, scale: [0.12, 1.2, 0.12], pos: [0, 2.5, 0], rot: [Math.PI / 2, 0, 0], isStatic: true });
      const post = makeObject("cube", { id: "post", scale: [0.3, 2.5, 0.3], pos: [0, 1.25, -0.7], isStatic: true, material: "concrete" });
      return { objects: [wheel, axle, post], joints: [J({ kind: "revolute", a: "wh", b: null, pa: [0, 0, 0], pb: [0, 2.5, 0] })], track: "wh", camera: { pos: [0, 3, 9], target: [0, 2.3, 0] } };
    },
    readouts: (c) => {
      const o = c.sim.observe("wh"); if (!o) return [];
      const I = 0.5 * c.v.m * (c.v.r) ** 2, t = Math.max(c.t, 1e-6);
      return [{ label: "ro.iTheory", value: I, unit: "kg·m²", digits: 4 }, { label: "ro.iMeas", value: Math.abs(o.w[2]) > 1e-6 ? o.L[2] / o.w[2] : "…", unit: "kg·m²", digits: 4 },
        { label: "ro.alphaTheory", value: c.v.tau / I, unit: "rad/s²", digits: 3 }, { label: "ro.alphaMeas", value: o.w[2] / t, unit: "rad/s²", digits: 3 },
        { label: "ro.omega", value: o.w[2], unit: "rad/s", digits: 3 }, { label: "ro.angMom", value: o.L[2], unit: "kg·m²/s", digits: 3 }, { label: "ro.ekR", value: o.ekR, unit: "J", digits: 3 }];
    },
  },
  {
    id: "torque", cat: "mechanics",
    params: [P("m1", 0.5, 10, 0.5, 2, "kg"), P("d1", 0.5, 2.8, 0.1, 2, "m"), P("m2", 0.5, 10, 0.5, 1, "kg"), P("d2", 0.5, 2.8, 0.1, 2, "m")],
    build: (v) => {
      const py = 1.6, bm = 2;
      const beam = makeObject("beam", { id: "beam", scale: [6, 0.14, 0.8], mass: bm, pos: [0, py, 0], material: "wood", angDamp: 0.05, friction: 0.5 });
      const mk = (id: string, m: number, x: number, color: string) => makeObject("cube", { id, mass: m, scale: [0.4, 0.4, 0.4], pos: [x, py + 0.07 + 0.2, 0], color, friction: 0.5 });
      const A = mk("w1", v.m1, -v.d1, "#4f8cff"), B = mk("w2", v.m2, v.d2, "#ff9f1c");
      const fulcrum = makeObject("pyramid", { id: "ful", ghost: true, scale: [0.8, py - 0.01, 0.8], pos: [0, (py - 0.01) / 2, 0], isStatic: true });
      return { objects: [beam, A, B, fulcrum], joints: [
        J({ kind: "revolute", a: "beam", b: null, pa: [0, 0, 0], pb: [0, py, 0], lim: [-0.5, 0.5] }),
        J({ kind: "fixed", a: "beam", b: "w1", pa: sub(A.pos, beam.pos), pb: [0, 0, 0] }), J({ kind: "fixed", a: "beam", b: "w2", pa: sub(B.pos, beam.pos), pb: [0, 0, 0] })],
        track: "beam", camera: { pos: [0, 3, 10], target: [0, 1.5, 0] } };
    },
    readouts: (c) => {
      const o = c.sim.observe("beam"); if (!o) return [];
      const { m1, d1, m2, d2 } = c.v, g = c.sim.g, bm = 2;
      const t1 = m1 * g * d1, t2 = m2 * g * d2, I = (bm * (36 + 0.0196)) / 12 + m1 * d1 * d1 + m2 * d2 * d2;
      return [{ label: "ro.tauLeft", value: t1, unit: "N·m", digits: 3 }, { label: "ro.tauRight", value: t2, unit: "N·m", digits: 3 },
        { label: "ro.tauNet", value: t2 - t1, unit: "N·m", digits: 3, tone: Math.abs(t2 - t1) < 1e-6 ? "ok" : undefined },
        { label: "ro.alphaTheory", value: (t1 - t2) / I, unit: "rad/s²", digits: 3 }, { label: "ro.alphaMeas", value: o.alpha[2], unit: "rad/s²", digits: 3 },
        { label: "ro.omega", value: o.w[2], unit: "rad/s", digits: 3 }, { label: "ro.angleNow", value: (o.rot[2] * 180) / Math.PI, unit: "°", digits: 2 }];
    },
  },
  {
    id: "pendulum", cat: "mechanics",
    params: [P("L", 0.5, 3.5, 0.05, 2, "m"), P("th0", 5, 80, 1, 30, "°"), P("m", 0.2, 5, 0.1, 1, "kg"), P("air", 0, 1, 1, 0, undefined, { type: "toggle" })],
    build: (v) => {
      const th = (v.th0 * Math.PI) / 180, piv: V3 = [0, 4.6, 0], pos: V3 = [Math.sin(th) * v.L, piv[1] - Math.cos(th) * v.L, 0];
      const bob = makeObject("sphere", { id: "bob", scale: [0.3, 0.3, 0.3], mass: v.m, pos, material: "metal", angDamp: 0, restitution: 0.3 });
      const top = makeObject("cube", { id: "top", scale: [1.6, 0.14, 0.5], pos: [0, piv[1] + 0.07, 0], isStatic: true, material: "metal" });
      return { objects: [bob, top], joints: [J({ kind: "revolute", a: "bob", b: null, pa: sub(piv, pos), pb: piv })], track: "bob", trails: true, env: { air: v.air >= 0.5 }, camera: { pos: [0, 3.2, 10], target: [0, 2.8, 0] } };
    },
    readouts: (c) => {
      const { L, th0 } = c.v, g = c.sim.g, T0 = 2 * Math.PI * Math.sqrt(L / g), Tex = T0 / agm(1, Math.cos((th0 * Math.PI) / 360));
      const Tm = measurePeriod(c.hist, (s) => s.p[0], 0);
      const o = c.sim.observe("bob");
      return [{ label: "ro.tSmall", value: g > 0 ? T0 : "∞", unit: "s", digits: 4 }, { label: "ro.tExact", value: g > 0 ? Tex : "∞", unit: "s", digits: 4 },
        { label: "ro.tMeas", value: Number.isFinite(Tm) ? Tm : "…", unit: "s", digits: 4 }, { label: "ro.omegaSmall", value: Math.sqrt(g / L), unit: "rad/s", digits: 3 },
        { label: "ro.tension", value: o ? Math.hypot(o.F[0], o.F[1]) : 0, unit: "N", digits: 2, tone: undefined }];
    },
  },
  {
    id: "double", cat: "mechanics",
    params: [P("L1", 0.8, 2.5, 0.05, 1.5, "m"), P("L2", 0.8, 2.5, 0.05, 1.5, "m"), P("m1", 0.5, 5, 0.1, 1, "kg"), P("m2", 0.5, 5, 0.1, 1, "kg"), P("t1", -170, 170, 1, 100, "°"), P("t2", -170, 170, 1, 20, "°")],
    build: (v) => {
      const piv: V3 = [0, 5, 0], a1 = (v.t1 * Math.PI) / 180, a2 = (v.t2 * Math.PI) / 180;
      const p1: V3 = [Math.sin(a1) * v.L1, piv[1] - Math.cos(a1) * v.L1, 0];
      const p2: V3 = [p1[0] + Math.sin(a2) * v.L2, p1[1] - Math.cos(a2) * v.L2, 0];
      const b1 = makeObject("sphere", { id: "b1", scale: [0.3, 0.3, 0.3], mass: v.m1, pos: p1, material: "metal", angDamp: 0, restitution: 0 });
      const b2 = makeObject("sphere", { id: "b2", scale: [0.3, 0.3, 0.3], mass: v.m2, pos: p2, material: "plastic", color: "#ff6b9d", angDamp: 0, restitution: 0 });
      const top = makeObject("cube", { id: "top", scale: [0.4, 0.2, 0.5], pos: [0, piv[1] + 0.1, 0], isStatic: true, material: "metal" });
      return { objects: [b1, b2, top], joints: [J({ kind: "revolute", a: "b1", b: null, pa: sub(piv, p1), pb: piv }), J({ kind: "revolute", a: "b2", b: "b1", pa: sub(p1, p2), pb: [0, 0, 0] })], track: "b2", trails: true, camera: { pos: [0, 3, 11], target: [0, 2.5, 0] } };
    },
    readouts: (c) => {
      const e = c.sim.systemEnergy(), s0 = c.hist[0], o2 = c.sim.observe("b2");
      return [{ label: "ro.eSys", value: e.total, unit: "J", digits: 4 }, { label: "ro.e0", value: s0 ? s0.sys : e.total, unit: "J", digits: 4 },
        { label: "ro.eDrift", value: s0 ? ((e.total - s0.sys) / Math.abs(s0.sys || 1)) * 100 : 0, unit: "%", digits: 4 },
        { label: "ro.ek", value: e.ek, unit: "J", digits: 3 }, { label: "ro.ep", value: e.ep, unit: "J", digits: 3 }, { label: "ro.speed", value: o2 ? o2.speed : 0, unit: "m/s", digits: 3 }];
    },
  },
  {
    id: "spring", cat: "mechanics",
    params: [P("k", 5, 300, 1, 60, "N/m"), P("m", 0.1, 5, 0.1, 1, "kg"), P("x0", -1.5, 1.5, 0.05, 0.6, "m"), P("c", 0, 5, 0.05, 0, "N·s/m")],
    build: (v) => {
      const top = 6.5, L0 = 2, yEq = top - L0 - (v.m * G) / v.k - 0.25;
      const s = Math.cbrt(v.m / 5) * 0.6 + 0.3;
      const mass = makeObject("cube", { id: "mass", scale: [s, 0.5, s], mass: v.m, pos: [0, yEq - v.x0, 0], restitution: 0, color: "#4f8cff", angDamp: 5 });
      const anchor = makeObject("cube", { id: "anchor", scale: [2, 0.3, 1.2], pos: [0, top + 0.15, 0], isStatic: true, material: "metal" });
      const spring = J({ kind: "spring", a: "mass", b: null, pa: [0, 0.25, 0], pb: [0, top, 0], k: v.k, c: v.c, len: L0 });
      const ruler = makeObject("cube", { id: "mark", ghost: true, scale: [0.9, 0.03, 0.03], pos: [1.6, yEq, 0], isStatic: true, color: "#ffd166", opacity: 0.8 });
      return { objects: [mass, anchor, ruler], joints: [spring], track: "mass", camera: { pos: [0, 3.5, 11], target: [0, 3.5, 0] } };
    },
    readouts: (c) => {
      const { k, m, c: cc } = c.v, g = c.sim.g, yEq = 6.5 - 2 - (m * g) / k - 0.25, o = c.sim.observe("mass"); if (!o) return [];
      const x = yEq - o.p[1];
      const wd = Math.sqrt(Math.max(k / m - (cc / (2 * m)) ** 2, 1e-9)), Tm = measurePeriod(c.hist, (s) => s.p[1], yEq);
      return [{ label: "ro.tTheory", value: (2 * Math.PI) / wd, unit: "s", digits: 4 }, { label: "ro.tMeas", value: Number.isFinite(Tm) ? Tm : "…", unit: "s", digits: 4 },
        { label: "ro.disp", value: x, unit: "m", digits: 3 }, { label: "ro.hooke", value: k * x, unit: "N", digits: 3 }, { label: "ro.ampl", value: Math.abs(c.v.x0), unit: "m", digits: 3 },
        { label: "ro.eSpring", value: c.sim.springEnergy(), unit: "J", digits: 3 }, { label: "ro.eSys", value: c.sim.systemEnergy().total, unit: "J", digits: 4 }];
    },
  },
  {
    id: "gears", cat: "mechanics",
    params: [P("tau", 0.5, 20, 0.5, 5, "N·m"), P("s2", 0.5, 2, 0.01, 1, "×"), P("load", 0, 3, 0.1, 0.3, "N·s·m")],
    build: (v) => {
      const s1 = 2, s2 = v.s2 * 1, n1 = Math.max(8, Math.min(60, Math.round(s1 * 14))), n2 = Math.max(8, Math.min(60, Math.round(s2 * 14)));
      const st1 = (2 * Math.PI) / n1, st2 = (2 * Math.PI) / n2, d = 0.46 * (s1 + s2), y = 3;
      const g1 = makeObject("gear", { id: "g1", scale: [s1, s1, 1], mass: 2, pos: [0, y, 0], rot: [0, 0, -0.32 * st1], torque: [0, 0, v.tau], angDamp: 0, color: "#e9c46a" });
      const g2 = makeObject("gear", { id: "g2", scale: [s2, s2, 1], mass: 1, pos: [d, y, 0], rot: [0, 0, Math.PI - 0.82 * st2], angDamp: v.load, color: "#2a9d8f" });
      const ax1 = makeObject("rod", { id: "ax1", ghost: true, scale: [0.14, 1.2, 0.14], pos: [0, y, 0], rot: [Math.PI / 2, 0, 0], isStatic: true });
      const ax2 = makeObject("rod", { id: "ax2", ghost: true, scale: [0.14, 1.2, 0.14], pos: [d, y, 0], rot: [Math.PI / 2, 0, 0], isStatic: true });
      return { objects: [g1, g2, ax1, ax2], joints: [J({ kind: "revolute", a: "g1", b: null, pb: [0, y, 0] }), J({ kind: "revolute", a: "g2", b: null, pb: [d, y, 0] }), J({ kind: "gear", a: "g1", b: "g2" })], track: "g1", camera: { pos: [d / 2, y + 0.5, 9], target: [d / 2, y, 0] } };
    },
    readouts: (c) => {
      const a = c.sim.observe("g1"), b = c.sim.observe("g2"); if (!a || !b) return [];
      const r1 = 0.46 * 2, r2 = 0.46 * c.v.s2;
      return [{ label: "ro.ratioTheory", value: r1 / r2, digits: 3 }, { label: "ro.ratioMeas", value: Math.abs(a.w[2]) > 1e-6 ? -b.w[2] / a.w[2] : "…", digits: 3 },
        { label: "ro.omega1", value: a.w[2], unit: "rad/s", digits: 3 }, { label: "ro.omega2", value: b.w[2], unit: "rad/s", digits: 3 },
        { label: "ro.tauOut", value: (c.v.tau * r2) / r1, unit: "N·m", digits: 3 }, { label: "ro.pIn", value: c.v.tau * a.w[2], unit: "W", digits: 3 },
        { label: "ro.ekR", value: a.ekR + b.ekR, unit: "J", digits: 3 }];
    },
  },
  {
    id: "cradle", cat: "mechanics",
    params: [P("n", 1, 4, 1, 1, undefined), P("ang", 10, 60, 1, 40, "°"), P("e", 0.8, 1, 0.01, 1)],
    build: (v) => {
      const objs: ObjData[] = [], joints: JointData[] = [], r = 0.5, Lr = 3.6, py = 5.6, th = (v.ang * Math.PI) / 180, rr = Math.sqrt(v.e);
      const frame = makeObject("beam", { id: "frame", scale: [7, 0.18, 1.6], pos: [0, py + 0.09, 0], isStatic: true, material: "metal" });
      objs.push(frame);
      for (let i = 0; i < 5; i++) {
        const px = (i - 2) * (2 * r + 0.002), lifted = i < v.n;
        const pos: V3 = lifted ? [px - Math.sin(th) * Lr, py - Math.cos(th) * Lr, 0] : [px, py - Lr, 0];
        objs.push(makeObject("sphere", { id: "b" + i, scale: [2 * r, 2 * r, 2 * r], mass: 1, pos, material: "metal", friction: 0, restitution: rr, angDamp: 0, linDamp: 0 }));
        joints.push(J({ kind: "revolute", a: "b" + i, b: null, pa: sub([px, py, 0], pos), pb: [px, py, 0] }));
      }
      return { objects: objs, joints, track: "b4", camera: { pos: [0, 3.5, 11], target: [0, 3, 0] } };
    },
    readouts: (c) => {
      const e = c.sim.systemEnergy(), s0 = c.hist[0];
      return [{ label: "ro.pSys", value: e.mom[0], unit: "kg·m/s", digits: 3 }, { label: "ro.eSys", value: e.total, unit: "J", digits: 4 }, { label: "ro.e0", value: s0 ? s0.sys : e.total, unit: "J", digits: 4 },
        { label: "ro.eDrift", value: s0 ? ((e.total - s0.sys) / Math.abs(s0.sys || 1)) * 100 : 0, unit: "%", digits: 3 }];
    },
  },
  {
    id: "pulley", cat: "mechanics",
    params: [P("m1", 0.5, 10, 0.1, 3, "kg"), P("m2", 0.5, 10, 0.1, 2, "kg")],
    build: (v) => {
      const py = 7.5, R = 0.6, sz = (m: number) => 0.4 + Math.cbrt(m) * 0.2;
      const s1 = sz(v.m1), s2 = sz(v.m2), y0 = 4.2;
      const wheel = makeObject("pulley", { id: "wh", scale: [2 * R, 2 * R, 1], pos: [0, py, 0], isStatic: true });
      const sup = makeObject("beam", { id: "sup", scale: [3, 0.2, 0.5], pos: [0, py + R + 0.15, 0], isStatic: true, material: "metal" });
      const A = makeObject("cube", { id: "m1", scale: [s1, s1, s1], mass: v.m1, pos: [-R, y0, 0], color: "#4f8cff", restitution: 0, angDamp: 5 });
      const B = makeObject("cube", { id: "m2", scale: [s2, s2, s2], mass: v.m2, pos: [R, y0, 0], color: "#ff9f1c", restitution: 0, angDamp: 5 });
      const pa: V3 = [0, s1 / 2, 0], pb: V3 = [0, s2 / 2, 0], P1: V3 = [-R, py, 0], P2: V3 = [R, py, 0];
      const len = (y0 + s1 / 2 > py ? 0 : py - (y0 + s1 / 2)) + (py - (y0 + s2 / 2));
      return { objects: [wheel, sup, A, B], joints: [J({ kind: "pulley", a: "m1", b: "m2", pa, pb, pts: [P1, P2], len, wheel: "wh" })], track: "m1", camera: { pos: [0, 5, 14], target: [0, 4.6, 0] } };
    },
    readouts: (c) => {
      const o = c.sim.observe("m1"), { m1, m2 } = c.v, g = c.sim.g, t = Math.max(c.t, 1e-6); if (!o) return [];
      const aT = ((m1 - m2) * g) / (m1 + m2), T = (2 * m1 * m2 * g) / (m1 + m2);
      return [{ label: "ro.aTheory", value: aT, unit: "m/s²", digits: 3 }, { label: "ro.aMeas", value: -o.v[1] / t, unit: "m/s²", digits: 3 },
        { label: "ro.tensionTheory", value: T, unit: "N", digits: 3 }, { label: "ro.tensionMeas", value: m1 * (g + o.a[1]), unit: "N", digits: 2 },
        { label: "ro.vNow", value: o.v[1], unit: "m/s", digits: 3 }];
    },
  },
  { id: "prism", cat: "optics", module: { mode: "dispersion", values: { inc: 50, apex: 60, np: 1.52, disp: 0.012 } } },
  { id: "convex", cat: "optics", module: { mode: "convex", values: { R: 2.2, nl: 1.5, src: 0 } } },
  { id: "circuit", cat: "em", module: { mode: "circuit" } },
  { id: "conduction", cat: "thermo", module: { mode: "conduction", values: { mat: 2, pattern: 0 } } },
];

export const presetById = (id: string) => PRESETS.find((p) => p.id === id);

export function defaultValues(p: Preset): Record<string, number> {
  const v: Record<string, number> = {};
  p.params?.forEach((d) => (v[d.key] = d.value));
  return v;
}
export { last };
