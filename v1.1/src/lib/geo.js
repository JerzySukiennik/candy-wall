// Candy Wall: geometry toolkit for candies: SDF primitives and mesher, welding, watertight validation, small helpers.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const hyp = Math.hypot;
const mx = Math.max;
const mn = Math.min;

export const S2 = {
  circle: (r) => (x, y) => hyp(x, y) - r,
  box: (hx, hy, r = 0) => (x, y) => {
    const qx = Math.abs(x) - hx + r;
    const qy = Math.abs(y) - hy + r;
    return hyp(mx(qx, 0), mx(qy, 0)) + mn(mx(qx, qy), 0) - r;
  },
  segment: (ax, ay, bx, by, r) => (x, y) => {
    const pax = x - ax;
    const pay = y - ay;
    const bax = bx - ax;
    const bay = by - ay;
    const h = mx(0, mn(1, (pax * bax + pay * bay) / (bax * bax + bay * bay || 1)));
    return hyp(pax - bax * h, pay - bay * h) - r;
  },
  polygon: (pts) => (x, y) => {
    const n = pts.length;
    let d = Infinity;
    let s = 1;
    for (let i = 0, j = n - 1; i < n; j = i, i++) {
      const ex = pts[j][0] - pts[i][0];
      const ey = pts[j][1] - pts[i][1];
      const wx = x - pts[i][0];
      const wy = y - pts[i][1];
      const t = mx(0, mn(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
      const bx = wx - ex * t;
      const by = wy - ey * t;
      d = mn(d, bx * bx + by * by);
      const c1 = y >= pts[i][1];
      const c2 = y < pts[j][1];
      const c3 = ex * wy > ey * wx;
      if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
    }
    return s * Math.sqrt(d);
  },
  star: (r, n, inner) => {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 ? r * inner : r;
      pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    return S2.polygon(pts);
  },
  heart: (r) => (x, y) => {
    const px = Math.abs(x) / r;
    const py = y / r + 0.55;
    let d;
    if (py + px > 1) d = hyp(px - 0.25, py - 0.75) - Math.SQRT2 / 4;
    else {
      const a = px * px + (py - 1) * (py - 1);
      const m = 0.5 * mx(px + py, 0);
      const b = (px - m) * (px - m) + (py - m) * (py - m);
      d = Math.sqrt(mn(a, b)) * Math.sign(px - py);
    }
    return d * r;
  },
  union: (...f) => (x, y) => {
    let d = Infinity;
    for (const g of f) d = mn(d, g(x, y));
    return d;
  },
  smooth: (k, ...f) => (x, y) => {
    let d = f[0](x, y);
    for (let i = 1; i < f.length; i++) d = smin(d, f[i](x, y), k);
    return d;
  },
  sub: (a, b) => (x, y) => mx(a(x, y), -b(x, y)),
  move: (f, tx, ty) => (x, y) => f(x - tx, y - ty),
  rot: (f, a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return (x, y) => f(c * x + s * y, -s * x + c * y);
  },
  round: (f, r) => (x, y) => f(x, y) - r,
  mirrorX: (f) => (x, y) => f(Math.abs(x), y),
};

function smin(a, b, k) {
  if (k <= 0) return mn(a, b);
  const h = mx(k - Math.abs(a - b), 0) / k;
  return mn(a, b) - h * h * k * 0.25;
}

function smax(a, b, k) {
  return -smin(-a, -b, k);
}

export const S = {
  sphere: (r) => (x, y, z) => hyp(x, y, z) - r,
  ellipsoid: (rx, ry, rz) => (x, y, z) => {
    const k0 = hyp(x / rx, y / ry, z / rz);
    const k1 = hyp(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -mn(rx, ry, rz);
  },
  box: (hx, hy, hz, r = 0) => (x, y, z) => {
    const qx = Math.abs(x) - hx + r;
    const qy = Math.abs(y) - hy + r;
    const qz = Math.abs(z) - hz + r;
    return hyp(mx(qx, 0), mx(qy, 0), mx(qz, 0)) + mn(mx(qx, qy, qz), 0) - r;
  },
  cylinder: (r, h, round = 0) => (x, y, z) => {
    const dx = hyp(x, z) - r + round;
    const dy = Math.abs(y) - h + round;
    return mn(mx(dx, dy), 0) + hyp(mx(dx, 0), mx(dy, 0)) - round;
  },
  capsule: (a, b, r) => (x, y, z) => {
    const pax = x - a[0];
    const pay = y - a[1];
    const paz = z - a[2];
    const bax = b[0] - a[0];
    const bay = b[1] - a[1];
    const baz = b[2] - a[2];
    const h = mx(0, mn(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz || 1)));
    return hyp(pax - bax * h, pay - bay * h, paz - baz * h) - r;
  },
  cone: (r1, r2, h) => (x, y, z) => {
    const q = hyp(x, z);
    const k = (y + h) / (2 * h);
    const rr = r1 + (r2 - r1) * mx(0, mn(1, k));
    const side = (q - rr) * Math.cos(Math.atan2(r1 - r2, 2 * h));
    const cap = Math.abs(y) - h;
    return mn(mx(side, cap), 0) + hyp(mx(side, 0), mx(cap, 0));
  },
  torus: (R, r) => (x, y, z) => hyp(hyp(x, z) - R, y) - r,
  plane: (nx, ny, nz, d = 0) => (x, y, z) => x * nx + y * ny + z * nz - d,
  union: (...f) => (x, y, z) => {
    let d = Infinity;
    for (const g of f) d = mn(d, g(x, y, z));
    return d;
  },
  inter: (...f) => (x, y, z) => {
    let d = -Infinity;
    for (const g of f) d = mx(d, g(x, y, z));
    return d;
  },
  sub: (a, b) => (x, y, z) => mx(a(x, y, z), -b(x, y, z)),
  smooth: (k, ...f) => (x, y, z) => {
    let d = f[0](x, y, z);
    for (let i = 1; i < f.length; i++) d = smin(d, f[i](x, y, z), k);
    return d;
  },
  smoothSub: (k, a, b) => (x, y, z) => smax(a(x, y, z), -b(x, y, z), k),
  smoothInter: (k, a, b) => (x, y, z) => smax(a(x, y, z), b(x, y, z), k),
  move: (f, tx, ty, tz) => (x, y, z) => f(x - tx, y - ty, z - tz),
  scale: (f, sx, sy = sx, sz = sx) => {
    const m = mn(sx, sy, sz);
    return (x, y, z) => f(x / sx, y / sy, z / sz) * m;
  },
  rotX: (f, a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return (x, y, z) => f(x, c * y + s * z, -s * y + c * z);
  },
  rotY: (f, a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return (x, y, z) => f(c * x - s * z, y, s * x + c * z);
  },
  rotZ: (f, a) => {
    const c = Math.cos(a);
    const s = Math.sin(a);
    return (x, y, z) => f(c * x + s * y, -s * x + c * y, z);
  },
  mirror: (f, axis = 'x') => (axis === 'x' ? (x, y, z) => f(Math.abs(x), y, z) : axis === 'y' ? (x, y, z) => f(x, Math.abs(y), z) : (x, y, z) => f(x, y, Math.abs(z))),
  twist: (f, k) => (x, y, z) => {
    const c = Math.cos(k * y);
    const s = Math.sin(k * y);
    return f(c * x - s * z, y, s * x + c * z) * 0.7;
  },
  round: (f, r) => (x, y, z) => f(x, y, z) - r,
  shell: (f, t) => (x, y, z) => Math.abs(f(x, y, z)) - t,
  displace: (f, g) => (x, y, z) => f(x, y, z) + g(x, y, z),
  revolve: (f2) => (x, y, z) => f2(hyp(x, z), y),
  extrude: (f2, h, round = 0) => (x, y, z) => {
    const d = f2(x, y) + round;
    const w = Math.abs(z) - h + round;
    return mn(mx(d, w), 0) + hyp(mx(d, 0), mx(w, 0)) - round;
  },
  pillow: (f2, h, edge) => (x, y, z) => {
    const d = f2(x, y);
    const t = h * Math.sqrt(mx(0, mn(1, -d / edge)));
    return mx(d, Math.abs(z) - t) * 0.6;
  },
  dome: (f2, h, edge, base = 0) => (x, y, z) => {
    const d = f2(x, y);
    const t = base + (h - base) * Math.sqrt(mx(0, mn(1, -d / edge)));
    return mx(d, mx(-z, z - t)) * 0.6;
  },
};

const CORNER = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];
const EDGE = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];

