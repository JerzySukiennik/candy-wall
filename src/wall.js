// Candy Wall: the wall of stacked acrylic bins with hinged slanted lids: candy piles (instanced, two detail levels, baked or loose), labels, scooping out and the focus veil.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BIN, BINBOX, IS_TOUCH, WALL } from './config.js';
import { ensureRest, setDetail } from './lib/geo.js';
import { clearPlastic } from './tray.js';
import { clamp, damp, hashStr, rng } from './util.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();
const _c = new THREE.Color();
const FAR_BUDGET = 26000;
const NEAR_BUDGET = IS_TOUCH ? 240000 : 620000;
const LID_OPEN = 1.32;

function trisOf(layers) {
  let n = 0;
  for (const l of layers) n += l.geometry.index ? l.geometry.index.count / 3 : l.geometry.attributes.position.count / 3;
  return n;
}

function lodBuild(def, v, detail) {
  setDetail(detail);
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

function loosePile(def, size, nv, tris) {
  const W = BINBOX.w;
  const D = BINBOX.d;
  const FILL = BINBOX.fill;
  const r = rng(hashStr(def.id));
  const cell = 0.45;
  const gw = Math.ceil(W / cell);
  const gd = Math.ceil(D / cell) + 1;
  const hm = new Float32Array(gw * gd);
  const longest = Math.max(size.x, size.y, size.z);
  const round = Math.min(size.x, size.y, size.z) / longest > 0.62;
  const cap = clamp(Math.floor(FAR_BUDGET / Math.max(40, tris)), 6, 300);
  const half = new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2);
  const rot = new THREE.Matrix4();
  const poses = [];
  let misses = 0;
  for (let n = 0; n < cap; n++) {
    let best = null;
    for (let tries = 0; tries < 14; tries++) {
      if (round) _e.set(r() * 6.283, r() * 6.283, r() * 6.283);
      else {
        const lim = longest > D * 0.9 ? 0.5 : Math.PI;
        _e.set((r() - 0.5) * 0.7, (r() - 0.5) * 2 * lim + (r() < 0.5 ? 0 : Math.PI), (r() - 0.5) * 0.7);
        if (longest > D * 0.9 && size.z > size.x) _e.y += Math.PI / 2;
      }
      _q.setFromEuler(_e);
      rot.makeRotationFromQuaternion(_q);
      const e = rot.elements;
      const ex = Math.abs(e[0]) * half.x + Math.abs(e[4]) * half.y + Math.abs(e[8]) * half.z;
      const ey = Math.abs(e[1]) * half.x + Math.abs(e[5]) * half.y + Math.abs(e[9]) * half.z;
      const ez = Math.abs(e[2]) * half.x + Math.abs(e[6]) * half.y + Math.abs(e[10]) * half.z;
      const fx = Math.min(ex * 0.8, W / 2 - 0.05);
      const fz = Math.min(ez * 0.8, D / 2 - 0.05);
      const px = (r() - 0.5) * 2 * Math.max(0, W / 2 - ex * 0.92);
      const pz = (r() - 0.5) * 2 * Math.max(0, D / 2 - ez * 0.92);
      const i0 = Math.max(0, Math.floor((px - fx + W / 2) / cell));
      const i1 = Math.min(gw - 1, Math.floor((px + fx + W / 2) / cell));
      const j0 = Math.max(0, Math.floor((pz - fz + D / 2) / cell));
      const j1 = Math.min(gd - 1, Math.floor((pz + fz + D / 2) / cell));
      const eh = ey * 0.76;
      let y = eh;
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const dx = ((i + 0.5) * cell - W / 2 - px) / fx;
          const dz = ((j + 0.5) * cell - D / 2 - pz) / fz;
          const d2 = dx * dx + dz * dz;
          if (d2 < 1) y = Math.max(y, hm[j * gw + i] + eh * Math.sqrt(1 - d2));
        }
      if (!best || y < best.y) best = { y, px, pz, ex: fx, ey: eh, ez: fz, q: _q.clone(), i0, i1, j0, j1 };
    }
    if (best.y + best.ey > FILL) {
      if (++misses > 5) break;
      continue;
    }
    for (let j = best.j0; j <= best.j1; j++)
      for (let i = best.i0; i <= best.i1; i++) {
        const dx = ((i + 0.5) * cell - W / 2 - best.px) / best.ex;
        const dz = ((j + 0.5) * cell - D / 2 - best.pz) / best.ez;
        const d2 = dx * dx + dz * dz;
        if (d2 < 1) hm[j * gw + i] = Math.max(hm[j * gw + i], best.y + best.ey * Math.sqrt(1 - d2));
      }
    poses.push({ x: best.px, y: best.y, z: best.pz, q: best.q, v: Math.floor(r() * nv) % nv });
  }
  poses.sort((a, b) => a.y - b.y);
  const top = poses.length ? poses[poses.length - 1].y : 1;
  const out = { n: poses.length, p: [], q: [], v: [], ao: [], loose: true };
  for (const p of poses) {
    out.p.push(Math.round(p.x * 100), Math.round(p.y * 100), Math.round(p.z * 100));
    out.q.push(Math.round(p.q.x * 10000), Math.round(p.q.y * 10000), Math.round(p.q.z * 10000), Math.round(p.q.w * 10000));
    out.v.push(p.v);
    const lit = Math.max(clamp((p.z + D / 2) / D, 0, 1) * 0.8, clamp(1 - (top - p.y) / 4, 0, 1));
    out.ao.push(Math.round((0.45 + 0.55 * lit) * 255));
  }
  return out;
}

