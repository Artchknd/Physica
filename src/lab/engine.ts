import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PhysicsSim, initRapier, type Observation } from "./physics";
import { MATERIALS, applyMaterial, createMaterial, disposeTextures } from "./materials";
import { DEFAULTS, disposeGeometries, geometryFor, makeObject, quatOf, volumeOf } from "./shapes";
import { PRESETS, defaultValues, presetById, type Preset, type Sample } from "./presets";
import { sanitizeScene } from "./scenes";
import { uid, type ChartSpec, type EnvData, type EnvKey, type JointData, type JointKind, type MaterialKey, type Notice, type ObjData, type Readout, type SceneData, type ShapeKind, type V3 } from "./types";
import type { ModuleBase } from "./modules/util";
import { labelSprite } from "./modules/util";

export type Cat = "mechanics" | "optics" | "waves" | "em" | "thermo";
export type Tool = "none" | "ruler" | "protractor" | "inspect";
export type Gizmo = "select" | "translate" | "rotate" | "scale";
export type VecKey = "v" | "a" | "F" | "p" | "g";

export interface Settings {
  snap: boolean; snapT: number; snapR: number;
  shadows: "off" | "low" | "med" | "high"; adaptive: boolean;
  ambient: number; sun: number; point: number; spot: number;
  showGrid: boolean; showAxes: boolean; trails: boolean;
  vec: Record<VecKey, boolean>; vecScale: number;
  gizmo: Gizmo; ortho: boolean; theme: "dark" | "light"; tempUnit: "K" | "C";
}

export const ENV_G: Record<Exclude<EnvKey, "custom">, number> = { earth: 9.80665, moon: 1.62, mars: 3.71, zero: 0 };

const VEC_COL: Record<VecKey, number> = { v: 0x4cc9f0, a: 0xff9f1c, F: 0xff4d6d, p: 0x80ed99, g: 0xc77dff };
const HOME = { pos: new THREE.Vector3(9, 7, 13), target: new THREE.Vector3(0, 1.5, 0) };

export interface Live {
  cat: Cat; running: boolean; speed: number; simTime: number; maxTime: number; fps: number; quality: number;
  obs: Observation | null; obsId: string | null; sys: { ek: number; ep: number; es: number; total: number; pmag: number } | null;
  readouts: Readout[]; charts: ChartSpec[]; stopwatch: number; swRunning: boolean;
  measure: { tool: Tool; n: number; result: { kind: string; value: number; dx?: number; dy?: number; dz?: number } | null };
  inspect: V3 | null; dist2: number | null; moduleInfo: { desc: string; model: string } | null; nObjects: number;
}

interface Snap { t: number; data: Uint8Array }

