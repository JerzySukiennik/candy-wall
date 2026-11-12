// Candy Wall: the backlit wall of acrylic dispensers (instanced candy piles, levers, labels) and pouring into the tray.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WALL } from './config.js';
import { ensureRest, setDetail } from './lib/geo.js';
import { clearPlastic } from './tray.js';
import { clamp, damp, hashStr, rng } from './util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();
const BIN = { w: 13.2, h: 17.6, d: 9.6, y: 5.6, innerW: 12.2, innerD: 8.4, fill: 13.6 };
const SPOUT = { y: 5.3, z: 12.6 };

function lodBuild(def, v) {
  setDetail(0.32);
  let built;
  try {
    built = def.build(v);
  } finally {
    setDetail(1);
  }
  const box = new THREE.Box3();
  const layers = built.layers.map((l) => {
    const g = l.geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    ensureRest(g);
    g.computeBoundingBox();
    box.union(g.boundingBox);
    return { geometry: g, material: l.material };
  });
  return { layers, size: box.getSize(new THREE.Vector3()) };
}

export class Wall {
  constructor(game, defs) {
    this.game = game;
    this.group = new THREE.Group();
    this.defs = defs.slice(0, WALL.cols * WALL.rows);
    this.bins = [];
    this.width = WALL.cols * WALL.cellW;
    this.height = WALL.rows * WALL.cellH;
    this.center = new THREE.Vector3(0, WALL.y0 + this.height / 2, WALL.z);
    this.queue = [];
    this.active = null;
    this.pourAcc = 0;
    this.buildFrame();
    this.defs.forEach((def, i) => {
      const col = i % WALL.cols;
      const row = Math.floor(i / WALL.cols);
      const x = (col - (WALL.cols - 1) / 2) * WALL.cellW;
      const y = WALL.y0 + (WALL.rows - 1 - row) * WALL.cellH;
      const bin = { index: i, def, col, row, x, y, meshes: [], order: [], left: 0, total: 0, ready: false, lever: 0, leverT: 0 };
      bin.spout = new THREE.Vector3(x, y + SPOUT.y, WALL.z + SPOUT.z);
      this.bins.push(bin);
      this.queue.push(bin);
    });
    this.buildLevers();
    this.buildLabels();
    const vg = new THREE.BufferGeometry();
    vg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    vg.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11, 12, 13, 14, 12, 14, 15]);
    this.veil = new THREE.Mesh(vg, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }));
    this.veil.renderOrder = 4.5;
    this.veil.frustumCulled = false;
    this.veil.visible = false;
    this.veilT = 0;
    this.group.add(this.veil);
  }

  setFocus(bin) {
    this.veilT = bin ? 0.74 : 0;
    if (!bin) return;
    const z = WALL.z + BIN.d + 0.7;
    const X0 = -this.width / 2 - 6;
    const X1 = this.width / 2 + 6;
    const Y0 = WALL.y0 - 30;
    const Y1 = WALL.y0 + this.height + 6;
    const x0 = bin.x - WALL.cellW / 2 + 0.3;
    const x1 = bin.x + WALL.cellW / 2 - 0.3;
    const y0 = bin.y - 0.2;
    const y1 = bin.y + WALL.cellH - 0.2;
    const quads = [
      [X0, Y0, x0, Y1],
      [x1, Y0, X1, Y1],
      [x0, y1, x1, Y1],
      [x0, Y0, x1, y0],
    ];
    const p = this.veil.geometry.attributes.position;
    quads.forEach((q, i) => {
      p.setXYZ(i * 4, q[0], q[1], z);
      p.setXYZ(i * 4 + 1, q[2], q[1], z);
      p.setXYZ(i * 4 + 2, q[2], q[3], z);
      p.setXYZ(i * 4 + 3, q[0], q[3], z);
    });
    p.needsUpdate = true;
  }

  buildFrame() {
    const { cols, rows, cellW, cellH, z, y0 } = WALL;
    const W = this.width;
    const H = this.height;
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, H + 2), new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0x6f7686 }));
    glow.position.set(0, y0 + H / 2, z - 0.4);
    this.group.add(glow);
    this.glow = glow;
    const dark = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.35 });
    const frame = [];
    const box = (w, h, d, x, y, zz) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, zz);
      frame.push(g);
    };
    for (let r = 0; r <= rows; r++) box(W + 3, r === rows ? 1.2 : 4.6, 11, 0, y0 + r * cellH + (r === rows ? 0.2 : 2.3), z + 5.3);
    box(1.6, H + 1.4, 11.4, -W / 2 - 1.2, y0 + H / 2 + 0.3, z + 5.3);
    box(1.6, H + 1.4, 11.4, W / 2 + 1.2, y0 + H / 2 + 0.3, z + 5.3);
    for (let c = 1; c < cols; c++) box(0.5, H, 0.6, (c - cols / 2) * cellW, y0 + H / 2, z + 0.4);
    box(W + 6, 2.4, WALL.counterD, 0, WALL.counterY - 1.2, z + WALL.counterD / 2 - 1);
    box(W + 6, WALL.counterY + 40, 2, 0, WALL.counterY / 2 - 20 - 1.2, z + WALL.counterD - 2);
    const frameMesh = new THREE.Mesh(mergeGeometries(frame), dark);
    frameMesh.receiveShadow = true;
    this.group.add(frameMesh);

    const bins = [];
    const spouts = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * cellW;
        const y = y0 + r * cellH;
        const b = new THREE.BoxGeometry(BIN.w, BIN.h, BIN.d);
        b.translate(x, y + BIN.y + BIN.h / 2, z + BIN.d / 2 + 0.2);
        bins.push(b);
        const s = new THREE.BoxGeometry(5.6, 3.4, 6.2);
        s.translate(x, y + BIN.y + 1.7, z + BIN.d + 3.1);
        spouts.push(s);
      }
    const binMesh = new THREE.Mesh(mergeGeometries(bins), clearPlastic({ base: 0.015, edge: 0.2, shine: 0.35, side: THREE.FrontSide }));
    binMesh.renderOrder = 3;
    this.group.add(binMesh);
    const spoutMesh = new THREE.Mesh(mergeGeometries(spouts), clearPlastic({ base: 0.03, edge: 0.3, shine: 0.5, side: THREE.FrontSide }));
    spoutMesh.renderOrder = 3.5;
    this.group.add(spoutMesh);
  }

  buildLevers() {
    const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.18, metalness: 1 });
    const arm = new THREE.CylinderGeometry(0.28, 0.28, 4.4, 10);
    arm.rotateX(Math.PI / 2);
    arm.translate(0, 0, 2.2);
    const knob = new THREE.SphereGeometry(0.85, 14, 10);
    knob.translate(0, 0, 4.6);
    const hub = new THREE.CylinderGeometry(0.7, 0.7, 0.8, 12);
    hub.rotateZ(Math.PI / 2);
    const g = mergeGeometries([arm, knob, hub]);
    this.levers = new THREE.InstancedMesh(g, chrome, this.bins.length);
    this.levers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (const b of this.bins) this.placeLever(b);
    this.group.add(this.levers);
  }

  placeLever(b) {
    _q.setFromEuler(_e.set(-0.5 + b.lever * 1.25, 0, 0));
    _m.compose(_p.set(b.x + 3.5, b.y + BIN.y + 2.4, WALL.z + BIN.d + 3.6), _q, _s);
    this.levers.setMatrixAt(b.index, _m);
    this.levers.instanceMatrix.needsUpdate = true;
  }

  buildLabels() {
    const cv = document.createElement('canvas');
    cv.width = 2048;
    cv.height = 2048;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0b0b0d';
    ctx.fillRect(0, 0, 2048, 2048);
    const cw = 512;
    const ch = 2048 / 12;
    const quads = [];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.bins.forEach((b, i) => {
      const cx = (i % 4) * cw;
      const cy = Math.floor(i / 4) * ch;
      let size = 54;
      ctx.font = `600 ${size}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
      const text = b.def.name;
      while (ctx.measureText(text).width > cw - 56 && size > 26) {
        size -= 2;
        ctx.font = `600 ${size}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
      }
      ctx.fillStyle = '#f2f2f4';
      ctx.fillText(text, cx + cw / 2, cy + ch / 2 + 2);
      const g = new THREE.PlaneGeometry(12.6, 12.6 * (ch / cw));
      const uv = g.attributes.uv;
      for (let k = 0; k < 4; k++) uv.setXY(k, (cx + uv.getX(k) * cw) / 2048, 1 - (cy + (1 - uv.getY(k)) * ch) / 2048);
      g.translate(b.x, b.y + 2.3, WALL.z + 10.86);
      quads.push(g);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mesh = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    this.group.add(mesh);
  }

  buildBin(bin) {
    const def = bin.def;
    const nv = def.variants || 1;
    const lods = [];
    for (let v = 0; v < nv; v++) lods.push(lodBuild(def, v));
    const size = lods[0].size;
    const r = rng(hashStr(def.id));
    const cell = 0.45;
    const gw = Math.ceil(BIN.innerW / cell);
    const gd = Math.ceil(BIN.innerD / cell) + 1;
    const hm = new Float32Array(gw * gd);
    const longest = Math.max(size.x, size.y, size.z);
    const round = Math.min(size.x, size.y, size.z) / longest > 0.62;
    let lodTris = 0;
    for (const l of lods[0].layers) lodTris += l.geometry.index ? l.geometry.index.count / 3 : l.geometry.attributes.position.count / 3;
    const cap = clamp(Math.floor(26000 / Math.max(40, lodTris)), 6, 240);
    const item = Math.max(0.3, size.x * size.y * size.z * 0.3);
    const depth = clamp((cap * item) / (BIN.innerW * BIN.fill * 0.62), Math.min(BIN.innerD, Math.max(3.4, longest * 0.9)), BIN.innerD);
    const zShift = (BIN.innerD - depth) / 2;
    const maxCount = cap;
    const poses = [];
    let misses = 0;
    const half = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
    const rot = new THREE.Matrix4();
    for (let n = 0; n < maxCount; n++) {
      let best = null;
      for (let tries = 0; tries < 14; tries++) {
        if (round) _e.set(r() * 6.283, r() * 6.283, r() * 6.283);
        else {
          const lim = longest > BIN.innerW * 0.78 ? 0.22 : longest > depth * 0.9 ? 0.7 : Math.PI;
          _e.set((r() - 0.5) * 0.7, (r() - 0.5) * 2 * lim + (r() < 0.5 ? 0 : Math.PI), (r() - 0.5) * 0.7);
        }
        _q.setFromEuler(_e);
        rot.makeRotationFromQuaternion(_q);
        const e = rot.elements;
        const ex = Math.abs(e[0]) * half.x + Math.abs(e[4]) * half.y + Math.abs(e[8]) * half.z;
        const ey = Math.abs(e[1]) * half.x + Math.abs(e[5]) * half.y + Math.abs(e[9]) * half.z;
        const ez = Math.abs(e[2]) * half.x + Math.abs(e[6]) * half.y + Math.abs(e[10]) * half.z;
        const fx = Math.min(ex * 0.8, BIN.innerW / 2 - 0.05);
        const fz = Math.min(ez * 0.8, depth / 2 - 0.05);
        const px = (r() - 0.5) * 2 * Math.max(0, BIN.innerW / 2 - ex * 0.92);
        const pz = (r() - 0.5) * 2 * Math.max(0, depth / 2 - ez * 0.92);
        const i0 = Math.max(0, Math.floor((px - fx + BIN.innerW / 2) / cell));
        const i1 = Math.min(gw - 1, Math.floor((px + fx + BIN.innerW / 2) / cell));
        const j0 = Math.max(0, Math.floor((pz - fz + depth / 2) / cell));
        const j1 = Math.min(gd - 1, Math.floor((pz + fz + depth / 2) / cell));
        const eh = ey * 0.76;
        let y = eh;
        for (let j = j0; j <= j1; j++)
          for (let i = i0; i <= i1; i++) {
            const dx = ((i + 0.5) * cell - BIN.innerW / 2 - px) / fx;
            const dz = ((j + 0.5) * cell - depth / 2 - pz) / fz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= 1) continue;
            y = Math.max(y, hm[j * gw + i] + eh * Math.sqrt(1 - d2));
          }
        if (!best || y < best.y) best = { y, px, pz, ex: fx, ey: eh, ez: fz, q: _q.clone(), i0, i1, j0, j1 };
      }
      const y = best.y;
      if (y + best.ey > BIN.fill) {
        if (++misses > 5) break;
        continue;
      }
      for (let j = best.j0; j <= best.j1; j++)
        for (let i = best.i0; i <= best.i1; i++) {
          const dx = ((i + 0.5) * cell - BIN.innerW / 2 - best.px) / best.ex;
          const dz = ((j + 0.5) * cell - depth / 2 - best.pz) / best.ez;
          const d2 = dx * dx + dz * dz;
          if (d2 >= 1) continue;
          hm[j * gw + i] = Math.max(hm[j * gw + i], y + best.ey * Math.sqrt(1 - d2));
        }
      poses.push({ x: best.px, y, z: best.pz + zShift, q: best.q, v: Math.floor(r() * nv) % nv });
    }
    poses.sort((a, b) => a.y - b.y);
    const baseX = bin.x;
    const baseY = bin.y + BIN.y + 0.35;
    const baseZ = WALL.z + 0.2 + BIN.d / 2;
    const perV = [];
    for (let v = 0; v < nv; v++) perV.push(poses.filter((p) => p.v === v));
    bin.variantPoses = perV;
    bin.variantLeft = perV.map((l) => l.length);
    bin.meshes = [];
    for (let v = 0; v < nv; v++) {
      const list = perV[v];
      if (!list.length) {
        bin.meshes.push([]);
        continue;
      }
      const set = [];
      for (const l of lods[v].layers) {
        const im = new THREE.InstancedMesh(l.geometry, l.material, list.length);
        list.forEach((p, i) => {
          _m.compose(_p.set(baseX + p.x, baseY + p.y, baseZ + p.z), p.q, _s);
          im.setMatrixAt(i, _m);
        });
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        im.castShadow = false;
        im.receiveShadow = false;
        if (l.material.transparent) im.renderOrder = 2;
        this.group.add(im);
        set.push(im);
      }
      bin.meshes.push(set);
    }
    bin.total = poses.length;
    bin.left = poses.length;
    bin.size = size;
    bin.ready = true;
  }

  takeOne(bin) {
    if (!bin.ready) return -1;
    if (bin.left <= Math.max(2, bin.total * 0.25)) this.refill(bin);
    let best = -1;
    let by = -Infinity;
    bin.variantLeft.forEach((n, v) => {
      if (n <= 0) return;
      const y = bin.variantPoses[v][n - 1].y;
      if (y > by) {
        by = y;
        best = v;
      }
    });
    if (best < 0) return 0;
    bin.variantLeft[best]--;
    bin.left--;
    for (const im of bin.meshes[best]) im.count = bin.variantLeft[best];
    return best;
  }

  refill(bin) {
    bin.variantLeft = bin.variantPoses.map((l) => l.length);
    bin.left = bin.total;
    bin.meshes.forEach((set, v) => {
      for (const im of set) im.count = bin.variantLeft[v];
    });
  }

  pick(ray) {
    const z = WALL.z + BIN.d + 0.2;
    const t = (z - ray.origin.z) / ray.direction.z;
    if (!(t > 0)) return null;
    const x = ray.origin.x + ray.direction.x * t;
    const y = ray.origin.y + ray.direction.y * t;
    const col = Math.floor((x + this.width / 2) / WALL.cellW);
    const rowUp = Math.floor((y - WALL.y0) / WALL.cellH);
    if (col < 0 || col >= WALL.cols || rowUp < 0 || rowUp >= WALL.rows) return null;
    const row = WALL.rows - 1 - rowUp;
    return this.bins[row * WALL.cols + col] || null;
  }

  rig(bin, aspect) {
    const portrait = aspect < 0.8;
    return { t: [bin.x, bin.y - (portrait ? 3 : 1.5), WALL.z + 12], w: portrait ? 31 : 40, h: portrait ? 50 : 38, elev: 17, fov: 28 };
  }

  overviewRig(aspect, panX = 0) {
    const fitW = this.width + 6;
    const fitH = this.height + 6;
    const wide = fitW / fitH;
    if (aspect >= wide * 0.92) return { t: [0, this.center.y, WALL.z + 6], w: fitW, h: fitH, elev: 0, fov: 28, pan: 0 };
    const w = fitH * aspect;
    const pan = Math.max(0, (fitW - w) / 2);
    return { t: [clamp(panX, -pan, pan), this.center.y, WALL.z + 6], w, h: fitH, elev: 0, fov: 28, pan };
  }

  update(dt, budgetMs = 5) {
    let moving = false;
    if (this.queue.length) {
      const t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < budgetMs) {
        const bin = this.queue.shift();
        try {
          this.buildBin(bin);
        } catch (e) {
          console.error('[wall] bin failed', bin.def.id, e);
          bin.ready = false;
          bin.broken = true;
        }
      }
      moving = true;
    }
    const vm = this.veil.material;
    if (Math.abs(vm.opacity - this.veilT) > 0.004) {
      vm.opacity = damp(vm.opacity, this.veilT, 7, dt);
      this.veil.visible = vm.opacity > 0.01;
      moving = true;
    }
    for (const b of this.bins) {
      if (Math.abs(b.lever - b.leverT) > 0.002) {
        b.lever = damp(b.lever, b.leverT, 22, dt);
        this.placeLever(b);
        moving = true;
      }
    }
    return moving;
  }

  get loaded() {
    return 1 - this.queue.length / Math.max(1, this.bins.length);
  }
}

let glowTex = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 256;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#f6f8ff');
  g.addColorStop(0.5, '#e9edf7');
  g.addColorStop(1, '#cfd5e2');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 256);
  glowTex = new THREE.CanvasTexture(cv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
