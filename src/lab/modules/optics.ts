import * as THREE from "three";
import type { ChartSpec, ParamDef, Readout } from "../types";
import { BeamSet, ModuleBase, deg, disposeObject, rad, wavelengthColor, labelSprite } from "./util";

type V2 = THREE.Vector2;
interface Elem { pts: V2[]; ns: V2[]; ne: V2[]; mirror: boolean; closed: boolean }
interface Seg { a: V2; b: V2; I: number; wl: number }

const v2 = (x: number, y: number) => new THREE.Vector2(x, y);

function makeElem(pts: V2[], mirror: boolean, closed: boolean): Elem {
  // ensure CCW for closed polygons so outward normal = (dy,-dx)
  if (closed) {
    let area = 0;
    pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; area += p.x * q.y - q.x * p.y; });
    if (area < 0) pts = pts.slice().reverse();
  }
  const n = pts.length, ne_ = closed ? n : n - 1;
  const en: V2[] = [];
  for (let i = 0; i < ne_; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    en.push(v2(b.y - a.y, -(b.x - a.x)).normalize());
  }
  const smooth = (x: V2, y: V2) => (x.dot(y) > 0.9 ? x.clone().add(y).normalize() : null);
  const ns: V2[] = [], ne: V2[] = [];
  for (let i = 0; i < ne_; i++) {
    const cur = en[i];
    const prev = closed ? en[(i - 1 + ne_) % ne_] : i > 0 ? en[i - 1] : null;
    const next = closed ? en[(i + 1) % ne_] : i < ne_ - 1 ? en[i + 1] : null;
    ns.push((prev && smooth(prev, cur)) || cur.clone());
    ne.push((next && smooth(cur, next)) || cur.clone());
  }
  return { pts, ns, ne, mirror, closed };
}

function traceRay(o: V2, d: V2, elems: Elem[], nOf: (wl: number) => number, wl: number, I0 = 1) {
  const segs: Seg[] = [];
  let pos = o.clone(), dir = d.clone().normalize(), I = I0;
  for (let hit = 0; hit < 24; hit++) {
    let bestT = Infinity, bestN: V2 | null = null, bestE: Elem | null = null;
    for (const e of elems) {
      const n = e.pts.length, ne = e.closed ? n : n - 1;
      for (let i = 0; i < ne; i++) {
        const a = e.pts[i], b = e.pts[(i + 1) % n];
        const ex = b.x - a.x, ey = b.y - a.y;
        const den = dir.x * ey - dir.y * ex;
        if (Math.abs(den) < 1e-12) continue;
        const t = ((a.x - pos.x) * ey - (a.y - pos.y) * ex) / den;
        const u = ((a.x - pos.x) * dir.y - (a.y - pos.y) * dir.x) / den;
        if (t > 1e-6 && u >= 0 && u <= 1 && t < bestT) {
          bestT = t; bestE = e;
          bestN = e.ns[i].clone().lerp(e.ne[i], u).normalize();
        }
      }
    }
    if (!bestE || !bestN) {
      segs.push({ a: pos.clone(), b: pos.clone().addScaledVector(dir, 40), I, wl });
      return { segs, dir, pos, escaped: true };
    }
    const hp = pos.clone().addScaledVector(dir, bestT);
    segs.push({ a: pos.clone(), b: hp, I, wl });
    pos = hp;
    if (bestE.mirror) {
      dir = dir.clone().addScaledVector(bestN, -2 * dir.dot(bestN)).normalize();
    } else {
      const entering = dir.dot(bestN) < 0;
      const N = entering ? bestN.clone() : bestN.clone().negate(); // N opposes dir
      const ng = nOf(wl);
      const n1 = entering ? 1 : ng, n2 = entering ? ng : 1;
      const eta = n1 / n2, cosi = -N.dot(dir), k = 1 - eta * eta * (1 - cosi * cosi);
      if (k < 0) dir = dir.clone().addScaledVector(N, 2 * cosi).normalize();
      else dir = dir.clone().multiplyScalar(eta).addScaledVector(N, eta * cosi - Math.sqrt(k)).normalize();
    }
    pos = pos.clone().addScaledVector(dir, 1e-5);
  }
  return { segs, dir, pos, escaped: false };
}

