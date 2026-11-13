// Candy Wall: dynamic candy pieces (rigid body + meshes), squash and wobble, settling damping so piles fall asleep, cutting, snapping, shattering and liquid cores.
import * as THREE from 'three';
import { GROUP, RAPIER } from './physics.js';
import { buildMeshes, disposeMeshes, measureSet, setParts, splitSet, wholeSet } from './candy.js';
import { GRP_CAP, hullPoints } from './lib/cut.js';
import { clamp, lerp, rand } from './util.js';
import { wholeShape } from './shape.js';
import { IS_TOUCH } from './config.js';

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _d = new THREE.Matrix4();
const _one = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);
const MAX_PIECES = IS_TOUCH ? 300 : 560;
const _w = new THREE.Matrix4();
const WHITE = new THREE.Color(1, 1, 1);

function deform(out, a, s, ext) {
  const b = 1 / Math.sqrt(Math.max(0.2, s));
  const k = s - b;
  const t = ext * (s - 1);
  out.set(b + k * a.x * a.x, k * a.x * a.y, k * a.x * a.z, a.x * t, k * a.y * a.x, b + k * a.y * a.y, k * a.y * a.z, a.y * t, k * a.z * a.x, k * a.z * a.y, b + k * a.z * a.z, a.z * t, 0, 0, 0, 1);
  return out;
}

export class Piece {
  constructor(sys, set, o) {
    this.sys = sys;
    this.set = set;
    this.prep = set.prep;
    const prep = set.prep;
    let m;
    if (set.whole) m = prep.wholeMeasure || (prep.wholeMeasure = measureSet(set));
    else m = measureSet(set);
    this.center = m.center;
    this.size = m.size;
    this.volume = m.volume;
    this.frac = clamp(m.volume / Math.max(1e-6, prep.volume), 0.002, 1);
    this.mass = Math.max(0.05, prep.mass * this.frac);
    this.radius = Math.hypot(m.size[0], m.size[1], m.size[2]) / 2;
    this.soft = Math.pow(1 - prep.feel.hardness, 1.25);
    this.opens = set.opens || [];
    this.zone = o.zone || 'table';
    this.held = false;
    this.pinned = false;
    this.dead = false;
    this.age = 0;
    this.quiet = 0;
    this.sAxis = new THREE.Vector3(0, 1, 0);
    this.s = 1;
    this.sv = 0;
    this.st = 1;
    this.sExt = 0;
    this.sForce = false;
    this.prevV = new THREE.Vector3();
    this.calm = 0;
    this.still = 0;
    this.calmed = false;
    this.pos = new THREE.Vector3().copy(o.pos);
    this.quat = new THREE.Quaternion().copy(o.quat || _q.identity());
    this.batched = !!set.whole;
    this.matrix = new THREE.Matrix4();
    this.slot = -1;
    this.group = null;
    if (!this.batched) {
      this.group = buildMeshes(set, m.center);
      this.group.matrixAutoUpdate = false;
      this.group.userData.piece = this;
    }
    const feel = prep.feel;
    const bd = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(this.pos.x, this.pos.y, this.pos.z)
      .setRotation(this.quat)
      .setLinearDamping(0.25 + feel.sticky * 0.6)
      .setAngularDamping(0.7 + this.soft * 1.4 + feel.sticky)
      .setSoftCcdPrediction(1.2);
    if (o.vel) bd.setLinvel(o.vel.x, o.vel.y, o.vel.z);
    if (o.spin) bd.setAngvel(o.spin);
    this.body = sys.physics.world.createRigidBody(bd);
    let cd = null;
    if (set.whole) cd = wholeShape(prep, RAPIER).make();
    else {
      const pts = this.hull();
      cd = pts.length >= 12 ? RAPIER.ColliderDesc.convexHull(pts) : null;
    }
    if (!cd) cd = RAPIER.ColliderDesc.cuboid(Math.max(0.08, m.size[0] / 2), Math.max(0.08, m.size[1] / 2), Math.max(0.08, m.size[2] / 2));
    cd.setMass(this.mass)
      .setFriction(lerp(0.45, 1.3, clamp(feel.sticky + this.soft * 0.5, 0, 1)))
      .setRestitution(clamp(feel.bounce * 0.45, 0, 0.6))
      .setCollisionGroups(GROUP.piece);
    this.collider = sys.physics.world.createCollider(cd, this.body);
    sys.physics.register(this.collider, this);
    this.liquids = [];
    if (this.opens.length) this.initLiquids(o.levels);
    this.sync(true);
  }

