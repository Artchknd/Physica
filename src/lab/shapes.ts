import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { MATERIALS } from "./materials";
import { uid, type MaterialKey, type ObjData, type ShapeKind, type V3 } from "./types";

export const SHAPES: ShapeKind[] = [
  "cube", "sphere", "cylinder", "cone", "capsule", "plane", "pyramid", "wall", "platform",
  "ramp", "beam", "rod", "wheel", "gear", "container", "pulley",
];

interface Def { scale: V3; mass: number; mat: MaterialKey; color?: string; stat?: boolean }
export const DEFAULTS: Record<ShapeKind, Def> = {
  cube: { scale: [1, 1, 1], mass: 1, mat: "plastic" },
  sphere: { scale: [1, 1, 1], mass: 1, mat: "rubber" },
  cylinder: { scale: [0.8, 1, 0.8], mass: 2, mat: "metal" },
  cone: { scale: [0.9, 1, 0.9], mass: 1, mat: "wood" },
  capsule: { scale: [1, 1, 1], mass: 1, mat: "ceramic" },
  plane: { scale: [6, 1, 6], mass: 10, mat: "concrete", stat: true },
  pyramid: { scale: [1, 1, 1], mass: 2, mat: "ceramic", color: "#e8c27a" },
  wall: { scale: [4, 2.5, 0.25], mass: 50, mat: "concrete", stat: true },
  platform: { scale: [3, 0.25, 3], mass: 30, mat: "wood", stat: true },
  ramp: { scale: [3, 1.5, 1.5], mass: 20, mat: "wood", stat: true },
  beam: { scale: [3, 0.2, 0.4], mass: 3, mat: "wood" },
  rod: { scale: [0.08, 2, 0.08], mass: 0.5, mat: "metal" },
  wheel: { scale: [1, 1, 1], mass: 2, mat: "rubber", color: "#3a3f4a" },
  gear: { scale: [1, 1, 1], mass: 1.5, mat: "metal", color: "#d4a73c" },
  container: { scale: [2, 1.2, 2], mass: 5, mat: "glass" },
  pulley: { scale: [0.8, 0.8, 1], mass: 1, mat: "metal", color: "#9aa3b2", stat: true },
};

export function makeObject(kind: ShapeKind, over: Partial<ObjData> = {}): ObjData {
  const d = DEFAULTS[kind];
  const m = MATERIALS[over.material ?? d.mat];
  const scale = over.scale ?? [...d.scale];
  const o: ObjData = {
    id: uid(),
    kind,
    pos: [0, scale[1] / 2 + 0.01, 0],
    rot: [0, 0, 0],
    scale: scale as V3,
    color: d.color ?? m.color,
    material: d.mat,
    roughness: m.rough,
    metalness: m.metal,
    opacity: m.opacity,
    emissive: m.emissive,
    mass: d.mass,
    friction: m.friction,
    restitution: m.restitution,
    gravityScale: 1,
    linDamp: 0,
    angDamp: 0.02,
    isStatic: !!d.stat,
    locked: false,
    group: null,
    lv: [0, 0, 0],
    av: [0, 0, 0],
    force: [0, 0, 0],
    torque: [0, 0, 0],
  };
  const merged = { ...o, ...over };
  if (over.material && !over.color) merged.color = m.color;
  return merged;
}

export function quatOf(rot: V3): THREE.Quaternion {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], "XYZ"));
}

// ---------- geometry ----------
const geoCache = new Map<string, THREE.BufferGeometry>();

function gearGeo(teeth: number) {
  const shape = new THREE.Shape();
  const ro = 0.5, rr = 0.42, step = (Math.PI * 2) / teeth;
  const pt = (r: number, a: number) => [Math.cos(a) * r, Math.sin(a) * r] as const;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const seq: [number, number][] = [[rr, 0], [ro, 0.18], [ro, 0.46], [rr, 0.64]];
    seq.forEach(([r, f], j) => {
      const [x, y] = pt(r, a + f * step);
      if (i === 0 && j === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    });
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.08, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: false });
  g.translate(0, 0, -0.1);
  return g;
}

export function gearTeeth(scaleX: number) {
  return Math.max(8, Math.min(60, Math.round(scaleX * 14)));
}

