// Candy Wall: chopsticks (press, grab, carry, feed) and knife (saw, snap, shatter) with their models and gestures.
import * as THREE from 'three';
import { IS_TOUCH } from './config.js';
import { clamp, damp, lerp, rand, rayY, smooth } from './util.js';

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _pt = new THREE.Vector3();
const _d = new THREE.Vector3();

function stickMesh() {
  const g = new THREE.CylinderGeometry(0.24, 0.1, 24, 8);
  g.translate(0, 12, 0);
  const m = new THREE.MeshPhysicalMaterial({ color: 0xcaa271, roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const mesh = new THREE.Mesh(g, m);
  mesh.castShadow = true;
  return mesh;
}

function knifeMesh() {
  const group = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-7.5, 0.02);
  s.quadraticCurveTo(-5.4, 1.5, -2.2, 2.25);
  s.lineTo(6.4, 2.5);
  s.lineTo(6.4, 0);
  s.lineTo(-7.5, 0.02);
  const bg = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 10 });
  bg.translate(0, 0, -0.07);
  const blade = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ color: 0xe9edf2, roughness: 0.2, metalness: 1 }));
  blade.castShadow = true;
  const hg = new THREE.BoxGeometry(10.5, 2.0, 1.25, 1, 1, 1);
  hg.translate(11.6, 1.45, 0);
  const handle = new THREE.Mesh(hg, new THREE.MeshPhysicalMaterial({ color: 0x0c0c0e, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3 }));
  handle.castShadow = true;
  const bol = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.3, 1.35), new THREE.MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.25, metalness: 1 }));
  bol.position.set(6.5, 1.3, 0);
  group.add(blade, handle, bol);
  return group;
}

export class Tools {
  constructor(game) {
    this.game = game;
    this.tool = 'sticks';
    this.sticks = [stickMesh(), stickMesh()];
    this.knife = knifeMesh();
    this.root = new THREE.Group();
    this.root.add(this.sticks[0], this.sticks[1], this.knife);
    game.stage.scene.add(this.root);
    this.restSticks = new THREE.Vector3();
    this.restKnife = new THREE.Vector3();
    this.tip = new THREE.Vector3(30, 3, 10);
    this.tipT = new THREE.Vector3(30, 3, 10);
    this.gap = 1.6;
    this.gapT = 1.6;
    this.pinch = new THREE.Vector3(1, 0, 0);
    this.kPos = new THREE.Vector3(30, 0.4, 16);
    this.kPosT = new THREE.Vector3(30, 0.4, 16);
    this.kDir = new THREE.Vector3(-0.42, 0, -0.9).normalize();
    this.kDirT = this.kDir.clone();
    this.kRoll = 0;
    this.state = 'idle';
    this.piece = null;
    this.pressT = 0;
    this.down = { x: 0, y: 0 };
    this.hover = { x: -1, y: -1, on: false };
    this.hold = new THREE.Vector3();
    this.holdY = 5;
    this.cut = null;
    this.active = false;
    this.pressBroke = false;
  }

  setRest(sticks, knife) {
    this.restSticks.copy(sticks);
    this.restKnife.copy(knife);
    if (this.state === 'idle') {
      this.tip.copy(sticks);
      this.kPos.copy(knife);
    }
  }

  setTool(t) {
    if (this.tool === t) return;
    this.cancel();
    this.tool = t;
    this.game.audio.play(t === 'knife' ? 'knife_pick' : 'chopsticks', { vol: 0.6 });
    this.game.ui.setTool(t);
    this.game.wake();
  }

  cancel() {
    if (this.state === 'hold' && this.piece) this.release(false);
    if (this.piece && !this.piece.dead) {
      this.piece.relax();
      this.piece.setPinned(false);
    }
    if (this.cut && this.cut.piece && !this.cut.piece.dead) {
      this.cut.piece.relax();
      this.cut.piece.setPinned(false);
    }
    this.cut = null;
    this.piece = null;
    this.state = 'idle';
    this.active = false;
  }