const WL7 = [650, 600, 580, 532, 490, 470, 420];

export class OpticsModule extends ModuleBase {
  cat = "optics";
  modes = [
    { id: "reflection", label: "opt.reflection" }, { id: "refraction", label: "opt.refraction" },
    { id: "tir", label: "opt.tir" }, { id: "prism", label: "opt.prism" }, { id: "dispersion", label: "opt.dispersion" },
    { id: "convex", label: "opt.convex" }, { id: "concave", label: "opt.concave" }, { id: "mirror", label: "opt.mirror" },
  ];
  private beams = new BeamSet();
  private dyn = new THREE.Group();
  private ro: Readout[] = [];
  private cs: ChartSpec[] = [];
  private mat = new THREE.MeshPhysicalMaterial({ color: "#b8e4ff", transparent: true, opacity: 0.22, roughness: 0.03, metalness: 0, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false });
  private lineMat = new THREE.LineBasicMaterial({ color: "#9fd8ff" });

  constructor() {
    super();
    const L = (k: string, min: number, max: number, step: number, value: number, unit: string | undefined, modes: string[], extra: Partial<ParamDef> = {}): ParamDef =>
      ({ key: k, label: "optp." + k, min, max, step, value, unit, modes, ...extra });
    const defs: ParamDef[] = [
      L("theta", 0, 85, 0.5, 40, "°", ["reflection", "refraction", "tir"]),
      L("dist", 2, 6, 0.1, 4, "m", ["reflection", "refraction", "tir"]),
      L("n1", 1, 2.5, 0.01, 1, undefined, ["refraction", "tir"]),
      L("n2", 1, 2.5, 0.01, 1.5, undefined, ["refraction", "tir"]),
      L("inc", 10, 80, 0.5, 48, "°", ["prism", "dispersion"]),
      L("apex", 30, 80, 1, 60, "°", ["prism", "dispersion"]),
      L("np", 1.2, 2.2, 0.005, 1.52, undefined, ["prism", "dispersion"]),
      L("disp", 0, 0.04, 0.001, 0.012, "µm²", ["dispersion"]),
      L("R", 0.8, 5, 0.05, 2.2, "m", ["convex", "concave", "mirror"]),
      L("nl", 1.2, 2.2, 0.01, 1.5, undefined, ["convex", "concave"]),
      L("h", 0.3, 0.9, 0.05, 0.6, "m", ["convex", "concave", "mirror"]),
      L("src", 0, 1, 1, 0, undefined, ["convex", "concave", "mirror"], { type: "select", options: [{ v: 0, label: "optp.parallel" }, { v: 1, label: "optp.point" }] }),
      L("u", 1.2, 8, 0.05, 4, "m", ["convex", "concave", "mirror"], { hidden: (v) => v.src === 0 }),
      L("yo", -0.6, 0.6, 0.02, 0, "m", ["convex", "concave", "mirror"], { hidden: (v) => v.src === 0 }),
      L("mtype", 0, 2, 1, 1, undefined, ["mirror"], { type: "select", options: [{ v: 0, label: "optp.plane" }, { v: 1, label: "optp.concaveM" }, { v: 2, label: "optp.convexM" }] }),
    ];
    this.setup(defs, {
      reflection: { theta: 40 }, refraction: { n1: 1, n2: 1.5, theta: 40 }, tir: { n1: 1.5, n2: 1, theta: 50 },
      prism: { inc: 48, disp: 0 }, dispersion: { inc: 50, disp: 0.012 },
      convex: { R: 2.2, src: 0 }, concave: { R: 2.2, src: 0 }, mirror: { R: 3, mtype: 1, src: 0 },
    }, "refraction");
    this.group.add(this.dyn, this.beams.group);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(18, 0.2, 5), new THREE.MeshStandardMaterial({ color: "#1d232e", roughness: 0.6, metalness: 0.4 }));
    bench.position.set(0, -3.9, 0);
    bench.receiveShadow = true;
    this.group.add(bench);
  }

  info() { return { desc: "optics.desc." + this.mode, model: "optics.model" }; }
  cameraHint() { return { pos: [0, 0.5, 11] as [number, number, number], target: [0, 0, 0] as [number, number, number] }; }
  protected onMode() { this.rebuild(); }
  update() { if (this.dirty) { this.rebuild(); this.dirty = false; } }
  readouts() { return this.ro; }
  charts() { return this.cs; }
  dispose() { this.beams.dispose(); this.mat.dispose(); this.lineMat.dispose(); disposeObject(this.group); }

  private clearDyn() { this.dyn.children.slice().forEach((c) => { this.dyn.remove(c); disposeObject(c); }); }
  private glassMesh(pts: V2[], color: string, opacity = 1) {
    const sh = new THREE.Shape(pts);
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.6, bevelEnabled: false });
    g.translate(0, 0, -0.3);
    const m = new THREE.Mesh(g, this.mat.clone());
    (m.material as THREE.MeshPhysicalMaterial).color.set(color);
    (m.material as THREE.MeshPhysicalMaterial).opacity = 0.22 * opacity;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 20), this.lineMat);
    m.add(e);
    this.dyn.add(m);
    return m;
  }
  private line(pts: THREE.Vector3[], color: string, dashed = false, op = 0.6) {
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: op }) : new THREE.LineBasicMaterial({ color, transparent: true, opacity: op }));
    if (dashed) l.computeLineDistances();
    this.dyn.add(l);
  }
  private marker(p: V2, color: string, r = 0.07) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), new THREE.MeshBasicMaterial({ color }));
    m.position.set(p.x, p.y, 0);
    this.dyn.add(m);
  }
  private arc(r: number, a0: number, a1: number, color: string, center = v2(0, 0)) {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) { const a = a0 + ((a1 - a0) * i) / 24; pts.push(new THREE.Vector3(center.x + r * Math.cos(a), center.y + r * Math.sin(a), 0)); }
    this.line(pts, color, false, 0.9);
  }
  private drawSegs(segs: Seg[], color?: THREE.ColorRepresentation, rad0 = 0.016) {
    for (const s of segs) {
      const c = color ?? wavelengthColor(s.wl);
      this.beams.add(new THREE.Vector3(s.a.x, s.a.y, 0), new THREE.Vector3(s.b.x, s.b.y, 0), c, Math.max(0.15, s.I), rad0);
    }
  }

  private rebuild() {
    this.clearDyn();
    this.beams.begin();
    this.ro = [];
    this.cs = [];
    const V = this.values;
    if (["reflection", "refraction", "tir"].includes(this.mode)) this.interfaceMode();
    else if (this.mode === "prism" || this.mode === "dispersion") this.prismMode();
    else if (this.mode === "mirror") this.mirrorMode();
    else this.lensMode();
    this.beams.end();
    void V;
  }

  private interfaceMode() {
    const V = this.values, mode = this.mode;
    const n1 = mode === "reflection" ? 1 : V.n1, n2 = mode === "reflection" ? 1 : V.n2;
    const t1 = rad(V.theta), D = V.dist;
    const src = v2(-D * Math.sin(t1), D * Math.cos(t1));
    const nCol = (n: number) => `hsl(${210 - (n - 1) * 90}, 70%, ${55 - (n - 1) * 12}%)`;
    const colUp = new THREE.Color(nCol(n1)).getStyle(), colDn = nCol(n2);
    if (mode === "reflection") {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(9, 0.25, 1.2), new THREE.MeshStandardMaterial({ color: "#c7d0dc", metalness: 1, roughness: 0.08 }));
      slab.position.set(0, -0.125, 0);
      this.dyn.add(slab);
    } else {
      this.glassMesh([v2(-5, 0), v2(5, 0), v2(5, 3.6), v2(-5, 3.6)], new THREE.Color(colUp).getStyle(), n1 > 1.001 ? 1 : 0.15);
      this.glassMesh([v2(-5, -3.6), v2(5, -3.6), v2(5, 0), v2(-5, 0)], colDn, 1);
    }
    this.line([new THREE.Vector3(0, -3.4, 0), new THREE.Vector3(0, 3.4, 0)], "#ffffff", true, 0.5);
    this.marker(src, "#fff2a8", 0.14);
    const sinT2 = (n1 / n2) * Math.sin(t1);
    const tir = sinT2 > 1;
    const t2 = tir ? NaN : Math.asin(sinT2);
    const O = new THREE.Vector3(0, 0, 0);
    const cosi = Math.cos(t1), cost = tir ? 0 : Math.cos(t2);
    let R = 1;
    if (mode === "reflection") R = 1;
    else if (!tir) {
      const rs = (n1 * cosi - n2 * cost) / (n1 * cosi + n2 * cost), rp = (n1 * cost - n2 * cosi) / (n1 * cost + n2 * cosi);
      R = (rs * rs + rp * rp) / 2;
    }
    this.beams.add(new THREE.Vector3(src.x, src.y, 0), O, "#fff0b0", 1, 0.02);
    const refl = new THREE.Vector3(D * Math.sin(t1), D * Math.cos(t1), 0);
    this.beams.add(O, refl, "#ffb066", Math.max(0.12, R), 0.02);
    if (mode !== "reflection" && !tir) {
      const tr = new THREE.Vector3(D * Math.sin(t2), -D * Math.cos(t2), 0);
      this.beams.add(O, tr, "#66e0ff", Math.max(0.12, 1 - R), 0.02);
      this.arc(1.1, -Math.PI / 2, -Math.PI / 2 + t2, "#66e0ff");
    }
    this.arc(1.1, Math.PI / 2 - t1, Math.PI / 2, "#fff0b0");
    this.arc(1.4, Math.PI / 2, Math.PI / 2 + t1, "#ffb066");
    const crit = n1 > n2 ? deg(Math.asin(n2 / n1)) : NaN;
    this.ro = [
      { label: "ro.theta1", value: V.theta, unit: "°", digits: 2 },
      { label: "ro.thetaR", value: V.theta, unit: "°", digits: 2 },
    ];
    if (mode !== "reflection") {
      this.ro.push(
        tir ? { label: "ro.theta2", value: "TIR", tone: "warn" } : { label: "ro.theta2", value: deg(t2), unit: "°", digits: 3 },
        { label: "ro.snell1", value: n1 * Math.sin(t1), digits: 5 },
        { label: "ro.snell2", value: tir ? "—" : n2 * Math.sin(t2), digits: 5 },
        { label: "ro.crit", value: Number.isFinite(crit) ? crit : "—", unit: "°", digits: 2 },
        { label: "ro.reflect", value: R * 100, unit: "%", digits: 2 },
        { label: "ro.transmit", value: (1 - R) * 100, unit: "%", digits: 2 },
      );
    }
    // chart: theta2 vs theta1 and Fresnel
    const pts: { x: number; y: number }[] = [], fr: { x: number; y: number }[] = [];
    for (let a = 0; a <= 89.5; a += 1) {
      const s = ((n1 / n2) * Math.sin(rad(a)));
      if (mode === "reflection") { pts.push({ x: a, y: a }); fr.push({ x: a, y: 100 }); continue; }
      if (s <= 1) {
        const tt = Math.asin(s), ci = Math.cos(rad(a)), ct = Math.cos(tt);
        const rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n1 * ct - n2 * ci) / (n1 * ct + n2 * ci);
        pts.push({ x: a, y: deg(tt) }); fr.push({ x: a, y: ((rs * rs + rp * rp) / 2) * 100 });
      } else fr.push({ x: a, y: 100 });
    }
    this.cs = [
      { id: "snell", title: "ch.snell", xLabel: "ch.theta1", yLabel: "ch.theta2", xUnit: "°", yUnit: "°", series: [
        { label: mode === "reflection" ? "ch.thetaR" : "ch.theta2", color: "#4cc9f0", pts },
        { label: "ch.now", color: "#ffd166", pts: tir ? [] : [{ x: V.theta, y: mode === "reflection" ? V.theta : deg(t2) }], points: true }] },
      { id: "fresnel", title: "ch.fresnel", xLabel: "ch.theta1", yLabel: "ro.reflect", xUnit: "°", yUnit: "%", series: [
        { label: "ro.reflect", color: "#ff9f1c", pts: fr }, { label: "ch.now", color: "#ffd166", pts: [{ x: V.theta, y: R * 100 }], points: true }] },
    ];
  }

  private prismMode() {
    const V = this.values;
    const A = rad(V.apex), H = 2.2;
    const hw = H * Math.tan(A / 2);
    const apex = v2(0, H * 0.6), bl = v2(-hw, -H * 0.4), br = v2(hw, -H * 0.4);
    const elem = makeElem([apex, bl, br], false, true);
    this.glassMesh([apex, bl, br], "#cfe9ff", 1);
    const B = this.mode === "dispersion" ? V.disp : 0;
    const nOf = (wl: number) => V.np + B * (1 / ((wl / 1000) ** 2) - 1 / 0.589 ** 2);
    // left face: apex->bl ; outward normal (-cos(A/2), sin(A/2)) for apex up
    const nL = v2(-Math.cos(A / 2), Math.sin(A / 2));
    const inward = nL.clone().negate();
    const th = rad(V.inc);
    const d = inward.clone().rotateAround(v2(0, 0), th);
    const M = apex.clone().add(bl).multiplyScalar(0.5);
    const origin = M.clone().addScaledVector(d, -5);
    const wls = this.mode === "dispersion" ? WL7 : [589];
    this.beams.add(new THREE.Vector3(origin.x, origin.y, 0), new THREE.Vector3(M.x, M.y, 0), "#ffffff", 1, 0.022);
    this.marker(origin, "#ffffff", 0.14);
    const results: { wl: number; dev: number; dir: V2; ok: boolean }[] = [];
    for (const wl of wls) {
      const tr = traceRay(M.clone().addScaledVector(d, -1e-4), d, [elem], nOf, wl);
      const segs = tr.segs.slice(1);
      this.drawSegs(this.mode === "dispersion" ? segs : segs, this.mode === "dispersion" ? undefined : "#ffe27a", 0.016);
      const dev = deg(Math.atan2(d.x * tr.dir.y - d.y * tr.dir.x, d.dot(tr.dir)));
      results.push({ wl, dev: Math.abs(dev), dir: tr.dir, ok: tr.segs.length <= 3 });
    }
    // theory
    const n = nOf(589), t1 = th;
    const s2 = Math.sin(t1) / n, t2 = Math.asin(Math.min(1, s2)), t3 = A - t2, s4 = n * Math.sin(t3);
    const theory = s4 <= 1 ? deg(t1 + Math.asin(s4) - A) : NaN;
    const dmin = 2 * Math.asin(Math.min(1, n * Math.sin(A / 2))) - A;
    const mid = results.find((r) => r.wl === (this.mode === "dispersion" ? 580 : 589)) ?? results[0];
    this.ro = [
      { label: "ro.devMeasured", value: mid.dev, unit: "°", digits: 3 },
      { label: "ro.devTheory", value: Number.isFinite(theory) ? theory : "TIR", unit: "°", digits: 3, tone: Number.isFinite(theory) ? undefined : "warn" },
      { label: "ro.devMin", value: deg(dmin), unit: "°", digits: 3 },
      { label: "ro.nAt589", value: n, digits: 4 },
    ];
    if (this.mode === "dispersion") {
      const red = results[0], vio = results[results.length - 1];
      this.ro.push({ label: "ro.spread", value: Math.abs(vio.dev - red.dev), unit: "°", digits: 3 }, { label: "ro.nRed", value: nOf(650), digits: 4 }, { label: "ro.nViolet", value: nOf(420), digits: 4 });
    }
    const dv: { x: number; y: number }[] = [];
    for (let a = 5; a <= 85; a += 1) {
      const t3b = A - Math.asin(Math.min(1, Math.sin(rad(a)) / n)), sx = n * Math.sin(t3b);
      if (sx <= 1 && t3b > -1.5) dv.push({ x: a, y: deg(rad(a) + Math.asin(sx) - A) });
    }
    const nl: { x: number; y: number }[] = [];
    for (let w = 400; w <= 700; w += 10) nl.push({ x: w, y: nOf(w) });
    this.cs = [
      { id: "dev", title: "ch.deviation", xLabel: "ch.incidence", yLabel: "ch.dev", xUnit: "°", yUnit: "°", series: [
        { label: "ch.dev", color: "#4cc9f0", pts: dv }, { label: "ch.now", color: "#ffd166", pts: Number.isFinite(theory) ? [{ x: V.inc, y: theory }] : [], points: true }] },
      { id: "cauchy", title: "ch.cauchy", xLabel: "ch.wavelength", yLabel: "ch.index", xUnit: "nm", series: [{ label: "ch.index", color: "#c77dff", pts: nl }] },
    ];
  }

  private lensElems(): { elems: Elem[]; fTheory: number } {
    const V = this.values;
    const R = V.R, h = V.h;
    const convex = this.mode === "convex";
    const N = 48;
    const right: V2[] = [], left: V2[] = [];
    let cx: number, edge: number;
    if (convex) {
      edge = 0.02;
      const half = R - Math.sqrt(Math.max(R * R - h * h, 0)) + edge;
      cx = half - R;
      for (let i = 0; i <= N; i++) { const y = -h + (2 * h * i) / N; right.push(v2(cx + Math.sqrt(R * R - y * y), y)); }
    } else {
      edge = 0.12;
      cx = edge + Math.sqrt(Math.max(R * R - h * h, 0));
      for (let i = 0; i <= N; i++) { const y = -h + (2 * h * i) / N; right.push(v2(cx - Math.sqrt(R * R - y * y), y)); }
    }
    for (let i = N; i >= 0; i--) left.push(v2(-right[i].x, right[i].y));
    const poly = [...right, ...left];
    const f = (convex ? 1 : -1) * R / (2 * (V.nl - 1));
    return { elems: [makeElem(poly, false, true)], fTheory: f };
  }

  private sources(xs: number, yo: number, h: number, parallel: boolean, count = 9) {
    const out: { o: V2; d: V2 }[] = [];
    for (let i = 0; i < count; i++) {
      const y = -0.85 * h + (1.7 * h * i) / (count - 1);
      if (parallel) out.push({ o: v2(-7, y), d: v2(1, 0) });
      else out.push({ o: v2(xs, yo), d: v2(-xs * 0 + Math.abs(xs), y - yo) });
    }
    return out;
  }

  private crossing(r: { pos: V2; dir: V2 }): number {
    if (Math.abs(r.dir.y) < 1e-9) return NaN;
    return r.pos.x + (-r.pos.y / r.dir.y) * r.dir.x;
  }

  private lensMode() {
    const V = this.values;
    const { elems, fTheory } = this.lensElems();
    this.glassMesh(elems[0].pts, "#bfe3ff", 1);
    const nOf = () => V.nl;
    const parallel = V.src === 0;
    const xs = -V.u;
    this.line([new THREE.Vector3(-8, 0, 0), new THREE.Vector3(8, 0, 0)], "#ffffff", true, 0.35);
    [-fTheory, fTheory].forEach((fx) => this.marker(v2(fx, 0), "#ffd166", 0.05));
    const srcs = this.sources(xs, V.yo, V.h, parallel);
    if (!parallel) this.marker(v2(xs, V.yo), "#fff2a8", 0.13);
    let ends: { pos: V2; dir: V2 }[] = [];
    for (const s of srcs) {
      const r = traceRay(s.o, s.d, elems, nOf, 589);
      // clip final segment
      this.drawSegs(r.segs.map((g, i) => (i === r.segs.length - 1 ? { ...g, b: g.a.clone().addScaledVector(r.dir, 9) } : g)), "#ffe27a", 0.012);
      ends.push({ pos: r.segs[r.segs.length - 1].a, dir: r.dir });
      if (r.dir.x < -1e-6 || (fTheory < 0)) {
        // virtual extension (backwards) for diverging output
        const last = r.segs[r.segs.length - 1];
        if (fTheory < 0 || Math.sign(r.dir.y) * Math.sign(last.a.y) > 0) {
          this.line([new THREE.Vector3(last.a.x, last.a.y, 0), new THREE.Vector3(last.a.x - r.dir.x * 4, last.a.y - r.dir.y * 4, 0)], "#ffe27a", true, 0.3);
        }
      }
    }
    // measurement with paraxial rays
    let fMeas = NaN, vMeas = NaN, vTheory = NaN;
    if (parallel) {
      const r = traceRay(v2(-7, 0.04), v2(1, 0), elems, nOf, 589);
      fMeas = this.crossing({ pos: r.segs[r.segs.length - 1].a, dir: r.dir });
      if (Number.isFinite(fMeas)) this.marker(v2(fMeas, 0), "#ff5d73", 0.07);
    } else {
      const u = V.u;
      const ra = traceRay(v2(xs, 0), v2(u, 0.05), elems, nOf, 589), rb = traceRay(v2(xs, 0), v2(u, -0.05), elems, nOf, 589);
      const la = ra.segs[ra.segs.length - 1], lb = rb.segs[rb.segs.length - 1];
      // intersection of the two output rays
      const a = la.a, da = ra.dir, b = lb.a, db = rb.dir;
      const den = da.x * db.y - da.y * db.x;
      if (Math.abs(den) > 1e-9) { const t = ((b.x - a.x) * db.y - (b.y - a.y) * db.x) / den; vMeas = a.x + da.x * t; }
      vTheory = (fTheory * u) / (u - fTheory * -1 * -1) ;
      // thin lens: 1/v = 1/f - 1/u (object at -u)
      vTheory = 1 / (1 / fTheory - 1 / u);
      if (Number.isFinite(vMeas) && Math.abs(vMeas) < 30) this.marker(v2(vMeas, 0), "#ff5d73", 0.07);
    }
    this.ro = [
      { label: "ro.fTheory", value: fTheory, unit: "m", digits: 4 },
      parallel ? { label: "ro.fMeasured", value: Number.isFinite(fMeas) ? fMeas : "∞", unit: "m", digits: 4 } : { label: "ro.vMeasured", value: Number.isFinite(vMeas) ? vMeas : "∞", unit: "m", digits: 4 },
    ];
    if (!parallel) this.ro.push({ label: "ro.vTheory", value: Number.isFinite(vTheory) ? vTheory : "∞", unit: "m", digits: 4 }, { label: "ro.magnification", value: Number.isFinite(vMeas) ? -vMeas / V.u : "—", digits: 3 });
    else this.ro.push({ label: "ro.sphAb", value: (() => { const r = traceRay(v2(-7, V.h * 0.85), v2(1, 0), elems, nOf, 589); const x = this.crossing({ pos: r.segs[r.segs.length - 1].a, dir: r.dir }); return Number.isFinite(x) && Number.isFinite(fMeas) ? x - fMeas : "—"; })(), unit: "m", digits: 4 });
    this.ro.push({ label: "ro.power", value: 1 / fTheory, unit: "D", digits: 3 });
    const curve: { x: number; y: number }[] = [];
    for (let u = 1.2; u <= 8; u += 0.1) { const vv = 1 / (1 / fTheory - 1 / u); if (Math.abs(vv) < 25) curve.push({ x: u, y: vv }); }
    this.cs = [{ id: "imgdist", title: "ch.imageDist", xLabel: "ch.objDist", yLabel: "ch.imgDist", xUnit: "m", yUnit: "m", series: [
      { label: "ch.thinLens", color: "#4cc9f0", pts: curve },
      { label: "ch.now", color: "#ffd166", pts: !parallel && Number.isFinite(vMeas) ? [{ x: V.u, y: vMeas }] : [], points: true }] }];
    void ends;
  }

  private mirrorMode() {
    const V = this.values;
    const R = V.R, h = V.h, type = V.mtype;
    const pts: V2[] = [];
    const N = 40;
    if (type === 0) { pts.push(v2(0, -h), v2(0, h)); }
    else if (type === 1) { for (let i = 0; i <= N; i++) { const y = -h + (2 * h * i) / N; pts.push(v2(-R + Math.sqrt(R * R - y * y), y)); } }
    else { for (let i = 0; i <= N; i++) { const y = -h + (2 * h * i) / N; pts.push(v2(R - Math.sqrt(R * R - y * y), y)); } }
    const el = makeElem(pts, true, false);
    // draw mirror body
    const body = [...pts, ...pts.slice().reverse().map((p) => v2(p.x + 0.12, p.y))];
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(body), { depth: 0.6, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: "#dfe6ee", metalness: 1, roughness: 0.05 }));
    m.geometry.translate(0, 0, -0.3);
    this.dyn.add(m);
    this.line([new THREE.Vector3(-8, 0, 0), new THREE.Vector3(8, 0, 0)], "#ffffff", true, 0.35);
    const fTheory = type === 0 ? Infinity : type === 1 ? -R / 2 : R / 2; // focal x position of vertex at 0 (virtual f for convex)
    if (type !== 0) this.marker(v2(fTheory, 0), "#ffd166", 0.06);
    const parallel = V.src === 0;
    const xs = -V.u;
    const srcs = this.sources(xs, V.yo, h, parallel);
    if (!parallel) this.marker(v2(xs, V.yo), "#fff2a8", 0.13);
    for (const s of srcs) {
      const r = traceRay(s.o, s.d, [el], () => 1, 589);
      this.drawSegs(r.segs.map((g, i) => (i === r.segs.length - 1 ? { ...g, b: g.a.clone().addScaledVector(r.dir, 9) } : g)), "#ffe27a", 0.012);
      const last = r.segs[r.segs.length - 1];
      if (type === 2 || (type === 0 && !parallel)) this.line([new THREE.Vector3(last.a.x, last.a.y, 0), new THREE.Vector3(last.a.x - r.dir.x * 5, last.a.y - r.dir.y * 5, 0)], "#ffe27a", true, 0.3);
    }
    let fMeas = NaN, vMeas = NaN, vTh = NaN;
    if (type !== 0 && parallel) {
      const r = traceRay(v2(-7, 0.04), v2(1, 0), [el], () => 1, 589);
      fMeas = this.crossing({ pos: r.segs[r.segs.length - 1].a, dir: r.dir });
      if (Number.isFinite(fMeas)) this.marker(v2(fMeas, 0), "#ff5d73", 0.07);
    }
    if (!parallel) {
      const u = V.u;
      const ra = traceRay(v2(xs, 0), v2(u, 0.05), [el], () => 1, 589), rb = traceRay(v2(xs, 0), v2(u, -0.05), [el], () => 1, 589);
      const la = ra.segs[ra.segs.length - 1], lb = rb.segs[rb.segs.length - 1];
      const den = ra.dir.x * rb.dir.y - ra.dir.y * rb.dir.x;
      if (Math.abs(den) > 1e-9) { const t = ((lb.a.x - la.a.x) * rb.dir.y - (lb.a.y - la.a.y) * rb.dir.x) / den; vMeas = la.a.x + ra.dir.x * t; }
      // mirror eq with x measured to the left (real image positive): 1/s' = 2/Rm - 1/u, Rm = +R concave, -R convex, inf plane
      const invf = type === 0 ? 0 : type === 1 ? 2 / R : -2 / R;
      const sp = 1 / (invf - 1 / u);
      vTh = -sp; // as x coordinate
      if (Number.isFinite(vMeas) && Math.abs(vMeas) < 30) this.marker(v2(vMeas, 0), "#ff5d73", 0.07);
    }
    this.ro = [
      { label: "ro.fTheory", value: type === 0 ? "∞" : Math.abs(fTheory), unit: "m", digits: 4 },
      { label: "ro.mirrorLaw", value: "θᵢ = θᵣ" },
    ];
    if (parallel && type !== 0) this.ro.push({ label: "ro.fMeasured", value: Number.isFinite(fMeas) ? Math.abs(fMeas) : "∞", unit: "m", digits: 4 });
    if (!parallel) this.ro.push({ label: "ro.vMeasured", value: Number.isFinite(vMeas) ? vMeas : "∞", unit: "m", digits: 4 }, { label: "ro.vTheory", value: Number.isFinite(vTh) ? vTh : "∞", unit: "m", digits: 4 });
    const curve: { x: number; y: number }[] = [];
    const invf = type === 0 ? 0 : type === 1 ? 2 / R : -2 / R;
    for (let u = 1.2; u <= 8; u += 0.1) { const sp = 1 / (invf - 1 / u); if (Math.abs(sp) < 25) curve.push({ x: u, y: -sp }); }
    this.cs = [{ id: "imgdist", title: "ch.imageDist", xLabel: "ch.objDist", yLabel: "ch.imgDist", xUnit: "m", yUnit: "m", series: [
      { label: "ch.mirrorEq", color: "#4cc9f0", pts: curve },
      { label: "ch.now", color: "#ffd166", pts: !parallel && Number.isFinite(vMeas) ? [{ x: V.u, y: vMeas }] : [], points: true }] }];
    const lab = labelSprite("F", "#ffd166", 0.4);
    if (type !== 0) { lab.position.set(fTheory, 0.3, 0); this.dyn.add(lab); }
  }
}
