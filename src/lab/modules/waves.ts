import * as THREE from "three";
import type { ChartSpec, ParamDef, Readout } from "../types";
import { ModuleBase, deg, disposeObject, labelSprite, rad } from "./util";

const TAU = Math.PI * 2;
const N1 = 161;

export class WavesModule extends ModuleBase {
  cat = "waves";
  modes = [
    { id: "transverse", label: "wav.transverse" }, { id: "longitudinal", label: "wav.longitudinal" },
    { id: "interference", label: "wav.interference" }, { id: "standing", label: "wav.standing" },
    { id: "reflection", label: "wav.reflection" }, { id: "refraction", label: "wav.refraction" },
    { id: "diffraction", label: "wav.diffraction" }, { id: "doppler", label: "wav.doppler" },
  ];
  private surf: THREE.Mesh;
  private surfGeo: THREE.PlaneGeometry;
  private surfMat: THREE.ShaderMaterial;
  private baseX: Float32Array; private baseZ: Float32Array;
  private fre: Float32Array; private fim: Float32Array;
  private chain: THREE.InstancedMesh;
  private chainLine: THREE.Line;
  private inc: THREE.Line; private refl: THREE.Line;
  private dyn = new THREE.Group();
  private ringGroup = new THREE.Group();
  private rings: { te: number; xe: number; mesh: THREE.LineLoop }[] = [];
  private nextEmit = 0;
  private arrivals: { A: number[]; B: number[] } = { A: [], B: [] };
  private srcMesh: THREE.Mesh;
  private ringGeo: THREE.BufferGeometry;
  private ringMat = new THREE.LineBasicMaterial({ color: "#7ee8ff", transparent: true, opacity: 0.9 });
  private ro: Readout[] = [];
  private cs: ChartSpec[] = [];
  private lastMs = 0;

