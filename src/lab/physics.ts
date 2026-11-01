import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { colliderParts, partVolume, quatOf, effectiveRadius } from "./shapes";
import type { EnvData, JointData, ObjData, V3 } from "./types";

export interface BodyState { p: V3; q: [number, number, number, number]; lv: V3; av: V3 }

export interface Observation {
  p: V3; rot: V3; v: V3; w: V3; a: V3; alpha: V3; mass: number; F: V3; mom: V3; L: V3;
  ekT: number; ekR: number; ep: number; e: number; speed: number; stat: boolean;
}

let rapierReady: Promise<void> | null = null;
export function initRapier() {
  rapierReady ??= RAPIER.init();
  return rapierReady;
}

const tq = new THREE.Quaternion();
const tv = new THREE.Vector3();
const len3 = (v: V3) => Math.hypot(v[0], v[1], v[2]);

export class PhysicsSim {
  world!: RAPIER.World;
  dt = 1 / 240;
  time = 0;
  stepped = false;
  g = 9.80665;
  air = false;
  rho = 1.225;
  objs = new Map<string, ObjData>();
  joints: JointData[] = [];
  handles = new Map<string, number>();
  worldBody = 0;
  private dyn: string[] = [];
  private acc = new Map<string, V3>();
  private alp = new Map<string, V3>();
  private pulley0 = new Map<string, number>();
  nonFinite = false;

  constructor() {}

  setEnv(env: EnvData) {
    this.g = Math.max(0, env.g);
    this.air = env.air;
    this.rho = env.rho;
    if (this.world) this.world.gravity = { x: 0, y: -this.g, z: 0 };
  }

  body(id: string): RAPIER.RigidBody | null {
    const h = this.handles.get(id);
    return h === undefined ? null : this.world.getRigidBody(h);
  }

  captureStates(): Map<string, BodyState> {
    const out = new Map<string, BodyState>();
    for (const id of this.objs.keys()) {
      const b = this.body(id);
      if (!b) continue;
      const t = b.translation(), r = b.rotation(), lv = b.linvel(), av = b.angvel();
      out.set(id, { p: [t.x, t.y, t.z], q: [r.x, r.y, r.z, r.w], lv: [lv.x, lv.y, lv.z], av: [av.x, av.y, av.z] });
    }
    return out;
  }