let DETAIL = 1;

export function setDetail(d) {
  DETAIL = d;
}

export function detail() {
  return DETAIL;
}

export function meshSDF(f, opt = {}) {
  const min = opt.min;
  const max = opt.max;
  const res = mx(8, Math.round((opt.res || 32) * DETAIL));
  const sx = max[0] - min[0];
  const sy = max[1] - min[1];
  const sz = max[2] - min[2];
  const h = mx(sx, sy, sz) / res;
  const nx = mx(3, Math.ceil(sx / h) + 1);
  const ny = mx(3, Math.ceil(sy / h) + 1);
  const nz = mx(3, Math.ceil(sz / h) + 1);
  const val = new Float32Array(nx * ny * nz);
  let p = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[p++] = f(min[0] + i * h, min[1] + j * h, min[2] + k * h);
  const cx = nx - 1;
  const cy = ny - 1;
  const cz = nz - 1;
  const cell = new Int32Array(cx * cy * cz).fill(-1);
  const pos = [];
  const v = new Float32Array(8);
  for (let k = 0; k < cz; k++)
    for (let j = 0; j < cy; j++)
      for (let i = 0; i < cx; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const o = CORNER[c];
          const q = val[i + o[0] + nx * (j + o[1] + ny * (k + o[2]))];
          v[c] = q;
          if (q < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let ax = 0;
        let ay = 0;
        let az = 0;
        let n = 0;
        for (let e = 0; e < 12; e++) {
          const a = EDGE[e][0];
          const b = EDGE[e][1];
          if (v[a] < 0 === v[b] < 0) continue;
          const t = v[a] / (v[a] - v[b]);
          ax += CORNER[a][0] + (CORNER[b][0] - CORNER[a][0]) * t;
          ay += CORNER[a][1] + (CORNER[b][1] - CORNER[a][1]) * t;
          az += CORNER[a][2] + (CORNER[b][2] - CORNER[a][2]) * t;
          n++;
        }
        cell[i + cx * (j + cy * k)] = pos.length / 3;
        pos.push(min[0] + (i + ax / n) * h, min[1] + (j + ay / n) * h, min[2] + (k + az / n) * h);
      }
  const ind = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) ind.push(a, c, b, a, d, c);
    else ind.push(a, b, c, a, c, d);
  };
  const ci = (i, j, k) => cell[i + cx * (j + cy * k)];
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const v0 = val[i + nx * (j + ny * k)];
        if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
          const v1 = val[i + 1 + nx * (j + ny * k)];
          if (v0 < 0 !== v1 < 0) quad(ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k), v0 >= 0);
        }
        if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
          const v1 = val[i + nx * (j + 1 + ny * k)];
          if (v0 < 0 !== v1 < 0) quad(ci(i - 1, j, k - 1), ci(i - 1, j, k), ci(i, j, k), ci(i, j, k - 1), v0 >= 0);
        }
        if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
          const v1 = val[i + nx * (j + ny * (k + 1))];
          if (v0 < 0 !== v1 < 0) quad(ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k), v0 >= 0);
        }
      }
  const nor = new Float32Array(pos.length);
  const e = h * 0.5;
  for (let i = 0; i < pos.length; i += 3) {
    const x = pos[i];
    const y = pos[i + 1];
    const z = pos[i + 2];
    const gx = f(x + e, y, z) - f(x - e, y, z);
    const gy = f(x, y + e, z) - f(x, y - e, z);
    const gz = f(x, y, z + e) - f(x, y, z - e);
    const l = hyp(gx, gy, gz) || 1;
    nor[i] = gx / l;
    nor[i + 1] = gy / l;
    nor[i + 2] = gz / l;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(ind);
  return g;
}