function build(kind: ShapeKind, scale: V3): THREE.BufferGeometry {
  switch (kind) {
    case "cube": case "wall": case "platform": case "beam":
      return new THREE.BoxGeometry(1, 1, 1);
    case "plane": return new THREE.BoxGeometry(1, 0.04, 1);
    case "sphere": return new THREE.SphereGeometry(0.5, 40, 28);
    case "cylinder": case "rod": return new THREE.CylinderGeometry(0.5, 0.5, 1, 40);
    case "cone": return new THREE.CylinderGeometry(0, 0.5, 1, 40);
    case "capsule": return new THREE.CapsuleGeometry(0.25, 0.5, 8, 24);
    case "pyramid": {
      const g = new THREE.CylinderGeometry(0, Math.SQRT1_2, 1, 4, 1);
      g.rotateY(Math.PI / 4);
      return g;
    }
    case "ramp": {
      const s = new THREE.Shape();
      s.moveTo(-0.5, -0.5); s.lineTo(0.5, -0.5); s.lineTo(0.5, 0.5); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
      g.translate(0, 0, -0.5);
      return g;
    }
    case "wheel": {
      const parts: THREE.BufferGeometry[] = [];
      const tire = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 40);
      tire.rotateX(Math.PI / 2);
      parts.push(tire);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.BoxGeometry(0.88, 0.07, 0.34);
        b.rotateZ((i * Math.PI) / 4);
        parts.push(b);
      }
      return mergeGeometries(parts)!;
    }
    case "gear": return gearGeo(gearTeeth(scale[0]));
    case "pulley": {
      const prof = [[0.1, -0.1], [0.5, -0.1], [0.5, -0.055], [0.4, -0.025], [0.4, 0.025], [0.5, 0.055], [0.5, 0.1], [0.1, 0.1]]
        .map(([x, y]) => new THREE.Vector2(x, y));
      const l = new THREE.LatheGeometry(prof, 40);
      l.rotateX(Math.PI / 2);
      const m = new THREE.BoxGeometry(0.1, 0.1, 0.24);
      m.translate(0.42, 0, 0);
      return mergeGeometries([l, m])!;
    }
    case "container": {
      const t = 0.05;
      const mk = (w: number, h: number, d: number, x: number, y: number, z: number) => {
        const b = new THREE.BoxGeometry(w, h, d);
        b.translate(x, y, z);
        return b;
      };
      return mergeGeometries([
        mk(1, t, 1, 0, -0.5 + t / 2, 0),
        mk(t, 1, 1, -0.5 + t / 2, 0, 0), mk(t, 1, 1, 0.5 - t / 2, 0, 0),
        mk(1 - 2 * t, 1, t, 0, 0, -0.5 + t / 2), mk(1 - 2 * t, 1, t, 0, 0, 0.5 - t / 2),
      ])!;
    }
  }
}

export function geometryFor(kind: ShapeKind, scale: V3): THREE.BufferGeometry {
  const key = kind === "gear" ? `gear${gearTeeth(scale[0])}` : kind;
  let g = geoCache.get(key);
  if (!g) {
    g = build(kind, scale);
    geoCache.set(key, g);
  }
  return g;
}

export function disposeGeometries() {
  geoCache.forEach((g) => g.dispose());
  geoCache.clear();
}

// ---------- collider parts ----------
export type Q4 = [number, number, number, number];
export type Part =
  | { t: "cuboid"; h: V3; p: V3; q?: Q4 }
  | { t: "ball"; r: number; p: V3 }
  | { t: "cyl"; hh: number; r: number; p: V3; q?: Q4 }
  | { t: "cone"; hh: number; r: number; p: V3 }
  | { t: "capsule"; hh: number; r: number; p: V3 }
  | { t: "hull"; pts: number[]; p: V3 };

const QX90: Q4 = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const near = (a: number, b: number) => Math.abs(a - b) < 1e-3 * Math.max(1, Math.abs(a), Math.abs(b));

function hullOf(g: THREE.BufferGeometry, s: V3): number[] {
  const a = g.attributes.position;
  const out: number[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < a.count; i++) {
    const x = a.getX(i) * s[0], y = a.getY(i) * s[1], z = a.getZ(i) * s[2];
    const k = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    if (!seen.has(k)) { seen.add(k); out.push(x, y, z); }
  }
  return out;
}

let lowSphere: THREE.BufferGeometry | null = null;
let lowCyl: THREE.BufferGeometry | null = null;
let lowCone: THREE.BufferGeometry | null = null;
let lowCap: THREE.BufferGeometry | null = null;

