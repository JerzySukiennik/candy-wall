// Candy Wall: the iridescent metal scoop: model, digging into a bin, carrying a physically settled heap (simulated in slices) and pouring it out as real pieces.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GROUP, RAPIER } from './physics.js';
import { S, meshSDF } from './lib/geo.js';
import { prepare } from './candy.js';
import { wholeShape } from './shape.js';
import { BIN, IS_TOUCH, WALL } from './config.js';
import { clamp, damp, lerp, rand, rayY, smooth } from './util.js';

const _m = new THREE.Matrix4();
const _l = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _v = new THREE.Vector3();
const WHITE = new THREE.Color(1, 1, 1);
const YAW = Math.PI + 0.3;
const CARRY_PITCH = -0.15;
const KEYS = [
  { t: 0.42, dx: 0.3, dy: 1.2, dz: 5.2, pitch: 0.78 },
  { t: 0.66, dx: 0, dy: -2.3, dz: 1.2, pitch: 0.42 },
  { t: 1, dx: 0.4, dy: 5.2, dz: 3.2, pitch: CARRY_PITCH },
];

const OUTER = S.scale(S.capsule([0, 0, -4.2], [0, 0, 6], 3.3), 1, 0.92, 1);
const INNER = S.scale(S.capsule([0, 0.25, -3.9], [0, 0.25, 14], 3.0), 1, 0.92, 1);
const smax = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};
const bowlSDF = (x, y, z) => smax(smax(Math.max(OUTER(x, y, z), -INNER(x, y, z)), y - 0.15, 0.12), z - (5.0 - y * 0.14 - x * x * 0.13), 0.3);

function buildGeometry() {
  const bowl = meshSDF(bowlSDF, { min: [-3.6, -3.4, -7.9], max: [3.6, 0.5, 5.9], res: 88 });
  const a = new THREE.Vector3(0, -0.9, -7.0);
  const b = new THREE.Vector3(0, 0.7, -16.4);
  const dir = b.clone().sub(a);
  const len = dir.length();
  const handle = new THREE.CylinderGeometry(0.52, 0.46, len, 20);
  handle.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()));
  handle.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  const collar = new THREE.SphereGeometry(0.7, 18, 12);
  collar.scale(1, 1, 1.5);
  collar.translate(a.x, a.y + 0.05, a.z + 0.2);
  const cap = new THREE.SphereGeometry(0.5, 16, 10);
  cap.translate(b.x, b.y, b.z);
  const ring = new THREE.TorusGeometry(0.62, 0.11, 10, 28);
  ring.rotateY(Math.PI / 2);
  ring.translate(b.x, b.y + 0.2, b.z - 0.95);
  for (const g of [handle, collar, cap, ring]) g.deleteAttribute('uv');
  return mergeGeometries([bowl, handle, collar, cap, ring]);
}

function bowlCollider() {
  const R = 3.0;
  const SY = 0.92;
  const CY = 0.25;
  const Z0 = -3.9;
  const A = 10;
  const NP = 4;
  const NZ = 4;
  const verts = [0, SY * CY, Z0 - R];
  const index = [];
  const rings = [];
  const ring = (f) => {
    const start = verts.length / 3;
    for (let i = 0; i <= A; i++) {
      const phi = Math.PI + (i / A) * Math.PI;
      verts.push(...f(Math.cos(phi), Math.sin(phi)));
    }
    rings.push(start);
  };
  for (let j = NP - 1; j >= 0; j--) {
    const psi = ((j / NP) * Math.PI) / 2;
    ring((c, s) => [R * c * Math.cos(psi), SY * (CY + R * s * Math.cos(psi)), Z0 - R * Math.sin(psi)]);
  }
  for (let j = 1; j <= NZ; j++)
    ring((c, s) => {
      const x = R * c;
      const y = SY * (CY + R * s);
      return [x, y, Z0 + ((5.0 - y * 0.14 - x * x * 0.13 - Z0) * j) / NZ];
    });
  for (let i = 0; i < A; i++) index.push(0, rings[0] + i, rings[0] + i + 1);
  for (let r = 0; r + 1 < rings.length; r++)
    for (let i = 0; i < A; i++) {
      const a = rings[r] + i;
      const b = rings[r + 1] + i;
      index.push(a, b, b + 1, a, b + 1, a + 1);
    }
  return { verts: new Float32Array(verts), index: new Uint32Array(index) };
}