export class LabEngine {
  container!: HTMLElement;
  renderer!: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  persp = new THREE.PerspectiveCamera(50, 1, 0.05, 600);
  ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -200, 600);
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.persp;
  controls!: OrbitControls;
  tc!: TransformControls;
  pivot = new THREE.Object3D();
  sim = new PhysicsSim();
  data: SceneData = this.emptyScene();
  meshes = new Map<string, THREE.Mesh>();
  selection: string[] = [];
  settings: Settings = {
    snap: false, snapT: 0.25, snapR: 15, shadows: "med", adaptive: true, ambient: 0.35, sun: 2.2, point: 0, spot: 0,
    showGrid: true, showAxes: true, trails: false, vec: { v: false, a: false, F: false, p: false, g: false }, vecScale: 1,
    gizmo: "translate", ortho: false, theme: "dark", tempUnit: "K",
  };
  cat: Cat = "mechanics";
  running = false;
  speed = 1;
  presetId: string | null = null;
  presetValues: Record<string, number> = {};
  trackedId: string | null = null;
  hist: Sample[] = [];
  snaps: Snap[] = [];
  tool: Tool = "none";
  mPoints: THREE.Vector3[] = [];
  mResult: Live["measure"]["result"] = null;
  inspectPt: V3 | null = null;
  swRunning = false; private swT0 = 0; private swAcc = 0;
  onChange: () => void = () => {};
  onNotice: (n: Notice) => void = () => {};
  onContext: (c: { x: number; y: number; id: string | null }) => void = () => {};
  modules = new Map<Cat, ModuleBase>();
  private moduleLoaders: Record<string, () => Promise<ModuleBase>> = {};
  private moduleRoot = new THREE.Group();
  private objGroup = new THREE.Group();
  private jointGroup = new THREE.Group();
  private vecGroup = new THREE.Group();
  private trailGroup = new THREE.Group();
  private measureGroup = new THREE.Group();
  private envGroup = new THREE.Group();
  private jointLines = new Map<string, THREE.Line>();
  private jointMarks = new Map<string, THREE.Mesh>();
  private arrows = new Map<string, THREE.ArrowHelper>();
  private trails = new Map<string, { line: THREE.Line; n: number; pos: Float32Array }>();
  private outlines = new Map<string, THREE.Mesh>();
  private outlineMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.BackSide });
  private lights: { amb: THREE.AmbientLight; hemi: THREE.HemisphereLight; sun: THREE.DirectionalLight; point: THREE.PointLight; spot: THREE.SpotLight } | null = null;
  private grids: THREE.Object3D[] = [];
  private floor!: THREE.Mesh;
  private rafId = 0;
  private lastT = 0;
  private acc = 0;
  private lastSample = -1;
  private lastSnap = -1;
  private rewound = false;
  private history: string[] = [];
  private hIdx = -1;
  private lastCommit = { tag: "", t: 0 };
  private camGoal: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private dragging = false;
  private dragStart: { pivot: THREE.Matrix4; mats: Map<string, THREE.Matrix4>; scales: Map<string, V3> } | null = null;
  private dragModule: THREE.Object3D | null = null;
  private downPos = { x: 0, y: 0, b: 0 };
  private ro?: ResizeObserver;
  private frames = 0; private fpsT = 0; fps = 60; quality = 1; private slowT = 0;
  private envTex?: THREE.Texture;
  private disposed = false;
  private pulleyWheels = new Map<string, { jid: string; r: number }>();
  private cleanup: (() => void)[] = [];
  private presetBuilt: { camera?: { pos: V3; target: V3 } } = {};
  dist2: number | null = null;

  emptyScene(): SceneData {
    return { v: 1, name: "Scene", objects: [], joints: [], env: { preset: "earth", g: 9.80665, air: false, rho: 1.225 } };
  }

  // ------------------------------------------------------------------ init
  async init(container: HTMLElement) {
    this.container = container;
    await initRapier();
    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      throw new Error("webgl");
    }
    const r = this.renderer;
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);
    r.domElement.style.touchAction = "none";
    r.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.onNotice({ key: "err.contextLost", tone: "error" }); });

    const pm = new THREE.PMREMGenerator(r);
    this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.7;
    this.scene.add(this.envGroup, this.objGroup, this.jointGroup, this.vecGroup, this.trailGroup, this.measureGroup, this.moduleRoot, this.pivot);
    this.buildEnvironment();
    this.buildLights();

    this.persp.position.copy(HOME.pos);
    this.camera = this.persp;
    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.target.copy(HOME.target);
    this.controls.maxPolarAngle = Math.PI * 0.497;
    this.controls.minDistance = 0.8;
    this.controls.maxDistance = 120;
    this.controls.zoomToCursor = true;

    this.tc = new TransformControls(this.camera, r.domElement);
    this.tc.size = 0.85;
    this.scene.add(this.tc.getHelper());
    this.tc.addEventListener("dragging-changed", ((e: { value: boolean }) => {
      this.controls.enabled = !e.value;
      if (e.value) this.beginGizmo(); else this.endGizmo();
    }) as never);
    this.tc.addEventListener("objectChange", (() => this.onGizmoChange()) as never);

    const dom = r.domElement;
    const pd = (e: PointerEvent) => this.onPointerDown(e);
    const pm2 = (e: PointerEvent) => this.onPointerMove(e);
    const pu = (e: PointerEvent) => this.onPointerUp(e);
    const cm = (e: Event) => e.preventDefault();
    dom.addEventListener("pointerdown", pd);
    dom.addEventListener("pointermove", pm2);
    dom.addEventListener("pointerup", pu);
    dom.addEventListener("contextmenu", cm);
    this.cleanup.push(() => { dom.removeEventListener("pointerdown", pd); dom.removeEventListener("pointermove", pm2); dom.removeEventListener("pointerup", pu); dom.removeEventListener("contextmenu", cm); });

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    this.moduleLoaders = {
      optics: async () => new (await import("./modules/optics")).OpticsModule(),
      waves: async () => new (await import("./modules/waves")).WavesModule(),
      em: async () => new (await import("./modules/em")).EMModule(),
      thermo: async () => new (await import("./modules/thermo")).ThermoModule(),
    };
    this.setTheme(this.settings.theme);
    this.applySettings();
    this.lastT = performance.now();
    this.rafId = requestAnimationFrame((t) => this.loop(t));
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.rafId);
    this.cleanup.forEach((f) => f());
    this.ro?.disconnect();
    this.modules.forEach((m) => m.dispose());
    this.clearMeshes();
    this.trails.forEach((t) => { t.line.geometry.dispose(); (t.line.material as THREE.Material).dispose(); });
    this.arrows.forEach((a) => a.dispose());
    this.tc?.dispose();
    this.controls?.dispose();
    this.sim.dispose();
    this.envTex?.dispose();
    disposeGeometries();
    disposeTextures();
    this.outlineMat.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
    });
    this.renderer?.dispose();
    this.renderer?.domElement.remove();
  }

  // ------------------------------------------------------------------ environment
  private buildEnvironment() {
    const g = this.envGroup;
    this.floor = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), new THREE.MeshStandardMaterial({ color: "#1b2230", roughness: 0.55, metalness: 0.15 }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.receiveShadow = true;
    g.add(this.floor);
    const g1 = new THREE.GridHelper(60, 60, 0x5b6b86, 0x2c3850);
    const g2 = new THREE.GridHelper(60, 12, 0x8aa0c8, 0x8aa0c8);
    (g1.material as THREE.Material).transparent = true; (g1.material as THREE.Material).opacity = 0.55;
    (g2.material as THREE.Material).transparent = true; (g2.material as THREE.Material).opacity = 0.5;
    g1.position.y = 0.003; g2.position.y = 0.004;
    g.add(g1, g2);
    this.grids = [g1, g2];
    // axes
    const axes = new THREE.Group();
    const mkAxis = (dir: THREE.Vector3, color: number, label: string) => {
      const a = new THREE.ArrowHelper(dir, new THREE.Vector3(0, 0.01, 0), 3.2, color, 0.3, 0.16);
      const s = labelSprite(label, "#" + color.toString(16).padStart(6, "0"), 0.55);
      s.position.copy(dir.clone().multiplyScalar(3.7)).add(new THREE.Vector3(0, 0.1, 0));
      axes.add(a, s);
    };
    mkAxis(new THREE.Vector3(1, 0, 0), 0xff4d6d, "X"); mkAxis(new THREE.Vector3(0, 1, 0), 0x80ed99, "Y"); mkAxis(new THREE.Vector3(0, 0, 1), 0x4cc9f0, "Z");
    for (let x = -20; x <= 20; x += 2) {
      if (x === 0) continue;
      const s = labelSprite(`${x}`, "#9fb0cc", 0.32);
      s.position.set(x, 0.03, 0.55); s.material.opacity = 0.75;
      axes.add(s);
    }
    for (let z = -20; z <= 20; z += 2) {
      if (z === 0) continue;
      const s = labelSprite(`${z}`, "#7aa6c8", 0.28);
      s.position.set(0.55, 0.03, z); s.material.opacity = 0.6;
      axes.add(s);
    }
    g.add(axes);
    this.grids.push(axes);
    this.scene.fog = new THREE.Fog(0x0b1020, 60, 160);
  }

  private buildLights() {
    const amb = new THREE.AmbientLight(0xffffff, 0.35);
    const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x20242c, 0.4);
    const sun = new THREE.DirectionalLight(0xfff1dc, 2.2);
    sun.position.set(10, 18, 8);
    sun.castShadow = true;
    sun.shadow.camera.left = -22; sun.shadow.camera.right = 22; sun.shadow.camera.top = 22; sun.shadow.camera.bottom = -22;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
    const point = new THREE.PointLight(0xffc680, 0, 60, 1.4);
    point.position.set(-7, 6, 5);
    point.castShadow = false;
    const spot = new THREE.SpotLight(0x9ec5ff, 0, 80, 0.5, 0.6, 1.2);
    spot.position.set(7, 12, -6);
    spot.target.position.set(0, 0, 0);
    spot.castShadow = true; spot.shadow.bias = -0.0005; spot.shadow.radius = 3;
    this.scene.add(amb, hemi, sun, point, spot, spot.target);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0xffc680 }));
    lamp.position.copy(point.position);
    lamp.name = "lamp";
    this.envGroup.add(lamp);
    this.lights = { amb, hemi, sun, point, spot };
  }

  applySettings() {
    const s = this.settings, L = this.lights;
    if (!L) return;
    L.amb.intensity = s.ambient;
    L.sun.intensity = s.sun; L.point.intensity = s.point * 120; L.spot.intensity = s.spot * 250;
    (this.envGroup.getObjectByName("lamp") as THREE.Mesh).visible = s.point > 0;
    const sizes = { off: 0, low: 1024, med: 2048, high: 4096 } as const;
    const size = sizes[s.shadows] / (this.quality < 0.8 ? 2 : 1);
    this.renderer.shadowMap.enabled = s.shadows !== "off";
    for (const l of [L.sun, L.spot, L.point]) {
      l.castShadow = s.shadows !== "off" && (l !== L.point || s.shadows === "high");
      if (l.shadow.mapSize.x !== size && size > 0) { l.shadow.mapSize.set(size, size); l.shadow.map?.dispose(); l.shadow.map = null; }
    }
    this.grids[0].visible = this.grids[1].visible = s.showGrid && this.cat === "mechanics";
    this.grids[2].visible = s.showAxes && this.cat === "mechanics";
    this.tc.setTranslationSnap(s.snap ? s.snapT : null);
    this.tc.setRotationSnap(s.snap ? THREE.MathUtils.degToRad(s.snapR) : null);
    this.tc.setScaleSnap(s.snap ? 0.1 : null);
    this.updateGizmo();
    this.clearTrails();
  }

  setTheme(t: "dark" | "light") {
    this.settings.theme = t;
    const dark = t === "dark";
    this.scene.background = new THREE.Color(dark ? 0x0b1020 : 0xdfe7f3);
    (this.scene.fog as THREE.Fog).color.set(dark ? 0x0b1020 : 0xdfe7f3);
    (this.floor.material as THREE.MeshStandardMaterial).color.set(dark ? "#1b2230" : "#c9d3e3");
    this.scene.environmentIntensity = dark ? 0.7 : 1.0;
  }

  private resize() {
    if (!this.container || !this.renderer) return;
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = "100%"; this.renderer.domElement.style.height = "100%";
    const a = w / h;
    this.persp.aspect = a; this.persp.updateProjectionMatrix();
    const hh = (this.ortho.top - this.ortho.bottom) / 2;
    this.ortho.left = -hh * a; this.ortho.right = hh * a; this.ortho.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ camera
  setOrtho(on: boolean) {
    this.settings.ortho = on;
    const from = this.camera, to = on ? this.ortho : this.persp;
    if (from === to) return;
    const dist = from.position.distanceTo(this.controls.target);
    const hh = dist * Math.tan(THREE.MathUtils.degToRad(this.persp.fov / 2));
    const a = this.persp.aspect;
    if (on) { this.ortho.top = hh; this.ortho.bottom = -hh; this.ortho.left = -hh * a; this.ortho.right = hh * a; this.ortho.zoom = 1; }
    to.position.copy(from.position); to.quaternion.copy(from.quaternion);
    this.ortho.updateProjectionMatrix();
    this.camera = to;
    this.controls.object = to;
    this.tc.camera = to;
    this.controls.update();
    this.emit();
  }
  resetCamera() {
    const h = this.cat === "mechanics" ? (this.presetBuilt.camera ? { pos: new THREE.Vector3(...this.presetBuilt.camera.pos), target: new THREE.Vector3(...this.presetBuilt.camera.target) } : HOME) : (() => { const hint = this.modules.get(this.cat)?.cameraHint() ?? { pos: [0, 2, 10], target: [0, 0, 0] }; return { pos: new THREE.Vector3(...hint.pos), target: new THREE.Vector3(...hint.target) }; })();
    this.flyTo(h.pos.clone(), h.target.clone());
  }
  flyTo(pos: THREE.Vector3, target: THREE.Vector3) { this.camGoal = { pos, target }; }
  focusSelection() {
    if (!this.selection.length) return;
    const box = new THREE.Box3();
    this.selection.forEach((id) => { const m = this.meshes.get(id); if (m) box.expandByObject(m); });
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), s = box.getSize(new THREE.Vector3()).length();
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.flyTo(c.clone().addScaledVector(dir, Math.max(4, s * 2.2)), c);
  }

  // ------------------------------------------------------------------ emit / notices
  emit() { this.onChange(); }
  notice(key: string, tone: Notice["tone"] = "info", params?: Notice["params"]) { this.onNotice({ key, tone, params }); }

  // ------------------------------------------------------------------ scene data
  snapshotJSON() { return JSON.stringify({ objects: this.data.objects, joints: this.data.joints, env: this.data.env }); }
  commit(tag = "") {
    const j = this.snapshotJSON();
    const now = performance.now();
    if (tag && tag === this.lastCommit.tag && now - this.lastCommit.t < 700 && this.hIdx === this.history.length - 1) {
      this.history[this.hIdx] = j;
    } else {
      this.history = this.history.slice(0, this.hIdx + 1);
      this.history.push(j);
      if (this.history.length > 120) this.history.shift();
      this.hIdx = this.history.length - 1;
    }
    this.lastCommit = { tag, t: now };
    this.emit();
  }
  resetHistory() { this.history = [this.snapshotJSON()]; this.hIdx = 0; this.lastCommit = { tag: "", t: 0 }; }
  canUndo() { return this.hIdx > 0; }
  canRedo() { return this.hIdx < this.history.length - 1; }
  private applyHistory(i: number) {
    try {
      const raw = JSON.parse(this.history[i]);
      const s = sanitizeScene({ ...raw, module: undefined });
      this.data.objects = s.objects; this.data.joints = s.joints; this.data.env = s.env;
      this.selection = this.selection.filter((id) => this.data.objects.some((o) => o.id === id));
      this.rebuildMeshes();
      this.rebuildPhysics(false);
      this.hIdx = i;
      this.emit();
    } catch { this.notice("err.history", "error"); }
  }
  undo() { if (this.canUndo()) { this.applyHistory(this.hIdx - 1); this.notice("msg.undo"); } }
  redo() { if (this.canRedo()) { this.applyHistory(this.hIdx + 1); this.notice("msg.redo"); } }

  getSceneData(): SceneData {
    const d: SceneData = JSON.parse(JSON.stringify({ ...this.data, v: 1 }));
    if (this.cat !== "mechanics") { const m = this.modules.get(this.cat); if (m) d.module = m.state(); }
    if (this.presetId) { d.presetId = this.presetId; d.presetValues = { ...this.presetValues }; }
    return d;
  }

  async loadSceneData(d: SceneData) {
    this.running = false;
    this.data = { v: 1, name: d.name, objects: d.objects, joints: d.joints, env: d.env };
    this.presetId = d.presetId && presetById(d.presetId) ? d.presetId : null;
    this.presetValues = d.presetId && presetById(d.presetId) ? { ...defaultValues(presetById(d.presetId)!), ...(d.presetValues ?? {}) } : {};
    this.presetBuilt = {};
    this.trackedId = null;
    this.selection = [];
    if (d.module && d.module.cat !== "mechanics") {
      await this.setCategory(d.module.cat as Cat, false);
      this.modules.get(this.cat)?.restore(d.module.mode, d.module.values, d.module.data);
    } else await this.setCategory("mechanics", false);
    this.rebuildMeshes();
    this.rebuildPhysics(false);
    this.resetHistory();
    this.resetCamera();
    this.emit();
  }

  // ------------------------------------------------------------------ meshes
  private clearMeshes() {
    this.meshes.forEach((m) => { (m.material as THREE.Material).dispose(); this.objGroup.remove(m); });
    this.meshes.clear();
    this.outlines.clear();
  }
  makeMesh(o: ObjData) {
    const m = new THREE.Mesh(geometryFor(o.kind, o.scale), createMaterial(o));
    m.castShadow = o.material !== "glass" && o.material !== "water";
    m.receiveShadow = true;
    m.userData.id = o.id;
    this.setMeshFromData(m, o);
    return m;
  }
  private setMeshFromData(m: THREE.Mesh, o: ObjData) {
    m.position.set(...o.pos);
    m.quaternion.copy(quatOf(o.rot));
    m.scale.set(...o.scale);
  }
  rebuildMeshes() {
    this.clearMeshes();
    for (const o of this.data.objects) {
      const m = this.makeMesh(o);
      this.meshes.set(o.id, m);
      this.objGroup.add(m);
    }
    this.updateOutlines();
    this.buildJointVisuals();
  }
  refreshMesh(o: ObjData) {
    const m = this.meshes.get(o.id);
    if (!m) return;
    applyMaterial(m.material as THREE.MeshPhysicalMaterial, o);
    const geo = geometryFor(o.kind, o.scale);
    if (m.geometry !== geo) m.geometry = geo;
    m.castShadow = o.material !== "glass" && o.material !== "water";
    m.scale.set(...o.scale);
  }
  obj(id: string) { return this.data.objects.find((o) => o.id === id); }

  // ------------------------------------------------------------------ physics control
  rebuildPhysics(keep: boolean) {
    const keepStates = keep && this.sim.stepped ? this.sim.captureStates() : undefined;
    this.sim.build(this.data.objects, this.data.joints, this.data.env, keepStates);
    if (!keepStates) {
      this.hist = []; this.snaps = []; this.lastSample = -1; this.lastSnap = -1; this.acc = 0; this.rewound = false;
      this.clearTrails();
      this.pushSnap();
    }
    this.pulleyWheels.clear();
    for (const j of this.data.joints) if (j.kind === "pulley" && j.wheel) { const w = this.obj(j.wheel); this.pulleyWheels.set(j.wheel, { jid: j.id, r: w ? 0.5 * w.scale[0] : 0.5 }); }
    this.syncMeshes(true);
    this.buildJointVisuals();
  }
  private pushSnap() {
    this.snaps.push({ t: this.sim.time, data: this.sim.snapshot() });
    if (this.snaps.length > 900) this.snaps.shift();
    this.lastSnap = this.sim.time;
  }
  setRunning(on: boolean) {
    if (on && this.cat === "mechanics") this.prepareStep();
    this.running = on;
    this.emit();
  }
  toggleRun() { this.setRunning(!this.running); }
  private prepareStep() {
    if (this.rewound) {
      this.snaps = this.snaps.filter((s) => s.t <= this.sim.time + 1e-9);
      this.hist = this.hist.filter((h) => h.t <= this.sim.time + 1e-9);
      this.rewound = false; this.lastSnap = this.sim.time;
    }
  }
  stepOnce() {
    this.running = false;
    if (this.cat === "mechanics") { this.prepareStep(); for (let i = 0; i < 4; i++) this.sim.step(); this.afterSteps(); this.syncMeshes(); }
    else this.modules.get(this.cat)?.update(1 / 60);
    this.emit();
  }
  reset() {
    this.running = false;
    if (this.cat === "mechanics") this.rebuildPhysics(false);
    else this.modules.get(this.cat)?.reset();
    this.swAcc = 0; this.swT0 = 0; this.swRunning = false;
    this.emit();
  }
  setSpeed(s: number) { this.speed = s; this.emit(); }
  seek(t: number) {
    if (this.cat !== "mechanics" || !this.snaps.length) return;
    this.running = false;
    let idx = 0;
    for (let i = 0; i < this.snaps.length; i++) if (this.snaps[i].t <= t + 1e-9) idx = i;
    const s = this.snaps[idx];
    this.sim.restore(s.data, s.t);
    this.hist = this.hist.filter((h) => h.t <= s.t + 1e-9);
    this.rewound = true;
    this.clearTrails();
    this.syncMeshes(true);
    this.emit();
  }
  setEnv(key: EnvKey, g?: number) {
    const e = this.data.env;
    e.preset = key;
    if (key !== "custom") e.g = ENV_G[key]; else if (g !== undefined) e.g = Math.max(0, Math.min(100, g));
    this.sim.setEnv(e);
    this.commit("env");
  }
  setAir(on: boolean, rho?: number) {
    this.data.env.air = on;
    if (rho !== undefined) this.data.env.rho = rho;
    this.sim.setEnv(this.data.env);
    this.commit("air");
  }

  private afterSteps() {
    if (this.sim.nonFinite) {
      this.running = false;
      this.notice("err.unstable", "error");
      this.rebuildPhysics(false);
      return;
    }
    const tid = this.trackId();
    if (tid !== this.trackedId) { this.trackedId = tid; this.hist = []; }
    if (tid && (this.lastSample < 0 || this.sim.time - this.lastSample >= 1 / 60 - 1e-9)) {
      this.lastSample = this.sim.time;
      const o = this.sim.observe(tid);
      if (o) {
        const e = this.sim.systemEnergy();
        this.hist.push({ t: this.sim.time, p: o.p, v: o.v, a: o.a, F: o.F, ek: o.ekT + o.ekR, ep: o.ep, e: o.e, sys: e.total });
        if (this.hist.length > 7000) this.hist.splice(0, 500);
      }
    }
    if (this.sim.time - this.lastSnap >= 0.25) this.pushSnap();
  }
  private trackId(): string | null {
    const sel = this.selection.find((id) => { const o = this.obj(id); return o && !o.isStatic; });
    if (sel) return sel;
    if (this.trackedId && this.obj(this.trackedId) && !this.obj(this.trackedId)!.isStatic && !this.selection.length) return this.trackedId;
    if (this.trackedId && this.obj(this.trackedId) && !this.obj(this.trackedId)!.isStatic && this.presetId) return this.trackedId;
    return this.data.objects.find((o) => !o.isStatic)?.id ?? null;
  }

  syncMeshes(all = false) {
    const q = new THREE.Quaternion();
    for (const o of this.data.objects) {
      const m = this.meshes.get(o.id);
      if (!m) continue;
      if (this.dragging && this.selection.includes(o.id)) continue;
      if (o.isStatic && !all) continue;
      const b = this.sim.body(o.id);
      if (!b) continue;
      const t = b.translation(), r = b.rotation();
      m.position.set(t.x, t.y, t.z);
      m.quaternion.copy(q.set(r.x, r.y, r.z, r.w));
    }
    // pulley wheels rotate with rope travel (visual of the ideal pulley)
    this.pulleyWheels.forEach((pw, wid) => {
      const j = this.data.joints.find((x) => x.id === pw.jid), m = this.meshes.get(wid), o = this.obj(wid);
      if (j && m && o) { const base = quatOf(o.rot); m.quaternion.copy(base.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -this.sim.pulleyAngle(j, pw.r)))); }
    });
  }

  // ------------------------------------------------------------------ loop
  private loop(ts: number) {
    if (this.disposed) return;
    this.rafId = requestAnimationFrame((t) => this.loop(t));
    const dtw = Math.min(0.1, Math.max(0, (ts - this.lastT) / 1000));
    this.lastT = ts;
    this.frames++; this.fpsT += dtw;
    if (this.fpsT >= 0.5) { this.fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0; this.adaptQuality(); }
    if (this.camGoal) {
      const k = 1 - Math.exp(-7 * dtw);
      this.camera.position.lerp(this.camGoal.pos, k);
      this.controls.target.lerp(this.camGoal.target, k);
      if (this.camera.position.distanceTo(this.camGoal.pos) < 0.02 && this.controls.target.distanceTo(this.camGoal.target) < 0.02) this.camGoal = null;
    }
    this.controls.update();
    if (this.cat === "mechanics") {
      if (this.running) {
        this.acc += dtw * this.speed;
        let n = 0;
        while (this.acc >= this.sim.dt && n < 28) { this.sim.step(); this.acc -= this.sim.dt; n++; }
        if (n >= 28) this.acc = 0;
        this.afterSteps();
        this.syncMeshes();
        this.updateTrails();
      }
      this.updateJoints();
      this.updateVectors();
      if (this.dragging) this.updateOutlinesTransform();
    } else {
      const m = this.modules.get(this.cat);
      if (m) {
        try { m.update(this.running ? dtw * this.speed : 0); } catch (e) { this.running = false; console.error(e); this.notice("err.module", "error"); }
        const dr = m.draggables.length > 0;
        void dr;
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  private adaptQuality() {
    if (!this.settings.adaptive) { if (this.quality !== 1) { this.quality = 1; this.setPR(); } return; }
    if (this.fps < 28) { this.slowT += 0.5; if (this.slowT >= 1.5 && this.quality > 0.55) { this.quality = Math.max(0.55, this.quality - 0.15); this.setPR(); this.slowT = 0; } }
    else if (this.fps > 52 && this.quality < 1) { this.slowT -= 0.5; if (this.slowT <= -4) { this.quality = Math.min(1, this.quality + 0.15); this.setPR(); this.slowT = 0; } }
    else this.slowT = 0;
  }
  private setPR() { this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2) * this.quality); this.resize(); }

  // ------------------------------------------------------------------ categories & modules
  async setCategory(cat: Cat, fly = true) {
    this.running = false;
    this.cat = cat;
    const mech = cat === "mechanics";
    this.objGroup.visible = this.jointGroup.visible = this.vecGroup.visible = this.trailGroup.visible = mech;
    this.measureGroup.visible = mech;
    this.moduleRoot.visible = !mech;
    this.floor.visible = mech;
    this.moduleRoot.children.slice().forEach((c) => this.moduleRoot.remove(c));
    this.selectIds([]);
    this.controls.maxPolarAngle = mech ? Math.PI * 0.497 : Math.PI;
    if (!mech) {
      let m = this.modules.get(cat);
      if (!m) {
        try { m = await this.moduleLoaders[cat](); this.modules.set(cat, m); } catch (e) { console.error(e); this.notice("err.module", "error"); this.cat = "mechanics"; this.objGroup.visible = true; this.floor.visible = true; this.emit(); return; }
      }
      this.moduleRoot.add(m.group);
      if (fly) { const h = m.cameraHint(); this.flyTo(new THREE.Vector3(...h.pos), new THREE.Vector3(...h.target)); }
    } else if (fly) this.resetCamera();
    this.applySettings();
    if (!mech) this.running = true;
    this.emit();
  }
  get module() { return this.modules.get(this.cat) ?? null; }
  setModuleMode(mode: string) {
    const m = this.module; if (!m) return;
    this.presetId = null;
    m.setMode(mode);
    this.running = true;
    const h = m.cameraHint(); this.flyTo(new THREE.Vector3(...h.pos), new THREE.Vector3(...h.target));
    this.emit();
  }
  setModuleParam(k: string, v: number) { this.module?.setParam(k, v); this.emit(); }

  // ------------------------------------------------------------------ presets
  async loadPreset(id: string, values?: Record<string, number>, fly = true) {
    const p = presetById(id);
    if (!p) return;
    if (p.module) {
      await this.setCategory(p.cat as Cat, fly);
      const m = this.module;
      if (m) { m.setMode(p.module.mode); if (p.module.values) for (const [k, v] of Object.entries(p.module.values)) m.setParam(k, v); }
      this.presetId = id; this.presetValues = {};
      this.running = true;
      this.notice("msg.presetLoaded", "ok", { name: id });
      this.emit();
      return;
    }
    await this.setCategory("mechanics", false);
    this.applyPreset(p, { ...defaultValues(p), ...(values ?? {}) }, fly);
    this.running = false;
    this.notice("msg.presetLoaded", "ok", { name: id });
  }
  private applyPreset(p: Preset, v: Record<string, number>, fly: boolean) {
    const b = p.build!(v);
    this.presetId = p.id; this.presetValues = v;
    this.data.objects = b.objects; this.data.joints = b.joints;
    this.data.env = { ...this.data.env, air: b.env?.air ?? false };
    this.settings.trails = b.trails ?? false;
    this.trackedId = b.track ?? null;
    this.presetBuilt = { camera: b.camera };
    this.selection = [];
    this.rebuildMeshes();
    this.rebuildPhysics(false);
    this.sim.setEnv(this.data.env);
    this.resetHistory();
    if (fly && b.camera) this.flyTo(new THREE.Vector3(...b.camera.pos), new THREE.Vector3(...b.camera.target));
    this.updateGizmo();
    this.emit();
  }
  setPresetParam(k: string, v: number) {
    const p = this.presetId ? presetById(this.presetId) : null;
    if (!p || !p.build) return;
    this.running = false;
    this.applyPreset(p, { ...this.presetValues, [k]: v }, false);
  }
  newSandbox() {
    this.presetId = null; this.presetValues = {}; this.presetBuilt = {};
    const env = this.data.env;
    this.data = { ...this.emptyScene(), env: { ...env, air: false } };
    this.data.objects = [
      makeObject("platform", { pos: [0, 0.125, 0], scale: [8, 0.25, 6] }),
      makeObject("ramp", { pos: [-5, 0.75, 0], scale: [3, 1.5, 2] }),
      makeObject("cube", { pos: [0, 1.3, 0] }),
      makeObject("sphere", { pos: [1.8, 2.5, 0.3], scale: [0.8, 0.8, 0.8] }),
    ];
    this.data.objects[1].rot = [0, Math.PI, 0];
    this.selection = []; this.running = false; this.trackedId = null;
    this.settings.trails = false;
    this.rebuildMeshes();
    this.rebuildPhysics(false);
    this.resetHistory();
    this.setCategory("mechanics", true);
    this.emit();
  }
  clearScene() {
    this.data.objects = []; this.data.joints = []; this.presetId = null; this.selection = [];
    this.rebuildMeshes(); this.rebuildPhysics(false); this.commit(); this.notice("msg.cleared");
  }

  // ------------------------------------------------------------------ selection / outlines
  private expand(ids: string[]) {
    const out = new Set(ids);
    for (const id of ids) { const g = this.obj(id)?.group; if (g) this.data.objects.filter((o) => o.group === g).forEach((o) => out.add(o.id)); }
    return [...out];
  }
  selectIds(ids: string[], additive = false) {
    let next = this.expand(ids);
    if (additive) {
      const cur = new Set(this.selection);
      const allIn = next.every((i) => cur.has(i));
      next.forEach((i) => (allIn ? cur.delete(i) : cur.add(i)));
      next = [...cur];
    }
    this.selection = next.filter((id) => this.obj(id));
    this.updateOutlines();
    this.updateGizmo();
    this.emit();
  }
  selectAll() { this.selectIds(this.data.objects.map((o) => o.id)); }
  private updateOutlines() {
    this.outlines.forEach((o, id) => { this.meshes.get(id)?.remove(o); });
    this.outlines.clear();
    for (const id of this.selection) {
      const m = this.meshes.get(id);
      if (!m) continue;
      const o = new THREE.Mesh(m.geometry, this.outlineMat);
      o.scale.setScalar(1.045);
      o.raycast = () => {};
      m.add(o);
      this.outlines.set(id, o);
    }
  }
  private updateOutlinesTransform() { this.outlines.forEach((o, id) => { const m = this.meshes.get(id); if (m && o.geometry !== m.geometry) o.geometry = m.geometry; }); }

  // ------------------------------------------------------------------ gizmo
  setGizmo(g: Gizmo) { this.settings.gizmo = g; this.updateGizmo(); this.emit(); }
  updateGizmo() {
    const sel = this.selection.map((id) => this.obj(id)).filter(Boolean) as ObjData[];
    const can = this.cat === "mechanics" && sel.length > 0 && this.settings.gizmo !== "select" && sel.every((o) => !o.locked);
    if (!can) { this.tc.detach(); return; }
    const box = new THREE.Box3();
    sel.forEach((o) => { const m = this.meshes.get(o.id); if (m) { box.expandByObject(m); } });
    if (sel.length === 1) {
      const m = this.meshes.get(sel[0].id)!;
      this.pivot.position.copy(m.position); this.pivot.quaternion.copy(m.quaternion); this.pivot.scale.set(1, 1, 1);
      this.tc.setSpace(this.settings.gizmo === "translate" ? "world" : "local");
    } else {
      this.pivot.position.copy(box.getCenter(new THREE.Vector3())); this.pivot.quaternion.identity(); this.pivot.scale.set(1, 1, 1);
      this.tc.setSpace("world");
    }
    this.pivot.updateMatrixWorld(true);
    this.tc.setMode(this.settings.gizmo === "select" ? "translate" : this.settings.gizmo);
    this.tc.attach(this.pivot);
  }
  private beginGizmo() {
    this.dragging = true;
    this.pivot.updateMatrixWorld(true);
    const mats = new Map<string, THREE.Matrix4>(), scales = new Map<string, V3>();
    for (const id of this.selection) {
      const m = this.meshes.get(id), o = this.obj(id);
      if (!m || !o) continue;
      m.updateMatrix();
      mats.set(id, m.matrix.clone());
      scales.set(id, [...o.scale] as V3);
    }
    this.dragStart = { pivot: this.pivot.matrix.clone(), mats, scales };
  }
  private onGizmoChange() {
    if (!this.dragStart) return;
    this.pivot.updateMatrix();
    const single = this.selection.length === 1;
    const delta = this.pivot.matrix.clone().multiply(this.dragStart.pivot.clone().invert());
    for (const id of this.selection) {
      const m = this.meshes.get(id), o = this.obj(id), start = this.dragStart.mats.get(id);
      if (!m || !o || !start) continue;
      if (single && this.settings.gizmo === "scale") {
        const s0 = this.dragStart.scales.get(id)!;
        const ps = this.pivot.scale;
        m.scale.set(Math.max(0.02, s0[0] * ps.x), Math.max(0.02, s0[1] * ps.y), Math.max(0.02, s0[2] * ps.z));
        m.position.copy(this.pivot.position);
      } else if (single) {
        m.position.copy(this.pivot.position); m.quaternion.copy(this.pivot.quaternion);
      } else {
        const nm = delta.clone().multiply(start);
        const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        nm.decompose(p, q, s);
        m.position.copy(p); m.quaternion.copy(q);
        if (this.settings.gizmo === "scale") m.scale.copy(s);
      }
    }
  }
  private endGizmo() {
    this.dragging = false;
    if (!this.dragStart) return;
    let rebuild = false;
    for (const id of this.selection) {
      const m = this.meshes.get(id), o = this.obj(id);
      if (!m || !o) continue;
      o.pos = [m.position.x, m.position.y, m.position.z];
      const e = new THREE.Euler().setFromQuaternion(m.quaternion, "XYZ");
      o.rot = [e.x, e.y, e.z];
      const ns: V3 = [m.scale.x, m.scale.y, m.scale.z];
      if (ns.some((v, i) => Math.abs(v - o.scale[i]) > 1e-6)) { o.scale = ns.map((v) => Math.round(v * 1000) / 1000) as V3; rebuild = true; this.refreshMesh(o); }
      if (!rebuild) this.sim.setTransform(id, o.pos, o.rot);
    }
    this.dragStart = null;
    if (rebuild) this.rebuildPhysics(true);
    this.syncMeshes(true);
    this.updateGizmo();
    this.commit();
  }

  // ------------------------------------------------------------------ pointer handling
  private ndc(e: PointerEvent | MouseEvent) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }
  private ray(e: PointerEvent | MouseEvent) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(this.ndc(e), this.camera);
    return rc;
  }
  private pick(e: PointerEvent | MouseEvent, withFloor = false) {
    const rc = this.ray(e);
    const targets: THREE.Object3D[] = [...this.meshes.values()];
    if (withFloor) targets.push(this.floor);
    const hit = rc.intersectObjects(targets, false)[0];
    return hit ?? null;
  }
  private onPointerDown(e: PointerEvent) {
    this.downPos = { x: e.clientX, y: e.clientY, b: e.button };
    if (this.cat !== "mechanics" && e.button === 0) {
      const m = this.module;
      if (m && m.draggables.length) {
        const hit = this.ray(e).intersectObjects(m.draggables, false)[0];
        if (hit) { this.dragModule = hit.object; this.controls.enabled = false; this.renderer.domElement.setPointerCapture(e.pointerId); }
      }
    }
  }
  private onPointerMove(e: PointerEvent) {
    if (this.dragModule) {
      const pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), -this.dragModule.position.z);
      const p = new THREE.Vector3();
      if (this.ray(e).ray.intersectPlane(pl, p)) this.module?.onDrag(this.dragModule, p);
      return;
    }
    if (this.cat === "mechanics" && this.tool === "inspect") {
      const h = this.pick(e, true);
      this.inspectPt = h ? [h.point.x, h.point.y, h.point.z] : null;
    }
  }
  private onPointerUp(e: PointerEvent) {
    if (this.dragModule) { this.dragModule = null; this.controls.enabled = true; try { this.renderer.domElement.releasePointerCapture(e.pointerId); } catch { /* noop */ } return; }
    const moved = Math.hypot(e.clientX - this.downPos.x, e.clientY - this.downPos.y);
    if (moved > 5 || this.cat !== "mechanics" || this.dragging) return;
    if (this.downPos.b === 2) {
      const h = this.pick(e);
      const id = h ? (h.object.userData.id as string) : null;
      if (id && !this.selection.includes(id)) this.selectIds([id]);
      this.onContext({ x: e.clientX, y: e.clientY, id });
      return;
    }
    if (e.button !== 0) return;
    if (this.tool === "ruler" || this.tool === "protractor") {
      const h = this.pick(e, true);
      if (h) this.addMeasurePoint(h.point.clone());
      return;
    }
    const h = this.pick(e);
    if (h) this.selectIds([h.object.userData.id as string], e.shiftKey || e.ctrlKey || e.metaKey);
    else if (!e.shiftKey) this.selectIds([]);
  }

  // ------------------------------------------------------------------ measurement tools
  setTool(t: Tool) { this.tool = t; this.clearMeasure(); this.inspectPt = null; this.emit(); }
  clearMeasure() {
    this.mPoints = []; this.mResult = null;
    this.measureGroup.children.slice().forEach((c) => { this.measureGroup.remove(c); const m = c as THREE.Mesh; m.geometry?.dispose(); });
  }
  private addMeasurePoint(p: THREE.Vector3) {
    const need = this.tool === "ruler" ? 2 : 3;
    if (this.mPoints.length >= need) this.clearMeasure();
    this.mPoints.push(p);
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd166, depthTest: false }));
    s.position.copy(p); s.renderOrder = 20;
    this.measureGroup.add(s);
    const line = (a: THREE.Vector3, b: THREE.Vector3) => {
      const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 0xffd166, depthTest: false }));
      l.renderOrder = 20; this.measureGroup.add(l);
    };
    const P = this.mPoints;
    if (this.tool === "ruler" && P.length === 2) {
      line(P[0], P[1]);
      const d = P[1].clone().sub(P[0]);
      this.mResult = { kind: "distance", value: d.length(), dx: d.x, dy: d.y, dz: d.z };
      const lab = labelSprite(`${d.length().toFixed(3)} m`, "#ffd166", 0.4);
      lab.position.copy(P[0]).add(P[1]).multiplyScalar(0.5).add(new THREE.Vector3(0, 0.3, 0));
      this.measureGroup.add(lab);
    } else if (this.tool === "protractor") {
      if (P.length >= 2) line(P[0], P[1]);
      if (P.length === 3) {
        line(P[1], P[2]);
        const a = P[0].clone().sub(P[1]), b = P[2].clone().sub(P[1]);
        const ang = THREE.MathUtils.radToDeg(a.angleTo(b));
        this.mResult = { kind: "angle", value: ang };
        // arc
        const r = Math.min(a.length(), b.length(), 1.2) * 0.6;
        const n = a.clone().normalize(), bn = b.clone().normalize();
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 24; i++) pts.push(P[1].clone().add(n.clone().lerp(bn, i / 24).normalize().multiplyScalar(r)));
        const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xff9f1c, depthTest: false }));
        arc.renderOrder = 20; this.measureGroup.add(arc);
        const lab = labelSprite(`${ang.toFixed(2)}°`, "#ff9f1c", 0.4);
        lab.position.copy(P[1]).add(n.clone().add(bn).normalize().multiplyScalar(r * 1.5)); this.measureGroup.add(lab);
      }
    }
    this.emit();
  }
  swToggle() {
    const clock = this.clockNow();
    if (this.swRunning) { this.swAcc += clock - this.swT0; this.swRunning = false; } else { this.swT0 = clock; this.swRunning = true; }
    this.emit();
  }
  swReset() { this.swAcc = 0; this.swT0 = this.clockNow(); this.emit(); }
  private clockNow() { return this.cat === "mechanics" ? this.sim.time : this.module?.time ?? 0; }

  // ------------------------------------------------------------------ object operations
  private spawnPos(o: ObjData): V3 {
    const n = this.data.objects.length;
    let x = ((n % 5) - 2) * 1.3, z = (Math.floor(n / 5) % 3 - 1) * 1.3;
    if (this.settings.snap) { x = Math.round(x / this.settings.snapT) * this.settings.snapT; z = Math.round(z / this.settings.snapT) * this.settings.snapT; }
    return [x, o.isStatic ? o.scale[1] / 2 + 0.005 : o.scale[1] / 2 + 1.2, z];
  }
  addObject(kind: ShapeKind) {
    const o = makeObject(kind);
    o.pos = this.spawnPos(o);
    if (kind === "pulley") o.pos[1] = 3;
    if (kind === "wheel" || kind === "gear") o.pos[1] = Math.max(o.pos[1], o.scale[0] / 2 + 0.2);
    this.data.objects.push(o);
    const m = this.makeMesh(o); this.meshes.set(o.id, m); this.objGroup.add(m);
    this.rebuildPhysics(true);
    this.selectIds([o.id]);
    this.commit();
    this.notice("msg.added", "ok");
  }
  addAssembly(kind: "spring" | "rope" | "pendulum" | "pulley") {
    const objs: ObjData[] = [], joints: JointData[] = [];
    const J = (p: Partial<JointData> & { kind: JointKind; a: string }): JointData => ({ id: uid("j"), b: null, pa: [0, 0, 0], pb: [0, 0, 0], axA: [0, 0, 1], axB: [0, 0, 1], k: 0, c: 0, len: 0, lim: null, pts: [], ...p });
    const ox = ((this.data.objects.length % 4) - 1.5) * 2.2;
    if (kind === "spring") {
      const a = makeObject("cube", { scale: [1.2, 0.2, 0.6], pos: [ox, 6, 0], isStatic: true, material: "metal" });
      const m = makeObject("cube", { scale: [0.6, 0.5, 0.6], mass: 1, pos: [ox, 3.6, 0], color: "#ff9f1c" });
      objs.push(a, m);
      joints.push(J({ kind: "spring", a: m.id, b: a.id, pa: [0, 0.25, 0], pb: [0, -0.1, 0], k: 40, c: 0.5, len: 2 }));
    } else if (kind === "rope") {
      const a = makeObject("cube", { scale: [0.4, 0.2, 0.4], pos: [ox, 5, 0], isStatic: true, material: "metal" });
      objs.push(a);
      let prev: ObjData | null = null;
      for (let i = 0; i < 8; i++) {
        const last = i === 7, r = last ? 0.28 : 0.11;
        const o = makeObject("sphere", { scale: [2 * r, 2 * r, 2 * r], mass: last ? 1.5 : 0.1, pos: [ox + 0.28 * (i + 1) * 0.85, 4.8 - 0.28 * (i + 1) * 0.5, 0], material: last ? "metal" : "plastic", color: last ? "#c9ced6" : "#ffd166", friction: 0.2 });
        objs.push(o);
        const dir = prev ? new THREE.Vector3(...o.pos).sub(new THREE.Vector3(...prev.pos)) : new THREE.Vector3(...o.pos).sub(new THREE.Vector3(ox, 4.9, 0));
        if (prev) { const half = dir.clone().multiplyScalar(0.5); joints.push(J({ kind: "spherical", a: o.id, b: prev.id, pa: [-half.x, -half.y, -half.z], pb: [half.x, half.y, half.z] })); }
        else { const half = dir.clone().multiplyScalar(0.0); void half; joints.push(J({ kind: "spherical", a: o.id, b: a.id, pa: [-dir.x, -dir.y, -dir.z], pb: [0, -0.1, 0] })); }
        prev = o;
      }
    } else if (kind === "pendulum") {
      const L = 2, th = 0.7, piv: V3 = [ox, 5.5, 0];
      const top = makeObject("cube", { scale: [0.8, 0.14, 0.4], pos: [ox, 5.57, 0], isStatic: true, material: "metal" });
      const bob = makeObject("sphere", { scale: [0.5, 0.5, 0.5], mass: 1, pos: [ox + Math.sin(th) * L, piv[1] - Math.cos(th) * L, 0], material: "metal" });
      objs.push(top, bob);
      joints.push(J({ kind: "revolute", a: bob.id, b: null, pa: [piv[0] - bob.pos[0], piv[1] - bob.pos[1], 0], pb: piv }));
    } else {
      const py = 6.5, R = 0.6;
      const w = makeObject("pulley", { scale: [2 * R, 2 * R, 1], pos: [ox, py, 0] });
      const sup = makeObject("beam", { scale: [2.4, 0.2, 0.5], pos: [ox, py + R + 0.15, 0], isStatic: true, material: "metal" });
      const A = makeObject("cube", { scale: [0.6, 0.6, 0.6], mass: 2, pos: [ox - R, 3.4, 0], color: "#4f8cff", angDamp: 5 });
      const B = makeObject("cube", { scale: [0.5, 0.5, 0.5], mass: 1, pos: [ox + R, 3.4, 0], color: "#ff9f1c", angDamp: 5 });
      objs.push(w, sup, A, B);
      joints.push(J({ kind: "pulley", a: A.id, b: B.id, pa: [0, 0.3, 0], pb: [0, 0.25, 0], pts: [[ox - R, py, 0], [ox + R, py, 0]], len: py - 3.7 + (py - 3.65), wheel: w.id }));
    }
    this.data.objects.push(...objs); this.data.joints.push(...joints);
    objs.forEach((o) => { const m = this.makeMesh(o); this.meshes.set(o.id, m); this.objGroup.add(m); });
    this.rebuildPhysics(true);
    this.selectIds(objs.filter((o) => !o.isStatic).map((o) => o.id));
    this.commit();
    this.notice("msg.added", "ok");
  }
  deleteSelected() {
    const ids = new Set(this.selection.filter((id) => !this.obj(id)?.locked));
    if (!ids.size) { if (this.selection.length) this.notice("msg.locked", "warn"); return; }
    this.data.objects = this.data.objects.filter((o) => !ids.has(o.id));
    this.data.joints = this.data.joints.filter((j) => !ids.has(j.a) && !(j.b && ids.has(j.b)) && !(j.wheel && ids.has(j.wheel)));
    this.selection = this.selection.filter((i) => !ids.has(i));
    this.rebuildMeshes(); this.rebuildPhysics(true); this.updateGizmo(); this.commit();
  }
  duplicateSelected() {
    const src = this.selection.map((id) => this.obj(id)).filter(Boolean) as ObjData[];
    if (!src.length) return;
    const map = new Map<string, string>(), gmap = new Map<string, string>(), news: ObjData[] = [];
    for (const o of src) {
      const c: ObjData = JSON.parse(JSON.stringify(o));
      c.id = uid(); map.set(o.id, c.id);
      c.pos = [o.pos[0] + 0.7, o.pos[1] + 0.2, o.pos[2] + 0.7];
      if (o.group) { if (!gmap.has(o.group)) gmap.set(o.group, uid("g")); c.group = gmap.get(o.group)!; }
      if (c.name) c.name += " ²";
      c.locked = false;
      news.push(c);
    }
    const nj: JointData[] = [];
    for (const j of this.data.joints) if (map.has(j.a) && (j.b ? map.has(j.b) : true) && (j.kind !== "pulley" || true)) {
      const c: JointData = JSON.parse(JSON.stringify(j));
      c.id = uid("j"); c.a = map.get(j.a)!; c.b = j.b ? map.get(j.b)! : null;
      if (!j.b) { c.pb = [j.pb[0] + 0.7, j.pb[1] + 0.2, j.pb[2] + 0.7]; }
      if (j.pts.length) c.pts = j.pts.map((p) => [p[0] + 0.7, p[1] + 0.2, p[2] + 0.7] as V3);
      if (j.wheel) c.wheel = map.get(j.wheel);
      nj.push(c);
    }
    this.data.objects.push(...news); this.data.joints.push(...nj);
    news.forEach((o) => { const m = this.makeMesh(o); this.meshes.set(o.id, m); this.objGroup.add(m); });
    this.rebuildPhysics(true);
    this.selectIds(news.map((o) => o.id));
    this.commit();
    this.notice("msg.duplicated", "ok");
  }
  groupSelected() {
    if (this.selection.length < 2) { this.notice("msg.needTwo", "warn"); return; }
    const g = uid("g");
    this.selection.forEach((id) => { const o = this.obj(id); if (o) o.group = g; });
    this.commit(); this.notice("msg.grouped", "ok");
  }
  ungroupSelected() {
    const gs = new Set(this.selection.map((id) => this.obj(id)?.group).filter(Boolean));
    if (!gs.size) return;
    this.data.objects.forEach((o) => { if (o.group && gs.has(o.group)) o.group = null; });
    this.commit(); this.notice("msg.ungrouped", "ok");
  }
  toggleLock() {
    const sel = this.selection.map((id) => this.obj(id)).filter(Boolean) as ObjData[];
    const lock = sel.some((o) => !o.locked);
    sel.forEach((o) => (o.locked = lock));
    this.updateGizmo(); this.commit();
  }
  align(axis: 0 | 1 | 2, mode: "min" | "center" | "max") {
    const sel = this.selection.filter((id) => !this.obj(id)?.locked);
    if (sel.length < 2) { this.notice("msg.needTwo", "warn"); return; }
    const boxes = sel.map((id) => new THREE.Box3().setFromObject(this.meshes.get(id)!));
    const key = mode === "min" ? (b: THREE.Box3) => b.min.getComponent(axis) : mode === "max" ? (b: THREE.Box3) => b.max.getComponent(axis) : (b: THREE.Box3) => (b.min.getComponent(axis) + b.max.getComponent(axis)) / 2;
    const target = mode === "min" ? Math.min(...boxes.map(key)) : mode === "max" ? Math.max(...boxes.map(key)) : boxes.map(key).reduce((a, b) => a + b, 0) / boxes.length;
    sel.forEach((id, i) => {
      const o = this.obj(id)!, d = target - key(boxes[i]);
      o.pos[axis] += d;
      this.meshes.get(id)!.position.setComponent(axis, o.pos[axis]);
      this.sim.setTransform(id, o.pos, o.rot);
    });
    this.syncMeshes(true); this.updateGizmo(); this.commit();
  }
  /** patch properties of objects */
  edit(ids: string[], patch: Partial<ObjData>, tag = "edit") {
    const keys = Object.keys(patch) as (keyof ObjData)[];
    let rebuild = false, transform = false, visual = false;
    for (const id of ids) {
      const o = this.obj(id);
      if (!o) continue;
      if (o.locked && keys.some((k) => ["pos", "rot", "scale"].includes(k))) continue;
      Object.assign(o, patch);
      if (patch.scale) o.scale = patch.scale.map((s) => Math.max(0.02, s)) as V3;
      if (patch.mass !== undefined) o.mass = Math.max(0.001, patch.mass);
      if (keys.some((k) => ["scale", "mass", "isStatic", "ghost", "friction", "restitution", "linDamp", "angDamp", "gravityScale"].includes(k))) rebuild = true;
      if (keys.some((k) => ["pos", "rot"].includes(k))) transform = true;
      if (keys.some((k) => ["color", "roughness", "metalness", "opacity", "emissive", "material", "scale"].includes(k))) visual = true;
      const m = this.meshes.get(id);
      if (m && transform) { m.position.set(...o.pos); m.quaternion.copy(quatOf(o.rot)); }
    }
    if (visual) ids.forEach((id) => { const o = this.obj(id); if (o) this.refreshMesh(o); });
    if (!this.sim.stepped && (keys.includes("lv") || keys.includes("av") || keys.includes("force") || keys.includes("torque"))) rebuild = true;
    if (rebuild) { this.rebuildPhysics(true); }
    else if (transform) ids.forEach((id) => { const o = this.obj(id); if (o) this.sim.setTransform(id, o.pos, o.rot); });
    if (transform || rebuild) this.updateGizmo();
    this.commit(tag + ids.join(","));
  }
  setMaterial(ids: string[], key: MaterialKey) {
    const s = MATERIALS[key];
    for (const id of ids) {
      const o = this.obj(id); if (!o) continue;
      const mass = o.isStatic ? o.mass : Math.max(0.01, Math.round(s.density * volumeOf(o.kind, o.scale) * 100) / 100);
      Object.assign(o, { material: key, color: s.color, roughness: s.rough, metalness: s.metal, opacity: s.opacity, emissive: s.emissive, friction: s.friction, restitution: s.restitution, mass: Math.min(mass, 5000) });
      const m = this.meshes.get(id); if (m) m.castShadow = key !== "glass" && key !== "water";
    }
    ids.forEach((id) => { const o = this.obj(id); if (o) this.refreshMesh(o); });
    this.rebuildPhysics(true);
    this.commit();
  }
  renameObject(id: string, name: string) { const o = this.obj(id); if (o) { o.name = name.slice(0, 60) || undefined; this.commit("rename" + id); } }

  // ------------------------------------------------------------------ joints
  addJoint(kind: JointKind, opt: { axis: 0 | 1 | 2; off: V3; k: number; c: number; limit: boolean; lo: number; hi: number }) {
    const sel = this.selection.map((id) => this.obj(id)).filter(Boolean) as ObjData[];
    if (sel.length < 1 || sel.length > 2) { this.notice("msg.pickOneTwo", "warn"); return; }
    const A = sel[0], B = sel[1] ?? null;
    if (A.isStatic && (!B || B.isStatic)) { this.notice("msg.needDynamic", "warn"); return; }
    let a = A, b: ObjData | null = B;
    if (b && a.isStatic) { a = B!; b = A; }
    const pa = new THREE.Vector3(...a.pos), qa = quatOf(a.rot);
    const pbv = b ? new THREE.Vector3(...b.pos) : null, qb = b ? quatOf(b.rot) : new THREE.Quaternion();
    const spring = kind === "spring" || kind === "distance";
    let anchor: THREE.Vector3;
    if (b) anchor = spring ? pa.clone() : pa.clone().add(pbv!).multiplyScalar(0.5);
    else anchor = pa.clone().add(new THREE.Vector3(...opt.off));
    const localA = spring && b ? new THREE.Vector3() : anchor.clone().sub(pa).applyQuaternion(qa.clone().invert());
    let localB: THREE.Vector3;
    if (b) localB = spring ? new THREE.Vector3() : anchor.clone().sub(pbv!).applyQuaternion(qb.clone().invert());
    else localB = anchor.clone();
    if (!b && spring) localA.set(0, 0, 0);
    const wa = new THREE.Vector3(), wb = new THREE.Vector3();
    wa.copy(localA).applyQuaternion(qa).add(pa);
    if (b) wb.copy(localB).applyQuaternion(qb).add(pbv!); else wb.copy(localB);
    const len = wa.distanceTo(wb);
    const ax = new THREE.Vector3(); ax.setComponent(opt.axis, 1);
    const axA = ax.clone().applyQuaternion(qa.clone().invert()), axB = b ? ax.clone().applyQuaternion(qb.clone().invert()) : ax.clone();
    const j: JointData = {
      id: uid("j"), kind, a: a.id, b: b ? b.id : null, pa: localA.toArray() as V3, pb: localB.toArray() as V3,
      axA: axA.toArray() as V3, axB: axB.toArray() as V3, k: opt.k, c: opt.c, len: kind === "spring" || kind === "distance" ? Math.max(0.05, len) : len,
      lim: (kind === "revolute" || kind === "prismatic") && opt.limit ? [opt.lo, opt.hi] : null, pts: [],
    };
    this.data.joints.push(j);
    this.rebuildPhysics(true);
    this.commit();
    this.notice("msg.jointAdded", "ok");
  }
  removeJoint(id: string) { this.data.joints = this.data.joints.filter((j) => j.id !== id); this.rebuildPhysics(true); this.commit(); }
  editJoint(id: string, patch: Partial<JointData>) {
    const j = this.data.joints.find((x) => x.id === id); if (!j) return;
    Object.assign(j, patch);
    if (this.sim.stepped && ["k", "c", "len"].includes(Object.keys(patch)[0])) { /* custom forces read live from data */ }
    else this.rebuildPhysics(true);
    this.commit("joint" + id);
  }

  // ------------------------------------------------------------------ joint visuals
  private buildJointVisuals() {
    this.jointLines.forEach((l) => { l.geometry.dispose(); (l.material as THREE.Material).dispose(); this.jointGroup.remove(l); });
    this.jointMarks.forEach((m) => { m.geometry.dispose(); (m.material as THREE.Material).dispose(); this.jointGroup.remove(m); });
    this.jointLines.clear(); this.jointMarks.clear();
    const colors: Record<string, number> = { fixed: 0xffffff, revolute: 0xff9f1c, prismatic: 0x80ed99, spherical: 0xc77dff, spring: 0x4cc9f0, distance: 0xffd166, pulley: 0xe0e0e0, gear: 0x000000 };
    for (const j of this.data.joints) {
      if (j.kind === "gear") continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 40), 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: colors[j.kind] ?? 0xffffff }));
      l.frustumCulled = false;
      this.jointLines.set(j.id, l); this.jointGroup.add(l);
      if (j.kind !== "spring" && j.kind !== "pulley" && j.kind !== "distance") {
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: colors[j.kind] }));
        this.jointMarks.set(j.id, m); this.jointGroup.add(m);
      }
    }
  }
  private updateJoints() {
    const A = new THREE.Vector3(), B = new THREE.Vector3();
    for (const j of this.data.joints) {
      const l = this.jointLines.get(j.id);
      if (!l) continue;
      if (!this.sim.worldAnchors(j, A, B)) continue;
      const attr = l.geometry.attributes.position as THREE.BufferAttribute;
      let n = 2;
      const cA = this.meshes.get(j.a)?.position, cB = j.b ? this.meshes.get(j.b)?.position : null;
      if (j.kind === "spring") {
        const d = B.clone().sub(A), L = d.length();
        const dir = L > 1e-6 ? d.clone().divideScalar(L) : new THREE.Vector3(0, 1, 0);
        const perp = new THREE.Vector3(1, 0, 0).cross(dir); if (perp.lengthSq() < 1e-4) perp.set(0, 0, 1); perp.normalize();
        const coils = 12; n = coils * 2 + 2;
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1), off = i === 0 || i === n - 1 ? 0 : (i % 2 ? 1 : -1) * 0.14;
          const p = A.clone().addScaledVector(d, t).addScaledVector(perp, off);
          attr.setXYZ(i, p.x, p.y, p.z);
        }
      } else if (j.kind === "pulley" && j.pts.length >= 2 && j.b) {
        const P1 = new THREE.Vector3(...j.pts[0]), P2 = new THREE.Vector3(...j.pts[1]);
        const B2 = new THREE.Vector3(); const bb = this.sim.body(j.b);
        if (bb) { const t = bb.translation(), r = bb.rotation(); B2.set(...j.pb).applyQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w)).add(new THREE.Vector3(t.x, t.y, t.z)); }
        const pts = [A, P1];
        const c = P1.clone().add(P2).multiplyScalar(0.5), rr = P1.distanceTo(P2) / 2;
        for (let i = 1; i < 8; i++) { const a = Math.PI - (Math.PI * i) / 8; pts.push(new THREE.Vector3(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, c.z)); }
        pts.push(P2, B2);
        n = pts.length;
        pts.forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z));
      } else if (j.kind === "distance") {
        attr.setXYZ(0, A.x, A.y, A.z); attr.setXYZ(1, B.x, B.y, B.z);
      } else {
        // anchor -> body centre(s)
        const pts: THREE.Vector3[] = [];
        if (cA) pts.push(cA.clone());
        pts.push(A.clone());
        if (cB) pts.push(cB.clone());
        n = Math.max(2, pts.length);
        pts.forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z));
        if (pts.length < 2) attr.setXYZ(1, A.x, A.y, A.z);
        const mk = this.jointMarks.get(j.id); if (mk) mk.position.copy(A);
      }
      l.geometry.setDrawRange(0, n);
      attr.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ vectors & trails
  private updateVectors() {
    const want = new Set<string>();
    const types = (Object.keys(this.settings.vec) as VecKey[]).filter((k) => this.settings.vec[k]);
    for (const id of this.selection) {
      const o = this.obj(id);
      if (!o || o.isStatic) continue;
      const ob = this.sim.observe(id);
      if (!ob) continue;
      for (const t of types) {
        const vec: V3 = t === "v" ? ob.v : t === "a" ? ob.a : t === "F" ? ob.F : t === "p" ? ob.mom : [0, -ob.mass * o.gravityScale * this.sim.g, 0];
        const mag = Math.hypot(...vec);
        const key = id + t;
        want.add(key);
        let a = this.arrows.get(key);
        if (!a) { a = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1, VEC_COL[t], 0.25, 0.14); a.renderOrder = 15; (a.line.material as THREE.Material).depthTest = false; (a.cone.material as THREE.Material).depthTest = false; this.arrows.set(key, a); this.vecGroup.add(a); }
        a.visible = mag > 1e-4;
        if (!a.visible) continue;
        const k = { v: 0.4, a: 0.12, F: 0.04, p: 0.08, g: 0.04 }[t] * this.settings.vecScale;
        const len = Math.min(8, Math.max(0.3, mag * k));
        a.position.set(...ob.p);
        a.setDirection(new THREE.Vector3(...vec).normalize());
        a.setLength(len, Math.min(0.3, len * 0.4), 0.15);
      }
    }
    this.arrows.forEach((a, k) => { if (!want.has(k)) { this.vecGroup.remove(a); a.dispose(); this.arrows.delete(k); } });
  }
  clearTrails() {
    this.trails.forEach((t) => { this.trailGroup.remove(t.line); t.line.geometry.dispose(); (t.line.material as THREE.Material).dispose(); });
    this.trails.clear();
  }
  private updateTrails() {
    if (!this.settings.trails) { if (this.trails.size) this.clearTrails(); return; }
    let count = 0;
    for (const o of this.data.objects) {
      if (o.isStatic || count++ > 40) continue;
      const m = this.meshes.get(o.id);
      if (!m) continue;
      let t = this.trails.get(o.id);
      if (!t) {
        const pos = new Float32Array(3 * 600);
        const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(o.color).offsetHSL(0, 0.2, 0.15), transparent: true, opacity: 0.85 }));
        line.frustumCulled = false;
        this.trailGroup.add(line);
        t = { line, n: 0, pos }; this.trails.set(o.id, t);
      }
      const last = t.n > 0 ? new THREE.Vector3(t.pos[3 * (t.n - 1)], t.pos[3 * (t.n - 1) + 1], t.pos[3 * (t.n - 1) + 2]) : null;
      if (!last || last.distanceToSquared(m.position) > 0.0004) {
        if (t.n >= 600) { t.pos.copyWithin(0, 3); t.n = 599; }
        t.pos[3 * t.n] = m.position.x; t.pos[3 * t.n + 1] = m.position.y; t.pos[3 * t.n + 2] = m.position.z; t.n++;
        t.line.geometry.setDrawRange(0, t.n);
        (t.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    }
  }

  // ------------------------------------------------------------------ live data
  private mechCharts(full = false): ChartSpec[] {
    const h = full ? this.hist : this.hist.slice(-700);
    const mk = (id: string, title: string, yl: string, yu: string, defs: [string, string, (s: Sample) => number][]): ChartSpec => ({
      id, title, xLabel: "ch.time", yLabel: yl, xUnit: "s", yUnit: yu,
      series: defs.map(([label, color, f]) => ({ label, color, pts: h.map((s) => ({ x: s.t, y: f(s) })) })),
    });
    const mag = (v: V3) => Math.hypot(...v);
    return [
      mk("pos", "ch.position", "ch.position", "m", [["ch.x", "#ff4d6d", (s) => s.p[0]], ["ch.y", "#80ed99", (s) => s.p[1]], ["ch.z", "#4cc9f0", (s) => s.p[2]]]),
      mk("vel", "ch.velocity", "ch.velocity", "m/s", [["ch.vx", "#ff4d6d", (s) => s.v[0]], ["ch.vy", "#80ed99", (s) => s.v[1]], ["ch.vz", "#4cc9f0", (s) => s.v[2]], ["ch.speed", "#ffd166", (s) => mag(s.v)]]),
      mk("acc", "ch.acceleration", "ch.acceleration", "m/s²", [["ch.ax", "#ff4d6d", (s) => s.a[0]], ["ch.ay", "#80ed99", (s) => s.a[1]], ["ch.az", "#4cc9f0", (s) => s.a[2]], ["ch.amag", "#ffd166", (s) => mag(s.a)]]),
      mk("frc", "ch.force", "ch.force", "N", [["ch.fx", "#ff4d6d", (s) => s.F[0]], ["ch.fy", "#80ed99", (s) => s.F[1]], ["ch.fz", "#4cc9f0", (s) => s.F[2]], ["ch.fmag", "#ffd166", (s) => mag(s.F)]]),
      mk("eng", "ch.energy", "ch.energy", "J", [["ch.ek", "#4cc9f0", (s) => s.ek], ["ch.ep", "#ff9f1c", (s) => s.ep], ["ch.etotal", "#80ed99", (s) => s.e], ["ch.esys", "#c77dff", (s) => s.sys]]),
    ];
  }
  getCharts(full = false): ChartSpec[] {
    if (this.cat === "mechanics") return this.mechCharts(full);
    return this.module?.charts() ?? [];
  }
  getLive(): Live {
    const mech = this.cat === "mechanics";
    let obs: Observation | null = null, obsId: string | null = null, dist2: number | null = null;
    if (mech) {
      obsId = this.selection[0] ?? this.trackedId ?? this.data.objects.find((o) => !o.isStatic)?.id ?? null;
      obs = obsId ? this.sim.observe(obsId) : null;
      if (this.selection.length === 2) {
        const a = this.sim.observe(this.selection[0]), b = this.sim.observe(this.selection[1]);
        if (a && b) dist2 = Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
      }
    }
    let readouts: Readout[] = [];
    if (mech) {
      const p = this.presetId ? presetById(this.presetId) : null;
      if (p?.readouts) {
        try { readouts = p.readouts({ sim: this.sim, v: this.presetValues, hist: this.hist, t: this.sim.time, ids: this.data.objects.map((o) => o.id) }); } catch { readouts = []; }
      }
    } else readouts = this.module?.readouts() ?? [];
    const clock = this.clockNow();
    return {
      cat: this.cat, running: this.running, speed: this.speed, simTime: mech ? this.sim.time : this.module?.time ?? 0,
      maxTime: mech ? Math.max(this.sim.time, this.snaps.length ? this.snaps[this.snaps.length - 1].t : 0) : 0,
      fps: this.fps, quality: this.quality, obs, obsId, sys: mech ? this.sim.systemEnergy() : null, readouts, charts: [],
      stopwatch: this.swAcc + (this.swRunning ? clock - this.swT0 : 0), swRunning: this.swRunning,
      measure: { tool: this.tool, n: this.mPoints.length, result: this.mResult }, inspect: this.inspectPt, dist2,
      moduleInfo: mech ? null : this.module?.info() ?? null, nObjects: this.data.objects.length,
    };
  }
}

export { PRESETS, DEFAULTS };
export type { Preset };
void (null as unknown as EnvData);
