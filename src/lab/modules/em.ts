import * as THREE from "three";
import type { ChartSpec, ParamDef, Readout } from "../types";
import { ArrowField, ModuleBase, deg, disposeObject, heatRGB, labelSprite, rad } from "./util";

const K = 8.9875517923e9;
const MU0 = 4e-7 * Math.PI;
const QE = 1.602176634e-19;
const SPECIES = [
  { name: "em.electron", q: -QE, m: 9.1093837e-31 },
  { name: "em.proton", q: QE, m: 1.67262192e-27 },
  { name: "em.alpha", q: 2 * QE, m: 6.6446573e-27 },
];
const GX = 25, GY = 15;
const MAX_STAGES = 5, MAX_BR = 4;

interface Path { pts: THREE.Vector3[]; I: number; len: number; dots: THREE.Mesh[] }

export class EMModule extends ModuleBase {
  cat = "em";
  modes = [
    { id: "charges", label: "em.charges" }, { id: "magwire", label: "em.magwire" }, { id: "magdipole", label: "em.magdipole" },
    { id: "lorentz", label: "em.lorentz" }, { id: "circuit", label: "em.circuit" }, { id: "rc", label: "em.rc" },
  ];
  private arrows = new ArrowField(GX * GY);
  private surf: THREE.Mesh;
  private surfGeo: THREE.PlaneGeometry;
  private surfMat: THREE.ShaderMaterial;
  private dyn = new THREE.Group();
  private charges: THREE.Mesh[] = [];
  private probe: THREE.Mesh;
  private ro: Readout[] = [];
  private cs: ChartSpec[] = [];
  // lorentz
  private pr = { x: 0, y: 0, vx: 0, vy: 0, t: 0, scale: 1 };
  private hist: { t: number; x: number; y: number; s: number }[] = [];
  private lastSample = -1;
  private trail: THREE.Line;
  private trailN = 0;
  private particle: THREE.Mesh;
  private samples: { x: number; y: number }[] = [];
  private lastRm = NaN;
  // circuit
  stages: number[][] = [[100], [220]];
  private paths: Path[] = [];
  private phase: number[] = [];
  private resMeshes: { m: THREE.Mesh; P: number }[] = [];
  private lever: THREE.Mesh | null = null;
  // rc
  private rc = { q: 0, t0: 0, vc0: 0, lastSw: 1, h: [] as { t: number; vc: number; i: number }[], sub: 0 };

