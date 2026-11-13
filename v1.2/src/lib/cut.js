// Candy Wall: plane cutting of closed triangle meshes with cap generation, on triangle soups with material groups.
import * as THREE from 'three';
import { weldIds } from './geo.js';

export const GRP_SURFACE = 0;
export const GRP_CAP = 1;
export const GRP_CAVITY = 2;

const EPS = 1e-5;
const KEYQ = 1e4;

export class Soup {
  constructor(hasUv = false, hasCol = false) {
    this.pos = [];
    this.nor = [];
    this.rest = [];
    this.uv = hasUv ? [] : null;
    this.col = hasCol ? [] : null;
    this.grp = [];
  }

  get count() {
    return this.grp.length;
  }

  like() {
    return new Soup(!!this.uv, !!this.col);
  }
}

function copyVert(dst, src, i) {
  const a = i * 3;
  dst.pos.push(src.pos[a], src.pos[a + 1], src.pos[a + 2]);
  dst.nor.push(src.nor[a], src.nor[a + 1], src.nor[a + 2]);
  dst.rest.push(src.rest[a], src.rest[a + 1], src.rest[a + 2]);
  if (dst.uv) dst.uv.push(src.uv[i * 2], src.uv[i * 2 + 1]);
  if (dst.col) dst.col.push(src.col[a], src.col[a + 1], src.col[a + 2]);
}

function pushRec(dst, r) {
  dst.pos.push(r.px, r.py, r.pz);
  dst.nor.push(r.nx, r.ny, r.nz);
  dst.rest.push(r.rx, r.ry, r.rz);
  if (dst.uv) dst.uv.push(r.u, r.v);
  if (dst.col) dst.col.push(r.cr, r.cg, r.cb);
}

function lerpRec(src, i, j, t) {
  const a = i * 3;
  const b = j * 3;
  const L = (arr, o) => arr[a + o] + (arr[b + o] - arr[a + o]) * t;
  let nx = L(src.nor, 0);
  let ny = L(src.nor, 1);
  let nz = L(src.nor, 2);
  const l = Math.hypot(nx, ny, nz) || 1;
  nx /= l;
  ny /= l;
  nz /= l;
  const r = { px: L(src.pos, 0), py: L(src.pos, 1), pz: L(src.pos, 2), nx, ny, nz, rx: L(src.rest, 0), ry: L(src.rest, 1), rz: L(src.rest, 2), u: 0, v: 0, cr: 1, cg: 1, cb: 1 };
  if (src.uv) {
    r.u = src.uv[i * 2] + (src.uv[j * 2] - src.uv[i * 2]) * t;
    r.v = src.uv[i * 2 + 1] + (src.uv[j * 2 + 1] - src.uv[i * 2 + 1]) * t;
  }
  if (src.col) {
    r.cr = L(src.col, 0);
    r.cg = L(src.col, 1);
    r.cb = L(src.col, 2);
  }
  return r;
}

export function soupFromGeometry(geometry, grp = GRP_SURFACE, flip = false, into = null) {
  const pa = geometry.attributes.position;
  const na = geometry.attributes.normal;
  const ua = geometry.attributes.uv;
  const ca = geometry.attributes.color;
  const ra = geometry.attributes.rest || pa;
  const out = into || new Soup(!!ua, !!ca);
  const { ids, rep } = weldIds(pa.array, pa.count);
  const index = geometry.index ? geometry.index.array : null;
  const tris = index ? index.length / 3 : pa.count / 3;
  const shift = pa === ra;
  for (let t = 0; t < tris; t++) {
    let i0 = index ? index[t * 3] : t * 3;
    let i1 = index ? index[t * 3 + 1] : t * 3 + 1;
    let i2 = index ? index[t * 3 + 2] : t * 3 + 2;
    if (ids[i0] === ids[i1] || ids[i1] === ids[i2] || ids[i0] === ids[i2]) continue;
    if (flip) {
      const s = i1;
      i1 = i2;
      i2 = s;
    }
    for (const i of [i0, i1, i2]) {
      const r = ids[i] * 3;
      out.pos.push(rep[r], rep[r + 1], rep[r + 2]);
      const sgn = flip ? -1 : 1;
      if (na) out.nor.push(na.getX(i) * sgn, na.getY(i) * sgn, na.getZ(i) * sgn);
      else out.nor.push(0, 1, 0);
      if (shift) out.rest.push(rep[r], rep[r + 1], rep[r + 2]);
      else out.rest.push(ra.getX(i), ra.getY(i), ra.getZ(i));
      if (out.uv) ua ? out.uv.push(ua.getX(i), ua.getY(i)) : out.uv.push(0, 0);
      if (out.col) ca ? out.col.push(ca.getX(i), ca.getY(i), ca.getZ(i)) : out.col.push(1, 1, 1);
    }
    out.grp.push(grp);
  }
  return out;
}

