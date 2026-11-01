import * as THREE from "three";
import type { ChartSpec, ParamDef, Readout } from "../types";
import { ModuleBase, blackbodyColor, disposeObject, heatRGB, makeHeatMaterial, makeHeatTexture, writeHeat, labelSprite } from "./util";

const SIGMA = 5.670374419e-8;
const RGAS = 8.314462618;
const MATS = [
  { id: "copper", k: 401, rho: 8960, c: 385, alpha: 17e-6 },
  { id: "aluminium", k: 237, rho: 2700, c: 897, alpha: 23e-6 },
  { id: "steel", k: 50, rho: 7850, c: 490, alpha: 12e-6 },
  { id: "glass", k: 1.0, rho: 2500, c: 840, alpha: 9e-6 },
  { id: "wood", k: 0.15, rho: 600, c: 1700, alpha: 5e-6 },
  { id: "invar", k: 10, rho: 8100, c: 515, alpha: 1.2e-6 },
  { id: "lead", k: 35, rho: 11340, c: 129, alpha: 29e-6 },
  { id: "water", k: 0.6, rho: 1000, c: 4186, alpha: 69e-6 },
];
const matOpts = (ids: string[]) => ids.map((id) => ({ v: MATS.findIndex((m) => m.id === id), label: "mat." + id }));

const NX = 64, NY = 40;
const PN = 520;
const GN = 140;

export class ThermoModule extends ModuleBase {
  cat = "thermo";
  modes = [
    { id: "conduction", label: "th.conduction" }, { id: "convection", label: "th.convection" }, { id: "radiation", label: "th.radiation" },
    { id: "expansion", label: "th.expansion" }, { id: "calorimetry", label: "th.calorimetry" }, { id: "gas", label: "th.gas" },
  ];
  private dyn = new THREE.Group();
  private ro: Readout[] = [];
  private cs: ChartSpec[] = [];
  // conduction
  private T = new Float32Array(NX * NY);
  private T2 = new Float32Array(NX * NY);
  private heatTex = makeHeatTexture(NX, NY);
  private heatMat = makeHeatMaterial(this.heatTex);
  private plate: THREE.Mesh;
  private condHist: { t: number; Tc: number; Tm: number }[] = [];
  private tPhys = 0;
  // convection
  private pp = new Float32Array(PN * 4); // x y vx vy
  private pT = new Float32Array(PN);
  private pts: THREE.Points;
  private convHist: { t: number; flux: number; dT: number }[] = [];
  private prof: number[] = new Array(10).fill(0);
  // radiation / expansion / calorimetry
  private sT = 0;
  private radHist: { t: number; T: number; P: number }[] = [];
  private radE = 0;
  private sphere: THREE.Mesh;
  private lamp: THREE.PointLight;
  private bar: THREE.Mesh;
  private pointer: THREE.Mesh;
  private expHist: { t: number; T: number; dL: number }[] = [];
  private calT1 = 0; private calT2 = 0;
  private calHist: { t: number; T1: number; T2: number }[] = [];
  private block: THREE.Mesh; private water: THREE.Mesh; private beaker: THREE.Mesh;
  // gas
  private gp = new Float32Array(GN * 6);
  private gasPts: THREE.Points;
  private piston: THREE.Mesh;
  private gasBox: THREE.LineSegments;
  private gasRef = { T0: 300, V0: 20, P0: 0 };
  private impulse: { t: number; j: number }[] = [];
  private gasHist: { t: number; V: number; P: number; T: number }[] = [];
  private lastH = 4;
  private pistonV = 0;
  private lastGasSample = 0;