  tablePoint(x, y, h, out) {
    return rayY(this.game.stage.ray(x, y), h, out);
  }

  pointerDown(x, y) {
    const g = this.game;
    this.down.x = x;
    this.down.y = y;
    this.active = true;
    this.hover.x = x;
    this.hover.y = y;
    const ray = g.stage.ray(x, y);
    const hit = g.pieces.pick(ray);
    if (this.tool === 'knife') return this.knifeDown(x, y, hit);
    if (!hit) {
      this.state = 'air';
      g.audio.play('chopsticks', { vol: 0.35, rate: 1.1 });
      this.gapT = 0.25;
      return;
    }
    this.piece = hit.piece;
    this.state = 'press';
    this.pressT = 0;
    this.burstAt = 0;
    this.pressBroke = false;
    this.pressPoint = hit.point.clone();
    const p = hit.piece;
    p.body.wakeUp();
    p.press(UP, 0.3);
    g.sound(p, 'squish', 0.5);
    g.ui.caption(p.prep.name);
  }

  pointerMove(x, y) {
    this.hover.x = x;
    this.hover.y = y;
    this.hover.on = true;
    if (!this.active) return;
    const g = this.game;
    if (this.tool === 'knife') return this.knifeMove(x, y);
    if (this.state === 'press' && Math.hypot(x - this.down.x, y - this.down.y) > (IS_TOUCH ? 10 : 6)) this.grab();
  }

  pointerUp() {
    if (!this.active) return;
    this.active = false;
    const g = this.game;
    if (this.tool === 'knife') return this.knifeUp();
    if (this.state === 'press' && this.piece && !this.piece.dead) {
      this.piece.relax();
      this.piece.sv -= 1.2 * this.piece.soft;
    } else if (this.state === 'hold') this.release(true);
    this.state = 'idle';
    this.piece = null;
    this.gapT = 1.6;
    g.ui.caption('');
  }

  grab() {
    const p = this.piece;
    const g = this.game;
    if (!p || p.dead) return;
    this.state = 'hold';
    p.held = true;
    p.relax();
    p.calm = 0;
    p.calmed = false;
    p.body.setGravityScale(0, true);
    p.body.setLinearDamping(2);
    p.body.setAngularDamping(6);
    p.body.enableCcd(true);
    const right = _a.set(1, 0, 0).applyQuaternion(g.stage.camera.quaternion);
    right.y = 0;
    this.pinch.copy(right.normalize());
    p.press(this.pinch, 0.55, false);
    this.hold.copy(p.pos);
    this.holdY = p.pos.y;
    if (p.zone === 'tray') {
      p.zone = 'table';
      g.pieces.parent(p);
    }
    g.sound(p, 'grab', 0.6);
    g.head.wake(2);
  }

  release(tryEat) {
    const p = this.piece;
    const g = this.game;
    if (!p || p.dead) return;
    p.held = false;
    p.relax();
    p.body.setGravityScale(1, true);
    p.body.enableCcd(false);
    p.body.setLinearDamping(0.25 + p.prep.feel.sticky * 0.6);
    p.body.setAngularDamping(0.7 + p.soft * 1.4 + p.prep.feel.sticky);
    if (tryEat && g.canEat(p)) g.eat(p);
    else {
      const v = p.body.linvel();
      const sp = Math.hypot(v.x, v.y, v.z);
      if (sp > 120) p.body.setLinvel({ x: (v.x / sp) * 120, y: (v.y / sp) * 120, z: (v.z / sp) * 120 }, true);
    }
  }

  carryHeight(x, z, p) {
    const g = this.game;
    let base = g.surfaceAt(x, z);
    if (g.tray.contains(x, 0, z, 1.5)) base = Math.max(base, g.tray.home.y + g.tray.depth + 0.6);
    let y = base + Math.max(1.6, p.radius * 0.9 + 1.2);
    if (g.head.present) {
      const m = g.head.mouth(_c);
      const k = smooth(m.z + 30, m.z + 9, z) * smooth(22, 9, Math.abs(x - m.x));
      y = lerp(y, m.y - 0.4, k);
    }
    return y;
  }