export function splitSoup(soup, n, d, capGrp = GRP_CAP) {
  const A = soup.like();
  const B = soup.like();
  const nx = n.x;
  const ny = n.y;
  const nz = n.z;
  const P = soup.pos;
  const cut = { pos: [], rest: [], col: [], key: new Map() };
  const segs = [];
  const dist = (i) => {
    const s = P[i * 3] * nx + P[i * 3 + 1] * ny + P[i * 3 + 2] * nz - d;
    return Math.abs(s) < EPS ? EPS : s;
  };
  const cutVert = (r) => {
    const k = Math.round(r.px * KEYQ) + ',' + Math.round(r.py * KEYQ) + ',' + Math.round(r.pz * KEYQ);
    let id = cut.key.get(k);
    if (id === undefined) {
      id = cut.pos.length / 3;
      cut.key.set(k, id);
      cut.pos.push(r.px, r.py, r.pz);
      cut.rest.push(r.rx, r.ry, r.rz);
      cut.col.push(r.cr, r.cg, r.cb);
    }
    return id;
  };
  const edgePoint = (i, j, si, sj) => (si > 0 ? lerpRec(soup, i, j, si / (si - sj)) : lerpRec(soup, j, i, sj / (sj - si)));
  const tris = soup.count;
  for (let t = 0; t < tris; t++) {
    const b = t * 3;
    const s0 = dist(b);
    const s1 = dist(b + 1);
    const s2 = dist(b + 2);
    const g = soup.grp[t];
    if (s0 > 0 && s1 > 0 && s2 > 0) {
      copyVert(A, soup, b);
      copyVert(A, soup, b + 1);
      copyVert(A, soup, b + 2);
      A.grp.push(g);
      continue;
    }
    if (s0 < 0 && s1 < 0 && s2 < 0) {
      copyVert(B, soup, b);
      copyVert(B, soup, b + 1);
      copyVert(B, soup, b + 2);
      B.grp.push(g);
      continue;
    }
    let i0 = b;
    let i1 = b + 1;
    let i2 = b + 2;
    let a0 = s0;
    let a1 = s1;
    let a2 = s2;
    if (s1 > 0 !== s0 > 0 && s1 > 0 !== s2 > 0) {
      i0 = b + 1;
      i1 = b + 2;
      i2 = b;
      a0 = s1;
      a1 = s2;
      a2 = s0;
    } else if (s2 > 0 !== s0 > 0 && s2 > 0 !== s1 > 0) {
      i0 = b + 2;
      i1 = b;
      i2 = b + 1;
      a0 = s2;
      a1 = s0;
      a2 = s1;
    }
    const p = edgePoint(i0, i1, a0, a1);
    const q = edgePoint(i0, i2, a0, a2);
    const lone = a0 > 0 ? A : B;
    const pair = a0 > 0 ? B : A;
    copyVert(lone, soup, i0);
    pushRec(lone, p);
    pushRec(lone, q);
    lone.grp.push(g);
    pushRec(pair, p);
    copyVert(pair, soup, i1);
    copyVert(pair, soup, i2);
    pair.grp.push(g);
    pushRec(pair, p);
    copyVert(pair, soup, i2);
    pushRec(pair, q);
    pair.grp.push(g);
    const e1x = P[i1 * 3] - P[i0 * 3];
    const e1y = P[i1 * 3 + 1] - P[i0 * 3 + 1];
    const e1z = P[i1 * 3 + 2] - P[i0 * 3 + 2];
    const e2x = P[i2 * 3] - P[i0 * 3];
    const e2y = P[i2 * 3 + 1] - P[i0 * 3 + 1];
    const e2z = P[i2 * 3 + 2] - P[i0 * 3 + 2];
    const tx = e1y * e2z - e1z * e2y;
    const ty = e1z * e2x - e1x * e2z;
    const tz = e1x * e2y - e1y * e2x;
    const dx = ty * nz - tz * ny;
    const dy = tz * nx - tx * nz;
    const dz = tx * ny - ty * nx;
    const ip = cutVert(p);
    const iq = cutVert(q);
    if (ip === iq) continue;
    if ((q.px - p.px) * dx + (q.py - p.py) * dy + (q.pz - p.pz) * dz > 0) segs.push(ip, iq);
    else segs.push(iq, ip);
  }
  if (!A.count || !B.count) return { a: A.count ? A : null, b: B.count ? B : null, loops: 0 };
  const loops = stitch(segs, cut.pos);
  const count = fillCaps(loops, cut, n, A, B, capGrp);
  return { a: A, b: B, loops: count };
}