  constructor() {
    super();
    const L = (k: string, min: number, max: number, step: number, value: number, unit: string | undefined, modes: string[], extra: Partial<ParamDef> = {}): ParamDef =>
      ({ key: k, label: "emp." + k, min, max, step, value, unit, modes, ...extra });
    const hid = () => true;
    const defs: ParamDef[] = [
      L("q1", -5, 5, 0.1, 3, "µC", ["charges"]), L("q2", -5, 5, 0.1, -3, "µC", ["charges"]), L("q3", -5, 5, 0.1, 0, "µC", ["charges"]),
      L("qt", -2, 2, 0.1, 1, "µC", ["charges"]),
      L("view", 0, 2, 1, 2, undefined, ["charges"], { type: "select", options: [{ v: 0, label: "emp.field" }, { v: 1, label: "emp.potential" }, { v: 2, label: "emp.both" }] }),
      L("c1x", -8, 8, 0.1, -3, "m", ["charges"], { hidden: hid }), L("c1y", -4.8, 4.8, 0.1, 0, "m", ["charges"], { hidden: hid }),
      L("c2x", -8, 8, 0.1, 3, "m", ["charges"], { hidden: hid }), L("c2y", -4.8, 4.8, 0.1, 0, "m", ["charges"], { hidden: hid }),
      L("c3x", -8, 8, 0.1, 0, "m", ["charges"], { hidden: hid }), L("c3y", -4.8, 4.8, 0.1, 3, "m", ["charges"], { hidden: hid }),
      L("prx", -8, 8, 0.1, 0, "m", ["charges", "magwire", "magdipole"], { hidden: hid }), L("pry", -4.8, 4.8, 0.1, 1.5, "m", ["charges", "magwire", "magdipole"], { hidden: hid }),
      L("I", -30, 30, 0.5, 10, "A", ["magwire"]),
      L("M", 0.5, 30, 0.5, 5, "A·m²", ["magdipole"]), L("alpha", 0, 360, 5, 0, "°", ["magdipole"]),
      L("species", 0, 2, 1, 0, undefined, ["lorentz"], { type: "select", options: [{ v: 0, label: "em.electron" }, { v: 1, label: "em.proton" }, { v: 2, label: "em.alpha" }] }),
      L("v0", 0.1, 5, 0.05, 1, "10⁶ m/s", ["lorentz"]), L("ang", 0, 360, 5, 0, "°", ["lorentz"]),
      L("B", 0.1, 20, 0.1, 2, "mT", ["lorentz"]), L("E", 0, 20, 0.1, 0, "kV/m", ["lorentz"]),
      L("restart", 0, 1, 1, 0, undefined, ["lorentz"], { type: "button" }),
      L("V", 1, 24, 0.5, 12, "V", ["circuit", "rc"]), L("rint", 0, 5, 0.1, 0.5, "Ω", ["circuit"]),
      L("sw", 0, 1, 1, 1, undefined, ["circuit", "rc"], { type: "toggle" }),
      L("addS", 0, 1, 1, 0, undefined, ["circuit"], { type: "button" }), L("addP", 0, 1, 1, 0, undefined, ["circuit"], { type: "button" }),
      L("remove", 0, 1, 1, 0, undefined, ["circuit"], { type: "button" }),
      L("sel", 1, 2, 1, 1, undefined, ["circuit"]), L("Rsel", 1, 1000, 1, 100, "Ω", ["circuit"]),
      L("R", 100, 20000, 100, 10000, "Ω", ["rc"]), L("C", 10, 2000, 10, 470, "µF", ["rc"]),
      L("tscale", 1, 100, 1, 1, "×", ["rc"]),
    ];
    this.defs = defs;
    this.surfGeo = new THREE.PlaneGeometry(16, 10, 96, 60);
    this.surfGeo.setAttribute("aV", new THREE.BufferAttribute(new Float32Array(this.surfGeo.attributes.position.count), 1));
    this.surfMat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide, transparent: true,
      vertexShader: `attribute float aV; varying float vV; varying vec3 vP; void main(){ vV=aV; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `varying float vV; varying vec3 vP;
        void main(){ vec3 n=normalize(cross(dFdx(vP),dFdy(vP))); float d=0.55+0.45*abs(n.z);
          vec3 neg=vec3(0.1,0.3,0.95), zero=vec3(0.92,0.92,0.95), pos=vec3(0.95,0.18,0.2);
          vec3 c= vV<0.0 ? mix(zero,neg,min(-vV,1.0)) : mix(zero,pos,min(vV,1.0));
          float f=fract(vV*8.0); float w=fwidth(vV*8.0); float line=1.0-smoothstep(0.0,max(w*1.5,0.03),min(f,1.0-f));
          c=mix(c,vec3(0.05),line*0.55); gl_FragColor=vec4(c*d,0.82);} `,
    });
    this.surf = new THREE.Mesh(this.surfGeo, this.surfMat);
    this.surf.frustumCulled = false;
    this.arrows.mesh.visible = true;
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2 }));
      m.userData.idx = i;
      this.charges.push(m);
    }
    this.probe = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshStandardMaterial({ color: "#ffd166", emissive: "#ffb703", emissiveIntensity: 1.2 }));
    this.probe.userData.idx = 9;
    this.particle = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: "#4cc9f0", emissiveIntensity: 1.5 }));
    this.trail = new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 1500), 3)), new THREE.LineBasicMaterial({ color: "#4cc9f0" }));
    this.trail.frustumCulled = false;
    this.group.add(this.arrows.mesh, this.surf, this.dyn, ...this.charges, this.probe, this.particle, this.trail);
    this.setup(defs, {
      charges: {}, magwire: { I: 10 }, magdipole: { M: 5 }, lorentz: {}, circuit: {}, rc: {},
    }, "charges");
  }

  info() { return { desc: "em.desc." + this.mode, model: "em.model." + this.mode }; }
  cameraHint() {
    if (this.mode === "charges") return { pos: [0, -6, 12] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
    return { pos: [0, 0, 13] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
  }
  readouts() { return this.ro; }
  charts() { return this.cs; }
  getData() { return { stages: this.stages }; }
  setData(d: unknown) {
    const s = (d as { stages?: unknown })?.stages;
    if (Array.isArray(s) && s.length > 0 && s.length <= MAX_STAGES && s.every((g) => Array.isArray(g) && g.length >= 1 && g.length <= MAX_BR && g.every((r) => typeof r === "number" && r > 0)))
      this.stages = s.map((g: number[]) => g.slice());
  }
  params(): ParamDef[] {
    const p = super.params();
    const n = this.stages.reduce((a, g) => a + g.length, 0);
    for (const d of p) if (d.key === "sel") { d.max = Math.max(1, n); d.value = Math.min(this.values.sel, n); }
    return p;
  }
  protected onMode() {
    this.lastSample = -1;
    this.restartParticle();
    this.rcReset();
    const m = this.mode;
    this.arrows.mesh.visible = m === "charges" || m === "magwire" || m === "magdipole";
    this.probe.visible = m === "charges" || m === "magwire" || m === "magdipole";
    this.particle.visible = this.trail.visible = m === "lorentz";
    this.charts_ = [];
    this.buildStatic();
    this.sync();
  }
  private charts_: unknown[] = [];
  protected onParam(k: string, v: number) {
    if (k === "restart") this.restartParticle();
    if (["species", "v0", "ang", "B", "E"].includes(k) && this.mode === "lorentz") this.restartParticle();
    if (this.mode === "circuit") {
      const n = this.stages.reduce((a, g) => a + g.length, 0);
      if (k === "addS" && this.stages.length < MAX_STAGES) this.stages.push([100]);
      if (k === "addP") { const g = this.stages[this.stages.length - 1]; if (g.length < MAX_BR) g.push(100); }
      if (k === "remove") { const g = this.stages[this.stages.length - 1]; if (g.length > 1) g.pop(); else if (this.stages.length > 1) this.stages.pop(); }
      if (k === "Rsel") { const loc = this.locate(Math.min(this.values.sel, n)); if (loc) this.stages[loc[0]][loc[1]] = v; }
      if (k === "sel" || k === "addS" || k === "addP" || k === "remove" || k === "*") {
        const nn = this.stages.reduce((a, g) => a + g.length, 0);
        this.values.sel = Math.min(this.values.sel, nn);
        const loc = this.locate(this.values.sel);
        if (loc) this.values.Rsel = this.stages[loc[0]][loc[1]];
      }
    }
    if (this.mode === "rc" && (k === "R" || k === "C" || k === "V")) { /* parameters change tau only */ }
    if (this.mode === "rc" && k === "sw") { this.rc.t0 = this.time; this.rc.vc0 = this.rc.q / (this.values.C * 1e-6); this.rc.lastSw = v; }
    if (this.mode === "charges" || this.mode === "magwire" || this.mode === "magdipole") this.sync();
  }
  protected onReset() { this.restartParticle(); this.rcReset(); }
  private locate(sel: number): [number, number] | null {
    let c = 0;
    for (let i = 0; i < this.stages.length; i++) for (let j = 0; j < this.stages[i].length; j++) if (++c === sel) return [i, j];
    return null;
  }
  private sync() {
    const V = this.values;
    if (this.mode === "charges") {
      this.charges.forEach((m, i) => m.position.set(V[`c${i + 1}x`], V[`c${i + 1}y`], 0));
    }
    this.probe.position.set(V.prx, V.pry, 0);
  }
  onDrag(o: THREE.Object3D, p: THREE.Vector3) {
    const V = this.values;
    const cl = (x: number, a: number) => Math.max(-a, Math.min(a, Math.round(x * 10) / 10));
    if (o === this.probe) { V.prx = cl(p.x, 8); V.pry = cl(p.y, 4.8); }
    else { const i = (o.userData.idx as number) + 1; V[`c${i}x`] = cl(p.x, 8); V[`c${i}y`] = cl(p.y, 4.8); }
    this.sync();
    this.dirty = true;
  }

  // ---------------- static geometry per mode ----------------
  private buildStatic() {
    this.dyn.children.slice().forEach((c) => { this.dyn.remove(c); disposeObject(c); });
    this.paths = []; this.resMeshes = []; this.lever = null;
    const m = this.mode;
    this.draggables = m === "charges" ? [...this.charges, this.probe] : m === "magwire" || m === "magdipole" ? [this.probe] : [];
    this.charges.forEach((c) => (c.visible = m === "charges"));
    this.surf.visible = m === "charges" && this.values.view !== 0;
    if (m === "magwire") {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 20), new THREE.MeshStandardMaterial({ color: "#d9a05b", metalness: 1, roughness: 0.25 }));
      w.rotation.x = Math.PI / 2; this.dyn.add(w);
    } else if (m === "magdipole") {
      const g = new THREE.Group();
      const n = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: "#e63946", roughness: 0.4 }));
      const s = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: "#3a86ff", roughness: 0.4 }));
      n.position.x = 0.5; s.position.x = -0.5;
      const ln = labelSprite("N", "#fff", 0.4), ls = labelSprite("S", "#fff", 0.4);
      ln.position.set(0.5, 0, 0.5); ls.position.set(-0.5, 0, 0.5);
      g.add(n, s, ln, ls); g.userData.magnet = true;
      this.dyn.add(g);
    } else if (m === "lorentz") {
      const dots = new THREE.Points(
        new THREE.BufferGeometry().setFromPoints(Array.from({ length: 15 * 9 }, (_, i) => new THREE.Vector3(-7 + (i % 15) * 1, -4 + Math.floor(i / 15) * 1, -0.3))),
        new THREE.PointsMaterial({ color: "#7a8aa8", size: 0.12, sizeAttenuation: true, transparent: true, opacity: 0.6 }));
      this.dyn.add(dots);
    } else if (m === "circuit") this.buildCircuit();
    else if (m === "rc") this.buildRC();
  }

  private pathMesh(pts: THREE.Vector3[], I: number, color = "#c8d3e6") {
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(2, pts.length * 2), 0.045, 8, false), new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.3 }));
    this.dyn.add(tube);
    let len = 0;
    for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
    const n = Math.max(2, Math.ceil(len / 0.55));
    const dots: THREE.Mesh[] = [];
    const geo = new THREE.SphereGeometry(0.075, 10, 8), mat = new THREE.MeshBasicMaterial({ color: "#ffe066" });
    for (let i = 0; i < n; i++) { const d = new THREE.Mesh(geo, mat); this.dyn.add(d); dots.push(d); }
    this.paths.push({ pts, I, len, dots });
    if (this.phase.length < this.paths.length) this.phase.push(0);
  }

  private resistor(x: number, y: number, R: number, P: number, label: string) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.34, 0.34), new THREE.MeshStandardMaterial({ color: "#d8b988", roughness: 0.5, emissive: "#ff3d00", emissiveIntensity: 0 }));
    body.position.set(x, y, 0);
    this.dyn.add(body);
    const cols = ["#8b5a2b", "#111", "#e63946", "#d4af37"];
    cols.forEach((c, i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.36), new THREE.MeshStandardMaterial({ color: c })); b.position.set(x - 0.28 + i * 0.18, y, 0); this.dyn.add(b); });
    const s = labelSprite(label, "#ffffff", 0.34); s.position.set(x, y + 0.5, 0); this.dyn.add(s);
    this.resMeshes.push({ m: body, P });
  }

  private solve() {
    const V = this.values;
    const closed = V.sw >= 0.5;
    const Rg = this.stages.map((g) => 1 / g.reduce((a, r) => a + 1 / r, 0));
    const Rtot = Rg.reduce((a, b) => a + b, 0) + V.rint;
    const I = closed ? V.V / Rtot : 0;
    const Vg = Rg.map((r) => I * r);
    return { closed, Rg, Rtot, I, Vg, Vterm: V.V - I * V.rint };
  }

  private buildCircuit() {
    this.paths = [];
    const V = this.values, S = this.stages.length, sol = this.solve();
    const x0 = -(3 * S) / 2, Ytop = 1.8, maxB = Math.max(...this.stages.map((g) => g.length));
    const Ybot = Ytop - 1.3 * maxB - 0.9, xb = x0 - 2.6, xr = x0 + 3 * S + 1.2;
    const P3 = (x: number, y: number) => new THREE.Vector3(x, y, 0);
    // battery
    const bat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), new THREE.MeshStandardMaterial({ color: "#2b2d42", metalness: 0.6, roughness: 0.35 }));
    bat.position.set(xb, (Ytop + Ybot) / 2, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.3), new THREE.MeshStandardMaterial({ color: "#e63946" }));
    cap.position.set(xb, (Ytop + Ybot) / 2 + 0.6, 0);
    this.dyn.add(bat, cap);
    const lp = labelSprite("+", "#ff6b6b", 0.5), ln = labelSprite("−", "#6ea8ff", 0.5);
    lp.position.set(xb - 0.7, (Ytop + Ybot) / 2 + 0.4, 0); ln.position.set(xb - 0.7, (Ytop + Ybot) / 2 - 0.4, 0);
    const vl = labelSprite(`${V.V} V`, "#ffffff", 0.4); vl.position.set(xb, (Ytop + Ybot) / 2 - 0.95, 0);
    this.dyn.add(lp, ln, vl);
    // switch
    const swx = xb + 1.2;
    const lev = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07), new THREE.MeshStandardMaterial({ color: "#ffd166", metalness: 0.8, roughness: 0.3 }));
    lev.geometry.translate(0.5, 0, 0);
    lev.position.set(swx - 0.5, Ytop, 0);
    lev.rotation.z = sol.closed ? 0 : rad(35);
    this.dyn.add(lev); this.lever = lev;
    for (const dx of [-0.5, 0.5]) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: "#aaa", metalness: 1 })); t.position.set(swx + dx, Ytop, 0); this.dyn.add(t); }
    const sl = labelSprite("S", "#fff", 0.35); sl.position.set(swx, Ytop + 0.5, 0); this.dyn.add(sl);
    // paths
    const I = sol.I;
    this.pathMesh([P3(xb, Ybot + 0.55 + 0.01), P3(xb, Ytop - 0.55 + 0.0), P3(xb, Ytop), P3(x0, Ytop)], I);
    let ri = 0;
    this.stages.forEach((g, i) => {
      const xa = x0 + 3 * i, xc = xa + 3, Vgi = sol.Vg[i];
      g.forEach((R, k) => {
        const y = Ytop - 1.3 * k, xm = (xa + xc) / 2;
        const Ik = sol.closed ? Vgi / R : 0, P = Vgi * Ik;
        ri++;
        const pts = k === 0 ? [P3(xa, Ytop), P3(xc, Ytop)] : [P3(xa, Ytop), P3(xa, y), P3(xc, y), P3(xc, Ytop)];
        this.pathMesh(pts, Ik);
        this.resistor(xm, y, R, P, `R${ri} ${R}Ω`);
      });
      if (g.length > 1) for (const x of [xa, xc]) { const n = new THREE.Mesh(new THREE.SphereGeometry(0.1), new THREE.MeshStandardMaterial({ color: "#fff" })); n.position.set(x, Ytop, 0); this.dyn.add(n); }
    });
    this.pathMesh([P3(x0 + 3 * S, Ytop), P3(xr, Ytop), P3(xr, Ybot), P3(xb, Ybot), P3(xb, Ybot + 0.55)], I);
    // outer loop closure from battery top handled; ensure phases
    this.updateCircuitReadouts(sol);
  }

  private updateCircuitReadouts(sol: ReturnType<EMModule["solve"]>) {
    const V = this.values;
    const out: Readout[] = [
      { label: "ro.emf", value: V.V, unit: "V", digits: 2 }, { label: "ro.current", value: sol.I, unit: "A", digits: 4 },
      { label: "ro.rtotal", value: sol.Rtot, unit: "Ω", digits: 3 }, { label: "ro.terminal", value: sol.Vterm, unit: "V", digits: 3 },
      { label: "ro.pBattery", value: V.V * sol.I, unit: "W", digits: 4 },
    ];
    let pd = sol.I * sol.I * V.rint, ri = 0, kcl = 0, kvl = V.V - sol.I * V.rint;
    this.stages.forEach((g, i) => {
      let Isum = 0;
      g.forEach((R) => { ri++; const Ik = sol.closed ? sol.Vg[i] / R : 0; Isum += Ik; pd += sol.Vg[i] * Ik;
        out.push({ label: `ro.resLine:${ri}`, value: `${sol.Vg[i].toFixed(3)} V · ${(Ik * 1000).toFixed(2)} mA · ${(sol.Vg[i] * Ik).toFixed(4)} W` }); });
      kcl = Math.max(kcl, Math.abs(Isum - sol.I));
      kvl -= sol.Vg[i];
    });
    out.push({ label: "ro.kvl", value: kvl, unit: "V", digits: 12, tone: Math.abs(kvl) < 1e-9 ? "ok" : "bad" });
    out.push({ label: "ro.kcl", value: kcl, unit: "A", digits: 12, tone: kcl < 1e-9 ? "ok" : "bad" });
    out.push({ label: "ro.pDiss", value: pd, unit: "W", digits: 4 });
    out.push({ label: "ro.ohmCheck", value: sol.Rtot * sol.I - V.V * (sol.closed ? 1 : 0), unit: "V", digits: 12, tone: "ok" });
    this.ro = out;
    // chart: voltage drops & power per stage
    this.cs = [
      { id: "vdrop", title: "ch.vdrop", xLabel: "ch.stage", yLabel: "ch.voltage", yUnit: "V", series: [{ label: "ch.voltage", color: "#4cc9f0", pts: sol.Vg.map((v, i) => ({ x: i + 1, y: v })), points: true }, { label: "ch.rint", color: "#ff9f1c", pts: [{ x: 0, y: sol.I * V.rint }], points: true }] },
      { id: "ivr", title: "ch.ivr", xLabel: "ch.voltage", yLabel: "ch.current", xUnit: "V", yUnit: "A", series: [
        { label: "ch.ohm", color: "#80ed99", pts: [{ x: 0, y: 0 }, { x: V.V, y: V.V / sol.Rtot }] }, { label: "ch.now", color: "#ffd166", pts: [{ x: V.V * (sol.closed ? 1 : 0), y: sol.I }], points: true }] },
    ];
  }

  // ---------------- RC ----------------
  private rcReset() { this.segSw = this.values.sw ?? 1; this.segT = 0; this.rcSegV0 = 0; this.rc = { q: 0, t0: 0, vc0: 0, lastSw: this.values.sw ?? 1, h: [], sub: 0 }; }
  private buildRC() {
    const P3 = (x: number, y: number) => new THREE.Vector3(x, y, 0);
    const lp = labelSprite("C", "#fff", 0.45); lp.position.set(3.4, 0.9, 0); this.dyn.add(lp);
    for (const y of [0.35, -0.35]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.6, 1.1), new THREE.MeshStandardMaterial({ color: "#c0c8d8", metalness: 1, roughness: 0.2 })); p.position.set(3 + (y > 0 ? 0.35 : -0.35), 0, 0); this.dyn.add(p); }
    const bat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), new THREE.MeshStandardMaterial({ color: "#2b2d42", metalness: 0.6 }));
    bat.position.set(-4, 0, 0); this.dyn.add(bat);
    this.resistor(-0.5, 2, 0, 0, "R");
    this.paths = [];
    this.pathMesh([P3(-4, 0.55), P3(-4, 2), P3(-1, 2)], 0);
    this.pathMesh([P3(0, 2), P3(3, 2), P3(3, 0.8)], 0);
    this.pathMesh([P3(3, -0.8), P3(3, -2), P3(-4, -2), P3(-4, -0.55)], 0);
    const lev = new THREE.Mesh(new THREE.BoxGeometry(1, 0.07, 0.07), new THREE.MeshStandardMaterial({ color: "#ffd166" }));
    lev.geometry.translate(0.5, 0, 0); lev.position.set(0.9, 2, 0); this.dyn.add(lev); this.lever = lev;
  }
  private rcStep(dtSim: number) {
    const V = this.values, R = V.R, C = V.C * 1e-6;
    let dt = dtSim * V.tscale;
    const tau = R * C;
    const n = Math.max(1, Math.ceil(dt / (tau / 40)));
    const h = dt / n, Vs = V.sw >= 0.5 ? V.V : 0;
    const f = (q: number) => (Vs - q / C) / R;
    for (let i = 0; i < n; i++) {
      const k1 = f(this.rc.q), k2 = f(this.rc.q + 0.5 * h * k1), k3 = f(this.rc.q + 0.5 * h * k2), k4 = f(this.rc.q + h * k3);
      this.rc.q += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    this.rcTime += dt;
    const vc = this.rc.q / C, i = (Vs - vc) / R;
    if (this.rc.h.length === 0 || this.rcTime - this.rc.h[this.rc.h.length - 1].t >= tau / 40) {
      this.rc.h.push({ t: this.rcTime, vc, i });
      if (this.rc.h.length > 1500) this.rc.h.shift();
    }
  }
  private rcTime = 0;

  // ---------------- Lorentz ----------------
  private restartParticle() {
    const V = this.values, sp = SPECIES[Math.round(V.species ?? 0)] ?? SPECIES[0];
    const v0 = (V.v0 ?? 1) * 1e6, B = Math.max(1e-6, (V.B ?? 2) * 1e-3);
    const r = (sp.m * v0) / (Math.abs(sp.q) * B);
    this.pr = { x: 0, y: 0, vx: v0 * Math.cos(rad(V.ang ?? 0)), vy: v0 * Math.sin(rad(V.ang ?? 0)), t: 0, scale: 1.8 / r };
    this.hist = []; this.trailN = 0; this.samples = []; this.lastRm = NaN; this.lastSample = -1;
    this.rcTime = 0;
  }
  private lorentzStep(dtSim: number) {
    const V = this.values, sp = SPECIES[Math.round(V.species)] ?? SPECIES[0];
    const B = V.B * 1e-3, E = V.E * 1e3, wc = (Math.abs(sp.q) * B) / sp.m, T = (2 * Math.PI) / wc;
    const rt = (T / 4) * dtSim;
    const n = Math.max(8, Math.ceil((rt * wc) / 0.04));
    const h = rt / n, qm = sp.q / sp.m, p = this.pr;
    for (let i = 0; i < n; i++) {
      let vx = p.vx, vy = p.vy;
      vy += qm * E * 0.5 * h; // E along +y
      const t = qm * B * 0.5 * h, s = (2 * t) / (1 + t * t);
      // v' = v + v × t ẑ ; v × ẑ = (vy, -vx)
      const vpx = vx + vy * t, vpy = vy - vx * t;
      vx = vx + vpy * s; vy = vy - vpx * s;
      vy += qm * E * 0.5 * h;
      p.vx = vx; p.vy = vy; p.x += vx * h; p.y += vy * h; p.t += h;
    }
    this.lorT = this.lorT + dtSim;
  }
  private lorT = 0;

  // ---------------- update ----------------
  update(dt: number) {
    this.time += dt;
    const V = this.values, m = this.mode;
    if (m === "charges" || m === "magwire" || m === "magdipole") {
      if (this.dirty) { this.updateFields(); this.dirty = false; }
    } else if (m === "lorentz") {
      this.dirty = false;
      if (dt > 0) this.lorentzStep(dt);
      this.updateLorentz();
    } else if (m === "circuit") {
      if (this.dirty) { this.buildStatic(); this.dirty = false; }
      this.animateDots(dt);
      this.resMeshes.forEach((r) => ((r.m.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(2.5, r.P * 4)));
    } else if (m === "rc") {
      this.dirty = false;
      if (dt > 0) this.rcStep(dt);
      this.updateRC(dt);
    }
    void V;
  }

  private animateDots(dt: number) {
    this.paths.forEach((p, idx) => {
      const spd = Math.max(-3, Math.min(3, p.I * 40)); // visual: units/s proportional to current (clamped)
      this.phase[idx] = ((this.phase[idx] ?? 0) + (spd * dt) / Math.max(p.len, 0.1)) % 1;
      const n = p.dots.length;
      p.dots.forEach((d, i) => {
        d.visible = Math.abs(p.I) > 1e-9;
        let u = (((i / n + this.phase[idx]) % 1) + 1) % 1;
        let tgt = u * p.len, acc = 0;
        for (let s = 1; s < p.pts.length; s++) {
          const L = p.pts[s].distanceTo(p.pts[s - 1]);
          if (acc + L >= tgt) { d.position.lerpVectors(p.pts[s - 1], p.pts[s], L > 0 ? (tgt - acc) / L : 0); break; }
          acc += L;
        }
      });
    });
  }

  private Efield(x: number, y: number) {
    const V = this.values;
    let ex = 0, ey = 0, pot = 0;
    for (let i = 1; i <= 3; i++) {
      const q = V[`q${i}`] * 1e-6;
      if (!q) continue;
      const dx = x - V[`c${i}x`], dy = y - V[`c${i}y`];
      const r2 = dx * dx + dy * dy + 0.0225, r = Math.sqrt(r2);
      const e = (K * q) / r2;
      ex += (e * dx) / r; ey += (e * dy) / r; pot += (K * q) / r;
    }
    return { ex, ey, pot };
  }
  private Bfield(x: number, y: number) {
    const V = this.values;
    if (this.mode === "magwire") {
      const r2 = Math.max(x * x + y * y, 0.04), B = (MU0 * V.I) / (2 * Math.PI * Math.sqrt(r2));
      const r = Math.sqrt(r2);
      return { bx: (-y / r) * B, by: (x / r) * B };
    }
    const r2 = Math.max(x * x + y * y, 0.36), r = Math.sqrt(r2), a = rad(V.alpha);
    const mx = V.M * Math.cos(a), my = V.M * Math.sin(a);
    const rx = x / r, ry = y / r, md = mx * rx + my * ry, c = 1e-7 / (r2 * r);
    return { bx: c * (3 * md * rx - mx), by: c * (3 * md * ry - my) };
  }

  private updateFields() {
    const V = this.values, m = this.mode, c = new THREE.Color();
    this.surf.visible = m === "charges" && V.view !== 0;
    this.arrows.mesh.visible = !(m === "charges" && V.view === 1);
    this.charges.forEach((ch, i) => {
      const q = V[`q${i + 1}`];
      ch.visible = m === "charges" && q !== 0;
      const mat = ch.material as THREE.MeshStandardMaterial;
      mat.color.set(q > 0 ? "#ff4d5e" : "#4d7cff"); mat.emissive.set(q > 0 ? "#aa0014" : "#0a2aaa"); mat.emissiveIntensity = 0.6;
      ch.scale.setScalar(0.7 + 0.12 * Math.abs(q));
    });
    // magnet orientation
    this.dyn.children.forEach((o) => { if (o.userData.magnet) o.rotation.z = rad(V.alpha); });
    for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) {
      const x = -8.4 + (i * 16.8) / (GX - 1), y = -4.9 + (j * 9.8) / (GY - 1);
      let fx: number, fy: number, t: number;
      if (m === "charges") { const e = this.Efield(x, y); fx = e.ex; fy = e.ey; const mg = Math.hypot(fx, fy) + 1e-9; t = (Math.log10(mg) - 2.5) / 3; }
      else { const b = this.Bfield(x, y); fx = b.bx; fy = b.by; const mg = Math.hypot(fx, fy) + 1e-15; t = (Math.log10(mg) + 7.2) / 2.8; }
      this.arrows.set(j * GX + i, new THREE.Vector3(x, y, 0.05), new THREE.Vector3(fx, fy, 0), Math.max(0, Math.min(1, t)), heatRGB(Math.max(0, Math.min(1, t)), c));
    }
    this.arrows.commit();
    if (m === "charges") {
      const pos = this.surfGeo.attributes.position as THREE.BufferAttribute, av = this.surfGeo.attributes.aV as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const { pot } = this.Efield(pos.getX(i), pos.getY(i));
        pos.setZ(i, 2 * Math.tanh(pot / 20000));
        av.setX(i, Math.max(-1, Math.min(1, pot / 40000)));
      }
      pos.needsUpdate = true; av.needsUpdate = true;
    }
    // readouts at probe
    const px = V.prx, py = V.pry;
    if (m === "charges") {
      const e = this.Efield(px, py), qt = V.qt * 1e-6;
      const Em = Math.hypot(e.ex, e.ey);
      this.ro = [
        { label: "ro.probePos", value: `(${px.toFixed(1)}, ${py.toFixed(1)}) m` },
        { label: "ro.Emag", value: Em, unit: "N/C", digits: 1 }, { label: "ro.Eang", value: deg(Math.atan2(e.ey, e.ex)), unit: "°", digits: 1 },
        { label: "ro.potential", value: e.pot, unit: "V", digits: 1 }, { label: "ro.force", value: Em * Math.abs(qt), unit: "N", digits: 5 },
        { label: "ro.pe", value: qt * e.pot, unit: "J", digits: 5 }, { label: "ro.coulomb", value: "k = 8.9876×10⁹ N·m²/C²" },
      ];
      const ve: { x: number; y: number }[] = [], ee: { x: number; y: number }[] = [];
      for (let i = 0; i <= 160; i++) { const x = -8 + (16 * i) / 160, r = this.Efield(x, py); ve.push({ x, y: Math.max(-1e5, Math.min(1e5, r.pot)) }); ee.push({ x, y: Math.max(-5e5, Math.min(5e5, r.ex)) }); }
      this.cs = [
        { id: "vx", title: "ch.potLine", xLabel: "ch.position", yLabel: "ch.potential", xUnit: "m", yUnit: "V", series: [{ label: "ch.potential", color: "#ff9f1c", pts: ve }, { label: "ch.now", color: "#ffd166", pts: [{ x: px, y: e.pot }], points: true }] },
        { id: "ex", title: "ch.fieldLine", xLabel: "ch.position", yLabel: "ch.Ex", xUnit: "m", yUnit: "N/C", series: [{ label: "ch.Ex", color: "#4cc9f0", pts: ee }, { label: "ch.now", color: "#ffd166", pts: [{ x: px, y: e.ex }], points: true }] },
      ];
    } else {
      const b = this.Bfield(px, py), Bm = Math.hypot(b.bx, b.by);
      this.ro = [
        { label: "ro.probePos", value: `(${px.toFixed(1)}, ${py.toFixed(1)}) m` },
        { label: "ro.Bmag", value: Bm * 1e6, unit: "µT", digits: 4 }, { label: "ro.Bang", value: deg(Math.atan2(b.by, b.bx)), unit: "°", digits: 1 },
        m === "magwire" ? { label: "ro.BtheoryWire", value: (MU0 * Math.abs(V.I)) / (2 * Math.PI * Math.max(Math.hypot(px, py), 0.2)) * 1e6, unit: "µT", digits: 4 } : { label: "ro.mu0", value: "μ₀ = 4π×10⁻⁷ T·m/A" },
      ];
      const pts: { x: number; y: number }[] = [];
      for (let i = 1; i <= 80; i++) { const x = (i * 8) / 80, bb = this.Bfield(x, 0); pts.push({ x, y: Math.hypot(bb.bx, bb.by) * 1e6 }); }
      const here = Math.hypot(px, py);
      this.cs = [{ id: "bx", title: "ch.Bdist", xLabel: "ch.distance", yLabel: "ch.Bfield", xUnit: "m", yUnit: "µT", series: [{ label: "ch.Bfield", color: "#80ed99", pts }, { label: "ch.now", color: "#ffd166", pts: here <= 8 ? [{ x: here, y: Bm * 1e6 }] : [], points: true }] }];
    }
  }

  private updateLorentz() {
    const V = this.values, sp = SPECIES[Math.round(V.species)] ?? SPECIES[0], p = this.pr;
    const B = V.B * 1e-3, E = V.E * 1e3, wc = (Math.abs(sp.q) * B) / sp.m, T = (2 * Math.PI) / wc;
    const sx = p.x * p.scale, sy = p.y * p.scale;
    this.particle.position.set(sx, sy, 0);
    (this.particle.material as THREE.MeshStandardMaterial).emissive.set(sp.q < 0 ? "#4cc9f0" : "#ff6b9d");
    (this.trail.material as THREE.LineBasicMaterial).color.set(sp.q < 0 ? "#4cc9f0" : "#ff6b9d");
    const arr = this.trail.geometry.attributes.position as THREE.BufferAttribute;
    if (this.trailN < 1500 && (this.trailN === 0 || Math.hypot(sx - arr.getX(this.trailN - 1), sy - arr.getY(this.trailN - 1)) > 0.02)) {
      arr.setXYZ(this.trailN++, sx, sy, 0);
      this.trail.geometry.setDrawRange(0, this.trailN);
      arr.needsUpdate = true;
    }
    const sampleDt = T / 36;
    if (this.lastSample < 0 || p.t - this.lastSample >= sampleDt) {
      this.lastSample = p.t;
      this.samples.push({ x: p.x, y: p.y });
      if (this.samples.length > 40) this.samples.shift();
      const k = this.samples.length;
      if (E === 0 && k >= 3) {
        const [a, b, c] = [this.samples[k - 3], this.samples[k - 2], this.samples[k - 1]];
        const A = Math.hypot(b.x - c.x, b.y - c.y), Bq = Math.hypot(a.x - c.x, a.y - c.y), Cq = Math.hypot(a.x - b.x, a.y - b.y);
        const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
        this.lastRm = area > 0 ? (A * Bq * Cq) / (4 * area) : NaN;
      } else this.lastRm = NaN;
      this.hist.push({ t: p.t / T, x: p.x, y: p.y, s: Math.hypot(p.vx, p.vy) });
      if (this.hist.length > 900) this.hist.shift();
    }
    const v0 = Math.hypot(p.vx, p.vy), r = (sp.m * V.v0 * 1e6) / (Math.abs(sp.q) * B);
    const ke = 0.5 * sp.m * v0 * v0;
    const un = r < 0.5 ? 1e3 : 1, uname = r < 0.5 ? "mm" : "m";
    this.ro = [
      { label: "ro.charge", value: sp.q / QE, unit: "e", digits: 0 }, { label: "ro.pmass", value: sp.m, unit: "kg", digits: 4 },
      { label: "ro.rTheory", value: r * un, unit: uname, digits: 4 }, { label: "ro.rMeas", value: Number.isFinite(this.lastRm) ? this.lastRm * un : "—", unit: uname, digits: 4 },
      { label: "ro.cyclPeriod", value: T, unit: "s", digits: 4 }, { label: "ro.cyclFreq", value: wc / (2 * Math.PI), unit: "Hz", digits: 4 },
      { label: "ro.speed", value: v0, unit: "m/s", digits: 1 }, { label: "ro.ke", value: ke / QE, unit: "eV", digits: 2 },
      { label: "ro.drift", value: E > 0 ? E / B : 0, unit: "m/s", digits: 1 },
      { label: "ro.timeScale", value: `1 s = ${(T / 4).toExponential(2)} s` },
    ];
    this.cs = [
      { id: "traj", title: "ch.trajectory", xLabel: "ch.x", yLabel: "ch.y", xUnit: uname, yUnit: uname, series: [{ label: "ch.trajectory", color: "#4cc9f0", pts: this.hist.map((h) => ({ x: h.x * un, y: h.y * un })) }] },
      { id: "spd", title: "ch.speedT", xLabel: "ch.periods", yLabel: "ch.speed", yUnit: "m/s", series: [{ label: "ch.speed", color: "#ff9f1c", pts: this.hist.map((h) => ({ x: h.t, y: h.s })) }] },
    ];
  }

  private updateRC(dt: number) {
    const V = this.values, R = V.R, C = V.C * 1e-6, tau = R * C;
    const vc = this.rc.q / C, Vs = V.sw >= 0.5 ? V.V : 0, i = (Vs - vc) / R;
    if (this.lever) this.lever.rotation.z = V.sw >= 0.5 ? 0 : rad(35);
    // dots: current direction follows i; speed ∝ |i|
    const spd = Math.max(-3, Math.min(3, i * 400));
    this.paths.forEach((p, idx) => {
      p.I = i;
      this.phase[idx] = (((this.phase[idx] ?? 0) + (spd * dt) / Math.max(p.len, 0.1)) % 1);
      p.dots.forEach((d, k) => {
        d.visible = Math.abs(i) > 1e-7;
        const u = (((k / p.dots.length + this.phase[idx]) % 1) + 1) % 1, tgt = u * p.len;
        let acc = 0;
        for (let s = 1; s < p.pts.length; s++) { const L = p.pts[s].distanceTo(p.pts[s - 1]); if (acc + L >= tgt) { d.position.lerpVectors(p.pts[s - 1], p.pts[s], L > 0 ? (tgt - acc) / L : 0); break; } acc += L; }
      });
    });
    // capacitor charge colouring
    this.dyn.children.forEach((o) => {
      const mm = o as THREE.Mesh;
      if (mm.geometry instanceof THREE.BoxGeometry && mm.geometry.parameters.height === 1.6) (mm.material as THREE.MeshStandardMaterial).emissive.set(mm.position.x > 3 ? "#ff3355" : "#3366ff").multiplyScalar(Math.min(1, Math.abs(vc) / Math.max(V.V, 1e-6)));
    });
    this.resMeshes.forEach((r) => ((r.m.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(2, (i * i * R) * 2)));
    const Vf = Vs, tt = this.rcTime - 0;
    const seg = Math.max(0, tt - this.rc.t0);
    void seg;
    this.ro = [
      { label: "ro.emf", value: Vs, unit: "V", digits: 2 }, { label: "ro.tau", value: tau, unit: "s", digits: 4 },
      { label: "ro.vc", value: vc, unit: "V", digits: 4 }, { label: "ro.current", value: i, unit: "A", digits: 6 },
      { label: "ro.charge", value: this.rc.q * 1e6, unit: "µC", digits: 3 }, { label: "ro.energyC", value: 0.5 * C * vc * vc, unit: "J", digits: 6 },
      { label: "ro.pR", value: i * i * R, unit: "W", digits: 6 }, { label: "ro.vr", value: i * R, unit: "V", digits: 4 },
      { label: "ro.kvl", value: Vs - i * R - vc, unit: "V", digits: 12, tone: "ok" },
      { label: "ro.tscale", value: V.tscale, unit: "×", digits: 0 },
    ];
    const h = this.rc.h;
    const th = h.map((q) => ({ x: q.t, y: q.vc }));
    // theory (current segment): Vc = Vf + (Vc0 - Vf) e^{-(t-t0)/τ}
    const t0 = this.rc.t0 * 0, thy: { x: number; y: number }[] = [];
    void t0;
    const startT = this.rcSegStart(), startV = this.rcSegV0;
    for (const q of h) if (q.t >= startT) thy.push({ x: q.t, y: Vf + (startV - Vf) * Math.exp(-(q.t - startT) / tau) });
    this.cs = [
      { id: "vc", title: "ch.vcT", xLabel: "ch.time", yLabel: "ch.voltage", xUnit: "s", yUnit: "V", series: [{ label: "ch.vcSim", color: "#4cc9f0", pts: th }, { label: "ch.vcTheory", color: "#ffd166", pts: thy, dashed: true }] },
      { id: "ic", title: "ch.iT", xLabel: "ch.time", yLabel: "ch.current", xUnit: "s", yUnit: "A", series: [{ label: "ch.current", color: "#ff9f1c", pts: h.map((q) => ({ x: q.t, y: q.i })) }] },
    ];
  }
  private segSw = 1;
  private segT = 0;
  private rcSegV0 = 0;
  private rcSegStart() {
    const V = this.values;
    if (V.sw !== this.segSw) { this.segSw = V.sw; this.segT = this.rcTime; this.rcSegV0 = this.rc.q / (V.C * 1e-6); }
    return this.segT;
  }
}