  build(objects: ObjData[], joints: JointData[], env: EnvData, keep?: Map<string, BodyState>) {
    if (this.world) this.world.free();
    const R = RAPIER;
    this.world = new R.World({ x: 0, y: -env.g, z: 0 });
    this.world.timestep = this.dt;
    this.world.integrationParameters.numSolverIterations = 4;
    this.world.integrationParameters.numInternalPgsIterations = 8;
    this.setEnv(env);
    this.handles.clear();
    this.objs.clear();
    this.acc.clear();
    this.alp.clear();
    this.pulley0.clear();
    this.nonFinite = false;
    this.joints = joints;
    if (!keep) { this.time = 0; this.stepped = false; }

    // ground
    const ground = this.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0));
    this.world.createCollider(
      R.ColliderDesc.cuboid(200, 0.5, 200).setFriction(1).setRestitution(1)
        .setFrictionCombineRule(R.CoefficientCombineRule.Multiply)
        .setRestitutionCombineRule(R.CoefficientCombineRule.Multiply),
      ground,
    );
    const wb = this.world.createRigidBody(R.RigidBodyDesc.fixed());
    this.worldBody = wb.handle;

    this.dyn = [];
    for (const o of objects) {
      this.objs.set(o.id, o);
      const st = keep?.get(o.id);
      const p = st?.p ?? o.pos;
      const q = st?.q ?? (() => { const k = quatOf(o.rot); return [k.x, k.y, k.z, k.w] as [number, number, number, number]; })();
      const lv = st?.lv ?? o.lv, av = st?.av ?? o.av;
      const desc = o.isStatic ? R.RigidBodyDesc.fixed() : R.RigidBodyDesc.dynamic();
      desc.setTranslation(p[0], p[1], p[2]).setRotation({ x: q[0], y: q[1], z: q[2], w: q[3] });
      if (!o.isStatic) {
        desc.setLinvel(lv[0], lv[1], lv[2]).setAngvel({ x: av[0], y: av[1], z: av[2] })
          .setLinearDamping(o.linDamp).setAngularDamping(o.angDamp)
          .setGravityScale(o.gravityScale).setCanSleep(false).setCcdEnabled(true);
      }
      const body = this.world.createRigidBody(desc);
      this.handles.set(o.id, body.handle);
      const parts = o.ghost ? [] : colliderParts(o.kind, o.scale);
      const vols = parts.map(partVolume);
      const vt = vols.reduce((a, b) => a + b, 0) || 1;
      parts.forEach((pt, i) => {
        let cd: RAPIER.ColliderDesc | null = null;
        switch (pt.t) {
          case "cuboid": cd = R.ColliderDesc.cuboid(Math.max(pt.h[0], 1e-3), Math.max(pt.h[1], 1e-3), Math.max(pt.h[2], 1e-3)); break;
          case "ball": cd = R.ColliderDesc.ball(pt.r); break;
          case "cyl": cd = R.ColliderDesc.cylinder(pt.hh, pt.r); break;
          case "cone": cd = R.ColliderDesc.cone(pt.hh, pt.r); break;
          case "capsule": cd = R.ColliderDesc.capsule(pt.hh, pt.r); break;
          case "hull": cd = R.ColliderDesc.convexHull(new Float32Array(pt.pts)); break;
        }
        if (!cd) cd = R.ColliderDesc.cuboid(0.25, 0.25, 0.25);
        cd.setTranslation(pt.p[0], pt.p[1], pt.p[2]);
        if ("q" in pt && pt.q) cd.setRotation({ x: pt.q[0], y: pt.q[1], z: pt.q[2], w: pt.q[3] });
        cd.setFriction(o.friction).setRestitution(o.restitution)
          .setFrictionCombineRule(R.CoefficientCombineRule.Multiply)
          .setRestitutionCombineRule(R.CoefficientCombineRule.Multiply);
        if (!o.isStatic) cd.setMass(Math.max(0.001, o.mass * (vols[i] / vt)));
        this.world.createCollider(cd, body);
      });
      if (!o.isStatic) this.dyn.push(o.id);
    }

    for (const j of joints) this.createJoint(j);
    for (const j of joints) if (j.kind === "pulley") this.pulley0.set(j.id, this.pulleyD(j));
  }

  private createJoint(j: JointData) {
    const R = RAPIER;
    const bA = this.body(j.a);
    const bB = j.b ? this.body(j.b) : this.world.getRigidBody(this.worldBody);
    if (!bA || !bB) return;
    const v = (a: V3) => ({ x: a[0], y: a[1], z: a[2] });
    let data: RAPIER.JointData | null = null;
    switch (j.kind) {
      case "fixed": {
        const qa = bA.rotation(), qb = bB.rotation();
        const A = new THREE.Quaternion(qa.x, qa.y, qa.z, qa.w), B = new THREE.Quaternion(qb.x, qb.y, qb.z, qb.w);
        const f2 = B.clone().invert().multiply(A);
        data = R.JointData.fixed(v(j.pa), { x: 0, y: 0, z: 0, w: 1 }, v(j.pb), { x: f2.x, y: f2.y, z: f2.z, w: f2.w });
        break;
      }
      case "revolute":
        data = R.JointData.revoluteWithAxes(v(j.pa), v(j.pb), v(j.axA), v(j.axB));
        if (j.lim) { data.limitsEnabled = true; data.limits = [j.lim[0], j.lim[1]]; }
        break;
      case "prismatic":
        data = R.JointData.prismatic(v(j.pa), v(j.pb), v(j.axA));
        if (j.lim) { data.limitsEnabled = true; data.limits = [j.lim[0], j.lim[1]]; }
        break;
      case "spherical": data = R.JointData.spherical(v(j.pa), v(j.pb)); break;
      case "distance": data = R.JointData.rope(j.len, v(j.pa), v(j.pb)); break;
      default: return;
    }
    this.world.createImpulseJoint(data, bA, bB, true).setContactsEnabled(false);
  }

  private wp(b: RAPIER.RigidBody, l: V3, out: THREE.Vector3) {
    const r = b.rotation(), t = b.translation();
    tq.set(r.x, r.y, r.z, r.w);
    return out.set(l[0], l[1], l[2]).applyQuaternion(tq).add(tv.set(t.x, t.y, t.z));
  }

  worldAnchors(j: JointData, A: THREE.Vector3, B: THREE.Vector3) {
    const bA = this.body(j.a);
    const bB = j.b ? this.body(j.b) : this.world.getRigidBody(this.worldBody);
    if (!bA || !bB) return false;
    this.wp(bA, j.pa, A);
    this.wp(bB, j.pb, B);
    return true;
  }

  private pulleyD(j: JointData): number {
    const bA = this.body(j.a);
    if (!bA || j.pts.length < 2) return 0;
    const a = this.wp(bA, j.pa, new THREE.Vector3());
    return a.distanceTo(new THREE.Vector3(...j.pts[0]));
  }

  pulleyAngle(j: JointData, radius: number): number {
    const d0 = this.pulley0.get(j.id) ?? 0;
    return (this.pulleyD(j) - d0) / Math.max(radius, 1e-3);
  }

  springEnergy(): number {
    let e = 0;
    const A = new THREE.Vector3(), B = new THREE.Vector3();
    for (const j of this.joints) {
      if (j.kind !== "spring" || !this.worldAnchors(j, A, B)) continue;
      const x = A.distanceTo(B) - j.len;
      e += 0.5 * j.k * x * x;
    }
    return e;
  }

  step() {
    const w = this.world;
    const v0 = new Map<string, V3>(), w0 = new Map<string, V3>();
    const A = new THREE.Vector3(), B = new THREE.Vector3();
    for (const id of this.dyn) {
      const b = this.body(id)!;
      const o = this.objs.get(id)!;
      const lv = b.linvel(), av = b.angvel();
      v0.set(id, [lv.x, lv.y, lv.z]);
      w0.set(id, [av.x, av.y, av.z]);
      b.resetForces(false);
      b.resetTorques(false);
      if (o.force[0] || o.force[1] || o.force[2]) b.addForce({ x: o.force[0], y: o.force[1], z: o.force[2] }, true);
      if (o.torque[0] || o.torque[1] || o.torque[2]) b.addTorque({ x: o.torque[0], y: o.torque[1], z: o.torque[2] }, true);
      if (this.air) {
        const sp = Math.hypot(lv.x, lv.y, lv.z);
        if (sp > 1e-6) {
          const r = effectiveRadius(o);
          const cd = o.kind === "sphere" || o.kind === "capsule" ? 0.47 : 1.05;
          const k = 0.5 * this.rho * cd * Math.PI * r * r * sp;
          b.addForce({ x: -k * lv.x, y: -k * lv.y, z: -k * lv.z }, true);
        }
      }
    }
    for (const j of this.joints) {
      if (j.kind === "spring") {
        if (!this.worldAnchors(j, A, B)) continue;
        const bA = this.body(j.a)!;
        const bB = j.b ? this.body(j.b)! : this.world.getRigidBody(this.worldBody);
        const d = B.clone().sub(A);
        const L = d.length();
        if (L < 1e-9) continue;
        d.divideScalar(L);
        const va = bA.velocityAtPoint({ x: A.x, y: A.y, z: A.z }), vb = bB.velocityAtPoint({ x: B.x, y: B.y, z: B.z });
        const rel = (vb.x - va.x) * d.x + (vb.y - va.y) * d.y + (vb.z - va.z) * d.z;
        let F = j.k * (L - j.len) + j.c * rel;
        F = Math.max(-1e5, Math.min(1e5, F));
        const f = { x: d.x * F, y: d.y * F, z: d.z * F };
        bA.addForceAtPoint(f, { x: A.x, y: A.y, z: A.z }, true);
        bB.addForceAtPoint({ x: -f.x, y: -f.y, z: -f.z }, { x: B.x, y: B.y, z: B.z }, true);
      } else if (j.kind === "pulley" && j.b && j.pts.length >= 2) {
        const bA = this.body(j.a), bB = this.body(j.b);
        if (!bA || !bB) continue;
        const pa = this.wp(bA, j.pa, new THREE.Vector3()), pb = this.wp(bB, j.pb, new THREE.Vector3());
        const P1 = new THREE.Vector3(...j.pts[0]), P2 = new THREE.Vector3(...j.pts[1]);
        const u1 = pa.clone().sub(P1), u2 = pb.clone().sub(P2);
        const d1 = u1.length(), d2 = u2.length();
        if (d1 < 1e-6 || d2 < 1e-6) continue;
        u1.divideScalar(d1); u2.divideScalar(d2);
        const excess = d1 + d2 - j.len;
        if (excess > 0) {
          const va = bA.linvel(), vb = bB.linvel();
          const rate = va.x * u1.x + va.y * u1.y + va.z * u1.z + vb.x * u2.x + vb.y * u2.y + vb.z * u2.z;
          const mm = Math.min(bA.mass(), bB.mass());
          const k = 8000 * mm, c = 0.8 * Math.sqrt(k * mm);
          const T = Math.max(0, k * excess + c * rate);
          bA.addForceAtPoint({ x: -T * u1.x, y: -T * u1.y, z: -T * u1.z }, { x: pa.x, y: pa.y, z: pa.z }, true);
          bB.addForceAtPoint({ x: -T * u2.x, y: -T * u2.y, z: -T * u2.z }, { x: pb.x, y: pb.y, z: pb.z }, true);
        }
      } else if (j.kind === "gear" && j.b) {
        const oa = this.objs.get(j.a), ob = this.objs.get(j.b);
        const bA = this.body(j.a), bB = this.body(j.b);
        if (!oa || !ob || !bA || !bB) continue;
        const r1 = 0.46 * oa.scale[0], r2 = 0.46 * ob.scale[0];
        const I1 = bA.effectiveAngularInertia().m33, I2 = bB.effectiveAngularInertia().m33;
        const e = bA.angvel().z * r1 + bB.angvel().z * r2;
        const jj = e / (r1 * r1 / I1 + r2 * r2 / I2);
        bA.applyTorqueImpulse({ x: 0, y: 0, z: -jj * r1 }, true);
        bB.applyTorqueImpulse({ x: 0, y: 0, z: -jj * r2 }, true);
      }
    }
    w.step();
    this.time += this.dt;
    this.stepped = true;
    for (const id of this.dyn) {
      const b = this.body(id)!;
      const lv = b.linvel(), av = b.angvel();
      if (!Number.isFinite(lv.x + lv.y + lv.z + av.x + av.y + av.z)) { this.nonFinite = true; continue; }
      const a0 = v0.get(id)!, o0 = w0.get(id)!;
      this.acc.set(id, [(lv.x - a0[0]) / this.dt, (lv.y - a0[1]) / this.dt, (lv.z - a0[2]) / this.dt]);
      this.alp.set(id, [(av.x - o0[0]) / this.dt, (av.y - o0[1]) / this.dt, (av.z - o0[2]) / this.dt]);
    }
  }

  observe(id: string): Observation | null {
    const b = this.body(id);
    const o = this.objs.get(id);
    if (!b || !o) return null;
    const t = b.translation(), r = b.rotation();
    const stat = o.isStatic;
    const lv = stat ? { x: 0, y: 0, z: 0 } : b.linvel();
    const av = stat ? { x: 0, y: 0, z: 0 } : b.angvel();
    const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(r.x, r.y, r.z, r.w), "XYZ");
    const m = stat ? o.mass : b.mass();
    const a = this.acc.get(id) ?? [0, 0, 0];
    const al = this.alp.get(id) ?? [0, 0, 0];
    let ekR = 0, L: V3 = [0, 0, 0];
    if (!stat) {
      const I = b.effectiveAngularInertia();
      L = [I.m11 * av.x + I.m12 * av.y + I.m13 * av.z, I.m21 * av.x + I.m22 * av.y + I.m23 * av.z, I.m31 * av.x + I.m32 * av.y + I.m33 * av.z];
      ekR = 0.5 * (L[0] * av.x + L[1] * av.y + L[2] * av.z);
    }
    const sp = Math.hypot(lv.x, lv.y, lv.z);
    const ekT = stat ? 0 : 0.5 * m * sp * sp;
    const ep = stat ? 0 : m * o.gravityScale * this.g * t.y;
    return {
      p: [t.x, t.y, t.z], rot: [e.x, e.y, e.z], v: [lv.x, lv.y, lv.z], w: [av.x, av.y, av.z], a, alpha: al,
      mass: m, F: [m * a[0], m * a[1], m * a[2]], mom: [m * lv.x, m * lv.y, m * lv.z], L,
      ekT, ekR, ep, e: ekT + ekR + ep, speed: sp, stat,
    };
  }

  systemEnergy() {
    let ek = 0, ep = 0, mom: V3 = [0, 0, 0];
    for (const id of this.dyn) {
      const ob = this.observe(id);
      if (!ob) continue;
      ek += ob.ekT + ob.ekR;
      ep += ob.ep;
      mom = [mom[0] + ob.mom[0], mom[1] + ob.mom[1], mom[2] + ob.mom[2]];
    }
    const es = this.springEnergy();
    return { ek, ep, es, total: ek + ep + es, mom, pmag: len3(mom) };
  }

  snapshot(): Uint8Array {
    return this.world.takeSnapshot();
  }

  restore(data: Uint8Array, time: number) {
    this.world.free();
    this.world = RAPIER.World.restoreSnapshot(data);
    this.world.timestep = this.dt;
    this.world.gravity = { x: 0, y: -this.g, z: 0 };
    this.time = time;
    this.acc.clear();
    this.alp.clear();
  }

  setTransform(id: string, p: V3, rot: V3) {
    const b = this.body(id);
    if (!b) return;
    const q = quatOf(rot);
    b.setTranslation({ x: p[0], y: p[1], z: p[2] }, true);
    b.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    if (!b.isFixed()) { b.setLinvel({ x: 0, y: 0, z: 0 }, true); b.setAngvel({ x: 0, y: 0, z: 0 }, true); }
  }

  dispose() {
    if (this.world) this.world.free();
  }
}
