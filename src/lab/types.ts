export type V3 = [number, number, number];

export type ShapeKind =
  | "cube" | "sphere" | "cylinder" | "cone" | "capsule" | "plane" | "pyramid" | "wall"
  | "platform" | "ramp" | "beam" | "rod" | "wheel" | "gear" | "container" | "pulley";

export type MaterialKey =
  | "metal" | "glass" | "plastic" | "rubber" | "wood" | "ceramic" | "concrete" | "water" | "emissive";

export type EnvKey = "earth" | "moon" | "mars" | "zero" | "custom";

export type JointKind =
  | "fixed" | "revolute" | "prismatic" | "spherical" | "spring" | "distance" | "pulley" | "gear";

export interface ObjData {
  id: string;
  kind: ShapeKind;
  name?: string;
  pos: V3;
  rot: V3; // Euler XYZ, radians
  scale: V3;
  color: string;
  material: MaterialKey;
  roughness: number;
  metalness: number;
  opacity: number;
  emissive: number;
  mass: number;
  friction: number;
  restitution: number;
  gravityScale: number;
  linDamp: number;
  angDamp: number;
  isStatic: boolean;
  locked: boolean;
  ghost?: boolean; // visual only, no collider
  group: string | null;
  lv: V3;
  av: V3;
  force: V3;
  torque: V3;
}

export interface JointData {
  id: string;
  kind: JointKind;
  a: string;
  b: string | null; // null => world
  pa: V3; // local anchor on a
  pb: V3; // local anchor on b (or world position when b === null)
  axA: V3;
  axB: V3;
  k: number; // spring stiffness N/m
  c: number; // damping N·s/m
  len: number; // rest / max length
  lim: [number, number] | null;
  pts: V3[]; // pulley tangent points (world)
  wheel?: string; // pulley wheel object (visual rotation)
}

export interface EnvData {
  preset: EnvKey;
  g: number;
  air: boolean;
  rho: number;
}

export interface ModuleState {
  cat: string;
  mode: string;
  values: Record<string, number>;
  data?: unknown;
}

export interface SceneData {
  v: 1;
  name: string;
  objects: ObjData[];
  joints: JointData[];
  env: EnvData;
  module?: ModuleState;
  presetId?: string;
  presetValues?: Record<string, number>;
}

export interface ParamDef {
  key: string;
  label: string; // i18n key
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  type?: "slider" | "select" | "toggle" | "button";
  options?: { v: number; label: string }[]; // select, labels are i18n keys
  hidden?: (v: Record<string, number>) => boolean;
  modes?: string[];
  hint?: string;
}

export interface Readout {
  label: string; // i18n key
  value: number | string;
  unit?: string;
  digits?: number;
  temp?: boolean; // kelvin value, convertible
  tr?: boolean; // value is an i18n key
  tone?: "ok" | "warn" | "bad";
}

export interface ChartSeries {
  label: string; // i18n key
  color: string;
  pts: { x: number; y: number }[];
  dashed?: boolean;
  points?: boolean;
}

export interface ChartSpec {
  id: string;
  title: string; // i18n key
  xLabel: string; // i18n key
  yLabel: string; // i18n key
  xUnit?: string;
  yUnit?: string;
  series: ChartSeries[];
}

export interface Notice {
  key: string;
  params?: Record<string, string | number>;
  tone?: "info" | "ok" | "warn" | "error";
}

export const uid = (p = "o") => p + Math.random().toString(36).slice(2, 9);