  hull() {
    const soups = this.set.soups.filter(Boolean);
    if (this.set.attach.length) {
      for (const ai of this.set.attach) {
        const g = this.prep.layers[ai].geometry;
        const pa = g.attributes.position;
        const step = Math.max(1, Math.floor(pa.count / 24));
        const pos = [];
        for (let i = 0; i < pa.count; i += step) pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
        soups.push({ pos });
      }
    }
    return hullPoints(soups, this.center, 40);
  }

  initLiquids(levels) {
    this.prep.layers.forEach((l, i) => {
      const soup = this.set.soups[i];
      if (!soup || l.role !== 'core' || !l.fill || (l.fill.type !== 'liquid' && l.fill.type !== 'gel')) return;
      const mesh = this.group.children.find((c) => c.userData.layer === i);
      if (!mesh) return;
      let vol = 0;
      const P = soup.pos;
      for (let k = 0; k < P.length; k += 9) vol += (P[k] * (P[k + 4] * P[k + 8] - P[k + 5] * P[k + 7]) + P[k + 1] * (P[k + 5] * P[k + 6] - P[k + 3] * P[k + 8]) + P[k + 2] * (P[k + 3] * P[k + 7] - P[k + 4] * P[k + 6])) / 6;
      const caps = [];
      const tris = soup.count;
      const stride = Math.max(1, Math.floor(tris / 30));
      for (let t = 0; t < tris; t += stride) if (soup.grp[t] === GRP_CAP) caps.push(new THREE.Vector3(P[t * 9] - this.center[0], P[t * 9 + 1] - this.center[1], P[t * 9 + 2] - this.center[2]));
      const pts = [];
      const step = Math.max(1, Math.floor(P.length / 3 / 40));
      for (let k = 0; k < P.length / 3; k += step) pts.push(new THREE.Vector3(P[k * 3] - this.center[0], P[k * 3 + 1] - this.center[1], P[k * 3 + 2] - this.center[2]));
      const level = levels && levels[i] !== undefined ? levels[i] : 1;
      this.liquids.push({ li: i, fill: l.fill, mesh, vol: Math.abs(vol) * (l.fill.amount ?? 1), level, caps, pts, acc: 0, base: mesh.position.clone() });
      mesh.matrixAutoUpdate = false;
    });
  }

  get liquidLeft() {
    let v = 0;
    for (const l of this.liquids) v += l.vol * l.level;
    return v;
  }

  sync(force) {
    const b = this.body;
    const moving = !b.isSleeping();
    const squashing = Math.abs(this.s - 1) > 1e-4 || Math.abs(this.sv) > 1e-3 || this.st !== 1;
    if (!moving && !squashing && !force && !this.liquidActive) return false;
    const t = b.translation();
    const r = b.rotation();
    this.pos.set(t.x, t.y, t.z);
    this.quat.set(r.x, r.y, r.z, r.w);
    _m.compose(this.pos, this.quat, _one);
    if (squashing) _m.multiply(deform(_d, this.sAxis, this.s, this.sExt));
    if (this.batched) {
      this.matrix.copy(_m);
      if (this.batch) this.batch.dirty = true;
    } else {
      this.group.matrix.copy(_m);
      this.group.matrixWorldNeedsUpdate = true;
    }
    return moving || squashing;
  }

  press(axisWorld, amount, pivot = true) {
    _qi.copy(this.quat).invert();
    this.sAxis.copy(axisWorld).applyQuaternion(_qi).normalize();
    const e = Math.abs(this.sAxis.x) * this.size[0] + Math.abs(this.sAxis.y) * this.size[1] + Math.abs(this.sAxis.z) * this.size[2];
    this.sExt = pivot ? e / 2 : 0;
    this.st = 1 - clamp(amount, 0, 1) * this.soft * 0.55;
    this.sForce = true;
  }

  relax() {
    this.st = 1;
    this.sForce = false;
  }