  beforeStep(dt) {
    if (this.state !== 'hold' || !this.piece || this.piece.dead) return;
    const p = this.piece;
    const t = p.body.translation();
    let vx = (this.hold.x - t.x) * 24;
    let vy = (this.hold.y - t.y) * 24;
    let vz = (this.hold.z - t.z) * 24;
    const sp = Math.hypot(vx, vy, vz);
    if (sp > 520) {
      vx *= 520 / sp;
      vy *= 520 / sp;
      vz *= 520 / sp;
    }
    p.body.setLinvel({ x: vx, y: vy, z: vz }, true);
  }

  update(dt) {
    const g = this.game;
    let moving = false;
    const atTable = g.view === 'table';
    const cam = g.stage.camera;
    const right = _a.set(1, 0, 0).applyQuaternion(cam.quaternion);
    const back = _b.set(0, 0, 1).applyQuaternion(cam.quaternion);
    const camUp = _d.set(0, 1, 0).applyQuaternion(cam.quaternion);
    const hand = _c.copy(right).multiplyScalar(0.42).addScaledVector(camUp, -0.4).addScaledVector(back, 0.86).normalize();

    if (this.tool === 'sticks') {
      if (this.state === 'press' && this.piece && !this.piece.dead) {
        const p = this.piece;
        this.pressT += dt;
        const k = clamp(this.pressT / 0.55, 0, 1);
        p.press(UP, 0.3 + 0.7 * k);
        this.tipT.set(p.pos.x, p.topY() - (1 - p.s) * p.size[1] * 0.5 + 0.05, p.pos.z);
        this.gapT = 0.3;
        if (!this.pressBroke && this.pressT > 0.42) this.pressBreak(p);
        if (this.burstAt && this.pressT > this.burstAt && this.piece === p) {
          this.burstAt = 0;
          const n = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
          p.relax();
          const out = g.pieces.cut(p, n, p.pos.clone(), 16);
          if (out) {
            g.sound(p, 'burst', 1);
            g.onBroken(p, out, { n, point: p.pos.clone(), first: true, burst: true });
            this.piece = null;
            this.state = 'air';
          }
        }
        moving = true;
      } else if (this.state === 'hold' && this.piece && !this.piece.dead) {
        const p = this.piece;
        const yOff = IS_TOUCH ? -46 : 0;
        const pt = this.tablePoint(this.hover.x, this.hover.y + yOff, this.holdY, _pt);
        if (pt) {
          const lim = g.bounds;
          pt.x = clamp(pt.x, lim.x0, lim.x1);
          pt.z = clamp(pt.z, lim.z0, lim.z1);
          const ty = this.carryHeight(pt.x, pt.z, p);
          this.holdY = damp(this.holdY, ty, 12, dt);
          this.hold.set(pt.x, this.holdY, pt.z);
        }
        const half = (Math.abs(this.pinch.x) * p.size[0] + Math.abs(this.pinch.z) * p.size[2]) * 0.5;
        this.tipT.copy(p.pos);
        this.gapT = Math.max(0.2, Math.min(half, p.radius) * 2 * p.s * 0.92);
        g.feedTrack(p);
        moving = true;
      } else if (atTable && (this.hover.on || this.active) && !IS_TOUCH) {
        const pt = this.tablePoint(this.hover.x, this.hover.y, 0, new THREE.Vector3());
        if (pt) {
          pt.x = clamp(pt.x, g.bounds.x0, g.bounds.x1);
          pt.z = clamp(pt.z, g.bounds.z0 + 6, g.bounds.z1);
          this.tipT.set(pt.x, 2.6, pt.z);
        }
        this.gapT = this.state === 'air' ? 0.25 : 1.5;
      } else {
        this.tipT.copy(this.restSticks);
        this.gapT = 0.9;
      }
      this.kPosT.copy(this.restKnife);
      this.kDirT.set(-0.42, 0, -0.9).normalize();
    } else {
      if (!this.cut) {
        if (atTable && (this.hover.on || this.active) && !IS_TOUCH) {
          const pt = this.tablePoint(this.hover.x, this.hover.y, 0, new THREE.Vector3());
          if (pt) this.kPosT.set(clamp(pt.x, g.bounds.x0, g.bounds.x1), 3.2, clamp(pt.z, g.bounds.z0 + 6, g.bounds.z1));
        } else if (!this.active) this.kPosT.copy(this.restKnife);
        if (!this.active) this.kDirT.set(-0.5, 0, -0.86).normalize();
      }
      this.tipT.copy(this.restSticks);
      this.gapT = 0.9;
    }
    const rest = this.tool !== 'sticks' || (this.state === 'idle' && !(atTable && this.hover.on && !IS_TOUCH));
    const rate = this.state === 'hold' || this.state === 'press' ? 40 : 16;
    if (this.tip.distanceToSquared(this.tipT) > 1e-5 || Math.abs(this.gap - this.gapT) > 1e-3) {
      this.tip.x = damp(this.tip.x, this.tipT.x, rate, dt);
      this.tip.y = damp(this.tip.y, this.tipT.y, rate, dt);
      this.tip.z = damp(this.tip.z, this.tipT.z, rate, dt);
      this.gap = damp(this.gap, this.gapT, 26, dt);
      moving = true;
    }
    if (rest) {
      for (let i = 0; i < 2; i++) {
        const s = this.sticks[i];
        s.position.set(this.tip.x + (i ? 0.55 : -0.55), this.tip.y, this.tip.z);
        s.quaternion.setFromUnitVectors(UP, _a.set(i ? 0.03 : -0.03, 0.02, 1).normalize());
      }
    } else {
      const px = this.state === 'hold' ? this.pinch : right;
      for (let i = 0; i < 2; i++) {
        const s = this.sticks[i];
        const sign = i ? 1 : -1;
        s.position.copy(this.tip).addScaledVector(px, (sign * this.gap) / 2);
        _a.copy(hand).multiplyScalar(22).addScaledVector(px, sign * (0.7 - this.gap / 2));
        s.quaternion.setFromUnitVectors(UP, _a.normalize());
      }
    }
    if (this.kPos.distanceToSquared(this.kPosT) > 1e-5 || this.kDir.distanceToSquared(this.kDirT) > 1e-5) {
      const kr = this.cut ? 60 : 16;
      this.kPos.x = damp(this.kPos.x, this.kPosT.x, kr, dt);
      this.kPos.y = damp(this.kPos.y, this.kPosT.y, kr, dt);
      this.kPos.z = damp(this.kPos.z, this.kPosT.z, kr, dt);
      this.kDir.lerp(this.kDirT, 1 - Math.exp(-dt * 14)).normalize();
      moving = true;
    }
    const lying = this.tool !== 'knife' || (!this.cut && !this.active && !(atTable && this.hover.on && !IS_TOUCH));
    this.kRoll = damp(this.kRoll, lying ? 1 : 0, 14, dt);
    const xAxis = _a.copy(this.kDir).multiplyScalar(-1);
    const zAxis = _b.crossVectors(xAxis, UP).normalize();
    _m.makeBasis(xAxis, UP, zAxis);
    this.knife.quaternion.setFromRotationMatrix(_m);
    if (this.kRoll > 0.001) this.knife.quaternion.multiply(_q.setFromAxisAngle(_c.set(1, 0, 0), this.kRoll * 1.5));
    this.knife.position.copy(this.kPos);
    this.knife.position.y += this.kRoll * 0.1;
    return moving;
  }