export function colliderParts(kind: ShapeKind, s: V3): Part[] {
  const [sx, sy, sz] = s;
  switch (kind) {
    case "cube": case "wall": case "platform": case "beam":
      return [{ t: "cuboid", h: [sx / 2, sy / 2, sz / 2], p: [0, 0, 0] }];
    case "plane": return [{ t: "cuboid", h: [sx / 2, 0.02 * sy, sz / 2], p: [0, 0, 0] }];
    case "sphere":
      if (near(sx, sy) && near(sy, sz)) return [{ t: "ball", r: 0.5 * sx, p: [0, 0, 0] }];
      lowSphere ??= new THREE.SphereGeometry(0.5, 14, 10);
      return [{ t: "hull", pts: hullOf(lowSphere, s), p: [0, 0, 0] }];
    case "cylinder": case "rod":
      if (near(sx, sz)) return [{ t: "cyl", hh: sy / 2, r: sx / 2, p: [0, 0, 0] }];
      lowCyl ??= new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
      return [{ t: "hull", pts: hullOf(lowCyl, s), p: [0, 0, 0] }];
    case "cone":
      if (near(sx, sz)) return [{ t: "cone", hh: sy / 2, r: sx / 2, p: [0, 0, 0] }];
      lowCone ??= new THREE.CylinderGeometry(0, 0.5, 1, 24);
      return [{ t: "hull", pts: hullOf(lowCone, s), p: [0, 0, 0] }];
    case "capsule":
      if (near(sx, sy) && near(sy, sz)) return [{ t: "capsule", hh: 0.25 * sy, r: 0.25 * sx, p: [0, 0, 0] }];
      lowCap ??= new THREE.CapsuleGeometry(0.25, 0.5, 4, 12);
      return [{ t: "hull", pts: hullOf(lowCap, s), p: [0, 0, 0] }];
    case "pyramid": {
      const pts = [-.5, -.5, -.5, .5, -.5, -.5, .5, -.5, .5, -.5, -.5, .5, 0, .5, 0];
      return [{ t: "hull", pts: pts.map((v, i) => v * s[i % 3]), p: [0, 0, 0] }];
    }
    case "ramp": {
      const pts = [-.5, -.5, -.5, .5, -.5, -.5, .5, .5, -.5, -.5, -.5, .5, .5, -.5, .5, .5, .5, .5];
      return [{ t: "hull", pts: pts.map((v, i) => v * s[i % 3]), p: [0, 0, 0] }];
    }
    case "wheel": return [{ t: "cyl", hh: 0.15 * sz, r: 0.5 * sx, p: [0, 0, 0], q: QX90 }];
    case "gear": return [{ t: "cyl", hh: 0.1 * sz, r: 0.45 * sx, p: [0, 0, 0], q: QX90 }];
    case "pulley": return [{ t: "cyl", hh: 0.1 * sz, r: 0.5 * sx, p: [0, 0, 0], q: QX90 }];
    case "container": {
      const t = 0.05;
      return [
        { t: "cuboid", h: [sx / 2, (t * sy) / 2, sz / 2], p: [0, (-0.5 + t / 2) * sy, 0] },
        { t: "cuboid", h: [(t * sx) / 2, sy / 2, sz / 2], p: [(-0.5 + t / 2) * sx, 0, 0] },
        { t: "cuboid", h: [(t * sx) / 2, sy / 2, sz / 2], p: [(0.5 - t / 2) * sx, 0, 0] },
        { t: "cuboid", h: [sx / 2 - t * sx, sy / 2, (t * sz) / 2], p: [0, 0, (-0.5 + t / 2) * sz] },
        { t: "cuboid", h: [sx / 2 - t * sx, sy / 2, (t * sz) / 2], p: [0, 0, (0.5 - t / 2) * sz] },
      ];
    }
  }
}

export function partVolume(p: Part): number {
  switch (p.t) {
    case "cuboid": return 8 * p.h[0] * p.h[1] * p.h[2];
    case "ball": return (4 / 3) * Math.PI * p.r ** 3;
    case "cyl": return 2 * p.hh * Math.PI * p.r ** 2;
    case "cone": return (2 * p.hh * Math.PI * p.r ** 2) / 3;
    case "capsule": return Math.PI * p.r ** 2 * 2 * p.hh + (4 / 3) * Math.PI * p.r ** 3;
    case "hull": {
      // bounding-box based estimate scaled by 0.5 (educational approximation)
      let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
      for (let i = 0; i < p.pts.length; i++) {
        mn[i % 3] = Math.min(mn[i % 3], p.pts[i]);
        mx[i % 3] = Math.max(mx[i % 3], p.pts[i]);
      }
      return (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]) * 0.5;
    }
  }
}

export function volumeOf(kind: ShapeKind, s: V3): number {
  if (kind === "pyramid") return (s[0] * s[1] * s[2]) / 3;
  if (kind === "ramp") return (s[0] * s[1] * s[2]) / 2;
  if (kind === "sphere") return ((4 / 3) * Math.PI * 0.125) * s[0] * s[1] * s[2];
  return Math.max(1e-6, colliderParts(kind, s).reduce((a, p) => a + partVolume(p), 0));
}

export function effectiveRadius(o: ObjData): number {
  return 0.5 * Math.cbrt(Math.abs(o.scale[0] * o.scale[1] * o.scale[2]));
}