  kick(axisWorld, strength) {
    if (this.sForce || this.soft < 0.02) return;
    _qi.copy(this.quat).invert();
    this.sAxis.copy(axisWorld).applyQuaternion(_qi).normalize();
    const e = Math.abs(this.sAxis.x) * this.size[0] + Math.abs(this.sAxis.y) * this.size[1] + Math.abs(this.sAxis.z) * this.size[2];
    this.sExt = e / 2;
    this.sv -= strength * this.soft;
    this.body.wakeUp();
  }

  stepSquash(dt) {
    if (Math.abs(this.s - this.st) < 1e-4 && Math.abs(this.sv) < 1e-3) {
      this.s = this.st;
      this.sv = 0;
      return;
    }
    const feel = this.prep.feel;
    const f = lerp(3.2, 13, feel.hardness);
    const k = (Math.PI * 2 * f) ** 2;
    const z = this.sForce ? 0.9 : lerp(0.85, 0.16, feel.bounce);
    const c = 2 * Math.sqrt(k) * z;
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.sv += ((this.st - this.s) * k - this.sv * c) * h;
      this.s += this.sv * h;
    }
    this.s = clamp(this.s, 0.35, 1.5);
  }

  worldToLocal(v, out) {
    _qi.copy(this.quat).invert();
    return out.copy(v).sub(this.pos).applyQuaternion(_qi).add(_a.fromArray(this.center));
  }

  localToWorld(v, out) {
    return out.copy(v).sub(_a.fromArray(this.center)).applyQuaternion(this.quat).add(this.pos);
  }

  settle(on) {
    if (this.calmed === on) return;
    this.calmed = on;
    const feel = this.prep.feel;
    this.body.setLinearDamping(on ? 6 : 0.25 + feel.sticky * 0.6);
    this.body.setAngularDamping(on ? 14 : 0.7 + this.soft * 1.4 + feel.sticky);
  }

  setPinned(on) {
    if (this.pinned === on) return;
    this.pinned = on;
    this.body.setBodyType(on ? RAPIER.RigidBodyType.Fixed : RAPIER.RigidBodyType.Dynamic, true);
  }

  topY() {
    const q = this.quat;
    const ax = _a.set(1, 0, 0).applyQuaternion(q).y;
    const ay = _a.set(0, 1, 0).applyQuaternion(q).y;
    const az = _a.set(0, 0, 1).applyQuaternion(q).y;
    return this.pos.y + (Math.abs(ax) * this.size[0] + Math.abs(ay) * this.size[1] + Math.abs(az) * this.size[2]) / 2;
  }
}

export class Pieces {
  constructor(game) {
    this.game = game;
    this.physics = game.physics;
    this.list = [];
    this.moving = false;
    this.batches = new Map();
    this.max = MAX_PIECES;
  }

  spawn(set, o) {
    const p = new Piece(this, set, o);
    this.list.push(p);
    if (p.batched) this.batchAdd(p);
    else this.parent(p);
    return p;
  }

  batchFor(prep) {
    let b = this.batches.get(prep);
    if (b) return b;
    b = { prep, pieces: [], meshes: [], cap: 0, dirty: true };
    this.batches.set(prep, b);
    this.batchGrow(b, 24);
    return b;
  }

