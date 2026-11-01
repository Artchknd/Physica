import * as THREE from "three";
import type { ChartSpec, ParamDef, Readout } from "../types";

// ---------- colour helpers ----------
const STOPS: [number, string][] = [
  [0, "#17164f"], [0.2, "#2f5fd1"], [0.4, "#35c0c9"], [0.6, "#f2e55c"], [0.8, "#f07a2a"], [1, "#c4131a"],
];
const stopCols = STOPS.map(([t, c]) => [t, new THREE.Color(c)] as [number, THREE.Color]);
export function heatRGB(t: number, out = new THREE.Color()) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stopCols.length; i++) {
    if (t <= stopCols[i][0]) {
      const [t0, c0] = stopCols[i - 1], [t1, c1] = stopCols[i];
      return out.copy(c0).lerp(c1, (t - t0) / (t1 - t0));
    }
  }
  return out.copy(stopCols[stopCols.length - 1][1]);
}

let cmap: THREE.DataTexture | null = null;
export function cmapTexture() {
  if (cmap) return cmap;
  const d = new Uint8Array(256 * 4);
  const c = new THREE.Color();
  for (let i = 0; i < 256; i++) {
    heatRGB(i / 255, c);
    // heatRGB returns linear working-space colour; store sRGB bytes
    const s = c.clone().convertLinearToSRGB();
    d[i * 4] = s.r * 255; d[i * 4 + 1] = s.g * 255; d[i * 4 + 2] = s.b * 255; d[i * 4 + 3] = 255;
  }
  cmap = new THREE.DataTexture(d, 256, 1, THREE.RGBAFormat);
  cmap.minFilter = cmap.magFilter = THREE.LinearFilter;
  cmap.needsUpdate = true;
  return cmap;
}

export function wavelengthColor(nm: number): THREE.Color {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 750) { r = 1; }
  return new THREE.Color(r, g, b);
}

export function blackbodyColor(T: number) {
  const t = Math.max(1000, Math.min(12000, T)) / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; } else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.52 * Math.log(t - 10) - 305.04;
  const cl = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color(cl(r), cl(g), cl(b)).convertSRGBToLinear();
}