export function weldIds(pos, count, tol = 2e-4) {
  const ids = new Uint32Array(count);
  const rep = [];
  const grid = new Map();
  const q = tol * 2;
  for (let i = 0; i < count; i++) {
    const x = pos[i * 3];
    const y = pos[i * 3 + 1];
    const z = pos[i * 3 + 2];
    const cxi = Math.floor(x / q);
    const cyi = Math.floor(y / q);
    const czi = Math.floor(z / q);
    let found = -1;
    for (let a = -1; a <= 1 && found < 0; a++)
      for (let b = -1; b <= 1 && found < 0; b++)
        for (let c = -1; c <= 1 && found < 0; c++) {
          const list = grid.get((cxi + a) * 73856093 ^ (cyi + b) * 19349663 ^ (czi + c) * 83492791);
          if (!list) continue;
          for (const r of list) {
            if (Math.abs(rep[r * 3] - x) <= tol && Math.abs(rep[r * 3 + 1] - y) <= tol && Math.abs(rep[r * 3 + 2] - z) <= tol) {
              found = r;
              break;
            }
          }
        }
    if (found < 0) {
      found = rep.length / 3;
      rep.push(x, y, z);
      const key = cxi * 73856093 ^ cyi * 19349663 ^ czi * 83492791;
      const list = grid.get(key);
      if (list) list.push(found);
      else grid.set(key, [found]);
    }
    ids[i] = found;
  }
  return { ids, rep, unique: rep.length / 3 };
}