  batchGrow(b, cap) {
    const scene = this.game.stage.scene;
    for (const im of b.meshes) scene.remove(im);
    b.meshes = b.prep.layers.map((l) => {
      const im = new THREE.InstancedMesh(l.geometry, l.material, cap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      im.castShadow = true;
      im.receiveShadow = true;
      im.count = 0;
      for (let i = 0; i < cap; i++) im.setColorAt(i, WHITE);
      if (l.material.transparent) im.renderOrder = 2;
      scene.add(im);
      return im;
    });
    b.cap = cap;
    b.dirty = true;
  }

  batchAdd(p) {
    const b = this.batchFor(p.prep);
    if (b.pieces.length >= b.cap) this.batchGrow(b, b.cap * 2);
    p.batch = b;
    p.slot = b.pieces.length;
    b.pieces.push(p);
    b.dirty = true;
  }

  batchRemove(p) {
    const b = p.batch;
    if (!b) return;
    const last = b.pieces.pop();
    if (last !== p) {
      b.pieces[p.slot] = last;
      last.slot = p.slot;
    }
    p.batch = null;
    p.slot = -1;
    b.dirty = true;
  }

  trayMoved() {
    for (const b of this.batches.values()) b.dirty = true;
  }

  flush() {
    const tm = this.game.tray.matrix;
    for (const b of this.batches.values()) {
      if (!b.dirty) continue;
      b.dirty = false;
      const n = b.pieces.length;
      const c0 = b.prep.wholeMeasure ? b.prep.wholeMeasure.center : [0, 0, 0];
      for (let i = 0; i < n; i++) {
        const p = b.pieces[i];
        if (p.zone === 'tray') _w.multiplyMatrices(tm, p.matrix);
        else _w.copy(p.matrix);
        _w.multiply(_d.makeTranslation(-c0[0], -c0[1], -c0[2]));
        for (const im of b.meshes) im.setMatrixAt(i, _w);
      }
      for (const im of b.meshes) {
        im.count = n;
        im.instanceMatrix.needsUpdate = true;
      }
    }
  }

  detach(p) {
    if (p.dead) return null;
    p.dead = true;
    this.physics.unregister(p.collider);
    this.physics.world.removeRigidBody(p.body);
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
    let g = p.group;
    if (p.batched) {
      this.batchRemove(p);
      g = buildMeshes(p.set, p.center);
      g.matrixAutoUpdate = false;
    } else if (g.parent) g.parent.remove(g);
    return g;
  }

  spawnWhole(prep, o) {
    return this.spawn(wholeSet(prep), o);
  }

  parent(p) {
    if (p.batched) {
      if (p.batch) p.batch.dirty = true;
      return;
    }
    const target = p.zone === 'tray' ? this.game.tray.inner : this.game.stage.scene;
    if (p.group.parent !== target) target.add(p.group);
  }

  remove(p) {
    if (p.dead) return;
    p.dead = true;
    this.physics.unregister(p.collider);
    this.physics.world.removeRigidBody(p.body);
    if (p.batched) this.batchRemove(p);
    else {
      if (p.group.parent) p.group.parent.remove(p.group);
      disposeMeshes(p.group);
    }
    const i = this.list.indexOf(p);
    if (i >= 0) this.list.splice(i, 1);
  }

  pick(ray, filter) {
    const hit = this.physics.cast(ray.origin, ray.direction, 800, (owner) => owner instanceof Piece && (!filter || filter(owner)));
    if (!hit || !(hit.owner instanceof Piece)) return null;
    return { piece: hit.owner, point: new THREE.Vector3(hit.x, hit.y, hit.z), t: hit.t };
  }

  before() {
    for (const p of this.list) {
      const v = p.body.linvel();
      p.prevV.set(v.x, v.y, v.z);
    }
  }

  after() {
    const game = this.game;
    for (const p of this.list) {
      if (p.body.isSleeping() || p.held) continue;
      const v = p.body.linvel();
      const dx = v.x - p.prevV.x;
      const dy = v.y - p.prevV.y;
      const dz = v.z - p.prevV.z;
      const dv = Math.hypot(dx, dy, dz);
      const w = p.body.angvel();
      const v2 = v.x * v.x + v.y * v.y + v.z * v.z;
      const w2 = w.x * w.x + w.y * w.y + w.z * w.z;
      if (v2 < 36 && w2 < 9) {
        if (++p.calm === 20) p.settle(true);
      } else {
        p.calm = 0;
        if (p.calmed && (v2 > 144 || w2 > 36)) p.settle(false);
      }
      if (v2 < 9 && w2 < 0.16) {
        if (++p.still > 16 && !p.liquidActive) p.body.sleep();
      } else p.still = 0;
      if (dv > 34 && p.quiet <= 0) {
        const strength = clamp(dv / 260, 0.05, 1);
        p.quiet = 0.09;
        game.onImpact(p, strength);
        if (p.soft > 0.02) p.kick(_n.set(dx, dy, dz).normalize(), strength * 2.4);
      }
    }
  }

  update(dt) {
    let moving = false;
    const tray = this.game.tray;
    const atTable = this.game.view === 'table';
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.age += dt;
      p.quiet -= dt;
      p.stepSquash(dt);
      if (p.liquids.length) this.stepLiquids(p, dt);
      if (p.sync(false)) moving = true;
      if (p.held) continue;
      const inTray = tray.contains(p.pos.x, p.pos.y, p.pos.z, 0.2);
      if (p.zone === 'tray' && !inTray) {
        if (atTable) {
          p.zone = 'table';
          this.parent(p);
        } else if (p.pos.y < tray.home.y + tray.floorY + tray.depth) {
          this.remove(p);
          continue;
        }
      } else if (p.zone === 'table' && inTray && atTable && p.pos.y < tray.home.y + tray.depth + 1) {
        p.zone = 'tray';
        this.parent(p);
      }
      if (p.pos.y < -40) this.remove(p);
    }
    this.flush();
    this.moving = moving;
    return moving;
  }