export class Wall {
  constructor(game, defs) {
    this.game = game;
    this.group = new THREE.Group();
    this.defs = defs;
    this.cols = Math.min(WALL.cols, defs.length);
    this.rows = Math.ceil(defs.length / this.cols);
    this.bins = [];
    this.width = this.cols * WALL.cellW;
    this.height = this.rows * WALL.cellH;
    this.center = new THREE.Vector3(0, WALL.y0 + this.height / 2, WALL.z);
    this.queue = [];
    this.focused = null;
    this.defs.forEach((def, i) => {
      const col = i % this.cols;
      const row = Math.floor(i / this.cols);
      const x = (col - (this.cols - 1) / 2) * WALL.cellW;
      const y = WALL.y0 + (this.rows - 1 - row) * WALL.cellH;
      const bin = { index: i, def, col, row, x, y, sets: [], left: 0, total: 0, ready: false, lid: 0, lidT: 0, near: false };
      bin.origin = new THREE.Vector3(x, y + BIN.y + 0.25, WALL.z + BIN.z0 + 0.3 + BINBOX.d / 2);
      bin.hinge = new THREE.Vector3(x, y + BIN.y + BIN.h, WALL.z + BIN.z0 + BIN.hingeZ);
      bin.mouth = new THREE.Vector3(x, y + BIN.y + BINBOX.fill, WALL.z + BIN.z0 + 9.5);
      this.bins.push(bin);
      this.queue.push(bin);
    });
    this.buildFrame();
    this.buildLids();
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

  buildFrame() {
    const { cellH, z, y0 } = WALL;
    const W = this.width;
    const H = this.height;
    const backing = new THREE.Mesh(new THREE.PlaneGeometry(W + 4, H + 2), new THREE.MeshStandardMaterial({ color: 0x0b0c10, roughness: 0.85, metalness: 0 }));
    backing.position.set(0, y0 + H / 2, z - 0.2);
    backing.receiveShadow = true;
    this.group.add(backing);
    const dark = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.35 });
    const frame = [];
    const box = (w, h, d, x, y, zz) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, zz);
      frame.push(g);
    };
    for (let r = 0; r <= this.rows; r++) box(W + 3, r === this.rows ? 1 : 2.5, 13.6, 0, y0 + r * cellH + (r === this.rows ? 0.3 : 1.35), z + 6.8);
    box(1.6, H + 1.4, 14, -W / 2 - 1.2, y0 + H / 2 + 0.3, z + 7);
    box(1.6, H + 1.4, 14, W / 2 + 1.2, y0 + H / 2 + 0.3, z + 7);
    box(W + 6, 2.4, WALL.counterD, 0, WALL.counterY - 1.2, z + WALL.counterD / 2 - 1);
    box(W + 6, WALL.counterY + 40, 2, 0, WALL.counterY / 2 - 20 - 1.2, z + WALL.counterD - 2);
    const frameMesh = new THREE.Mesh(mergeGeometries(frame), dark);
    frameMesh.receiveShadow = true;
    this.group.add(frameMesh);

    const pos = [];
    const lines = [];
    const rods = [];
    const hw = BIN.w / 2;
    const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (const bin of this.bins) {
      const x0 = bin.x - hw;
      const x1 = bin.x + hw;
      const yb = bin.y + BIN.y;
      const zb = z + BIN.z0;
      const A = [0, yb, zb];
      const B = [0, yb + BIN.h, zb];
      const C = [0, yb + BIN.h, zb + BIN.hingeZ];
      const N = [0, yb + BIN.noseY, zb + BIN.noseZ];
      const F = [0, yb, zb + BIN.frontZ];
      const at = (p, x) => [x, p[1], p[2]];
      quad(at(A, x0), at(A, x1), at(F, x1), at(F, x0));
      quad(at(A, x0), at(B, x0), at(B, x1), at(A, x1));
      quad(at(B, x0), at(C, x0), at(C, x1), at(B, x1));
      quad(at(F, x0), at(F, x1), at(N, x1), at(N, x0));
      for (const x of [x0, x1]) {
        pos.push(...at(A, x), ...at(B, x), ...at(C, x), ...at(A, x), ...at(C, x), ...at(N, x), ...at(A, x), ...at(N, x), ...at(F, x));
        lines.push(...at(C, x), ...at(N, x), ...at(N, x), ...at(F, x), ...at(B, x), ...at(C, x));
      }
      lines.push(...at(N, x0), ...at(N, x1), ...at(F, x0), ...at(F, x1));
      const rod = new THREE.CylinderGeometry(0.22, 0.22, BIN.w + 0.8, 10);
      rod.rotateZ(Math.PI / 2);
      rod.translate(bin.x, C[1] + 0.05, C[2]);
      rods.push(rod);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bg.computeVertexNormals();
    const binMesh = new THREE.Mesh(bg, clearPlastic({ base: 0.012, edge: 0.16, shine: 0.14, roughness: 0.16, side: THREE.DoubleSide }));
    binMesh.renderOrder = 3;
    this.group.add(binMesh);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const edges = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xcfdcff, transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false }));
    edges.renderOrder = 3.2;
    this.group.add(edges);
    const rodMesh = new THREE.Mesh(mergeGeometries(rods), new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.18, metalness: 1 }));
    this.group.add(rodMesh);
  }

  buildLids() {
    const len = Math.hypot(BIN.noseZ - BIN.hingeZ, BIN.h - BIN.noseY);
    const dy = (BIN.noseY - BIN.h) / len;
    const dz = (BIN.noseZ - BIN.hingeZ) / len;
    const hw = BIN.w / 2;
    const p = [];
    const quad = (a, b, c, d) => p.push(...a, ...b, ...c, ...a, ...c, ...d);
    const tip = [0, dy * len, dz * len];
    quad([-hw, 0, 0], [hw, 0, 0], [hw, tip[1], tip[2]], [-hw, tip[1], tip[2]]);
    quad([-hw, tip[1], tip[2]], [hw, tip[1], tip[2]], [hw, tip[1] - 0.9, tip[2] + 0.5], [-hw, tip[1] - 0.9, tip[2] + 0.5]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    this.lids = new THREE.InstancedMesh(g, clearPlastic({ base: 0.02, edge: 0.22, shine: 0.16, roughness: 0.16, side: THREE.DoubleSide }), this.bins.length);
    this.lids.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lids.renderOrder = 3.6;
    this.lids.frustumCulled = false;
    for (const b of this.bins) this.placeLid(b);
    this.group.add(this.lids);
  }

  placeLid(b) {
    _q.setFromEuler(_e.set(-b.lid * LID_OPEN, 0, 0));
    _m.compose(b.hinge, _q, _s);
    this.lids.setMatrixAt(b.index, _m);
    this.lids.instanceMatrix.needsUpdate = true;
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
      let size = 58;
      const font = () => `600 ${size}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
      ctx.font = font();
      const text = b.def.name;
      while (ctx.measureText(text).width > cw - 40 && size > 26) {
        size -= 2;
        ctx.font = font();
      }
      ctx.fillStyle = '#f2f2f4';
      ctx.fillText(text, cx + cw / 2, cy + ch / 2 + 2);
      const g = new THREE.PlaneGeometry(7.2, 7.2 * (ch / cw));
      const uv = g.attributes.uv;
      for (let k = 0; k < 4; k++) uv.setXY(k, (cx + uv.getX(k) * cw) / 2048, 1 - (cy + (1 - uv.getY(k)) * ch) / 2048);
      g.translate(b.x, b.y + 1.35, WALL.z + 13.66);
      quads.push(g);
    });
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mesh = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    this.group.add(mesh);
  }

  async buildBin(bin) {
    const def = bin.def;
    const nv = def.variants || 1;
    let pile = null;
    if (!this.index) this.index = fetch('assets/piles/index.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
    const baked = await this.index;
    if (baked.includes(def.id)) {
      try {
        const r = await fetch('assets/piles/' + def.id + '.json');
        if (r.ok) pile = await r.json();
      } catch (e) {}
    }
    const probe = lodBuild(def, 0, 0.3);
    const t03 = Math.max(12, trisOf(probe.layers));
    bin.size = probe.size;
    if (!pile) pile = loosePile(def, probe.size, nv, t03);
    bin.loose = !!pile.loose;
    bin.tris1 = t03 / 0.09;
    const farDetail = clamp(0.3 * Math.sqrt(FAR_BUDGET / (pile.n * t03)), 0.14, 0.5);
    bin.nearDetail = clamp(Math.sqrt(NEAR_BUDGET / (pile.n * bin.tris1)), 0.3, 1.25);
    const perV = [];
    for (let v = 0; v < nv; v++) perV.push([]);
    for (let i = 0; i < pile.n; i++) {
      perV[pile.v[i] % nv].push({
        x: pile.p[i * 3] / 100,
        y: pile.p[i * 3 + 1] / 100,
        z: pile.p[i * 3 + 2] / 100,
        q: new THREE.Quaternion(pile.q[i * 4] / 10000, pile.q[i * 4 + 1] / 10000, pile.q[i * 4 + 2] / 10000, pile.q[i * 4 + 3] / 10000).normalize(),
        ao: pile.ao[i] / 255,
      });
    }
    bin.all = perV;
    bin.active = perV.map((l) => l.slice());
    bin.sets = [];
    for (let v = 0; v < nv; v++) {
      const list = perV[v];
      if (!list.length) {
        bin.sets.push(null);
        continue;
      }
      const far = Math.abs(farDetail - 0.3) < 0.02 && v === 0 ? probe : lodBuild(def, v, farDetail);
      const meshes = [];
      for (const l of far.layers) {
        const im = new THREE.InstancedMesh(l.geometry, l.material, list.length);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.castShadow = false;
        im.receiveShadow = false;
        if (l.material.transparent) im.renderOrder = 2;
        this.group.add(im);
        meshes.push(im);
      }
      bin.sets.push({ meshes, far: far.layers.map((l) => l.geometry), near: null });
      list.forEach((p, i) => this.placeInstance(bin, v, i, p));
      for (const im of meshes) {
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
        im.computeBoundingSphere();
      }
    }
    bin.total = pile.n;
    bin.left = pile.n;
    bin.ready = true;
  }

  placeInstance(bin, v, i, p) {
    _m.compose(_p.set(bin.origin.x + p.x, bin.origin.y + p.y, bin.origin.z + p.z), p.q, _s);
    for (const im of bin.sets[v].meshes) {
      im.setMatrixAt(i, _m);
      im.setColorAt(i, _c.setScalar(p.ao));
    }
  }

  setNear(bin, on) {
    if (!bin || !bin.ready || bin.near === on) return;
    bin.near = on;
    const nv = bin.def.variants || 1;
    for (let v = 0; v < nv; v++) {
      const set = bin.sets[v];
      if (!set) continue;
      if (on && !set.near) set.near = lodBuild(bin.def, v, bin.nearDetail).layers.map((l) => l.geometry);
      set.meshes.forEach((im, i) => {
        im.geometry = on ? set.near[i] || set.far[i] : set.far[i];
        im.castShadow = on;
        im.receiveShadow = on;
      });
    }
  }

  scoopOut(bin, wx, wz, n) {
    if (!bin.ready) return [];
    if (bin.left - n < bin.total * 0.28) this.refill(bin);
    const lx = wx - bin.origin.x;
    const lz = wz - bin.origin.z;
    const cand = [];
    bin.active.forEach((list, v) => {
      list.forEach((p) => cand.push({ v, p, d: Math.hypot(p.x - lx, (p.z - lz) * 0.8) }));
    });
    let radius = 2.6;
    let pool = [];
    while (pool.length < n && radius < 30) {
      pool = cand.filter((c) => c.d <= radius);
      radius += 1.2;
    }
    pool.sort((a, b) => b.p.y - a.p.y);
    const taken = pool.slice(0, n);
    for (const t of taken) {
      const list = bin.active[t.v];
      const i = list.indexOf(t.p);
      if (i < 0) continue;
      const last = list.pop();
      if (last !== t.p) {
        list[i] = last;
        this.placeInstance(bin, t.v, i, last);
      }
      bin.left--;
    }
    bin.sets.forEach((set, v) => {
      if (!set) return;
      for (const im of set.meshes) {
        im.count = bin.active[v].length;
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
      }
    });
    return taken.map((t) => t.v);
  }

  refill(bin) {
    if (!bin.ready) return;
    bin.active = bin.all.map((l) => l.slice());
    bin.left = bin.total;
    bin.sets.forEach((set, v) => {
      if (!set) return;
      bin.active[v].forEach((p, i) => this.placeInstance(bin, v, i, p));
      for (const im of set.meshes) {
        im.count = bin.active[v].length;
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
      }
    });
  }

  setFocus(bin) {
    if (this.focused && this.focused !== bin) {
      this.setNear(this.focused, false);
      this.focused.lidT = 0;
    }
    this.focused = bin || null;
    if (bin) {
      this.setNear(bin, true);
      bin.lidT = 1;
    }
    this.veilT = bin ? 0.8 : 0;
    if (!bin) return;
    const z = WALL.z + BIN.z0 + BIN.noseZ + 0.9;
    const X0 = -this.width / 2 - 80;
    const X1 = this.width / 2 + 80;
    const Y0 = WALL.y0 - 40;
    const Y1 = WALL.y0 + this.height + 40;
    const x0 = bin.x - WALL.cellW / 2 + 0.2;
    const x1 = bin.x + WALL.cellW / 2 - 0.2;
    const y0 = bin.y + 0.1;
    const y1 = bin.y + WALL.cellH + 5;
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

  pick(ray) {
    const z = WALL.z + BIN.z0 + BIN.frontZ;
    const t = (z - ray.origin.z) / ray.direction.z;
    if (!(t > 0)) return null;
    const x = ray.origin.x + ray.direction.x * t;
    const y = ray.origin.y + ray.direction.y * t;
    const col = Math.floor((x + this.width / 2) / WALL.cellW);
    const rowUp = Math.floor((y - WALL.y0) / WALL.cellH);
    if (col < 0 || col >= this.cols || rowUp < 0 || rowUp >= this.rows) return null;
    const row = this.rows - 1 - rowUp;
    return this.bins[row * this.cols + col] || null;
  }

  overviewRig(aspect, panX = 0) {
    const fitW = this.width + 6;
    const fitH = Math.max(this.height + 6, 60);
    const wide = fitW / fitH;
    if (aspect >= wide * 0.92) return { t: [0, this.center.y, WALL.z + 8], w: fitW, h: fitH, elev: 0, fov: 28, pan: 0 };
    const w = fitH * aspect;
    const pan = Math.max(0, (fitW - w) / 2);
    return { t: [clamp(panX, -pan, pan), this.center.y, WALL.z + 8], w, h: fitH, elev: 0, fov: 28, pan };
  }

  update(dt) {
    let moving = false;
    if (this.queue.length && !this.building) {
      const bin = this.queue.shift();
      this.building = true;
      this.buildBin(bin)
        .catch((e) => {
          console.error('[wall] bin failed', bin.def.id, e);
          bin.broken = true;
        })
        .finally(() => {
          this.building = false;
          this.game.wake();
        });
      moving = true;
    }
    if (this.building) moving = true;
    const vm = this.veil.material;
    if (Math.abs(vm.opacity - this.veilT) > 0.004) {
      vm.opacity = damp(vm.opacity, this.veilT, 7, dt);
      this.veil.visible = vm.opacity > 0.01;
      moving = true;
    }
    for (const b of this.bins) {
      if (Math.abs(b.lid - b.lidT) > 0.002) {
        b.lid = damp(b.lid, b.lidT, 9, dt);
        this.placeLid(b);
        moving = true;
      }
    }
    return moving;
  }

  get loaded() {
    return 1 - (this.queue.length + (this.building ? 1 : 0)) / Math.max(1, this.bins.length);
  }
}
