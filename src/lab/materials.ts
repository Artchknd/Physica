import * as THREE from "three";
import type { MaterialKey, ObjData } from "./types";

export interface MatSpec {
  color: string;
  rough: number;
  metal: number;
  opacity: number;
  emissive: number;
  friction: number;
  restitution: number;
  density: number; // kg/m³
  tex?: "wood" | "concrete" | null;
  ior?: number;
}

export const MATERIALS: Record<MaterialKey, MatSpec> = {
  metal: { color: "#c9ced6", rough: 0.22, metal: 1, opacity: 1, emissive: 0, friction: 0.45, restitution: 0.3, density: 7800 },
  glass: { color: "#bfe6f5", rough: 0.04, metal: 0, opacity: 0.28, emissive: 0, friction: 0.3, restitution: 0.45, density: 2500, ior: 1.5 },
  plastic: { color: "#4f8cff", rough: 0.4, metal: 0, opacity: 1, emissive: 0, friction: 0.4, restitution: 0.5, density: 1200 },
  rubber: { color: "#ef4b4b", rough: 0.92, metal: 0, opacity: 1, emissive: 0, friction: 0.95, restitution: 0.8, density: 1100 },
  wood: { color: "#c18a54", rough: 0.7, metal: 0, opacity: 1, emissive: 0, friction: 0.55, restitution: 0.4, density: 600, tex: "wood" },
  ceramic: { color: "#f3f1ea", rough: 0.12, metal: 0, opacity: 1, emissive: 0, friction: 0.4, restitution: 0.5, density: 2400 },
  concrete: { color: "#9a9a96", rough: 0.95, metal: 0, opacity: 1, emissive: 0, friction: 0.8, restitution: 0.1, density: 2300, tex: "concrete" },
  water: { color: "#3aa6ff", rough: 0.02, metal: 0, opacity: 0.55, emissive: 0, friction: 0.05, restitution: 0.0, density: 1000, ior: 1.33 },
  emissive: { color: "#ffd24a", rough: 0.4, metal: 0, opacity: 1, emissive: 2.2, friction: 0.4, restitution: 0.4, density: 1000 },
};

const texCache: Record<string, THREE.CanvasTexture> = {};

function makeTexture(kind: "wood" | "concrete"): THREE.CanvasTexture {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  if (kind === "wood") {
    g.fillStyle = "#e6c9a4";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * 256;
      g.strokeStyle = `rgba(120,70,30,${0.05 + Math.random() * 0.18})`;
      g.lineWidth = 0.6 + Math.random() * 2;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(80, y + Math.random() * 12 - 6, 170, y + Math.random() * 12 - 6, 256, y + Math.random() * 8 - 4);
      g.stroke();
    }
  } else {
    g.fillStyle = "#cfcfcb";
    g.fillRect(0, 0, 256, 256);
    const img = g.getImageData(0, 0, 256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 46;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    g.putImageData(img, 0, 0);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache[kind] = t;
  return t;
}

export function applyMaterial(m: THREE.MeshPhysicalMaterial, o: ObjData) {
  const spec = MATERIALS[o.material];
  m.color.set(o.color);
  m.roughness = o.roughness;
  m.metalness = o.metalness;
  m.opacity = o.opacity;
  m.transparent = o.opacity < 0.999;
  m.depthWrite = o.opacity >= 0.6;
  m.emissive.set(o.emissive > 0 ? o.color : "#000000");
  m.emissiveIntensity = o.emissive;
  m.map = spec.tex ? makeTexture(spec.tex) : null;
  m.ior = spec.ior ?? 1.45;
  m.clearcoat = o.material === "glass" || o.material === "ceramic" || o.material === "plastic" ? 0.6 : 0;
  m.clearcoatRoughness = 0.1;
  m.envMapIntensity = o.material === "metal" ? 1.4 : 1;
  m.side = o.material === "glass" || o.material === "water" ? THREE.DoubleSide : THREE.FrontSide;
  m.needsUpdate = true;
}

export function createMaterial(o: ObjData) {
  const m = new THREE.MeshPhysicalMaterial();
  applyMaterial(m, o);
  return m;
}

export function disposeTextures() {
  Object.values(texCache).forEach((t) => t.dispose());
  for (const k of Object.keys(texCache)) delete texCache[k];
}