  stepLiquids(p, dt) {
    let active = false;
    let worstOpen = 0;
    for (const o of p.opens) {
      const oy = _n.copy(o).applyQuaternion(p.quat).y;
      worstOpen = Math.max(worstOpen, clamp((0.4 - oy) / 0.7, 0, 1));
    }
    _qi.copy(p.quat).invert();
    const upL = _n.copy(UP).applyQuaternion(_qi);
    for (const l of p.liquids) {
      if (l.level <= 0.001) {
        if (l.mesh.visible) l.mesh.visible = false;
        continue;
      }
      const visc = l.fill.viscosity ?? 0.4;
      const flow = (7 * Math.pow(1 - visc, 1.6) + 0.12) * worstOpen * (0.35 + 0.65 * Math.sqrt(l.level));
      if (flow > 0 && l.vol > 0) {
        const out = Math.min(l.vol * l.level, flow * dt);
        l.level = Math.max(0, l.level - out / l.vol);
        l.acc += out;
        active = true;
        const dropV = lerp(0.03, 0.09, visc);
        let guard = 0;
        while (l.acc >= dropV && guard++ < 6) {
          l.acc -= dropV;
          let low = null;
          let ly = Infinity;
          for (const c of l.caps) {
            const y = _a.copy(c).applyQuaternion(p.quat).y;
            if (y < ly) {
              ly = y;
              low = c;
            }
          }
          if (!low) break;
          const w = _p.copy(low).applyQuaternion(p.quat).add(p.pos);
          this.game.fx.drop(w, l.fill, dropV, p);
        }
      }
      let lo = Infinity;
      let hi = -Infinity;
      for (const c of l.pts) {
        const h = c.dot(upL);
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
      const s = clamp(l.level, 0.02, 1);
      const piv = lo;
      const e = _d.identity().elements;
      const kk = s - 1;
      e[0] = 1 + kk * upL.x * upL.x;
      e[4] = kk * upL.x * upL.y;
      e[8] = kk * upL.x * upL.z;
      e[1] = kk * upL.y * upL.x;
      e[5] = 1 + kk * upL.y * upL.y;
      e[9] = kk * upL.y * upL.z;
      e[2] = kk * upL.z * upL.x;
      e[6] = kk * upL.z * upL.y;
      e[10] = 1 + kk * upL.z * upL.z;
      const shift = piv * (1 - s);
      e[12] = upL.x * shift;
      e[13] = upL.y * shift;
      e[14] = upL.z * shift;
      l.mesh.matrix.makeTranslation(l.base.x, l.base.y, l.base.z).premultiply(_d);
      l.mesh.matrixWorldNeedsUpdate = true;
    }
    p.liquidActive = active;
    if (active) p.body.wakeUp();
  }

  localPlane(p, nWorld, pointWorld) {
    _qi.copy(p.quat).invert();
    const n = nWorld.clone().applyQuaternion(_qi).normalize();
    const x = p.worldToLocal(pointWorld, new THREE.Vector3());
    return { n, d: n.dot(x) };
  }

  breakInto(p, sets, kick) {
    if (!sets || sets.length < 2) return null;
    const out = [];
    const v = p.body.linvel();
    const levels = {};
    for (const l of p.liquids) levels[l.li] = l.level;
    const zone = p.zone;
    const pos = p.pos.clone();
    const quat = p.quat.clone();
    const c0 = new THREE.Vector3().fromArray(p.center);
    const room = this.max - this.list.length;
    sets.sort((a, b) => measureSet(b).volume - measureSet(a).volume);
    let made = 0;
    for (const s of sets) {
      const m = measureSet(s);
      const tiny = m.volume < 0.012 || Math.max(...m.size) < 0.22;
      const c = new THREE.Vector3().fromArray(m.center).sub(c0).applyQuaternion(quat).add(pos);
      if (tiny || made >= Math.max(2, room)) {
        this.game.fx.crumbs(c, p.prep, 2, 0.4);
        continue;
      }
      const vel = new THREE.Vector3(v.x, v.y, v.z);
      const spin = new THREE.Vector3();
      if (kick) vel.add(kick(c, m, spin));
      const np = this.spawn(s, { pos: c, quat, vel, zone, levels, spin: { x: spin.x, y: spin.y, z: spin.z } });
      np.s = p.s;
      np.sAxis.copy(p.sAxis);
      np.sv = -0.6 * p.soft;
      out.push(np);
      made++;
    }
    this.remove(p);
    return out;
  }

  splitSides(set, n, d) {
    const sides = splitSet(set, n, d);
    if (!sides) return null;
    const out = [];
    sides.forEach((side, si) => {
      const normal = n.clone().multiplyScalar(si === 0 ? -1 : 1);
      for (const part of setParts(side)) {
        part.opens = [...(set.opens || []), normal];
        out.push(part);
      }
    });
    return out.length >= 2 ? out : null;
  }

  cut(p, nWorld, pointWorld, push = 14) {
    const pl = this.localPlane(p, nWorld, pointWorld);
    const sets = this.splitSides(p.set, pl.n, pl.d);
    if (!sets) return null;
    const nw = nWorld.clone().normalize();
    const tip = new THREE.Vector3().crossVectors(UP, nw);
    const topple = 2.4 + 3.2 * p.soft;
    return this.breakInto(p, sets, (c, m, spin) => {
      const side = Math.sign(c.clone().sub(pointWorld).dot(nw)) || 1;
      if (push > 0) spin.copy(tip).multiplyScalar(side * topple);
      return nw.clone().multiplyScalar(side * push);
    });
  }

  snap(p, pointWorld, fallbackNormalWorld) {
    const grooves = p.prep.breaks.grooves || [];
    const x = p.worldToLocal(pointWorld, new THREE.Vector3());
    const ranked = grooves
      .map((g) => {
        const n = new THREE.Vector3(...g.n).normalize();
        return { n, d: g.d / Math.hypot(...g.n), dist: Math.abs(n.dot(x) - g.d / Math.hypot(...g.n)) };
      })
      .sort((a, b) => a.dist - b.dist);
    for (const g of ranked) {
      if (g.dist > 2.2) break;
      const sets = this.splitSides(p.set, g.n, g.d);
      if (sets) {
        const nw = g.n.clone().applyQuaternion(p.quat);
        const pw = pointWorld.clone();
        return this.breakInto(p, sets, (c) => nw.clone().multiplyScalar((Math.sign(c.clone().sub(pw).dot(nw)) || 1) * 10).add(new THREE.Vector3(0, 22, 0)));
      }
    }
    if (!fallbackNormalWorld) return null;
    return this.cut(p, fallbackNormalWorld, pointWorld, 10);
  }

  shatter(p, pointWorld, count, force = 1) {
    const x = p.worldToLocal(pointWorld, new THREE.Vector3());
    let sets = [p.set];
    const c0 = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      let big = sets[0];
      let bv = -1;
      for (const s of sets) {
        const m = measureSet(s);
        if (m.volume > bv) {
          bv = m.volume;
          big = s;
        }
      }
      const m = measureSet(big);
      c0.fromArray(m.center).lerp(x, 0.45);
      c0.x += rand(-0.25, 0.25) * m.size[0];
      c0.y += rand(-0.25, 0.25) * m.size[1];
      c0.z += rand(-0.25, 0.25) * m.size[2];
      const n = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1));
      const thin = Math.min(...m.size) / Math.max(...m.size) < 0.3;
      if (thin) n.setComponent(m.size.indexOf(Math.min(...m.size)), n.getComponent(m.size.indexOf(Math.min(...m.size))) * 0.15);
      n.normalize();
      const parts = this.splitSides(big, n, n.dot(c0));
      if (!parts) continue;
      sets = sets.filter((s) => s !== big).concat(parts);
    }
    if (sets.length < 2) return null;
    const pw = pointWorld.clone();
    return this.breakInto(p, sets, (c) => {
      const dir = c.clone().sub(pw);
      dir.y = Math.abs(dir.y) * 0.6 + 0.4;
      return dir.normalize().multiplyScalar(rand(18, 46) * force);
    });
  }

  clear(zone) {
    for (let i = this.list.length - 1; i >= 0; i--) if (!zone || this.list[i].zone === zone) this.remove(this.list[i]);
  }
}