function rainbowMetal() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, envMapIntensity: 1.6 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;').replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      float iN = dot(normalize(vNormal), normalize(vViewPosition));
      float iT = iN * 1.15 + vLocal.z * 0.052 + vLocal.x * 0.085 + vLocal.y * 0.12;
      vec3 iC = 0.5 + 0.5 * cos(6.28318 * (iT + vec3(0.0, 0.33, 0.67)));
      diffuseColor.rgb = mix(vec3(0.8), iC * iC * 1.25, 0.88);`
    );
  };
  m.customProgramCacheKey = () => 'rainbow-metal';
  return m;
}

export class Scoop {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    this.mesh = new THREE.Mesh(buildGeometry(), rainbowMetal());
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.group.add(this.mesh);
    this.group.visible = false;
    game.stage.scene.add(this.group);
    this.bowl = bowlCollider();
    this.cache = new Map();
    this.job = null;
    this.recent = [];
    this.bin = null;
    this.state = 'off';
    this.pos = new THREE.Vector3(0, 40, 0);
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.pitch = CARRY_PITCH;
    this.pitchT = CARRY_PITCH;
    this.roll = 0;
    this.t = 0;
    this.px = -1;
    this.py = -1;
    this.hover = false;
    this.heap = null;
    this.loadedAt = 0;
    this.digFrom = { pos: new THREE.Vector3(), pitch: 0 };
    this.digPoint = new THREE.Vector3();
    this.pourAt = new THREE.Vector3();
  }

  get loaded() {
    return !!(this.heap && this.heap.items.length);
  }

  setBin(bin) {
    if (this.bin && this.bin !== bin && this.loaded) this.dump(true);
    this.bin = bin || null;
    if (!bin) {
      if (this.loaded) this.dump(true);
      this.state = 'off';
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    if (this.state === 'off') {
      this.state = 'idle';
      this.pos.copy(this.restPoint(_p));
      this.pos.y += 14;
      this.pitch = CARRY_PITCH;
    }
  }

  restPoint(out) {
    const tr = this.game.tray;
    return out.set(tr.group.position.x + tr.radius + 6, tr.group.position.y + 2.2, tr.group.position.z + 4);
  }

  count(def) {
    const prep = prepare(def, 0);
    const box = prep.size.x * prep.size.y * prep.size.z;
    return clamp(Math.round(Math.min(64 / Math.max(0.3, prep.volume), 150 / Math.max(0.5, box))), 1, 56);
  }

  step(def, ms = 4) {
    if (this.cache.has(def.id)) return true;
    let j = this.job;
    if (!j || j.def !== def) {
      if (j && j.world) j.world.free();
      j = this.job = { def, v: 0, world: null, bodies: [], steps: 0, long: false };
    }
    const nv = def.variants || 1;
    if (j.v < nv * 2) {
      const prep = prepare(def, j.v >> 1);
      if (j.v & 1) wholeShape(prep, RAPIER);
      j.v++;
      return false;
    }
    if (!j.world) {
      const n = this.count(def);
      const world = (j.world = new RAPIER.World({ x: 0, y: -981, z: -150 }));
      world.timestep = 1 / 120;
      world.createCollider(RAPIER.ColliderDesc.trimesh(this.bowl.verts, this.bowl.index).setFriction(0.55).setRestitution(0.02));
      const sh0 = wholeShape(prepare(def, 0), RAPIER);
      const long = (j.long = sh0.longest > 6.5);
      const stepY = Math.max(0.5, sh0.thin * 0.8);
      for (let i = 0; i < n; i++) {
        const prep = prepare(def, i % nv);
        const sh = wholeShape(prep, RAPIER);
        const q = new THREE.Quaternion();
        if (long) q.setFromEuler(new THREE.Euler(0, prep.size.x >= prep.size.z ? Math.PI / 2 : 0, 0)).premultiply(_q.setFromAxisAngle(_v.set(0, 0, 1), rand(-0.3, 0.3)));
        else q.setFromEuler(new THREE.Euler(rand(6.28), rand(6.28), rand(6.28)));
        const spread = Math.max(0, 2.3 - sh.longest * 0.35);
        const bd = RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(rand(-spread, spread), 1.2 + i * stepY, long ? rand(0.5, 2) : rand(-3.2, 2.2))
          .setRotation(q)
          .setLinearDamping(1.5)
          .setAngularDamping(3);
        const body = world.createRigidBody(bd);
        world.createCollider(sh.make().setMass(Math.max(0.2, prep.mass)).setFriction(0.7).setRestitution(0.02).setCollisionGroups(GROUP.piece), body);
        j.bodies.push({ body, v: i % nv });
      }
      j.wait = 60 + Math.round(Math.sqrt((2 * (1.2 + n * stepY)) / 981) * 150);
      return false;
    }
    const t0 = performance.now();
    let done = false;
    do {
      for (let k = 0; k < 3; k++) j.world.step();
      j.steps += 3;
      done = j.steps >= 420 || (j.steps >= j.wait && this.settled(j));
    } while (!done && performance.now() - t0 < ms);
    if (!done) return false;
    const items = [];
    for (const b of j.bodies) {
      const t = b.body.translation();
      const r = b.body.rotation();
      if (t.y < -3.6 || t.y > 7 || Math.abs(t.x) > 3.8 || t.z < -7.6 || t.z > (j.long ? 9 : 6)) continue;
      items.push({ v: b.v, pos: new THREE.Vector3(t.x, t.y, t.z), quat: new THREE.Quaternion(r.x, r.y, r.z, r.w) });
    }
    j.world.free();
    this.job = null;
    if (!items.length) items.push({ v: 0, pos: new THREE.Vector3(0, -1.2, 0), quat: new THREE.Quaternion() });
    this.cache.set(def.id, items);
    if (this.game.onWarm) this.game.onWarm(def);
    return true;
  }

  settled(j) {
    for (const b of j.bodies) {
      const t = b.body.translation();
      if (t.y < -8) continue;
      const v = b.body.linvel();
      const w = b.body.angvel();
      if (v.x * v.x + v.y * v.y + v.z * v.z > 9 || w.x * w.x + w.y * w.y + w.z * w.z > 1.2) return false;
    }
    return true;
  }

  arrange(def) {
    while (!this.step(def, 1e9)) {}
    return this.cache.get(def.id);
  }

  load(def, variants) {
    this.clearHeap();
    const base = this.arrange(def);
    const nv = def.variants || 1;
    const items = base.slice(0, Math.max(1, variants.length)).map((it, i) => ({ v: (variants[i] ?? it.v) % nv, pos: it.pos, quat: it.quat, slot: -1 }));
    const sets = new Map();
    for (const it of items) {
      let set = sets.get(it.v);
      if (!set) {
        const prep = prepare(def, it.v);
        const c = wholeShape(prep, RAPIER).center;
        set = { prep, list: [], meshes: [], center: new THREE.Matrix4().makeTranslation(-c[0], -c[1], -c[2]) };
        sets.set(it.v, set);
      }
      it.slot = set.list.length;
      set.list.push(it);
    }
    for (const set of sets.values()) {
      set.meshes = set.prep.layers.map((l) => {
        const im = new THREE.InstancedMesh(l.geometry, l.material, set.list.length);
        im.frustumCulled = false;
        im.castShadow = true;
        im.receiveShadow = true;
        if (l.material.transparent) im.renderOrder = 2;
        for (let i = 0; i < set.list.length; i++) im.setColorAt(i, WHITE);
        this.group.add(im);
        return im;
      });
      set.list.forEach((it, i) => this.place(set, i, it));
      for (const im of set.meshes) im.instanceMatrix.needsUpdate = true;
    }
    this.heap = { def, items, sets };
  }

  place(set, i, it) {
    _l.compose(it.pos, it.quat, _s.set(1, 1, 1)).multiply(set.center);
    for (const im of set.meshes) im.setMatrixAt(i, _l);
  }

  takeItem(it) {
    const set = this.heap.sets.get(it.v);
    const last = set.list.pop();
    if (last !== it) {
      set.list[it.slot] = last;
      last.slot = it.slot;
      this.place(set, it.slot, last);
    }
    for (const im of set.meshes) {
      im.count = set.list.length;
      im.instanceMatrix.needsUpdate = true;
    }
    const i = this.heap.items.indexOf(it);
    if (i >= 0) this.heap.items.splice(i, 1);
  }

  clearHeap() {
    if (!this.heap) return;
    for (const set of this.heap.sets.values()) for (const im of set.meshes) this.group.remove(im);
    this.heap = null;
  }

  dump(silent) {
    if (this.bin && this.loaded) this.game.wall.refill(this.bin);
    this.clearHeap();
    if (!silent) this.game.audio.play('pour_candy', { vol: 0.4 });
  }

  pointer(x, y) {
    this.px = x;
    this.py = y;
    this.hover = true;
  }

  overBin(x, z) {
    const b = this.bin;
    return b && Math.abs(x - b.x) < BIN.w / 2 + 1 && z < WALL.z + BIN.z0 + BIN.noseZ + 1.5;
  }

  carryY(z) {
    const b = this.bin;
    const tr = this.game.tray;
    const zb = WALL.z + BIN.z0 + BIN.noseZ + 1;
    return lerp(b.mouth.y + 5.2, tr.group.position.y + tr.depth + 8.2, smooth(zb - 2, zb + 7, z));
  }

  pointerTarget(out) {
    const b = this.bin;
    const tr = this.game.tray;
    const ray = this.game.stage.ray(this.px, this.py);
    const zb = WALL.z + BIN.z0 + BIN.noseZ + 1;
    const rim = tr.group.position.y + tr.depth;
    let aim = rim;
    for (let i = 0; i < 3; i++) {
      if (!rayY(ray, aim, out)) return null;
      out.x = clamp(out.x, b.x - 30, b.x + 30);
      out.z = clamp(out.z, WALL.z + 8, WALL.z + 66);
      aim = lerp(b.mouth.y, rim, smooth(zb - 2, zb + 7, out.z));
    }
    const over = this.overBin(out.x, out.z);
    out.y = this.carryY(out.z);
    if (!over) {
      out.z += 2.6;
      out.x += 0.8;
    }
    return out;
  }

  down(x, y) {
    this.pointer(x, y);
    if (!this.bin || this.state === 'dig' || this.state === 'pour') return false;
    if (this.state === 'carry') return true;
    const b = this.bin;
    if (!b.ready) return false;
    const ray = this.game.stage.ray(x, y);
    const hit = rayY(ray, b.mouth.y, _p);
    const picked = this.game.wall.pick(ray);
    if (picked !== b && !(hit && this.overBin(hit.x, hit.z))) return false;
    const dx = hit ? clamp(hit.x, b.x - BIN.w / 2 + 3.6, b.x + BIN.w / 2 - 3.6) : b.x;
    this.digPoint.set(dx, b.mouth.y, b.mouth.z);
    this.digFrom.pos.copy(this.pos);
    this.digFrom.pitch = this.pitch;
    this.state = 'dig';
    this.t = 0;
    this.dug = false;
    this.game.onScoop('dig', this);
    this.game.audio.play('knife_pick', { vol: 0.35, rate: 1.2 });
    return true;
  }

  up() {
    if (this.state !== 'carry' || !this.loaded) return;
    if (performance.now() - this.loadedAt < 160) return;
    if (this.overBin(this.pos.x, this.pos.z)) {
      this.dump(false);
      return;
    }
    this.state = 'pour';
    this.t = 0;
    this.pourAt.copy(this.pointerTarget(this.target) || this.pos);
    this.game.onScoop('pour', this);
    const order = this.heap.items.slice().sort((a, b) => b.pos.z + b.pos.y * 0.4 - (a.pos.z + a.pos.y * 0.4));
    order.forEach((it, i) => (it.at = 0.1 + (i / Math.max(1, order.length - 1)) * 0.5 + rand(0, 0.03)));
    this.pitchT = 1.05;
  }

  digStep(dt) {
    const g = this.game;
    this.t += dt / 0.78;
    const k = Math.min(1, this.t);
    let a = { t: 0, pos: this.digFrom.pos, pitch: this.digFrom.pitch };
    let chosen = null;
    for (const key of KEYS) {
      const kp = new THREE.Vector3(this.digPoint.x + key.dx, this.digPoint.y + key.dy, this.digPoint.z + key.dz);
      if (k <= key.t) {
        chosen = { a, b: { t: key.t, pos: kp, pitch: key.pitch } };
        break;
      }
      a = { t: key.t, pos: kp, pitch: key.pitch };
    }
    if (!chosen) chosen = { a, b: a };
    const span = Math.max(1e-4, chosen.b.t - chosen.a.t);
    const u = clamp((k - chosen.a.t) / span, 0, 1);
    const e = u * u * (3 - 2 * u);
    this.pos.lerpVectors(chosen.a.pos, chosen.b.pos, e);
    this.pitch = lerp(chosen.a.pitch, chosen.b.pitch, e);
    this.pitchT = this.pitch;
    if (!this.dug && k >= 0.6) {
      this.dug = true;
      const b = this.bin;
      const n = Math.min(this.count(b.def), this.arrange(b.def).length);
      const variants = g.wall.scoopOut(b, this.digPoint.x, this.digPoint.z, n);
      this.load(b.def, variants.length ? variants : [0]);
      this.loadedAt = performance.now();
      const land = (b.def.sound && b.def.sound.land) || 'soft';
      const pitch = (b.def.sound && b.def.sound.pitch) || 1;
      g.audio.play('pour_candy', { vol: land === 'soft' || land === 'foam' || land === 'rubber' ? 0.25 : 0.6, rate: rand(0.9, 1.1) });
      for (let i = 0; i < Math.min(7, n); i++) g.audio.play('land_' + land, { vol: rand(0.25, 0.5), rate: pitch * rand(0.9, 1.25), delay: i * 0.035 + rand(0, 0.02), gap: 0 });
      g.stage.shake(0.02);
      g.ui.caption(b.def.name);
    }
    if (k >= 1) {
      this.state = 'carry';
      this.game.onScoop('carry', this);
    }
  }

  pourStep(dt) {
    const g = this.game;
    this.t += dt;
    if (this.heap) {
      this.group.updateMatrixWorld(true);
      const fwd = _v.set(0, 0, 1).applyQuaternion(this.group.quaternion);
      for (const it of this.heap.items.slice()) {
        if (this.t < it.at) continue;
        const set = this.heap.sets.get(it.v);
        _p.set(clamp(it.pos.x, -1.5, 1.5) * 0.8, -1.3 + rand(0, 0.9), 4.4 + rand(-0.5, 0.3));
        _m.compose(_p, it.quat, _s.set(1, 1, 1)).premultiply(this.group.matrixWorld).premultiply(g.tray.inverse);
        const pos = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        _m.decompose(pos, quat, _s);
        const reach = wholeShape(set.prep, RAPIER).mean * 0.6;
        let free = true;
        for (const q of this.recent) if (!q.dead && q.pos.distanceToSquared(pos) < (reach + q.reach) ** 2) free = false;
        if (!free && this.t < it.at + 1.6) continue;
        const vel = new THREE.Vector3(fwd.x * 7 + this.vel.x * 0.2 + rand(-1, 1), -22, fwd.z * 7 + this.vel.z * 0.2 + rand(-1, 1));
        if (g.pieces.list.length < g.pieces.max - 2) {
          const piece = g.pieces.spawnWhole(set.prep, { pos, quat, vel, spin: { x: rand(-5, 5), y: rand(-5, 5), z: rand(-5, 5) }, zone: 'tray' });
          piece.reach = reach;
          this.recent.push(piece);
          if (this.recent.length > 10) this.recent.shift();
        }
        this.takeItem(it);
      }
      if (!this.heap.items.length) this.clearHeap();
    }
    if (this.t > 0.72 && !this.heap) this.pitchT = CARRY_PITCH;
    if (this.t > 1.0 && !this.heap) {
      this.state = 'idle';
      this.recent.length = 0;
      g.ui.caption('');
      g.onScoop('idle', this);
    }
  }

  update(dt) {
    if (this.state === 'off' || !this.bin) return false;
    this.prev.copy(this.pos);
    let moving = false;
    if (!this.cache.has(this.bin.def.id)) {
      if (!this.game.wall.busy) this.step(this.bin.def, 4);
      moving = true;
    }
    if (this.state === 'dig') {
      this.digStep(dt);
      moving = true;
    } else {
      if (this.state === 'pour') {
        this.pourStep(dt);
        moving = true;
      }
      let tgt = null;
      const follow = this.state === 'carry' || (!IS_TOUCH && this.hover);
      if (this.state === 'pour') tgt = this.target.copy(this.pourAt);
      else if (follow && this.px >= 0) tgt = this.pointerTarget(this.target);
      if (!tgt) tgt = this.restPoint(this.target);
      if (this.pos.distanceToSquared(tgt) > 1e-4) {
        const rate = this.state === 'carry' || this.state === 'pour' ? 18 : 10;
        this.pos.x = damp(this.pos.x, tgt.x, rate, dt);
        this.pos.y = damp(this.pos.y, tgt.y, rate, dt);
        this.pos.z = damp(this.pos.z, tgt.z, rate, dt);
        moving = true;
      }
      if (this.state !== 'pour') this.pitchT = this.state === 'idle' && !this.hover ? 0.05 : CARRY_PITCH;
      if (Math.abs(this.pitch - this.pitchT) > 1e-3) {
        this.pitch = damp(this.pitch, this.pitchT, this.state === 'pour' ? 13 : 9, dt);
        moving = true;
      }
    }
    if (dt > 0) this.vel.copy(this.pos).sub(this.prev).multiplyScalar(1 / dt);
    const rollT = clamp(-this.vel.x * 0.004, -0.25, 0.25);
    this.roll = damp(this.roll, rollT, 8, dt);
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.pitch, YAW, this.roll);
    return moving || Math.abs(this.roll) > 0.004;
  }
}
