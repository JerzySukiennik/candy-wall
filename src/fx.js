// Candy Wall: small effects: liquid drops and puddles, crumbs, soft sprite puffs (steam, mist, sweat, tears).
import * as THREE from 'three';
import { clamp, lerp, rand } from './util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _e = new THREE.Euler();
const MAX_DROPS = 160;
const MAX_CRUMBS = 420;
const MAX_PUDDLES = 36;
const MAX_PUFFS = 220;

export class Fx {
  constructor(game) {
    this.game = game;
    const scene = game.stage.scene;
    const dropMat = new THREE.MeshPhysicalMaterial({ roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, emissive: 0xffffff, emissiveIntensity: 0 });
    dropMat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.45;');
    };
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), dropMat, MAX_DROPS);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.drops.count = 0;
    this.drops.frustumCulled = false;
    this.drops.castShadow = false;
    this.drops.setColorAt(0, _c.set(0xffffff));
    scene.add(this.drops);
    this.dropList = [];

    const cg = new THREE.IcosahedronGeometry(1, 0);
    cg.scale(1, 0.62, 0.8);
    this.crumbMesh = new THREE.InstancedMesh(cg, new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true }), MAX_CRUMBS);
    this.crumbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.crumbMesh.count = 0;
    this.crumbMesh.frustumCulled = false;
    this.crumbMesh.setColorAt(0, _c.set(0xffffff));
    scene.add(this.crumbMesh);
    this.crumbList = [];
    this.crumbHead = 0;

    const prof = [];
    prof.push(new THREE.Vector2(1.0, 0));
    for (let i = 10; i >= 0; i--) {
      const t = i / 10;
      prof.push(new THREE.Vector2(Math.sin((t * Math.PI) / 2), Math.cos((t * Math.PI) / 2) ** 0.55));
    }
    this.puddleGeo = new THREE.LatheGeometry(prof, 28);
    this.puddles = [];

    const n = MAX_PUFFS;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 4), 4));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setDrawRange(0, 0);
    this.puffGeo = g;
    this.puffMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uScale: { value: 1 } },
      vertexShader: `attribute vec4 aColor; attribute float aSize; varying vec4 vColor; uniform float uScale;
        void main() { vColor = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; }`,
      fragmentShader: `varying vec4 vColor;
        void main() { float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); gl_FragColor = vec4(vColor.rgb, vColor.a * a * a); }`,
    });
    this.puffPoints = new THREE.Points(g, this.puffMat);
    this.puffPoints.frustumCulled = false;
    this.puffPoints.renderOrder = 20;
    scene.add(this.puffPoints);
    this.puffList = [];
  }

  surfaceY(x, z) {
    const g = this.game;
    if (g.tray && g.tray.contains(x, 0, z, 0)) return g.tray.home.y + g.tray.floorY;
    return g.surfaceAt ? g.surfaceAt(x, z) : 0;
  }

  drop(pos, fill, volume, piece) {
    if (this.dropList.length >= MAX_DROPS) return;
    const v = piece ? piece.body.linvel() : { x: 0, y: 0, z: 0 };
    this.dropList.push({ x: pos.x, y: pos.y, z: pos.z, vx: v.x * 0.5 + rand(-2, 2), vy: v.y * 0.5 - 4, vz: v.z * 0.5 + rand(-2, 2), vol: volume, fill, r: Math.cbrt((volume * 3) / (4 * Math.PI)) });
  }

  squirt(pos, dir, fill, count, speed = 60) {
    for (let i = 0; i < count; i++) {
      if (this.dropList.length >= MAX_DROPS) return;
      const vol = rand(0.008, 0.03);
      this.dropList.push({ x: pos.x, y: pos.y, z: pos.z, vx: dir.x * speed * rand(0.3, 1) + rand(-12, 12), vy: dir.y * speed * rand(0.3, 1) + rand(4, 26), vz: dir.z * speed * rand(0.3, 1) + rand(-12, 12), vol, fill, r: Math.cbrt((vol * 3) / (4 * Math.PI)) });
    }
  }

  addPuddle(x, y, z, fill, vol) {
    const key = fill.color;
    for (const p of this.puddles) {
      if (p.key !== key || Math.abs(p.y - y) > 0.2) continue;
      if (Math.hypot(p.x - x, p.z - z) < p.r + 0.7) {
        const w = vol / (p.vol + vol);
        p.x = lerp(p.x, x, w * 0.5);
        p.z = lerp(p.z, z, w * 0.5);
        p.vol += vol;
        return;
      }
    }
    if (this.puddles.length >= MAX_PUDDLES) {
      const old = this.puddles.shift();
      this.game.stage.scene.remove(old.mesh);
      old.mesh.material.dispose();
    }
    const visc = fill.viscosity ?? 0.4;
    const col = new THREE.Color(fill.color);
    const mat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: lerp(0.82, 0.97, visc), emissive: col, emissiveIntensity: 0.3 });
    const mesh = new THREE.Mesh(this.puddleGeo, mat);
    mesh.renderOrder = 3;
    mesh.scale.setScalar(0.001);
    this.game.stage.scene.add(mesh);
    this.puddles.push({ key, x, y, z, vol, r: 0.01, h: lerp(0.11, 0.3, visc), mesh, visc });
  }

  crumbs(pos, prep, count, spread = 1, speed = 1) {
    const cr = prep.breaks.crumbs || {};
    const base = new THREE.Color(cr.color ?? prep.layers[0].cap.color ?? 0xffffff);
    const n = Math.round(count * (0.5 + (cr.amount ?? 0.4)));
    for (let i = 0; i < n; i++) {
      const c = { x: pos.x + rand(-spread, spread) * 0.4, y: pos.y + rand(0, 0.3), z: pos.z + rand(-spread, spread) * 0.4, vx: rand(-1, 1) * 26 * speed, vy: rand(8, 46) * speed, vz: rand(-1, 1) * 26 * speed, s: rand(0.035, 0.11), rx: rand(6.28), ry: rand(6.28), rz: rand(6.28), w: rand(-12, 12), rest: false, color: base.clone().offsetHSL(0, 0, rand(-0.05, 0.07)) };
      if (this.crumbList.length < MAX_CRUMBS) this.crumbList.push(c);
      else {
        this.crumbList[this.crumbHead] = c;
        this.crumbHead = (this.crumbHead + 1) % MAX_CRUMBS;
      }
    }
    this.crumbDirty = true;
  }

  puff(pos, o = {}) {
    const n = o.count ?? 1;
    for (let i = 0; i < n; i++) {
      if (this.puffList.length >= MAX_PUFFS) this.puffList.shift();
      const sp = o.spread ?? 0.5;
      this.puffList.push({
        x: pos.x + rand(-sp, sp),
        y: pos.y + rand(-sp, sp),
        z: pos.z + rand(-sp, sp),
        vx: (o.vx ?? 0) + rand(-1, 1) * (o.jitter ?? 2),
        vy: (o.vy ?? 6) + rand(-1, 1) * (o.jitter ?? 2),
        vz: (o.vz ?? 0) + rand(-1, 1) * (o.jitter ?? 2),
        g: o.gravity ?? 0,
        drag: o.drag ?? 1.2,
        life: 0,
        max: (o.life ?? 1.2) * rand(0.7, 1.2),
        size: (o.size ?? 3) * rand(0.7, 1.3),
        grow: o.grow ?? 1.5,
        color: new THREE.Color(o.color ?? 0xffffff),
        alpha: o.alpha ?? 0.35,
        floor: o.floor,
      });
    }
  }

  update(dt) {
    let moving = false;
    const dl = this.dropList;
    if (dl.length) {
      moving = true;
      for (let i = dl.length - 1; i >= 0; i--) {
        const d = dl[i];
        d.vy -= 981 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.z += d.vz * dt;
        const sy = this.surfaceY(d.x, d.z);
        if (d.y <= sy + 0.02) {
          this.addPuddle(d.x, sy, d.z, d.fill, d.vol);
          if (Math.abs(d.vy) > 60) this.game.onDrip(d);
          dl.splice(i, 1);
        }
      }
      for (let i = 0; i < dl.length; i++) {
        const d = dl[i];
        const st = clamp(Math.abs(d.vy) / 240, 0, 1.2);
        _s.set(d.r * (1 - st * 0.25), d.r * (1 + st), d.r * (1 - st * 0.25));
        _m.compose(_p.set(d.x, d.y, d.z), _q.identity(), _s);
        this.drops.setMatrixAt(i, _m);
        this.drops.setColorAt(i, _c.set(d.fill.color));
      }
      this.drops.count = dl.length;
      this.drops.instanceMatrix.needsUpdate = true;
      if (this.drops.instanceColor) this.drops.instanceColor.needsUpdate = true;
    } else if (this.drops.count) this.drops.count = 0;

    for (const p of this.puddles) {
      const target = Math.sqrt(p.vol / (Math.PI * p.h * 0.8));
      if (Math.abs(target - p.r) > 0.002) {
        p.r = lerp(p.r, target, 1 - Math.exp(-dt * lerp(7, 1.6, p.visc)));
        moving = true;
      }
      p.mesh.position.set(p.x, p.y + 0.004, p.z);
      p.mesh.scale.set(p.r, p.h * clamp(p.r / 0.5, 0.25, 1), p.r);
    }

    const cl = this.crumbList;
    let live = false;
    for (let i = 0; i < cl.length; i++) {
      const c = cl[i];
      if (c.rest) continue;
      live = true;
      c.vy -= 981 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.z += c.vz * dt;
      c.rx += c.w * dt;
      c.rz += c.w * 0.7 * dt;
      const sy = this.surfaceY(c.x, c.z) + c.s * 0.5;
      if (c.y < sy) {
        c.y = sy;
        if (Math.abs(c.vy) < 30) {
          c.rest = true;
          c.rx = 0;
          c.rz = 0;
        } else {
          c.vy = -c.vy * 0.28;
          c.vx *= 0.55;
          c.vz *= 0.55;
        }
      }
    }
    if (live || this.crumbDirty) {
      this.crumbDirty = false;
      moving = moving || live;
      for (let i = 0; i < cl.length; i++) {
        const c = cl[i];
        _q.setFromEuler(_e.set(c.rx, c.ry, c.rz));
        _m.compose(_p.set(c.x, c.y, c.z), _q, _s.setScalar(c.s));
        this.crumbMesh.setMatrixAt(i, _m);
        this.crumbMesh.setColorAt(i, c.color);
      }
      this.crumbMesh.count = cl.length;
      this.crumbMesh.instanceMatrix.needsUpdate = true;
      if (this.crumbMesh.instanceColor) this.crumbMesh.instanceColor.needsUpdate = true;
    }

    const pl = this.puffList;
    if (pl.length || this.puffGeo.drawRange.count) {
      const pos = this.puffGeo.attributes.position.array;
      const col = this.puffGeo.attributes.aColor.array;
      const size = this.puffGeo.attributes.aSize.array;
      for (let i = pl.length - 1; i >= 0; i--) {
        const p = pl[i];
        p.life += dt;
        if (p.life >= p.max) {
          pl.splice(i, 1);
          continue;
        }
        p.vy -= p.g * dt;
        const dr = Math.exp(-p.drag * dt);
        p.vx *= dr;
        p.vy = p.g ? p.vy : p.vy * dr;
        p.vz *= dr;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.floor !== undefined && p.y < p.floor) p.life = p.max;
      }
      for (let i = 0; i < pl.length; i++) {
        const p = pl[i];
        const k = p.life / p.max;
        pos[i * 3] = p.x;
        pos[i * 3 + 1] = p.y;
        pos[i * 3 + 2] = p.z;
        col[i * 4] = p.color.r;
        col[i * 4 + 1] = p.color.g;
        col[i * 4 + 2] = p.color.b;
        col[i * 4 + 3] = p.alpha * Math.min(1, k * 6) * (1 - k) ** 1.2;
        size[i] = p.size * (1 + p.grow * k);
      }
      this.puffGeo.setDrawRange(0, pl.length);
      this.puffGeo.attributes.position.needsUpdate = true;
      this.puffGeo.attributes.aColor.needsUpdate = true;
      this.puffGeo.attributes.aSize.needsUpdate = true;
      this.puffMat.uniforms.uScale.value = (this.game.stage.h * this.game.stage.renderer.getPixelRatio()) / (2 * Math.tan((this.game.stage.camera.fov * Math.PI) / 360));
      moving = moving || pl.length > 0;
    }
    return moving;
  }

  clearTable() {
    for (const p of this.puddles) {
      this.game.stage.scene.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this.puddles.length = 0;
    this.crumbList.length = 0;
    this.crumbHead = 0;
    this.crumbMesh.count = 0;
  }
}