  pressBreak(p) {
    const g = this.game;
    const b = p.prep.breaks;
    this.pressBroke = true;
    if (b.mode === 'snap' || (b.mode === 'crumble' && b.toughness < 0.75) || (b.mode === 'shatter' && b.toughness < 0.45)) {
      const pt = this.pressPoint.clone();
      const n = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize();
      let out;
      if (b.mode === 'snap') out = g.pieces.snap(p, pt, n);
      else out = g.pieces.shatter(p, pt, Math.max(2, Math.round((b.shards || 4) * 0.6)), 0.5);
      if (out) {
        g.sound(p, 'break', 1);
        g.fx.crumbs(pt, p.prep, b.mode === 'snap' ? 5 : 14, 1, 0.7);
        g.stage.shake(0.03);
        this.piece = null;
        this.state = 'air';
      }
      return;
    }
    if (p.soft > 0.5 && p.set.whole && p.prep.layers.some((l) => l.fill && l.fill.type === 'liquid' && (l.fill.viscosity ?? 0.4) < 0.5)) this.burstAt = this.pressT + 0.5;
  }

  knifeDown(x, y, hit) {
    const g = this.game;
    const p = hit && hit.piece.zone === 'table' ? hit.piece : null;
    const h = p ? p.topY() : 0;
    const pt = this.tablePoint(x, y, h, new THREE.Vector3());
    if (!pt) return;
    this.cut = { piece: null, p0: pt.clone(), last: pt.clone(), locked: false, dir: this.kDir.clone(), s: 0, progress: 0, sawed: 0, sign: 0 };
    this.kPosT.set(pt.x, h + 0.02, pt.z);
    if (p) this.knifeTarget(p, pt, true);
    else {
      g.audio.play('knife_board', { vol: 0.5, rate: rand(0.95, 1.1) });
      this.kPosT.y = g.surfaceAt(pt.x, pt.z) + 0.02;
    }
  }