function stitch(segs, pos) {
  const out = new Map();
  const used = new Uint8Array(segs.length / 2);
  for (let s = 0; s < segs.length; s += 2) {
    const l = out.get(segs[s]);
    if (l) l.push(s);
    else out.set(segs[s], [s]);
  }
  const loops = [];
  for (let s = 0; s < segs.length; s += 2) {
    if (used[s / 2]) continue;
    const loop = [];
    let cur = s;
    const start = segs[s];
    let guard = 0;
    while (cur >= 0 && guard++ < 100000) {
      used[cur / 2] = 1;
      loop.push(segs[cur]);
      const end = segs[cur + 1];
      if (end === start) {
        cur = -2;
        break;
      }
      let next = -1;
      const cand = out.get(end);
      if (cand) for (const c of cand) if (!used[c / 2]) {
        next = c;
        break;
      }
      if (next < 0) {
        let best = 4e-3;
        for (let c = 0; c < segs.length; c += 2) {
          if (used[c / 2]) continue;
          const a = segs[c] * 3;
          const e = end * 3;
          const dd = Math.hypot(pos[a] - pos[e], pos[a + 1] - pos[e + 1], pos[a + 2] - pos[e + 2]);
          if (dd < best) {
            best = dd;
            next = c;
          }
        }
        if (next < 0) {
          const a = start * 3;
          const e = end * 3;
          if (Math.hypot(pos[a] - pos[e], pos[a + 1] - pos[e + 1], pos[a + 2] - pos[e + 2]) < 0.02) cur = -2;
          else loop.push(end);
          break;
        }
      }
      cur = next;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

function fillCaps(loops, cut, n, A, B, capGrp) {
  const u = new THREE.Vector3();
  if (Math.abs(n.x) < 0.8) u.set(1, 0, 0);
  else u.set(0, 1, 0);
  u.addScaledVector(n, -u.dot(n)).normalize();
  const v = new THREE.Vector3().crossVectors(n, u);
  const P = cut.pos;
  const polys = loops.map((ids) => {
    const pts = ids.map((i) => new THREE.Vector2(P[i * 3] * u.x + P[i * 3 + 1] * u.y + P[i * 3 + 2] * u.z, P[i * 3] * v.x + P[i * 3 + 1] * v.y + P[i * 3 + 2] * v.z));
    let area = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i++) area += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    return { ids, pts, area: area / 2, holes: [] };
  });
  const outers = polys.filter((p) => p.area < -1e-7).sort((a, b) => a.area - b.area);
  const holes = polys.filter((p) => p.area > 1e-7);
  const inside = (pt, poly) => {
    let c = false;
    const q = poly.pts;
    for (let i = 0, j = q.length - 1; i < q.length; j = i, i++) if (q[i].y > pt.y !== q[j].y > pt.y && pt.x < ((q[j].x - q[i].x) * (pt.y - q[i].y)) / (q[j].y - q[i].y) + q[i].x) c = !c;
    return c;
  };
  for (const h of holes) {
    let best = null;
    for (const o of outers) if (-o.area > h.area && inside(h.pts[0], o) && (!best || -o.area < -best.area)) best = o;
    if (best) best.holes.push(h);
  }
  const emit = (dst, ia, ib, ic, sign) => {
    for (const i of [ia, ib, ic]) {
      const a = i * 3;
      dst.pos.push(P[a], P[a + 1], P[a + 2]);
      dst.nor.push(n.x * sign, n.y * sign, n.z * sign);
      dst.rest.push(cut.rest[a], cut.rest[a + 1], cut.rest[a + 2]);
      if (dst.uv) dst.uv.push((P[a] * u.x + P[a + 1] * u.y + P[a + 2] * u.z) * 0.25, (P[a] * v.x + P[a + 1] * v.y + P[a + 2] * v.z) * 0.25);
      if (dst.col) dst.col.push(cut.col[a], cut.col[a + 1], cut.col[a + 2]);
    }
    dst.grp.push(capGrp);
  };
  for (const o of outers) {
    const all = o.ids.slice();
    const pts2 = o.pts.slice();
    const holePts = o.holes.map((h) => {
      for (let i = 0; i < h.ids.length; i++) {
        all.push(h.ids[i]);
        pts2.push(h.pts[i]);
      }
      return h.pts.slice();
    });
    let faces;
    try {
      faces = THREE.ShapeUtils.triangulateShape(o.pts.slice(), holePts);
    } catch (e) {
      continue;
    }
    for (const f of faces) {
      const a = pts2[f[0]];
      const b = pts2[f[1]];
      const c = pts2[f[2]];
      if (!a || !b || !c) continue;
      const ar = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
      if (Math.abs(ar) < 1e-10) continue;
      const i0 = all[f[0]];
      const i1 = ar > 0 ? all[f[1]] : all[f[2]];
      const i2 = ar > 0 ? all[f[2]] : all[f[1]];
      emit(B, i0, i1, i2, 1);
      emit(A, i0, i2, i1, -1);
    }
  }
  return outers.length;
}

export function measure(soup) {
  const P = soup.pos;
  let vol = 0;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 9) {
    const ax = P[i], ay = P[i + 1], az = P[i + 2];
    const bx = P[i + 3], by = P[i + 4], bz = P[i + 5];
    const dx = P[i + 6], dy = P[i + 7], dz = P[i + 8];
    const w = (ax * (by * dz - bz * dy) + ay * (bz * dx - bx * dz) + az * (bx * dy - by * dx)) / 6;
    vol += w;
    cx += w * (ax + bx + dx) * 0.25;
    cy += w * (ay + by + dy) * 0.25;
    cz += w * (az + bz + dz) * 0.25;
  }
  for (let i = 0; i < P.length; i += 3)
    for (let k = 0; k < 3; k++) {
      if (P[i + k] < min[k]) min[k] = P[i + k];
      if (P[i + k] > max[k]) max[k] = P[i + k];
    }
  const mid = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const ok = Math.abs(vol) > 1e-6;
  const c = ok ? [cx / vol, cy / vol, cz / vol] : mid;
  for (let k = 0; k < 3; k++) if (!(c[k] >= min[k] && c[k] <= max[k])) c[k] = mid[k];
  return { volume: Math.abs(vol), center: c, min, max };
}

export function components(soup) {
  const count = soup.pos.length / 3;
  const { ids, unique } = weldIds(soup.pos, count, 2e-4);
  const parent = new Int32Array(unique);
  for (let i = 0; i < unique; i++) parent[i] = i;
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const tris = soup.count;
  for (let t = 0; t < tris; t++) {
    const a = find(ids[t * 3]);
    const b = find(ids[t * 3 + 1]);
    const c = find(ids[t * 3 + 2]);
    parent[b] = a;
    parent[find(c)] = a;
  }
  const map = new Map();
  for (let t = 0; t < tris; t++) {
    const r = find(ids[t * 3]);
    let s = map.get(r);
    if (!s) {
      s = soup.like();
      map.set(r, s);
    }
    copyVert(s, soup, t * 3);
    copyVert(s, soup, t * 3 + 1);
    copyVert(s, soup, t * 3 + 2);
    s.grp.push(soup.grp[t]);
  }
  return [...map.values()];
}

export function mergeSoups(list) {
  const out = list[0].like();
  for (const s of list) {
    for (const k of ['pos', 'nor', 'rest', 'grp']) for (let i = 0; i < s[k].length; i++) out[k].push(s[k][i]);
    if (out.uv) for (let i = 0; i < s.pos.length / 3; i++) out.uv.push(s.uv ? s.uv[i * 2] : 0, s.uv ? s.uv[i * 2 + 1] : 0);
    if (out.col) for (let i = 0; i < s.pos.length; i++) out.col.push(s.col ? s.col[i] : 1);
  }
  return out;
}

export function soupToGeometry(soup, center = null) {
  const tris = soup.count;
  const order = [];
  const counts = [0, 0, 0];
  for (let g = 0; g < 3; g++) for (let t = 0; t < tris; t++) if (soup.grp[t] === g) {
    order.push(t);
    counts[g]++;
  }
  const pos = new Float32Array(tris * 9);
  const nor = new Float32Array(tris * 9);
  const rest = new Float32Array(tris * 9);
  const uv = soup.uv ? new Float32Array(tris * 6) : null;
  const col = soup.col ? new Float32Array(tris * 9) : null;
  const ox = center ? center[0] : 0;
  const oy = center ? center[1] : 0;
  const oz = center ? center[2] : 0;
  for (let k = 0; k < tris; k++) {
    const t = order[k];
    for (let j = 0; j < 9; j++) {
      const off = j % 3 === 0 ? ox : j % 3 === 1 ? oy : oz;
      pos[k * 9 + j] = soup.pos[t * 9 + j] - off;
      nor[k * 9 + j] = soup.nor[t * 9 + j];
      rest[k * 9 + j] = soup.rest[t * 9 + j];
      if (col) col[k * 9 + j] = soup.col[t * 9 + j];
    }
    if (uv) for (let j = 0; j < 6; j++) uv[k * 6 + j] = soup.uv[t * 6 + j];
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('rest', new THREE.BufferAttribute(rest, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  let start = 0;
  for (let i = 0; i < 3; i++) {
    if (counts[i]) g.addGroup(start * 3, counts[i] * 3, i);
    start += counts[i];
  }
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export function shiftSoup(soup, dx, dy, dz) {
  for (let i = 0; i < soup.pos.length; i += 3) {
    soup.pos[i] += dx;
    soup.pos[i + 1] += dy;
    soup.pos[i + 2] += dz;
  }
  return soup;
}

export function hullPoints(soups, center, max = 48) {
  const all = [];
  for (const s of soups) for (let i = 0; i < s.pos.length; i += 3) all.push(i, s);
  const total = all.length / 2;
  const step = Math.max(1, Math.floor(total / 400));
  const pts = [];
  for (let k = 0; k < total; k += step) {
    const i = all[k * 2];
    const s = all[k * 2 + 1];
    pts.push(s.pos[i] - center[0], s.pos[i + 1] - center[1], s.pos[i + 2] - center[2]);
  }
  if (pts.length / 3 <= max) return new Float32Array(pts);
  const dirs = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < max; i++) {
    const y = 1 - (i / (max - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    dirs.push(Math.cos(ga * i) * r, y, Math.sin(ga * i) * r);
  }
  const pickSet = new Set();
  for (let dI = 0; dI < dirs.length; dI += 3) {
    let best = -Infinity;
    let bi = 0;
    for (let i = 0; i < pts.length; i += 3) {
      const s = pts[i] * dirs[dI] + pts[i + 1] * dirs[dI + 1] + pts[i + 2] * dirs[dI + 2];
      if (s > best) {
        best = s;
        bi = i;
      }
    }
    pickSet.add(bi);
  }
  const out = [];
  for (const i of pickSet) out.push(pts[i], pts[i + 1], pts[i + 2]);
  return new Float32Array(out);
}