// ---------- heat map material ----------
export function makeHeatTexture(w: number, h: number) {
  const data = new Uint8Array(w * h * 4);
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
export function makeHeatMaterial(tex: THREE.DataTexture) {
  return new THREE.ShaderMaterial({
    uniforms: { uTemp: { value: tex }, uCmap: { value: cmapTexture() }, uLines: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; void main(){ vUv=uv; vN=normalMatrix*normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform sampler2D uTemp; uniform sampler2D uCmap; uniform float uLines; varying vec2 vUv; varying vec3 vN;
      void main(){ float v=texture2D(uTemp,vUv).r; vec3 c=texture2D(uCmap,vec2(v,0.5)).rgb;
        float f=fract(v*12.0); float w=fwidth(v*12.0); float line=1.0-smoothstep(0.0,max(w*1.2,0.02),min(f,1.0-f));
        c=mix(c,c*0.45,line*0.5*uLines); float l=0.75+0.25*abs(normalize(vN).z); gl_FragColor=vec4(c*l,1.0);
      }`,
  });
}
export function writeHeat(tex: THREE.DataTexture, idx: number, v01: number) {
  const d = tex.image.data as Uint8Array;
  const b = Math.max(0, Math.min(255, Math.round(v01 * 255)));
  d[idx * 4] = b; d[idx * 4 + 1] = b; d[idx * 4 + 2] = b; d[idx * 4 + 3] = 255;
}

// ---------- text sprites ----------
const spriteCache = new Map<string, THREE.CanvasTexture>();
export function labelSprite(text: string, color = "#ffffff", size = 0.5) {
  const key = text + color;
  let t = spriteCache.get(key);
  if (!t) {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 96;
    const g = c.getContext("2d")!;
    g.font = "600 52px system-ui, sans-serif";
    g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 8; g.strokeStyle = "rgba(0,0,0,0.65)"; g.strokeText(text, 128, 48);
    g.fillStyle = color; g.fillText(text, 128, 48);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (spriteCache.size > 60) {
      const first = spriteCache.keys().next().value as string;
      spriteCache.get(first)?.dispose();
      spriteCache.delete(first);
    }
    spriteCache.set(key, t);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(size * 2.67, size, 1);
  s.renderOrder = 10;
  return s;
}

// ---------- beams ----------
export class BeamSet {
  group = new THREE.Group();
  private meshes: THREE.Mesh[] = [];
  private used = 0;
  private geo = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true);
  begin() { this.used = 0; }
  add(a: THREE.Vector3, b: THREE.Vector3, color: THREE.ColorRepresentation, opacity = 1, radius = 0.014) {
    let m = this.meshes[this.used];
    if (!m) {
      m = new THREE.Mesh(this.geo, new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      this.meshes.push(m);
      this.group.add(m);
    }
    this.used++;
    const d = b.clone().sub(a);
    const L = d.length();
    m.visible = L > 1e-6;
    if (!m.visible) return;
    m.position.copy(a).addScaledVector(d, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.divideScalar(L));
    m.scale.set(radius, L, radius);
    (m.material as THREE.MeshBasicMaterial).color.set(color);
    (m.material as THREE.MeshBasicMaterial).opacity = opacity;
  }
  end() { for (let i = this.used; i < this.meshes.length; i++) this.meshes[i].visible = false; }
  dispose() { this.meshes.forEach((m) => (m.material as THREE.Material).dispose()); this.geo.dispose(); }
}

// ---------- arrow field ----------
export class ArrowField {
  mesh: THREE.InstancedMesh;
  n: number;
  constructor(n: number) {
    this.n = n;
    const g = new THREE.ConeGeometry(0.06, 0.28, 8);
    g.rotateZ(-Math.PI / 2); // points +x
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff }), n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
  }
  set(i: number, pos: THREE.Vector3, dir: THREE.Vector3, mag01: number, color: THREE.Color) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.lengthSq() > 0 ? dir.clone().normalize() : new THREE.Vector3(1, 0, 0));
    const s = 0.35 + 1.2 * mag01;
    m.compose(pos, q, new THREE.Vector3(s, s, s));
    this.mesh.setMatrixAt(i, m);
    this.mesh.setColorAt(i, color);
  }
  commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose() { this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); }
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = c as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}

// ---------- module base ----------
export abstract class ModuleBase {
  abstract cat: string;
  abstract modes: { id: string; label: string }[];
  mode = "";
  group = new THREE.Group();
  values: Record<string, number> = {};
  defs: ParamDef[] = [];
  modeDefaults: Record<string, Record<string, number>> = {};
  time = 0;
  dirty = true;
  draggables: THREE.Object3D[] = [];

  protected setup(defs: ParamDef[], modeDefaults: Record<string, Record<string, number>>, mode: string) {
    this.defs = defs;
    this.modeDefaults = modeDefaults;
    defs.forEach((d) => (this.values[d.key] = d.value));
    this.setMode(mode);
  }
  setMode(m: string) {
    this.mode = m;
    Object.assign(this.values, this.modeDefaults[m] ?? {});
    this.time = 0;
    this.dirty = true;
    this.onMode();
  }
  setParam(k: string, v: number) {
    this.values[k] = v;
    this.dirty = true;
    this.onParam(k, v);
  }
  params(): ParamDef[] {
    return this.defs
      .filter((d) => (!d.modes || d.modes.includes(this.mode)) && !(d.hidden && d.hidden(this.values)))
      .map((d) => ({ ...d, value: this.values[d.key] }));
  }
  state() { return { cat: this.cat, mode: this.mode, values: { ...this.values }, data: this.getData() }; }
  getData(): unknown { return undefined; }
  setData(_d: unknown) {}
  restore(mode: string, values: Record<string, number>, data?: unknown) {
    this.setMode(this.modes.some((m) => m.id === mode) ? mode : this.modes[0].id);
    for (const [k, v] of Object.entries(values)) if (k in this.values && Number.isFinite(v)) this.values[k] = v;
    if (data !== undefined) this.setData(data);
    this.dirty = true;
    this.onParam("*", 0);
  }
  reset() { this.time = 0; this.dirty = true; this.onReset(); }
  protected onMode() {}
  protected onParam(_k: string, _v: number) {}
  protected onReset() {}
  abstract update(dt: number): void;
  abstract readouts(): Readout[];
  abstract charts(): ChartSpec[];
  abstract info(): { desc: string; model: string };
  onDrag(_o: THREE.Object3D, _p: THREE.Vector3) {}
  cameraHint(): { pos: [number, number, number]; target: [number, number, number] } { return { pos: [0, 2, 10], target: [0, 0, 0] }; }
  dispose() { disposeObject(this.group); }
}

export const deg = (r: number) => (r * 180) / Math.PI;
export const rad = (d: number) => (d * Math.PI) / 180;
