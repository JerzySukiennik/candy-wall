// Candy pack B shared builders: closed parametric grids, heightfield slabs, thin sheets, ropes, noise and material helpers.
import * as THREE from 'three';
import { detail, merge, meshSDF } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { hashStr } from '../../util.js';

export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function glsl(hex) {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
}

export function blend(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

function share(m) {
  const c = m.userData.candy;
  const p = c && c.opts && c.opts.pattern;
  if (p) {
    const key = `candy-b:${m.transparent ? 1 : 0}:${c.opts.sugar > 0 ? 1 : 0}:${hashStr(p)}`;
    m.customProgramCacheKey = () => key;
  }
  return m;
}

export const M = {};
for (const k of ['gummy', 'hard', 'shell', 'chocolate', 'foam', 'crisp', 'cream', 'liquid', 'wax', 'matte', 'foil']) M[k] = (o) => share(mat[k](o));

function ih(i, j, k) {
  let n = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(k, 1440662683);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function noise3(x, y, z) {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const k = Math.floor(z);
  let fx = x - i;
  let fy = y - j;
  let fz = z - k;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const a = mix(mix(ih(i, j, k), ih(i + 1, j, k), fx), mix(ih(i, j + 1, k), ih(i + 1, j + 1, k), fx), fy);
  const b = mix(mix(ih(i, j, k + 1), ih(i + 1, j, k + 1), fx), mix(ih(i, j + 1, k + 1), ih(i + 1, j + 1, k + 1), fx), fy);
  return mix(a, b, fz);
}

export function fbm3(x, y, z, oct = 3) {
  let a = 0.5;
  let s = 0;
  for (let i = 0; i < oct; i++) {
    s += a * noise3(x, y, z);
    x = x * 2.03 + 11.7;
    y = y * 2.03 + 11.7;
    z = z * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}

function close(pos, idx, uv) {
  let vol = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3;
    const b = idx[t + 1] * 3;
    const c = idx[t + 2] * 3;
    vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) + pos[a + 1] * (pos[b + 2] * pos[c] - pos[b] * pos[c + 2]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (vol < 0)
    for (let t = 0; t < idx.length; t += 3) {
      const s = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = s;
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function grid(rows, segs, fn, opt = {}) {
  const d = detail();
  let list = rows.map((r) => (typeof r === 'number' ? { u: r } : r));
  if (d < 0.75) list = list.filter((r, i) => i === 0 || i === list.length - 1 || r.crease || r.keep || i % 2 === 0);
  const mult = opt.mult || 1;
  const n = Math.max(opt.minSegs || 8, Math.round((segs * d) / mult) * mult);
  const pos = [];
  const uv = opt.uv ? [] : null;
  const starts = [];
  const last = list.length - 1;
  const put = (u, v, side) => {
    const p = fn(u, v);
    pos.push(p[0], p[1], p[2]);
    if (uv) {
      const t = opt.uv(p, u, side);
      uv.push(t[0], t[1]);
    }
  };
  list.forEach((r, k) => {
    if (k === 0 || k === last) {
      starts.push([pos.length / 3, pos.length / 3]);
      put(r.u, 0, k === 0 ? 1 : 0);
      return;
    }
    const a = pos.length / 3;
    for (let j = 0; j < n; j++) put(r.u, j / n, 0);
    let b = a;
    if (r.crease) {
      b = pos.length / 3;
      for (let j = 0; j < n; j++) put(r.u, j / n, 1);
    }
    starts.push([a, b]);
  });
  const idx = [];
  for (let k = 0; k < last; k++) {
    const r0 = starts[k][1];
    const r1 = starts[k + 1][0];
    for (let j = 0; j < n; j++) {
      const j2 = (j + 1) % n;
      if (k === 0) idx.push(r0, r1 + j, r1 + j2);
      else if (k + 1 === last) idx.push(r0 + j, r1, r0 + j2);
      else idx.push(r0 + j, r1 + j, r1 + j2, r0 + j, r1 + j2, r0 + j2);
    }
  }
  return close(pos, idx, uv);
}

export function spin(profile, segs, opt = {}) {
  const rows = profile.map((p, i) => ({ u: i, crease: !!p[2] }));
  const ax = opt.axis === 'x';
  return grid(
    rows,
    segs,
    (u, v) => {
      const p = profile[u];
      const a = v * TAU;
      const q = ax ? [p[1], p[0] * Math.cos(a), p[0] * Math.sin(a)] : [p[0] * Math.cos(a), p[1], p[0] * Math.sin(a)];
      return opt.warp ? opt.warp(q, a, u) : q;
    },
    opt
  );
}

export function ball(r, segs, rings, warp) {
  const rows = [];
  for (let k = 0; k <= rings; k++) rows.push(k / rings);
  return grid(rows, segs, (u, v) => {
    const lat = -Math.PI / 2 + Math.PI * u;
    const a = v * TAU;
    const dir = [Math.cos(lat) * Math.cos(a), Math.sin(lat), Math.cos(lat) * Math.sin(a)];
    const w = warp ? warp(dir, lat, a) : r;
    return Array.isArray(w) ? w : [dir[0] * w, dir[1] * w, dir[2] * w];
  });
}

export function roundBox(hx, hy, hz, n, segs, rings, warp) {
  return ball(1, segs, rings, (d) => {
    const k = Math.pow(Math.abs(d[0]) ** n + Math.abs(d[1]) ** n + Math.abs(d[2]) ** n, -1 / n);
    const p = [d[0] * k * hx, d[1] * k * hy, d[2] * k * hz];
    return warp ? warp(p) : p;
  });
}

export function sheet(outline, rings, segs, height, thick, opt = {}) {
  const e = opt.edge ?? 0.06;
  const rows = [];
  for (let k = 0; k < rings; k++) rows.push(k / rings);
  rows.push(1 - e, 1.5, 2 + e);
  for (let k = rings - 1; k >= 0; k--) rows.push(3 - k / rings);
  return grid(
    rows,
    segs,
    (u, v) => {
      const a = v * TAU;
      const rho = u <= 1 ? u : u < 2 ? 1 : 3 - u;
      const side = u <= 1 ? 1 : u < 2 ? 0 : -1;
      const r = outline(a) * rho;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      return [x, height(x, z) + side * thick * 0.5, z];
    },
    opt
  );
}

export function slab(xs, zs, top, y0) {
  const d = detail();
  const thin = (a) => (d < 0.75 ? a.filter((_, i) => i === 0 || i === a.length - 1 || i % 2 === 0) : a);
  const X = thin(xs);
  const Z = thin(zs);
  const nx = X.length;
  const nz = Z.length;
  const pos = [];
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) pos.push(X[i], top(X[i], Z[k]), Z[k]);
  const idx = [];
  for (let k = 0; k < nz - 1; k++)
    for (let i = 0; i < nx - 1; i++) {
      const a = k * nx + i;
      const b = a + 1;
      const c = a + nx;
      idx.push(a, c, b, b, c, c + 1);
    }
  const topG = new THREE.BufferGeometry();
  topG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  topG.setIndex(idx);
  topG.computeVertexNormals();
  const sp = [];
  const sn = [];
  const tri = (a, b, c, n) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const f = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2];
    const o = f >= 0 ? [a, b, c] : [a, c, b];
    for (const p of o) {
      sp.push(p[0], p[1], p[2]);
      sn.push(n[0], n[1], n[2]);
    }
  };
  const at = (i, k) => [X[i], pos[(k * nx + i) * 3 + 1], Z[k]];
  const wall = (p, q, n) => {
    const p0 = [p[0], y0, p[2]];
    const q0 = [q[0], y0, q[2]];
    tri(p, q, q0, n);
    tri(p, q0, p0, n);
    tri(p0, q0, [(X[0] + X[nx - 1]) / 2, y0, (Z[0] + Z[nz - 1]) / 2], [0, -1, 0]);
  };
  for (let i = 0; i < nx - 1; i++) {
    wall(at(i, 0), at(i + 1, 0), [0, 0, -1]);
    wall(at(i, nz - 1), at(i + 1, nz - 1), [0, 0, 1]);
  }
  for (let k = 0; k < nz - 1; k++) {
    wall(at(0, k), at(0, k + 1), [-1, 0, 0]);
    wall(at(nx - 1, k), at(nx - 1, k + 1), [1, 0, 0]);
  }
  const side = new THREE.BufferGeometry();
  side.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  side.setAttribute('normal', new THREE.Float32BufferAttribute(sn, 3));
  return merge([topG, side]);
}

export function lines(from, to, step) {
  const n = Math.max(1, Math.round((to - from) / step));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(from + ((to - from) * i) / n);
  return out;
}

function blendMin(a, b, k) {
  if (k <= 0 || a === Infinity || b === Infinity) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export function rope(points, radius, opt = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  const n = opt.samples || points.length * 6;
  const pts = curve.getSpacedPoints(n);
  const rad = pts.map((_, i) => (typeof radius === 'function' ? radius(i / n) : radius));
  const cuts = (opt.parts || []).map((t) => Math.round(t * n));
  const k = opt.k || 0;
  const f = (x, y, z) => {
    let best = Infinity;
    let all = Infinity;
    let part = 0;
    for (let i = 0; i < n; i++) {
      if (part < cuts.length && i === cuts[part]) {
        all = blendMin(all, best, k);
        best = Infinity;
        part++;
      }
      const a = pts[i];
      const b = pts[i + 1];
      const pax = x - a.x, pay = y - a.y, paz = z - a.z;
      const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
      const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz || 1));
      const dd = Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (rad[i] + (rad[i + 1] - rad[i]) * h);
      if (dd < best) best = dd;
    }
    return blendMin(all, best, k);
  };
  const pad = Math.max(...rad) + (opt.pad ?? 0.3);
  const bb = new THREE.Box3().setFromPoints(pts).expandByScalar(pad);
  return { f, min: bb.min.toArray(), max: bb.max.toArray(), pts: pts.map((q) => [q.x, q.y, q.z]) };
}

export function solid(f, min, max, cell) {
  const e = cell / detail();
  const lo = [min[0] - e, min[1] - e, min[2] - e];
  const hi = [max[0] + e, max[1] + e, max[2] + e];
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  return meshSDF(f, { min: lo, max: hi, res: Math.max(8, Math.round(span / cell)) });
}

function pinch(g) {
  const idx = g.index.array;
  const P = g.attributes.position.array;
  const seen = new Map();
  const bad = [];
  for (let t = 0; t < idx.length; t += 3)
    for (let e = 0; e < 3; e++) {
      const u = idx[t + e];
      const w = idx[t + ((e + 1) % 3)];
      const key = u * 16777216 + w;
      const n = (seen.get(key) || 0) + 1;
      seen.set(key, n);
      if (n === 2) bad.push([(P[u * 3] + P[w * 3]) / 2, (P[u * 3 + 1] + P[w * 3 + 1]) / 2, (P[u * 3 + 2] + P[w * 3 + 2]) / 2]);
    }
  return bad;
}

export function seal(f, min, max, cell, tries = 5) {
  let fn = f;
  let g = null;
  const r = (cell / detail()) * 1.05;
  for (let t = 0; t <= tries; t++) {
    g = solid(fn, min, max, cell);
    const bad = pinch(g);
    if (!bad.length) break;
    const prev = fn;
    fn = (x, y, z) => {
      let d = prev(x, y, z);
      for (const b of bad) d = Math.min(d, Math.hypot(x - b[0], y - b[1], z - b[2]) - r);
      return d;
    };
  }
  return g;
}

export function facet(g) {
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

export function recentre(g) {
  g.computeBoundingBox();
  const c = g.boundingBox.getCenter(new THREE.Vector3());
  g.translate(-c.x, -c.y, -c.z);
  return g;
}

export const GRAIN = `vec3 candyPattern(vec3 p, vec3 base) {
  return base * (0.9 + 0.24 * cFbm(p * 9.0));
}`;

export const PORES = `vec3 candyPattern(vec3 p, vec3 base) {
  float n = cNoise(p * 34.0);
  float m = cFbm(p * 7.0);
  return base * (0.86 + 0.2 * m) * (1.0 - 0.3 * smoothstep(0.62, 0.9, n));
}`;

export function centreAll(list) {
  const box = new THREE.Box3();
  for (const g of list) {
    g.computeBoundingBox();
    box.union(g.boundingBox);
  }
  const c = box.getCenter(new THREE.Vector3());
  for (const g of list) g.translate(-c.x, -c.y, -c.z);
  return [c.x, c.y, c.z];
}