  constructor() {
    super();
    const L = (k: string, min: number, max: number, step: number, value: number, unit: string | undefined, modes: string[], extra: Partial<ParamDef> = {}): ParamDef =>
      ({ key: k, label: "thp." + k, min, max, step, value, unit, modes, ...extra });
    const defs: ParamDef[] = [
      L("mat", 0, 7, 1, 0, undefined, ["conduction", "radiation", "expansion", "calorimetry"], { type: "select", options: matOpts(["copper", "aluminium", "steel", "glass", "wood"]) }),
      L("Th", 300, 800, 5, 400, "K", ["conduction", "convection"]), L("Tc", 250, 400, 5, 300, "K", ["conduction", "convection"]),
      L("pattern", 0, 2, 1, 0, undefined, ["conduction"], { type: "select", options: [{ v: 0, label: "thp.pLR" }, { v: 1, label: "thp.pDisc" }, { v: 2, label: "thp.pDiscCold" }] }),
      L("auto", 0, 1, 1, 1, undefined, ["conduction"], { type: "toggle" }),
      L("tscale", 1, 5000, 1, 100, "×", ["conduction", "radiation", "calorimetry"], { hidden: (v) => v.auto === 1 && false }),
      L("T0", 500, 3000, 10, 1500, "K", ["radiation"]), L("eps", 0.05, 1, 0.01, 0.9, undefined, ["radiation"]),
      L("rad", 0.02, 0.5, 0.01, 0.1, "m", ["radiation"]), L("Tenv", 3, 400, 1, 293, "K", ["radiation"]),
      L("L0", 0.5, 2, 0.05, 1, "m", ["expansion"]), L("P", 0, 2000, 10, 600, "W", ["expansion"]), L("mass", 0.5, 10, 0.1, 2, "kg", ["expansion", "calorimetry"]),
      L("exag", 1, 20000, 1, 2000, "×", ["expansion"]),
      L("mm", 0.5, 8, 0.1, 2, "kg", ["calorimetry"], { hidden: () => true }),
      L("T1", 320, 700, 5, 600, "K", ["calorimetry"]), L("m2", 0.2, 3, 0.1, 1, "kg", ["calorimetry"]), L("T2", 273, 330, 1, 293, "K", ["calorimetry"]),
      L("h", 1, 200, 1, 30, "W/K", ["calorimetry"]),
      L("proc", 0, 4, 1, 0, undefined, ["gas"], { type: "select", options: [{ v: 0, label: "thp.free" }, { v: 1, label: "thp.isothermal" }, { v: 2, label: "thp.isobaric" }, { v: 3, label: "thp.isochoric" }, { v: 4, label: "thp.adiabatic" }] }),
      L("n", 0.1, 5, 0.1, 1, "mol", ["gas"]), L("Tg", 150, 1000, 5, 300, "K", ["gas"]),
      L("Vg", 5, 50, 0.5, 20, "L", ["gas"], { hidden: (v) => v.proc === 2 || v.proc === 3 }),
      L("hot", 0, 1, 1, 0, undefined, ["convection"], { type: "toggle" }),
    ];
    this.defs = defs;
    this.plate = new THREE.Mesh(new THREE.BoxGeometry(8, 5, 0.4), this.heatMat);
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), new THREE.MeshStandardMaterial({ color: "#222", roughness: 0.5, metalness: 0.4, emissive: "#ff3300" }));
    this.lamp = new THREE.PointLight("#ff6a2a", 0, 40, 1.6);
    this.bar = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: "#aaa", metalness: 0.8, roughness: 0.35, emissive: "#000" }));
    this.pointer = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 12), new THREE.MeshStandardMaterial({ color: "#ff4d5e" }));
    this.block = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), new THREE.MeshStandardMaterial({ color: "#aaa", metalness: 0.9, roughness: 0.3, emissive: "#000" }));
    this.water = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 3, 40), new THREE.MeshStandardMaterial({ color: "#3a9bff", transparent: true, opacity: 0.55, roughness: 0.1, emissive: "#000" }));
    this.beaker = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3.8, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: "#dff4ff", transparent: true, opacity: 0.18, roughness: 0.02, side: THREE.DoubleSide, clearcoat: 1 }));
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
    this.pts = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, sizeAttenuation: true }));
    this.pts.frustumCulled = false;
    const gg = new THREE.BufferGeometry();
    gg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(GN * 3), 3));
    gg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(GN * 3), 3));
    this.gasPts = new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.16, vertexColors: true }));
    this.gasPts.frustumCulled = false;
    this.piston = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 3.2), new THREE.MeshStandardMaterial({ color: "#b0b8c8", metalness: 1, roughness: 0.25 }));
    this.gasBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3, 1, 3)), new THREE.LineBasicMaterial({ color: "#9fd8ff" }));
    this.group.add(this.dyn, this.plate, this.sphere, this.lamp, this.bar, this.pointer, this.block, this.water, this.beaker, this.pts, this.gasPts, this.piston, this.gasBox);
    this.setup(defs, {
      conduction: { Th: 400, Tc: 300, pattern: 0, auto: 1, mat: 0 }, convection: { Th: 420, Tc: 290 },
      radiation: { T0: 1500, eps: 0.9, rad: 0.1, Tenv: 293, mat: 2, tscale: 20 }, expansion: { mat: 2, L0: 1, P: 600, mass: 2, exag: 2000 },
      calorimetry: { mat: 0, mass: 1, T1: 600, m2: 1, T2: 293, h: 30, tscale: 20 }, gas: { proc: 0, n: 1, Tg: 300, Vg: 20 },
    }, "conduction");
  }

  info() { return { desc: "th.desc." + this.mode, model: "th.model." + this.mode }; }
  cameraHint() {
    if (this.mode === "gas") return { pos: [0, 3, 12] as [number, number, number], target: [0, 2.5, 0] as [number, number, number] };
    if (this.mode === "convection") return { pos: [0, 2.2, 10] as [number, number, number], target: [0, 2, 0] as [number, number, number] };
    return { pos: [0, 0.5, 10] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
  }
  readouts() { return this.ro; }
  charts() { return this.cs; }
  dispose() { this.heatTex.dispose(); this.heatMat.dispose(); disposeObject(this.group); }

  protected onMode() {
    const m = this.mode;
    this.plate.visible = m === "conduction";
    this.sphere.visible = m === "radiation"; this.lamp.visible = m === "radiation";
    this.bar.visible = this.pointer.visible = m === "expansion";
    this.block.visible = this.water.visible = this.beaker.visible = m === "calorimetry";
    this.pts.visible = m === "convection";
    this.gasPts.visible = this.piston.visible = this.gasBox.visible = m === "gas";
    this.initState();
    this.buildDyn();
  }
  protected onParam(k: string) {
    const m = this.mode, V = this.values;
    if (m === "conduction" && ["Th", "Tc", "pattern", "mat"].includes(k)) this.initState();
    if (m === "radiation" && ["T0", "rad", "mat", "Tenv", "eps"].includes(k)) { if (k !== "eps" && k !== "Tenv") this.initState(); }
    if (m === "expansion" && ["mat", "L0", "mass"].includes(k)) this.initState();
    if (m === "calorimetry" && ["mat", "mass", "T1", "m2", "T2"].includes(k)) this.initState();
    if (m === "gas") this.gasParam(k);
    if (m === "convection" && (k === "Th" || k === "Tc")) this.convHist = [];
    void V;
  }
  protected onReset() { this.initState(); }

  private gasParam(k: string) {
    const V = this.values, r = this.gasRef;
    const P = () => (V.n * RGAS * V.Tg) / (V.Vg * 1e-3);
    if (k === "proc" || k === "*") { r.T0 = V.Tg; r.V0 = V.Vg; r.P0 = P(); this.gasHist = []; return; }
    if (k === "Tg") {
      if (V.proc === 2) V.Vg = Math.max(5, Math.min(50, (V.n * RGAS * V.Tg) / r.P0 * 1e3));
      else if (V.proc === 4) { r.T0 = V.Tg; r.V0 = V.Vg; }
      else if (V.proc === 1) { r.T0 = V.Tg; }
      r.P0 = V.proc === 2 ? r.P0 : P();
    }
    if (k === "Vg") {
      if (V.proc === 1) V.Tg = r.T0;
      if (V.proc === 4) V.Tg = Math.max(150, Math.min(1000, r.T0 * Math.pow(r.V0 / V.Vg, 2 / 3)));
    }
    if (k === "n" && V.proc === 2) V.Vg = Math.max(5, Math.min(50, (V.n * RGAS * V.Tg) / r.P0 * 1e3));
    if (V.proc === 3 && k === "Tg") r.P0 = P();
  }

  private initState() {
    const V = this.values, m = this.mode;
    this.time = 0;
    if (m === "conduction") {
      this.tPhys = 0; this.condHist = [];
      const cx = NX * 0.5, cy = NY * 0.5;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const disc = (i - cx) ** 2 + ((j - cy) * 1.0) ** 2 < 8 * 8;
        this.T[j * NX + i] = V.pattern === 0 ? V.Tc : disc ? V.Th : V.Tc;
      }
    } else if (m === "convection") {
      this.convHist = [];
      for (let i = 0; i < PN; i++) { this.pp[i * 4] = (Math.random() - 0.5) * 5.6; this.pp[i * 4 + 1] = Math.random() * 4; this.pp[i * 4 + 2] = 0; this.pp[i * 4 + 3] = 0; this.pT[i] = (V.Th + V.Tc) / 2; }
    } else if (m === "radiation") { this.sT = V.T0; this.radHist = []; this.radE = 0; }
    else if (m === "expansion") { this.sT = 293.15; this.expHist = []; }
    else if (m === "calorimetry") { this.calT1 = V.T1; this.calT2 = V.T2; this.calHist = []; }
    else if (m === "gas") {
      this.gasRef = { T0: V.Tg, V0: V.Vg, P0: (V.n * RGAS * V.Tg) / (V.Vg * 1e-3) };
      this.gasHist = []; this.impulse = []; this.lastH = V.Vg / 5; this.lastGasSample = 0;
      const Ts = V.Tg / 200;
      for (let i = 0; i < GN; i++) {
        this.gp[i * 6] = (Math.random() - 0.5) * 3; this.gp[i * 6 + 1] = Math.random() * this.lastH; this.gp[i * 6 + 2] = (Math.random() - 0.5) * 3;
        const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2 * Math.sqrt(Ts);
        this.gp[i * 6 + 3] = g(); this.gp[i * 6 + 4] = g(); this.gp[i * 6 + 5] = g();
      }
    }
    this.dirty = true;
  }

  private buildDyn() {
    this.dyn.children.slice().forEach((c) => { this.dyn.remove(c); disposeObject(c); });
    const m = this.mode;
    if (m === "convection") {
      const hot = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 2.5), new THREE.MeshStandardMaterial({ color: "#c0392b", emissive: "#ff3d00", emissiveIntensity: 0.6 })); hot.position.set(0, -0.1, 0);
      const cold = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 2.5), new THREE.MeshStandardMaterial({ color: "#2e86de", emissive: "#0044ff", emissiveIntensity: 0.4 })); cold.position.set(0, 4.1, 0);
      const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6, 4, 2.5)), new THREE.LineBasicMaterial({ color: "#9fd8ff", transparent: true, opacity: 0.4 })); box.position.set(0, 2, 0);
      this.dyn.add(hot, cold, box);
    }
    if (m === "expansion") {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 1.2), new THREE.MeshStandardMaterial({ color: "#4a5568", metalness: 0.4 })); wall.position.set(-4.4, 0, 0);
      const base = new THREE.Mesh(new THREE.BoxGeometry(10, 0.1, 1.4), new THREE.MeshStandardMaterial({ color: "#2d3748" })); base.position.set(0, -0.8, 0);
      this.dyn.add(wall, base);
      for (let i = 0; i <= 20; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.02, i % 5 === 0 ? 0.5 : 0.28, 0.02), new THREE.MeshBasicMaterial({ color: "#cbd5e1" })); t.position.set(-4 + 8 * (1 / 1) * 0 + 0.35 * i + 0.0, -1.3 + 0, 0.5); t.position.x = 3.4 + i * 0.1 - 0.0; t.position.y = -1.05; this.dyn.add(t); }
    }
    if (m === "calorimetry") {
      this.block.position.set(0, 1.6, 0); this.water.position.set(0, 0, 0); this.beaker.position.set(0, 0.4, 0);
    }
    if (m === "gas") {
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 3.4), new THREE.MeshStandardMaterial({ color: "#4a5568", metalness: 0.6 })); base.position.set(0, -0.1, 0);
      this.dyn.add(base);
    }
    if (m === "radiation") { const s = labelSprite("T", "#fff", 0.01); s.visible = false; this.dyn.add(s); }
  }

  // ---------------- update ----------------
  update(dt: number) {
    this.time += dt;
    this.dirty = false;
    switch (this.mode) {
      case "conduction": this.condStep(dt); break;
      case "convection": this.convStep(dt); break;
      case "radiation": this.radStep(dt); break;
      case "expansion": this.expStep(dt); break;
      case "calorimetry": this.calStep(dt); break;
      case "gas": this.gasStep(dt); break;
    }
  }

  private condAlpha() { const m = MATS[this.values.mat]; return { m, a: m.k / (m.rho * m.c) }; }
  private condStep(dt: number) {
    const V = this.values, { m, a } = this.condAlpha();
    const Lx = 0.2, dx = Lx / NX, Ly = dx * NY;
    const auto = V.auto >= 0.5;
    const ts = auto ? Lx * Lx / a / 15 : V.tscale;
    const T = this.T, T2 = this.T2;
    let rem = dt * ts;
    const dtMax = (0.9 * dx * dx) / (4 * a);
    while (rem > 1e-12) {
      const h = Math.min(dtMax, rem), r = (a * h) / (dx * dx);
      rem -= h;
      for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
        const idx = j * NX + i, c = T[idx];
        const l = i > 0 ? T[idx - 1] : c, rr = i < NX - 1 ? T[idx + 1] : c, d = j > 0 ? T[idx - NX] : c, u = j < NY - 1 ? T[idx + NX] : c;
        T2[idx] = c + r * (l + rr + d + u - 4 * c);
      }
      // boundary conditions (Dirichlet baths)
      if (V.pattern === 0) for (let j = 0; j < NY; j++) { T2[j * NX] = V.Th; T2[j * NX + NX - 1] = V.Tc; }
      else if (V.pattern === 2) {
        for (let j = 0; j < NY; j++) { T2[j * NX] = V.Tc; T2[j * NX + NX - 1] = V.Tc; }
        for (let i = 0; i < NX; i++) { T2[i] = V.Tc; T2[(NY - 1) * NX + i] = V.Tc; }
      }
      T.set(T2);
      this.tPhys += h;
    }
    const lo = Math.min(V.Tc, V.Th) - 1, hi = Math.max(V.Th, V.Tc) + 1;
    for (let i = 0; i < T.length; i++) writeHeat(this.heatTex, i, (T[i] - lo) / (hi - lo));
    this.heatTex.needsUpdate = true;
    const mid = (NY >> 1) * NX + (NX >> 1);
    if (this.condHist.length === 0 || this.time - this.condHist[this.condHist.length - 1].t > 0.1) {
      this.condHist.push({ t: this.time, Tc: T[mid], Tm: this.mean(T) });
      if (this.condHist.length > 800) this.condHist.shift();
    }
    // flux at mid column
    let g = 0; const ic = NX >> 1;
    for (let j = 0; j < NY; j++) g += (T[j * NX + ic + 1] - T[j * NX + ic - 1]) / (2 * dx);
    g /= NY;
    const qMeas = -m.k * g;
    const qTheory = (m.k * (V.Th - V.Tc)) / Lx;
    const Ty: { x: number; y: number }[] = [], Tl: { x: number; y: number }[] = [];
    for (let i = 0; i < NX; i++) { Ty.push({ x: (i + 0.5) * dx * 100, y: T[(NY >> 1) * NX + i] }); Tl.push({ x: (i + 0.5) * dx * 100, y: V.Th + ((V.Tc - V.Th) * (i + 0.5)) / NX }); }
    this.ro = [
      { label: "ro.material", value: "mat." + m.id, tr: true } as Readout,
      { label: "ro.kcond", value: m.k, unit: "W/(m·K)", digits: 2 }, { label: "ro.alpha", value: a, unit: "m²/s", digits: 3 },
      { label: "ro.tphys", value: this.tPhys, unit: "s", digits: 2 }, { label: "ro.tscaleEff", value: ts, unit: "×", digits: 1 },
      { label: "ro.Tcenter", value: T[mid], unit: "K", temp: true, digits: 2 }, { label: "ro.Tmean", value: this.mean(T), unit: "K", temp: true, digits: 2 },
      { label: "ro.fluxMeas", value: V.pattern === 0 ? qMeas : "—", unit: "W/m²", digits: 1 },
      { label: "ro.fluxTheory", value: V.pattern === 0 ? qTheory : "—", unit: "W/m²", digits: 1 },
      { label: "ro.plateSize", value: `${(Lx * 100).toFixed(0)} × ${(Ly * 100).toFixed(1)} cm` },
    ];
    this.cs = [
      { id: "prof", title: "ch.tempProfile", xLabel: "ch.position", yLabel: "ch.temperature", xUnit: "cm", yUnit: "K", series: [{ label: "ch.tempSim", color: "#ff9f1c", pts: Ty }, ...(V.pattern === 0 ? [{ label: "ch.tempSteady", color: "#80ed99", pts: Tl, dashed: true }] : [])] },
      { id: "tt", title: "ch.tempTime", xLabel: "ch.time", yLabel: "ch.temperature", xUnit: "s", yUnit: "K", series: [{ label: "ro.Tcenter", color: "#ff6b9d", pts: this.condHist.map((h) => ({ x: h.t, y: h.Tc })) }, { label: "ro.Tmean", color: "#4cc9f0", pts: this.condHist.map((h) => ({ x: h.t, y: h.Tm })) }] },
    ];
  }
  private mean(a: Float32Array) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s / a.length; }

  private convStep(dt: number) {
    const V = this.values, W = 6, H = 4, g = 9.80665;
    const steps = dt > 0 ? Math.max(1, Math.round(dt * 120)) : 0;
    const h = steps ? dt / steps : 0;
    const Tm = (V.Th + V.Tc) / 2, hotOn = V.hot >= 0.5 || true;
    void hotOn;
    const NXc = 6, NYc = 8;
    for (let s = 0; s < steps; s++) {
      const sum = new Float32Array(NXc * NYc), cnt = new Float32Array(NXc * NYc);
      for (let i = 0; i < PN; i++) {
        const cx = Math.min(NXc - 1, Math.max(0, Math.floor(((this.pp[i * 4] + W / 2) / W) * NXc))), cy = Math.min(NYc - 1, Math.max(0, Math.floor((this.pp[i * 4 + 1] / H) * NYc)));
        sum[cy * NXc + cx] += this.pT[i]; cnt[cy * NXc + cx]++;
      }
      for (let i = 0; i < PN; i++) {
        let x = this.pp[i * 4], y = this.pp[i * 4 + 1], vx = this.pp[i * 4 + 2], vy = this.pp[i * 4 + 3], T = this.pT[i];
        const cx = Math.min(NXc - 1, Math.max(0, Math.floor(((x + W / 2) / W) * NXc))), cy = Math.min(NYc - 1, Math.max(0, Math.floor((y / H) * NYc)));
        const local = cnt[cy * NXc + cx] > 1 ? sum[cy * NXc + cx] / cnt[cy * NXc + cx] : T;
        T += 1.2 * (local - T) * h;
        if (y < 0.35) T += 5 * (V.Th - T) * h;
        if (y > H - 0.35) T += 5 * (V.Tc - T) * h;
        const buoy = (g * (T - Tm)) / Tm * 6;
        vy += (buoy - 1.8 * vy) * h; vx += (-1.8 * vx + (Math.random() - 0.5) * 3.0) * h;
        vy += (Math.random() - 0.5) * 1.5 * h;
        x += vx * h; y += vy * h;
        if (x < -W / 2) { x = -W / 2; vx = Math.abs(vx); } if (x > W / 2) { x = W / 2; vx = -Math.abs(vx); }
        if (y < 0.02) { y = 0.02; vy = Math.abs(vy) * 0.3; } if (y > H - 0.02) { y = H - 0.02; vy = -Math.abs(vy) * 0.3; }
        this.pp[i * 4] = x; this.pp[i * 4 + 1] = y; this.pp[i * 4 + 2] = vx; this.pp[i * 4 + 3] = vy; this.pT[i] = T;
      }
    }
    const pos = this.pts.geometry.attributes.position as THREE.BufferAttribute, col = this.pts.geometry.attributes.color as THREE.BufferAttribute, c = new THREE.Color();
    let flux = 0; const bins = new Array(10).fill(0), bc = new Array(10).fill(0);
    for (let i = 0; i < PN; i++) {
      pos.setXYZ(i, this.pp[i * 4], this.pp[i * 4 + 1], ((i * 7919) % 100) / 100 * 2 - 1);
      const t = (this.pT[i] - V.Tc) / Math.max(V.Th - V.Tc, 1);
      heatRGB(t, c); col.setXYZ(i, c.r, c.g, c.b);
      flux += this.pp[i * 4 + 3] * (this.pT[i] - Tm);
      const b = Math.min(9, Math.floor((this.pp[i * 4 + 1] / H) * 10)); bins[b] += this.pT[i]; bc[b]++;
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    flux /= PN;
    if (dt > 0 && (this.convHist.length === 0 || this.time - this.convHist[this.convHist.length - 1].t > 0.15)) { this.convHist.push({ t: this.time, flux, dT: 0 }); if (this.convHist.length > 600) this.convHist.shift(); }
    this.prof = bins.map((s, i) => (bc[i] ? s / bc[i] : Tm));
    const rising = Array.from({ length: PN }, (_, i) => this.pp[i * 4 + 3]).filter((v) => v > 0).length;
    this.ro = [
      { label: "ro.Thot", value: V.Th, unit: "K", temp: true, digits: 1 }, { label: "ro.Tcold", value: V.Tc, unit: "K", temp: true, digits: 1 },
      { label: "ro.beta", value: 1 / Tm, unit: "1/K", digits: 5 }, { label: "ro.heatFlux", value: flux, unit: "K·m/s", digits: 4 },
      { label: "ro.rising", value: `${rising} / ${PN}` }, { label: "ro.Tmean", value: this.pT.reduce((a, b) => a + b, 0) / PN, unit: "K", temp: true, digits: 1 },
    ];
    this.cs = [
      { id: "cprof", title: "ch.heightProfile", xLabel: "ch.height", yLabel: "ch.temperature", xUnit: "m", yUnit: "K", series: [{ label: "ch.temperature", color: "#ff9f1c", pts: this.prof.map((y, i) => ({ x: ((i + 0.5) * H) / 10, y })) }] },
      { id: "cflux", title: "ch.convFlux", xLabel: "ch.time", yLabel: "ro.heatFlux", xUnit: "s", series: [{ label: "ro.heatFlux", color: "#4cc9f0", pts: this.convHist.map((q) => ({ x: q.t, y: q.flux })) }] },
    ];
  }

  private radStep(dt: number) {
    const V = this.values, m = MATS[V.mat], r = V.rad;
    const A = 4 * Math.PI * r * r, mass = (m.rho * 4 * Math.PI * r ** 3) / 3, C = mass * m.c;
    const f = (T: number) => -(V.eps * SIGMA * A * (Math.pow(T, 4) - Math.pow(V.Tenv, 4))) / C;
    let rem = dt * V.tscale;
    while (rem > 1e-9) {
      const h = Math.min(rem, Math.max(0.005, Math.abs(f(this.sT)) > 0 ? 0.4 / Math.max(1, Math.abs(f(this.sT)) / this.sT * 20) : 0.05));
      const k1 = f(this.sT), k2 = f(this.sT + 0.5 * h * k1), k3 = f(this.sT + 0.5 * h * k2), k4 = f(this.sT + h * k3);
      const Tn = this.sT + (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      this.radE += V.eps * SIGMA * A * (Math.pow((this.sT + Tn) / 2, 4) - Math.pow(V.Tenv, 4)) * h;
      this.sT = Math.max(V.Tenv, Tn);
      rem -= h;
    }
    const P = V.eps * SIGMA * A * (Math.pow(this.sT, 4) - Math.pow(V.Tenv, 4));
    const bb = blackbodyColor(this.sT);
    const mat = this.sphere.material as THREE.MeshStandardMaterial;
    const glow = Math.max(0, Math.min(1, (this.sT - 700) / 1400));
    mat.emissive.copy(bb); mat.emissiveIntensity = glow * 2.2; mat.color.set("#2a2a2a").lerp(bb, glow * 0.5);
    this.sphere.scale.setScalar(2 + r * 4);
    this.lamp.color.copy(bb); this.lamp.intensity = glow * 120 * (r + 0.2);
    this.lamp.position.set(0, 0, 3);
    if (this.radHist.length === 0 || this.time - this.radHist[this.radHist.length - 1].t > 0.1) { this.radHist.push({ t: this.time * V.tscale, T: this.sT, P }); if (this.radHist.length > 900) this.radHist.shift(); }
    const lamMax = 2.897771955e-3 / this.sT;
    this.ro = [
      { label: "ro.Tsurf", value: this.sT, unit: "K", temp: true, digits: 1 }, { label: "ro.pRad", value: P, unit: "W", digits: 1 },
      { label: "ro.wien", value: lamMax * 1e6, unit: "µm", digits: 3 }, { label: "ro.area", value: A, unit: "m²", digits: 4 },
      { label: "ro.massS", value: mass, unit: "kg", digits: 3 }, { label: "ro.heatCap", value: C, unit: "J/K", digits: 1 },
      { label: "ro.radE", value: this.radE, unit: "J", digits: 1 },
      { label: "ro.heatLost", value: C * (V.T0 - this.sT), unit: "J", digits: 1 },
      { label: "ro.tscaleEff", value: V.tscale, unit: "×", digits: 0 },
    ];
    const T0 = V.T0, k = (3 * V.eps * SIGMA * A * T0 ** 3) / C;
    const analytic = V.Tenv <= 10 ? this.radHist.map((q) => ({ x: q.t, y: T0 / Math.cbrt(1 + k * q.t) })) : [];
    this.cs = [
      { id: "Tt", title: "ch.tempTime", xLabel: "ch.time", yLabel: "ch.temperature", xUnit: "s", yUnit: "K", series: [{ label: "ch.tempSim", color: "#ff9f1c", pts: this.radHist.map((q) => ({ x: q.t, y: q.T })) }, ...(analytic.length ? [{ label: "ch.analytic", color: "#80ed99", pts: analytic, dashed: true }] : [])] },
      { id: "Pt", title: "ch.radPower", xLabel: "ch.time", yLabel: "ro.pRad", xUnit: "s", yUnit: "W", series: [{ label: "ro.pRad", color: "#ff6b9d", pts: this.radHist.map((q) => ({ x: q.t, y: q.P })) }] },
    ];
  }

  private expStep(dt: number) {
    const V = this.values, m = MATS[V.mat];
    const Cth = V.mass * m.c, hloss = 3, Tenv = 293.15;
    const f = (T: number) => (V.P - hloss * (T - Tenv)) / Cth;
    let rem = dt * 1;
    while (rem > 1e-9) { const h = Math.min(rem, 0.05); this.sT += h * f(this.sT + 0.5 * h * f(this.sT)); rem -= h; }
    const dL = m.alpha * V.L0 * (this.sT - 293.15);
    const disp = V.L0 * 4 + dL * V.exag * 1; // visual length (scene units: 4 per metre)
    this.bar.scale.set(disp, 1, 1);
    this.bar.position.set(-4.2 + disp / 2, 0, 0);
    const t01 = Math.max(0, Math.min(1, (this.sT - 293) / 400));
    const mat = this.bar.material as THREE.MeshStandardMaterial;
    mat.color.set("#9aa3b2").lerp(heatRGB(t01), 0.7); mat.emissive.copy(heatRGB(t01)).multiplyScalar(t01 > 0.15 ? 0.5 : 0);
    this.pointer.position.set(-4.2 + disp, 0.5 * 0 + 0.55, 0); this.pointer.rotation.z = Math.PI;
    if (this.expHist.length === 0 || this.time - this.expHist[this.expHist.length - 1].t > 0.1) { this.expHist.push({ t: this.time, T: this.sT, dL: dL * 1000 }); if (this.expHist.length > 900) this.expHist.shift(); }
    this.ro = [
      { label: "ro.Tbar", value: this.sT, unit: "K", temp: true, digits: 2 }, { label: "ro.dT", value: this.sT - 293.15, unit: "K", digits: 2 },
      { label: "ro.alphaLin", value: m.alpha * 1e6, unit: "×10⁻⁶ /K", digits: 1 }, { label: "ro.dL", value: dL * 1000, unit: "mm", digits: 4 },
      { label: "ro.Lnow", value: V.L0 + dL, unit: "m", digits: 5 }, { label: "ro.betaVol", value: 3 * m.alpha * 1e6, unit: "×10⁻⁶ /K", digits: 1 },
      { label: "ro.heatIn", value: V.P * this.time, unit: "J", digits: 0 }, { label: "ro.heatCapS", value: Cth, unit: "J/K", digits: 0 },
      { label: "ro.exag", value: V.exag, unit: "×", digits: 0 },
    ];
    this.cs = [
      { id: "dlT", title: "ch.dLvsT", xLabel: "ch.temperature", yLabel: "ch.dL", xUnit: "K", yUnit: "mm", series: [{ label: "ch.dL", color: "#ff9f1c", pts: this.expHist.map((q) => ({ x: q.T, y: q.dL })) }] },
      { id: "Tt", title: "ch.tempTime", xLabel: "ch.time", yLabel: "ch.temperature", xUnit: "s", yUnit: "K", series: [{ label: "ch.temperature", color: "#ff6b9d", pts: this.expHist.map((q) => ({ x: q.t, y: q.T })) }] },
    ];
  }

  private calStep(dt: number) {
    const V = this.values, m = MATS[V.mat];
    const C1 = V.mass * m.c, C2 = V.m2 * 4186;
    let rem = dt * V.tscale;
    while (rem > 1e-9) {
      const h = Math.min(rem, 0.2 * Math.min(C1, C2) / V.h);
      const q = V.h * (this.calT1 - this.calT2);
      const T1 = this.calT1 - (q * h) / C1, T2 = this.calT2 + (q * h) / C2;
      this.calT1 = T1; this.calT2 = T2; rem -= h;
    }
    const Tf = (C1 * V.T1 + C2 * V.T2) / (C1 + C2);
    this.block.position.set(0, 0.5, 0);
    (this.block.material as THREE.MeshStandardMaterial).color.copy(heatRGB((this.calT1 - 273) / 500));
    (this.block.material as THREE.MeshStandardMaterial).emissive.copy(heatRGB((this.calT1 - 273) / 500)).multiplyScalar(this.calT1 > 450 ? 0.5 : 0.1);
    (this.water.material as THREE.MeshStandardMaterial).color.copy(heatRGB((this.calT2 - 273) / 120)).lerp(new THREE.Color("#3a9bff"), 0.4);
    if (this.calHist.length === 0 || this.time - this.calHist[this.calHist.length - 1].t > 0.1) { this.calHist.push({ t: this.time * V.tscale, T1: this.calT1, T2: this.calT2 }); if (this.calHist.length > 900) this.calHist.shift(); }
    const Qm = C1 * (V.T1 - this.calT1), Qw = C2 * (this.calT2 - V.T2);
    this.ro = [
      { label: "ro.Tmetal", value: this.calT1, unit: "K", temp: true, digits: 2 }, { label: "ro.Twater", value: this.calT2, unit: "K", temp: true, digits: 2 },
      { label: "ro.Tfinal", value: Tf, unit: "K", temp: true, digits: 2 }, { label: "ro.cMetal", value: m.c, unit: "J/(kg·K)", digits: 0 },
      { label: "ro.Qlost", value: Qm, unit: "J", digits: 1 }, { label: "ro.Qgained", value: Qw, unit: "J", digits: 1 },
      { label: "ro.Qresid", value: Qm - Qw, unit: "J", digits: 6, tone: Math.abs(Qm - Qw) < 1e-6 * Math.max(1, Math.abs(Qm)) ? "ok" : "bad" },
      { label: "ro.heatCapS", value: C1, unit: "J/K", digits: 1 },
    ];
    this.cs = [{ id: "cal", title: "ch.tempTime", xLabel: "ch.time", yLabel: "ch.temperature", xUnit: "s", yUnit: "K", series: [
      { label: "ro.Tmetal", color: "#ff9f1c", pts: this.calHist.map((q) => ({ x: q.t, y: q.T1 })) }, { label: "ro.Twater", color: "#4cc9f0", pts: this.calHist.map((q) => ({ x: q.t, y: q.T2 })) },
      { label: "ro.Tfinal", color: "#80ed99", dashed: true, pts: this.calHist.length ? [{ x: 0, y: Tf }, { x: this.calHist[this.calHist.length - 1].t, y: Tf }] : [] }] }];
  }

  private gasStep(dt: number) {
    const V = this.values, Hn = V.Vg / 5, A = 1.5 * 1.5 * 4, half = 1.5;
    const steps = dt > 0 ? Math.max(1, Math.round(dt * 120)) : 0;
    const h = steps ? dt / steps : 0;
    const Ts = V.Tg / 200;
    const pv = h > 0 ? (Hn - this.lastH) / dt : 0;
    this.pistonV = pv;
    let H = this.lastH;
    for (let s = 0; s < steps; s++) {
      H += (Hn - H) * Math.min(1, h * 8 > 0 ? 1 : 0) * 0 + ((Hn - H) > 0 ? Math.min(Hn - H, 3 * h) : Math.max(Hn - H, -3 * h));
      const vp = (Hn - H) === 0 ? 0 : Math.sign(Hn - H) * 3;
      for (let i = 0; i < GN; i++) {
        const o = i * 6;
        this.gp[o] += this.gp[o + 3] * h; this.gp[o + 1] += this.gp[o + 4] * h; this.gp[o + 2] += this.gp[o + 5] * h;
        for (const a of [0, 2]) { const k = o + a; if (this.gp[k] > half) { this.gp[k] = half; this.gp[k + 3] = -Math.abs(this.gp[k + 3]); } if (this.gp[k] < -half) { this.gp[k] = -half; this.gp[k + 3] = Math.abs(this.gp[k + 3]); } }
        if (this.gp[o + 1] < 0) { this.gp[o + 1] = 0; this.gp[o + 4] = Math.abs(this.gp[o + 4]); }
        if (this.gp[o + 1] > H) {
          const vrel = this.gp[o + 4] - vp;
          this.gp[o + 1] = H;
          if (vrel > 0) { const vn = this.gp[o + 4]; this.gp[o + 4] = 2 * vp - vn; this.impulse.push({ t: this.time, j: 2 * (vrel) }); }
        }
      }
    }
    this.lastH = H;
    // thermostat towards target temperature
    let v2 = 0; for (let i = 0; i < GN; i++) v2 += this.gp[i * 6 + 3] ** 2 + this.gp[i * 6 + 4] ** 2 + this.gp[i * 6 + 5] ** 2;
    v2 /= GN;
    const sc = Math.sqrt((3 * Ts) / Math.max(v2, 1e-9));
    const ks = 1 + (sc - 1) * 0.04;
    if (dt > 0) for (let i = 0; i < GN; i++) { this.gp[i * 6 + 3] *= ks; this.gp[i * 6 + 4] *= ks; this.gp[i * 6 + 5] *= ks; }
    const pos = this.gasPts.geometry.attributes.position as THREE.BufferAttribute, col = this.gasPts.geometry.attributes.color as THREE.BufferAttribute, c = new THREE.Color();
    for (let i = 0; i < GN; i++) {
      pos.setXYZ(i, this.gp[i * 6], this.gp[i * 6 + 1], this.gp[i * 6 + 2]);
      const sp = Math.hypot(this.gp[i * 6 + 3], this.gp[i * 6 + 4], this.gp[i * 6 + 5]);
      heatRGB(Math.min(1, sp / (3.2 * Math.sqrt(Math.max(Ts, 0.4)))), c); col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.piston.position.set(0, H + 0.125, 0);
    this.gasBox.scale.set(1, Math.max(H, 0.01), 1); this.gasBox.position.set(0, H / 2, 0);
    // measurement window
    const win = 3;
    this.impulse = this.impulse.filter((q) => q.t > this.time - win);
    const span = Math.min(win, Math.max(this.time, 1e-6));
    const Pkin = this.impulse.reduce((a, b) => a + b.j, 0) / (A / 4) / span; // piston area = 3x3 = 9 → using (1.5*1.5*4)/4... below
    void Pkin;
    const areaP = 9;
    const Pmeas = this.impulse.reduce((a, b) => a + b.j, 0) / areaP / span;
    const Vs = 9 * H, Ptheory = (GN * Ts) / Vs; // reduced units (m=1, k_B=1)
    const T = V.Tg, Vm3 = V.Vg * 1e-3, P = (V.n * RGAS * T) / Vm3;
    const meanKE = 0.5 * v2;
    if (dt > 0 && this.time - this.lastGasSample > 0.1) { this.lastGasSample = this.time; this.gasHist.push({ t: this.time, V: V.Vg, P: P / 1000, T }); if (this.gasHist.length > 600) this.gasHist.shift(); }
    this.ro = [
      { label: "ro.pressure", value: P, unit: "Pa", digits: 1 }, { label: "ro.pressureAtm", value: P / 101325, unit: "atm", digits: 4 },
      { label: "ro.volume", value: V.Vg, unit: "L", digits: 2 }, { label: "ro.Tgas", value: T, unit: "K", temp: true, digits: 1 },
      { label: "ro.moles", value: V.n, unit: "mol", digits: 2 }, { label: "ro.pvnrt", value: (P * Vm3) / (V.n * RGAS * T), digits: 6, tone: "ok" },
      { label: "ro.Uint", value: 1.5 * V.n * RGAS * T, unit: "J", digits: 1 }, { label: "ro.kineticRatio", value: Pmeas > 0 && this.time > 1 ? Pmeas / Ptheory : "…", digits: 3 },
      { label: "ro.meanKE", value: meanKE / (Ts * 1.5), digits: 3 },
    ];
    const iso: { x: number; y: number }[] = [], adi: { x: number; y: number }[] = [];
    for (let v = 5; v <= 50; v += 1) { iso.push({ x: v, y: (V.n * RGAS * T) / (v * 1e-3) / 1000 }); adi.push({ x: v, y: P / 1000 * Math.pow(V.Vg / v, 5 / 3) }); }
    this.cs = [
      { id: "pv", title: "ch.pvDiagram", xLabel: "ch.volume", yLabel: "ch.pressure", xUnit: "L", yUnit: "kPa", series: [
        { label: "ch.isotherm", color: "#4cc9f0", pts: iso, dashed: true }, { label: "ch.adiabat", color: "#c77dff", pts: adi, dashed: true },
        { label: "ch.path", color: "#ff9f1c", pts: this.gasHist.map((q) => ({ x: q.V, y: q.P })) }, { label: "ch.now", color: "#ffd166", pts: [{ x: V.Vg, y: P / 1000 }], points: true }] },
      { id: "pt", title: "ch.tempTime", xLabel: "ch.time", yLabel: "ch.temperature", xUnit: "s", yUnit: "K", series: [{ label: "ch.temperature", color: "#ff6b9d", pts: this.gasHist.map((q) => ({ x: q.t, y: q.T })) }] },
    ];
  }
}