  constructor() {
    super();
    const L = (k: string, min: number, max: number, step: number, value: number, unit: string | undefined, modes?: string[], extra: Partial<ParamDef> = {}): ParamDef =>
      ({ key: k, label: "wavp." + k, min, max, step, value, unit, modes, ...extra });
    const all2D = ["interference", "reflection", "refraction", "diffraction"];
    const defs: ParamDef[] = [
      L("f", 0.1, 3, 0.01, 0.5, "Hz"), L("lam", 0.4, 6, 0.05, 2, "m"), L("A", 0.02, 0.6, 0.01, 0.3, "m"),
      L("phi", 0, 360, 1, 0, "°"), L("v", 0.1, 8, 0.05, 1, "m/s"), L("px", -6, 6, 0.1, 2, "m"),
      L("harm", 1, 8, 1, 3, undefined, ["standing"]),
      L("d", 1, 8, 0.1, 4, "m", ["interference", "diffraction"], { hidden: (v) => false && v.f > 99 }),
      L("a", 0.4, 5, 0.05, 1.5, "m", ["diffraction"]),
      L("slits", 1, 2, 1, 1, undefined, ["diffraction"], { type: "select", options: [{ v: 1, label: "wavp.single" }, { v: 2, label: "wavp.double" }] }),
      L("xw", 1.5, 6, 0.1, 4, "m", ["reflection"]),
      L("theta", 0, 80, 1, 35, "°", ["refraction"]),
      L("vr", 0.3, 2, 0.01, 0.6, undefined, ["refraction"]),
      L("mach", 0, 1.6, 0.01, 0.5, undefined, ["doppler"]),
    ];
    this.defs = defs;

    this.surfGeo = new THREE.PlaneGeometry(16, 10, 128, 80);
    this.surfGeo.rotateX(-Math.PI / 2);
    const pos = this.surfGeo.attributes.position;
    this.baseX = new Float32Array(pos.count); this.baseZ = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) { this.baseX[i] = pos.getX(i); this.baseZ[i] = pos.getZ(i); }
    this.fre = new Float32Array(pos.count); this.fim = new Float32Array(pos.count);
    this.surfMat = new THREE.ShaderMaterial({
      uniforms: { uInv: { value: 1 } },
      side: THREE.DoubleSide,
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uInv; varying vec3 vP;
        void main(){ vec3 n=normalize(cross(dFdx(vP),dFdy(vP))); if(n.y<0.0) n=-n;
          float h=clamp(vP.y*uInv*0.5+0.5,0.0,1.0);
          vec3 deep=vec3(0.02,0.10,0.30), crest=vec3(0.45,0.88,1.0);
          vec3 c=mix(deep,crest,h);
          vec3 L=normalize(vec3(0.4,1.0,0.3)); float d=max(dot(n,L),0.0);
          vec3 H=normalize(L+vec3(0.0,0.6,0.8)); float s=pow(max(dot(n,H),0.0),48.0);
          c=c*(0.55+0.6*d)+vec3(s)*0.6;
          float grid=1.0-smoothstep(0.0,0.06,min(fract(vP.x),fract(vP.z))); c=mix(c,c*0.7,grid*0.25);
          gl_FragColor=vec4(c,1.0);} `,
    });
    this.surf = new THREE.Mesh(this.surfGeo, this.surfMat);
    this.surf.frustumCulled = false;
    this.group.add(this.surf, this.dyn, this.ringGroup);

    this.chain = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2 }), N1);
    this.chain.frustumCulled = false;
    const mkLine = (c: string, op: number) => new THREE.Line(new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(N1 * 3), 3)), new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: op }));
    this.chainLine = mkLine("#7ee8ff", 0.9); this.inc = mkLine("#ffd166", 0.5); this.refl = mkLine("#ff6b9d", 0.5);
    this.chainLine.frustumCulled = this.inc.frustumCulled = this.refl.frustumCulled = false;
    this.group.add(this.chain, this.chainLine, this.inc, this.refl);
    this.ringGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 97 }, (_, i) => new THREE.Vector3(Math.cos((i / 96) * TAU), 0, Math.sin((i / 96) * TAU))));
    this.srcMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), new THREE.MeshStandardMaterial({ color: "#ffd166", emissive: "#ff9f1c", emissiveIntensity: 1.5 }));
    this.group.add(this.srcMesh);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: "#0b1220", roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.2; floor.receiveShadow = true;
    this.group.add(floor);
    this.setup(defs, {
      transverse: {}, longitudinal: {}, interference: { d: 4 }, standing: { harm: 3 }, reflection: { xw: 4 },
      refraction: { theta: 35, vr: 0.6 }, diffraction: { d: 4, a: 1.5, lam: 1.5 }, doppler: { v: 2, f: 1, lam: 2, mach: 0.5 },
    }, "interference");
    this.syncFrom("f");
    this.onMode();
  }

  info() { return { desc: "waves.desc." + this.mode, model: this.mode === "refraction" || this.mode === "reflection" || this.mode === "diffraction" ? "waves.model2d" : "waves.model" }; }
  cameraHint() {
    const oneD = ["transverse", "longitudinal", "standing"].includes(this.mode);
    return oneD ? { pos: [0, 2, 13] as [number, number, number], target: [0, 0, 0] as [number, number, number] } : { pos: [0, 11, 9] as [number, number, number], target: [0, 0, 0] as [number, number, number] };
  }
  readouts() { return this.ro; }
  charts() { return this.cs; }

  private syncFrom(k: string) {
    const V = this.values, clamp = (key: string, x: number) => { const d = this.defs.find((q) => q.key === key)!; return Math.max(d.min, Math.min(d.max, x)); };
    if (this.mode === "standing") {
      const lam = 16 / 2 / V.harm * 1; // string length 8 m => λ = 2L/n
      const Ls = 8; V.lam = (2 * Ls) / V.harm;
      if (k === "f") V.v = clamp("v", V.f * V.lam); else V.f = clamp("f", V.v / V.lam);
      void lam; return;
    }
    if (k === "v") V.f = clamp("f", V.v / V.lam);
    if (k === "v" && Math.abs(V.f * V.lam - V.v) > 1e-3) V.lam = clamp("lam", V.v / V.f);
    if (k === "f" || k === "lam") V.v = clamp("v", V.f * V.lam);
  }
  protected onParam(k: string) {
    if (k === "*") { return; }
    if (["f", "lam", "v", "harm"].includes(k)) this.syncFrom(k === "harm" ? "v" : k);
    if (k === "lam" || k === "f" || k === "mach") this.arrivals = { A: [], B: [] };
  }
  protected onMode() {
    const V = this.values;
    if (this.mode === "standing") this.syncFrom("v");
    else {
      const md = this.modeDefaults[this.mode] ?? {};
      if (md.f === undefined) V.f = 0.5;
      if (md.lam === undefined) V.lam = 2;
      V.v = Math.max(0.1, Math.min(8, V.f * V.lam));
    }
    const oneD = ["transverse", "longitudinal", "standing"].includes(this.mode);
    this.surf.visible = !oneD && this.mode !== "doppler";
    this.chain.visible = this.chainLine.visible = oneD;
    this.inc.visible = this.refl.visible = this.mode === "standing";
    this.srcMesh.visible = this.mode === "doppler";
    this.ringGroup.visible = this.mode === "doppler";
    this.clearRings();
    this.buildDyn();
  }
  protected onReset() { this.clearRings(); this.nextEmit = 0; this.arrivals = { A: [], B: [] }; }
  private clearRings() { this.rings.forEach((r) => this.ringGroup.remove(r.mesh)); this.rings = []; this.nextEmit = 0; }

  private buildDyn() {
    this.dyn.children.slice().forEach((c) => { this.dyn.remove(c); disposeObject(c); });
    const V = this.values;
    const box = (w: number, h: number, d: number, x: number, y: number, z: number, color = "#9aa6b8") => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.6 }));
      m.position.set(x, y, z); this.dyn.add(m);
    };
    if (this.mode === "reflection") box(0.25, 0.7, 10, V.xw + 0.125, 0.1, 0, "#c7d0dc");
    if (this.mode === "refraction") {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(8, 10), new THREE.MeshBasicMaterial({ color: "#ff9f1c", transparent: true, opacity: 0.1, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(4, 0.02, 0); this.dyn.add(m);
      box(0.05, 0.05, 10, 0, 0.05, 0, "#ffffff");
    }
    if (this.mode === "diffraction") {
      const a = V.a, d = V.d;
      const gaps: [number, number][] = V.slits === 1 ? [[-a / 2, a / 2]] : [[-d / 2 - a / 2, -d / 2 + a / 2], [d / 2 - a / 2, d / 2 + a / 2]];
      let z0 = -5;
      for (const [g0, g1] of gaps) { if (g0 > z0) box(0.3, 0.8, g0 - z0, 0, 0.1, (g0 + z0) / 2); z0 = g1; }
      if (z0 < 5) box(0.3, 0.8, 5 - z0, 0, 0.1, (5 + z0) / 2);
    }
    if (this.mode === "doppler") {
      for (const [x, name] of [[-9, "A"], [9, "B"]] as [number, string][]) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), new THREE.MeshStandardMaterial({ color: name === "A" ? "#ff6b9d" : "#80ed99" }));
        m.position.set(x, 0, 0); this.dyn.add(m);
        const s = labelSprite(name, "#ffffff", 0.7); s.position.set(x, 0.9, 0); this.dyn.add(s);
      }
    }
  }

  // ---------- 2D field: complex amplitude (unit incident amplitude) ----------
  private field(x: number, z: number, out: [number, number]) {
    const V = this.values, k = TAU / V.lam, ph = rad(V.phi);
    let re = 0, im = 0;
    const add = (a: number, th: number) => { re += a * Math.cos(th); im += a * Math.sin(th); };
    switch (this.mode) {
      case "interference": {
        for (const s of [-1, 1]) {
          const r = Math.hypot(x, z - (s * V.d) / 2) + 0.05;
          add(1.4 / Math.sqrt(r + 0.6), k * r + (s > 0 ? ph : 0));
        }
        break;
      }
      case "reflection": {
        if (x < V.xw) {
          const r1 = Math.hypot(x + 4, z) + 0.05, r2 = Math.hypot(x - (2 * V.xw + 4), z) + 0.05;
          add(1.6 / Math.sqrt(r1 + 0.6), k * r1 + ph);
          add(-1.6 / Math.sqrt(r2 + 0.6), k * r2 + ph);
        }
        break;
      }
      case "refraction": {
        const t1 = rad(V.theta), k1 = k, k2 = k / V.vr; // v2 = vr*v1 => λ2 = vr λ1
        const s2 = Math.sin(t1) / V.vr;
        if (x < 0) {
          add(1, k1 * (x * Math.cos(t1) + z * Math.sin(t1)) + ph);
          if (s2 > 1) add(1, k1 * (-x * Math.cos(t1) + z * Math.sin(t1)) + ph);
        } else if (s2 <= 1) add(1, k2 * (x * Math.sqrt(1 - s2 * s2) + z * s2) + ph);
        else { const kap = k1 * Math.sqrt(s2 * s2 - 1) * 0 + k * Math.sqrt(Math.max(Math.sin(t1) ** 2 / (V.vr * V.vr) - 1, 0)) / V.vr; add(Math.exp(-kap * x), k1 * z * Math.sin(t1) + ph); }
        break;
      }
      case "diffraction": {
        if (x < 0) { add(1, k * x + ph); break; }
        const a = V.a, gaps = V.slits === 1 ? [0] : [-V.d / 2, V.d / 2];
        const M = 18;
        for (const c of gaps) for (let i = 0; i < M; i++) {
          const zs = c - a / 2 + (a * (i + 0.5)) / M;
          const r = Math.hypot(x, z - zs) + 0.02;
          const w = (a / M) * Math.sqrt(k / (TAU * r));
          add(w, k * r + ph - Math.PI / 4);
        }
        break;
      }
    }
    out[0] = re; out[1] = im;
  }

  // ---------- 1D ----------
  private h1(x: number, t: number): number {
    const V = this.values, k = TAU / V.lam, w = TAU * V.f, ph = rad(V.phi);
    if (this.mode === "standing") {
      if (Math.abs(x) > 4) return 0;
      const xs = x + 4; // fixed ends at xs = 0 and 8
      return V.A * Math.sin(k * xs - w * t + ph) - V.A * Math.sin(-k * xs - w * t + ph);
    }
    return V.A * Math.sin(k * x - w * t + ph);
  }

  update(dt: number) {
    this.time += dt;
    const V = this.values, t = this.time, w = TAU * V.f;
    if (this.dirty) { this.buildDyn(); }
    const oneD = ["transverse", "longitudinal", "standing"].includes(this.mode);
    const k = TAU / V.lam;
    if (oneD) {
      const m = new THREE.Matrix4(), c = new THREE.Color();
      const arr = this.chainLine.geometry.attributes.position as THREE.BufferAttribute;
      const half = this.mode === "standing" ? 4 : 8;
      const Ae = this.mode === "longitudinal" ? Math.min(V.A, 0.8 / k) : V.A;
      for (let i = 0; i < N1; i++) {
        const x0 = -half + (2 * half * i) / (N1 - 1);
        let x = x0, y = 0, col = 0.5;
        if (this.mode === "longitudinal") {
          const xi = Ae * Math.sin(k * x0 - w * t + rad(V.phi));
          x = x0 + xi;
          col = 0.5 - 0.5 * Math.max(-0.99, Math.min(0.99, Ae * k * Math.cos(k * x0 - w * t + rad(V.phi))));
          y = 0;
        } else y = this.h1(x0, t);
        m.makeTranslation(x, y, 0);
        this.chain.setMatrixAt(i, m);
        this.chain.setColorAt(i, c.setHSL(0.58 - col * 0.55, 0.9, 0.55));
        arr.setXYZ(i, x, y, 0);
      }
      this.chain.instanceMatrix.needsUpdate = true;
      if (this.chain.instanceColor) this.chain.instanceColor.needsUpdate = true;
      arr.needsUpdate = true;
      this.chainLine.visible = this.mode !== "longitudinal";
      if (this.mode === "standing") {
        const a1 = this.inc.geometry.attributes.position as THREE.BufferAttribute, a2 = this.refl.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < N1; i++) {
          const x = -4 + (8 * i) / (N1 - 1);
          a1.setXYZ(i, x, V.A * Math.sin(k * (x + 4) - w * t + rad(V.phi)), 0);
          a2.setXYZ(i, x, -V.A * Math.sin(-k * (x + 4) - w * t + rad(V.phi)), 0);
        }
        a1.needsUpdate = a2.needsUpdate = true;
      }
    } else if (this.mode === "doppler") this.updateDoppler(dt);
    else {
      if (this.dirty) {
        const o: [number, number] = [0, 0];
        for (let i = 0; i < this.baseX.length; i++) { this.field(this.baseX[i], this.baseZ[i], o); this.fre[i] = o[0]; this.fim[i] = o[1]; }
      }
      const c = Math.cos(w * t), s = Math.sin(w * t), pos = this.surfGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < this.fre.length; i++) pos.setY(i, V.A * (this.fre[i] * c + this.fim[i] * s));
      pos.needsUpdate = true;
      this.surfMat.uniforms.uInv.value = 1 / Math.max(V.A * (this.mode === "interference" ? 2 : 1.4), 1e-3);
    }
    this.dirty = false;
    this.computeOutputs();
  }

  private updateDoppler(dt: number) {
    void dt;
    const V = this.values, t = this.time, vwave = V.v, vs = V.mach * vwave, T0 = 1 / V.f;
    const range = 12;
    const cyc = vs > 1e-6 ? range / vs : 1e9;
    const tl = t % cyc, xs = vs > 1e-6 ? -6 + vs * tl : 0;
    if (this.lastMs > tl + 1e-6 || V.mach !== this.lastMach) { this.clearRings(); this.arrivals = { A: [], B: [] }; this.nextEmit = Math.ceil((tl - 1e-9) / T0) * T0; this.lastMach = V.mach; }
    this.lastMs = tl;
    this.srcMesh.position.set(xs, 0, 0);
    while (this.nextEmit <= tl) {
      const te = this.nextEmit, xe = vs > 1e-6 ? -6 + vs * te : 0;
      const mesh = new THREE.LineLoop(this.ringGeo, this.ringMat);
      mesh.position.set(xe, 0.02, 0);
      this.ringGroup.add(mesh);
      this.rings.push({ te, xe, mesh });
      for (const [key, xo] of [["A", -9], ["B", 9]] as ["A" | "B", number][]) this.arrivals[key].push(te + Math.abs(xo - xe) / vwave);
      this.nextEmit += T0;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i], rr = vwave * (tl - r.te);
      if (rr > 22) { this.ringGroup.remove(r.mesh); this.rings.splice(i, 1); continue; }
      r.mesh.scale.set(Math.max(rr, 1e-3), 1, Math.max(rr, 1e-3));
    }
  }
  private lastMach = -1;

  private measuredF(arr: number[], tl: number) {
    const done = arr.filter((a) => a <= tl);
    if (done.length < 3) return NaN;
    const n = Math.min(6, done.length - 1);
    return n / (done[done.length - 1] - done[done.length - 1 - n]);
  }

  private computeOutputs() {
    const V = this.values, t = this.time, k = TAU / V.lam, w = TAU * V.f;
    const base: Readout[] = [
      { label: "ro.freq", value: V.f, unit: "Hz", digits: 3 }, { label: "ro.period", value: 1 / V.f, unit: "s", digits: 3 },
      { label: "ro.wavelength", value: V.lam, unit: "m", digits: 3 }, { label: "ro.speed", value: V.f * V.lam, unit: "m/s", digits: 3 },
      { label: "ro.omega", value: w, unit: "rad/s", digits: 3 }, { label: "ro.wavenumber", value: k, unit: "rad/m", digits: 3 },
    ];
    const cs: ChartSpec[] = [];
    const oneD = ["transverse", "longitudinal", "standing"].includes(this.mode);
    const xr = oneD ? (this.mode === "standing" ? 4 : 8) : 8;
    const o: [number, number] = [0, 0];
    const sp: { x: number; y: number }[] = [], tp: { x: number; y: number }[] = [];
    const wc = Math.cos(w * t), ws = Math.sin(w * t);
    if (this.mode === "doppler") {
      const vs = V.mach * V.v, v = V.v;
      const fa = vs < v ? (V.f * v) / (v - vs) : NaN, fb = (V.f * v) / (v + vs);
      const mA = this.measuredF(this.arrivals.A, this.time % (vs > 1e-6 ? 12 / vs : 1e9)), mB = this.measuredF(this.arrivals.B, this.time % (vs > 1e-6 ? 12 / vs : 1e9));
      this.ro = [...base,
        { label: "ro.vs", value: vs, unit: "m/s", digits: 3 }, { label: "ro.mach", value: V.mach, digits: 2 },
        { label: "ro.fBehindTheory", value: fb, unit: "Hz", digits: 3 }, { label: "ro.fBehindMeas", value: Number.isFinite(mA) ? mA : "…", unit: "Hz", digits: 3 },
        { label: "ro.fAheadTheory", value: Number.isFinite(fa) ? fa : "∞ (shock)", unit: "Hz", digits: 3 }, { label: "ro.fAheadMeas", value: Number.isFinite(mB) && vs < v ? mB : "…", unit: "Hz", digits: 3 },
        ...(V.mach > 1 ? [{ label: "ro.machAngle", value: deg(Math.asin(1 / V.mach)), unit: "°", digits: 2 } as Readout] : [])];
      const ca: { x: number; y: number }[] = [], cb: { x: number; y: number }[] = [];
      for (let m = 0; m < 0.98; m += 0.02) { ca.push({ x: m, y: V.f / (1 - m) }); }
      for (let m = 0; m <= 1.6; m += 0.02) cb.push({ x: m, y: V.f / (1 + m) });
      cs.push({ id: "dop", title: "ch.doppler", xLabel: "ch.machNumber", yLabel: "ch.obsFreq", yUnit: "Hz", series: [
        { label: "ro.fAheadTheory", color: "#80ed99", pts: ca }, { label: "ro.fBehindTheory", color: "#ff6b9d", pts: cb },
        { label: "ch.now", color: "#ffd166", pts: [{ x: V.mach, y: fb }].concat(Number.isFinite(fa) ? [{ x: V.mach, y: fa }] : []), points: true }] });
      this.cs = cs; return;
    }
    for (let i = 0; i <= 200; i++) {
      const x = -xr + (2 * xr * i) / 200;
      if (oneD) {
        if (this.mode === "longitudinal") sp.push({ x, y: V.A * Math.sin(k * x - w * t + rad(V.phi)) });
        else sp.push({ x, y: this.h1(x, t) });
      } else { this.field(x, 0, o); sp.push({ x, y: V.A * (o[0] * wc + o[1] * ws) }); }
    }
    const Tw = Math.max(4 / V.f, 4);
    const px = this.mode === "standing" ? Math.max(-4, Math.min(4, V.px)) : V.px;
    let pf: [number, number] = [0, 0];
    if (!oneD) { this.field(px, 0, o); pf = [o[0], o[1]]; }
    for (let i = 0; i <= 160; i++) {
      const tt = t - Tw + (Tw * i) / 160;
      if (tt < 0) continue;
      const y = oneD ? (this.mode === "longitudinal" ? V.A * Math.sin(k * px - w * tt + rad(V.phi)) : this.h1(px, tt)) : V.A * (pf[0] * Math.cos(w * tt) + pf[1] * Math.sin(w * tt));
      tp.push({ x: tt, y });
    }
    cs.push({ id: "wsp", title: this.mode === "longitudinal" ? "ch.dispSpace" : "ch.waveSpace", xLabel: "ch.position", yLabel: this.mode === "longitudinal" ? "ch.displacement" : "ch.height", xUnit: "m", yUnit: "m", series: [{ label: "ch.waveform", color: "#4cc9f0", pts: sp }] });
    cs.push({ id: "wt", title: "ch.waveTime", xLabel: "ch.time", yLabel: "ch.height", xUnit: "s", yUnit: "m", series: [{ label: "ch.probe", color: "#ffd166", pts: tp }] });
    let extra: Readout[] = [];
    if (this.mode === "standing") {
      const n = V.harm;
      extra = [{ label: "ro.harmonic", value: n, digits: 0 }, { label: "ro.nodes", value: n + 1, digits: 0 }, { label: "ro.antinodes", value: n, digits: 0 }, { label: "ro.fn", value: (n * V.v) / 16, unit: "Hz", digits: 3 }];
    }
    if (this.mode === "interference" || this.mode === "diffraction") {
      const xs = this.mode === "diffraction" ? 20 : 8, ip: { x: number; y: number }[] = [];
      const zr = this.mode === "diffraction" ? 12 : 5;
      for (let i = 0; i <= 240; i++) { const z = -zr + (2 * zr * i) / 240; this.field(xs, z, o); ip.push({ x: z, y: o[0] * o[0] + o[1] * o[1] }); }
      cs.push({ id: "int", title: "ch.intensity", xLabel: "ch.screenPos", yLabel: "ch.intensityRel", xUnit: "m", series: [{ label: "ch.intensityRel", color: "#ff9f1c", pts: ip }] });
      if (this.mode === "interference") {
        extra = [{ label: "ro.pathDiffMax", value: V.d, unit: "m", digits: 3 }, { label: "ro.maxima", value: Math.floor(V.d / V.lam) * 2 + 1, digits: 0 }];
      } else {
        // first minimum from the centre
        let zmin = NaN;
        const iC = 120;
        for (let i = iC + 1; i < ip.length - 1; i++) if (ip[i].y < ip[i - 1].y && ip[i].y <= ip[i + 1].y) { zmin = ip[i].x; break; }
        const meas = Number.isFinite(zmin) ? deg(Math.atan(zmin / xs)) : NaN;
        if (V.slits === 1) {
          const sin = V.lam / V.a;
          extra = [{ label: "ro.minTheory", value: sin <= 1 ? deg(Math.asin(sin)) : "—", unit: "°", digits: 2 }, { label: "ro.minMeas", value: Number.isFinite(meas) ? meas : "—", unit: "°", digits: 2 }];
        } else extra = [{ label: "ro.fringeTheory", value: (V.lam * xs) / V.d, unit: "m", digits: 3 }, { label: "ro.minMeas", value: Number.isFinite(meas) ? meas : "—", unit: "°", digits: 2 }];
      }
    }
    if (this.mode === "refraction") {
      const s2 = Math.sin(rad(V.theta)) / V.vr;
      extra = [{ label: "ro.theta1", value: V.theta, unit: "°", digits: 2 }, s2 <= 1 ? { label: "ro.theta2", value: deg(Math.asin(s2)), unit: "°", digits: 2 } : { label: "ro.theta2", value: "TIR", tone: "warn" },
        { label: "ro.lam2", value: V.lam * V.vr, unit: "m", digits: 3 }, { label: "ro.v2", value: V.f * V.lam * V.vr, unit: "m/s", digits: 3 }, { label: "ro.nrel", value: 1 / V.vr, digits: 3 }];
    }
    if (this.mode === "reflection") extra = [{ label: "ro.reflLaw", value: "θᵢ = θᵣ" }, { label: "ro.phaseShift", value: 180, unit: "°", digits: 0 }];
    if (this.mode === "longitudinal") extra = [{ label: "ro.dispAmpEff", value: Math.min(V.A, 0.8 / k), unit: "m", digits: 3 }];
    this.ro = [...base, ...extra];
    this.cs = cs;
  }

  dispose() { this.ringMat.dispose(); this.ringGeo.dispose(); disposeObject(this.group); }
}