export function validate(geometry) {
  const pa = geometry.attributes.position;
  const { ids } = weldIds(pa.array, pa.count);
  const index = geometry.index ? geometry.index.array : null;
  const tris = index ? index.length / 3 : pa.count / 3;
  const edges = new Map();
  let degenerate = 0;
  let volume = 0;
  const P = pa.array;
  for (let t = 0; t < tris; t++) {
    const i0 = index ? index[t * 3] : t * 3;
    const i1 = index ? index[t * 3 + 1] : t * 3 + 1;
    const i2 = index ? index[t * 3 + 2] : t * 3 + 2;
    const a = ids[i0];
    const b = ids[i1];
    const c = ids[i2];
    if (a === b || b === c || a === c) {
      degenerate++;
      continue;
    }
    for (const [u, w] of [[a, b], [b, c], [c, a]]) {
      const k = u * 4294967296 + w;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
    const ax = P[i0 * 3], ay = P[i0 * 3 + 1], az = P[i0 * 3 + 2];
    const bx = P[i1 * 3], by = P[i1 * 3 + 1], bz = P[i1 * 3 + 2];
    const cx = P[i2 * 3], cy = P[i2 * 3 + 1], cz = P[i2 * 3 + 2];
    volume += (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  }
  let open = 0;
  let nonManifold = 0;
  for (const [k, n] of edges) {
    const u = Math.floor(k / 4294967296);
    const w = k - u * 4294967296;
    const back = edges.get(w * 4294967296 + u) || 0;
    if (n > 1) nonManifold++;
    else if (back === 0) open++;
  }
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const size = [bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z].map((s) => Math.round(s * 100) / 100);
  return { tris, degenerate, open, nonManifold, watertight: open === 0 && nonManifold === 0, volume: Math.round(volume * 100) / 100, size };
}

export function ensureRest(geometry) {
  if (!geometry.attributes.rest) geometry.setAttribute('rest', geometry.attributes.position.clone());
  return geometry;
}

export function tint(geometry, fn) {
  const p = geometry.attributes.position;
  const col = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const r = fn(p.getX(i), p.getY(i), p.getZ(i), i);
    if (r && r.isColor) c.copy(r);
    else if (Array.isArray(r)) c.setRGB(r[0], r[1], r[2]);
    else c.set(r);
    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geometry;
}

export function bake(geometry, { move, rotate, scale } = {}) {
  if (scale) Array.isArray(scale) ? geometry.scale(scale[0], scale[1], scale[2]) : geometry.scale(scale, scale, scale);
  if (rotate) {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotate[0], rotate[1], rotate[2]));
    geometry.applyMatrix4(m);
  }
  if (move) geometry.translate(move[0], move[1], move[2]);
  return geometry;
}

export function merge(list) {
  const clean = list.map((g) => {
    const c = g.index ? g.toNonIndexed() : g.clone();
    for (const k of Object.keys(c.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) c.deleteAttribute(k);
    return c;
  });
  const hasUv = clean.every((g) => g.attributes.uv);
  const hasCol = clean.some((g) => g.attributes.color);
  for (const g of clean) {
    if (!hasUv && g.attributes.uv) g.deleteAttribute('uv');
    if (hasCol && !g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  }
  return mergeGeometries(clean, false);
}

export function lathe(profile, segments = 32) {
  const pts = profile.map((p) => new THREE.Vector2(Math.max(0, p[0]), p[1]));
  return new THREE.LatheGeometry(pts, mx(8, Math.round(segments * DETAIL)));
}

export function extrude(points, depth, bevel = 0, bevelSegments = 4, curveSegments = 16) {
  const shape = points.isShape ? points : new THREE.Shape(points.map((p) => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments, curveSegments });
  g.translate(0, 0, -(depth - bevel * 2) / 2);
  return g;
}

export function tube(points, radius, res = 40) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
  const samples = curve.getSpacedPoints(Math.max(8, points.length * 6));
  const sd = (x, y, z) => {
    let d = Infinity;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      const pax = x - a.x, pay = y - a.y, paz = z - a.z;
      const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z;
      const h = mx(0, mn(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz || 1)));
      d = mn(d, hyp(pax - bax * h, pay - bay * h, paz - baz * h));
    }
    return d - radius;
  };
  const bb = new THREE.Box3().setFromPoints(samples).expandByScalar(radius * 1.5);
  return meshSDF(sd, { min: bb.min.toArray(), max: bb.max.toArray(), res });
}