  knifeTarget(p, pt, hit) {
    const g = this.game;
    const c = this.cut;
    c.piece = p;
    c.progress = p.cutProgress || 0;
    c.p0.copy(pt);
    c.s = 0;
    c.top = p.topY();
    c.bottom = Math.max(g.surfaceAt(p.pos.x, p.pos.z), p.pos.y - (c.top - p.pos.y));
    p.setPinned(true);
    g.ui.caption(p.prep.name);
    const b = p.prep.breaks;
    if (b.mode !== 'slice' && hit) {
      const hits = 1 + Math.round(b.toughness * 3.2);
      p.damage = (p.damage || 0) + 1 / hits;
      g.sound(p, p.damage >= 1 ? 'break' : 'hit', 0.9);
      g.fx.crumbs(pt, p.prep, 3, 0.6, 0.6);
      g.stage.shake(0.02);
      if (p.damage >= 1) this.knifeBreak(p, pt);
    } else if (hit) g.sound(p, 'squish', 0.4);
  }

  knifeBreak(p, pt) {
    const g = this.game;
    const b = p.prep.breaks;
    const c = this.cut;
    const n = c ? new THREE.Vector3().crossVectors(UP, c.dir).normalize() : new THREE.Vector3(1, 0, 0);
    p.setPinned(false);
    p.relax();
    let out = null;
    if (b.mode === 'snap') out = g.pieces.snap(p, pt, n);
    else out = g.pieces.shatter(p, pt, b.shards || 5, b.mode === 'crumble' ? 0.6 : 1);
    if (out) {
      g.fx.crumbs(pt, p.prep, b.mode === 'crumble' ? 26 : b.mode === 'shatter' ? 16 : 6, 1.2, 1);
      g.stage.shake(b.mode === 'snap' ? 0.03 : 0.06);
      g.onBroken(p, out);
    } else p.damage = 0.6;
    if (c) c.piece = null;
  }

  knifeMove(x, y) {
    const g = this.game;
    const c = this.cut;
    if (!c) return;
    const pt = this.tablePoint(x, y, c.p0.y, new THREE.Vector3());
    if (!pt) return;
    if (!c.locked) {
      const d = _a.copy(pt).sub(c.p0);
      d.y = 0;
      if (d.length() > 0.7) {
        c.locked = true;
        c.dir.copy(d.normalize());
        const toCam = _b.copy(g.stage.camera.position).sub(c.p0);
        const handle = _c.copy(c.dir);
        if (handle.dot(toCam) < 0) handle.multiplyScalar(-1);
        if (handle.x < -0.2 && Math.abs(handle.z) < 0.5) handle.multiplyScalar(-1);
        this.kDirT.copy(handle).multiplyScalar(-1);
      } else return;
    }
    const s = _a.copy(pt).sub(c.p0).dot(c.dir);
    const ds = s - c.s;
    c.s = s;
    const pos = _b.copy(c.p0).addScaledVector(c.dir, s);
    if (!c.piece) {
      const hit = g.physics.cast({ x: pos.x, y: 30, z: pos.z }, { x: 0, y: -1, z: 0 }, 60, (o) => o && o.prep && o.zone === 'table' && !o.held);
      if (hit && hit.owner && hit.owner.prep) {
        const pp = new THREE.Vector3(pos.x, hit.owner.topY(), pos.z);
        this.knifeTarget(hit.owner, pp, false);
        c.p0.copy(pp);
        c.s = 0;
      }
      this.kPosT.set(pos.x, (c.piece ? c.top : g.surfaceAt(pos.x, pos.z)) + 0.02, pos.z);
      return;
    }
    const p = c.piece;
    if (p.dead) {
      c.piece = null;
      return;
    }
    const b = p.prep.breaks;
    const height = Math.max(0.3, c.top - c.bottom);
    if (b.mode === 'slice') {
      const need = (2.6 + b.toughness * 15) * clamp(height / 2, 0.6, 1.5);
      c.progress = Math.min(1, c.progress + Math.abs(ds) / need);
      p.cutProgress = c.progress;
      c.sawed += Math.abs(ds);
      const sign = Math.sign(ds);
      if (c.sawed > 2.4 || (sign && sign !== c.sign && c.sawed > 0.8)) {
        c.sawed = 0;
        c.sign = sign;
        g.sound(p, 'saw', 0.5 + 0.3 * c.progress);
        if (p.prep.feel.sticky > 0.5) g.fx.crumbs(pos, p.prep, 1, 0.3, 0.3);
      }
      p.press(UP, Math.sin(c.progress * Math.PI) * 0.75 + c.progress * 0.25);
      this.kPosT.set(pos.x, lerp(c.top, c.bottom + 0.03, c.progress) - (1 - p.s) * height * 0.4, pos.z);
      if (c.progress >= 1) {
        const n = new THREE.Vector3().crossVectors(UP, c.dir).normalize();
        p.setPinned(false);
        p.relax();
        p.cutProgress = 0;
        const had = p.set.whole;
        const out = g.pieces.cut(p, n, c.p0, 20 + 12 * (1 - p.soft));
        g.audio.play('knife_board', { vol: 0.7, rate: rand(0.92, 1.08) });
        if (out) {
          g.sound(p, 'cut', 1);
          g.onBroken(p, out, { n, point: c.p0, first: had });
        }
        c.piece = null;
        this.kPosT.y = g.surfaceAt(pos.x, pos.z) + 0.02;
      }
    } else {
      c.sawed += Math.abs(ds);
      this.kPosT.set(pos.x, c.top + 0.02, pos.z);
      if (c.sawed > 3.2) {
        c.sawed = 0;
        const hits = 1 + Math.round(b.toughness * 3.2);
        p.damage = (p.damage || 0) + 0.5 / hits;
        g.sound(p, 'scrape', 0.5);
        g.fx.crumbs(pos, p.prep, 2, 0.5, 0.4);
        if (p.damage >= 1) this.knifeBreak(p, new THREE.Vector3(pos.x, c.top, pos.z));
      }
    }
  }

  knifeUp() {
    const c = this.cut;
    if (c && c.piece && !c.piece.dead) {
      c.piece.setPinned(false);
      c.piece.relax();
    }
    this.cut = null;
    this.game.ui.caption('');
  }
}
