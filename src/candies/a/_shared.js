// Pack A shared helpers: GLSL colours, recentring, swept ropes and belts, convex gems and small SDF extras.
import * as THREE from 'three';
import { detail, meshSDF, validate } from '../../lib/geo.js';

const hyp = Math.hypot;

export const glsl = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

export const v3 = (a) => `vec3(${a[0].toFixed(4)}, ${a[1].toFixed(4)}, ${a[2].toFixed(4)})`;

export const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

export function centre(list) {
  const box = new THREE.Box3();
  for (const g of list) {
    g.computeBoundingBox();
    box.union(g.boundingBox);
  }
  const c = box.getCenter(new THREE.Vector3());
  for (const g of list) g.translate(-c.x, -c.y, -c.z);
  return [-c.x, -c.y, -c.z];
}

export function solid(f, opt) {
  let g = null;
  for (let i = 0; i < 14; i++) {
    const k = i % 2 ? (i + 1) / 2 : -i / 2;
    const pad = (i % 3) * 0.031;
    g = meshSDF(f, { min: [opt.min[0] - pad, opt.min[1] - pad * 0.6, opt.min[2] - pad * 1.4], max: opt.max, res: opt.res + k });
    if (validate(g).watertight) return g;
  }
  return g;
}

export function snapY(g, y0, tol, f) {
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const e = 0.01;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(p.getY(i) - y0) >= tol) continue;
    let x = p.getX(i);
    let z = p.getZ(i);
    if (f && f(x, y0, z) > -tol * 1.5) {
      let gx = 0;
      let gz = 0;
      for (let k = 0; k < 4; k++) {
        const d = f(x, y0, z);
        gx = (f(x + e, y0, z) - f(x - e, y0, z)) / (2 * e);
        gz = (f(x, y0, z + e) - f(x, y0, z - e)) / (2 * e);
        const l = gx * gx + gz * gz || 1;
        x -= (d * gx) / l;
        z -= (d * gz) / l;
      }
      const l = Math.hypot(gx, gz) || 1;
      if (n) n.setXYZ(i, gx / l, 0, gz / l);
    }
    p.setXYZ(i, x, y0, z);
  }
  return g;
}

export const lay = (f) => (x, y, z) => f(x, -z, y);

export const floor = (f, y0, k = 0.06) => (x, y, z) => {
  const a = f(x, y, z);
  const b = y0 - y;
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.max(a, b) + h * h * k * 0.25;
};

export const above = (f, y0) => (x, y, z) => Math.max(f(x, y, z), y0 - y);
export const below = (f, y0) => (x, y, z) => Math.max(f(x, y, z), y - y0);

export const roundCone = (r1, r2, h) => {
  const b = (r1 - r2) / h;
  const a = Math.sqrt(1 - b * b);
  return (x, y, z) => {
    const q = hyp(x, z);
    const k = -q * b + y * a;
    if (k < 0) return hyp(q, y) - r1;
    if (k > a * h) return hyp(q, y - h) - r2;
    return q * a + y * b - r1;
  };
};

export const link = (a, b, r1, r2) => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const h = hyp(dx, dy, dz);
  const ux = dx / h;
  const uy = dy / h;
  const uz = dz / h;
  const s = (r1 - r2) / h;
  const c = Math.sqrt(Math.max(0, 1 - s * s));
  return (x, y, z) => {
    const px = x - a[0];
    const py = y - a[1];
    const pz = z - a[2];
    const t = px * ux + py * uy + pz * uz;
    const q = Math.sqrt(Math.max(0, px * px + py * py + pz * pz - t * t));
    const k = -q * s + t * c;
    if (k < 0) return hyp(q, t) - r1;
    if (k > c * h) return hyp(q, t - h) - r2;
    return q * c + t * s - r1;
  };
};

export function surfacePoint(f, origin, dir, far = 6) {
  let lo = 0;
  let hi = far;
  for (let i = 0; i < 26; i++) {
    const m = (lo + hi) / 2;
    if (f(origin[0] + dir[0] * m, origin[1] + dir[1] * m, origin[2] + dir[2] * m) < 0) lo = m;
    else hi = m;
  }
  return [origin[0] + dir[0] * lo, origin[1] + dir[1] * lo, origin[2] + dir[2] * lo];
}

export function sweep(points, opt = {}) {
  const d = detail();
  const radius = opt.radius ?? 0.3;
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), false, 'centripetal');
  curve.arcLengthDivisions = Math.max(200, points.length * 24);
  const L = curve.getLength();
  const profile = opt.profile || null;
  const m = profile ? profile.length : Math.max(5, Math.round((opt.sides ?? 10) * d));
  const n = Math.max(4, Math.round((L / (opt.step ?? 0.15)) * d));
  const round = !profile && opt.round !== false;
  const capR = opt.cap ?? radius;
  const stations = [];
  if (round) {
    const K = 3;
    for (let k = 1; k < K; k++) stations.push({ s: capR * (1 - Math.cos((k * Math.PI) / 2 / K)), e: Math.sin((k * Math.PI) / 2 / K) });
    for (let i = 0; i <= n; i++) stations.push({ s: capR + ((L - capR * 2) * i) / n, e: 1 });
    for (let k = K - 1; k >= 1; k--) stations.push({ s: L - capR * (1 - Math.cos((k * Math.PI) / 2 / K)), e: Math.sin((k * Math.PI) / 2 / K) });
  } else for (let i = 0; i <= n; i++) stations.push({ s: (L * i) / n, e: 1 });
  const pos = [];
  const up = new THREE.Vector3(0, 1, 0);
  const P = new THREE.Vector3();
  const T = new THREE.Vector3();
  const side = new THREE.Vector3();
  const N = new THREE.Vector3();
  const centres = [];
  for (const st of stations) {
    const t = Math.min(1, Math.max(0, st.s / L));
    curve.getPointAt(t, P);
    curve.getTangentAt(t, T);
    side.crossVectors(up, T).normalize();
    N.crossVectors(T, side).normalize();
    centres.push(P.clone());
    for (let j = 0; j < m; j++) {
      let u;
      let v;
      if (profile) {
        u = profile[j][0];
        v = profile[j][1];
      } else {
        const a = (j / m) * Math.PI * 2;
        const r = typeof radius === 'function' ? radius(st.s, a, L) : radius;
        u = Math.cos(a) * r * st.e;
        v = Math.sin(a) * r * st.e;
      }
      if (opt.warp) [u, v] = opt.warp(u, v, st.s, L);
      pos.push(P.x + side.x * u + N.x * v, P.y + side.y * u + N.y * v, P.z + side.z * u + N.z * v);
    }
  }
  const rings = stations.length;
  const ind = [];
  for (let i = 0; i < rings - 1; i++)
    for (let j = 0; j < m; j++) {
      const a = i * m + j;
      const b = i * m + ((j + 1) % m);
      const c = (i + 1) * m + ((j + 1) % m);
      const e = (i + 1) * m + j;
      ind.push(a, e, c, a, c, b);
    }
  const capFan = (ringIndex, apex, flip) => {
    let base = ringIndex * m;
    if (!round) {
      base = pos.length / 3;
      for (let j = 0; j < m * 3; j++) pos.push(pos[ringIndex * m * 3 + j]);
    }
    const ai = pos.length / 3;
    pos.push(apex.x, apex.y, apex.z);
    for (let j = 0; j < m; j++) {
      const a = base + j;
      const b = base + ((j + 1) % m);
      if (flip) ind.push(ai, b, a);
      else ind.push(ai, a, b);
    }
  };
  const first = round ? curve.getPointAt(0) : centres[0];
  const last = round ? curve.getPointAt(1) : centres[rings - 1];
  capFan(0, first, false);
  capFan(rings - 1, last, true);
  let vol = 0;
  for (let i = 0; i < ind.length; i += 3) {
    const a = ind[i] * 3;
    const b = ind[i + 1] * 3;
    const c = ind[i + 2] * 3;
    vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) + pos[a + 1] * (pos[b + 2] * pos[c] - pos[b] * pos[c + 2]) + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (vol < 0) for (let i = 0; i < ind.length; i += 3) {
    const s = ind[i + 1];
    ind[i + 1] = ind[i + 2];
    ind[i + 2] = s;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ind);
  g.computeVertexNormals();
  return g;
}

export function polytope(planes) {
  const verts = [];
  const n = planes.length;
  const eps = 1e-6;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++) {
        const a = planes[i];
        const b = planes[j];
        const c = planes[k];
        const cx = b[1] * c[2] - b[2] * c[1];
        const cy = b[2] * c[0] - b[0] * c[2];
        const cz = b[0] * c[1] - b[1] * c[0];
        const det = a[0] * cx + a[1] * cy + a[2] * cz;
        if (Math.abs(det) < 1e-7) continue;
        const ax = c[1] * a[2] - c[2] * a[1];
        const ay = c[2] * a[0] - c[0] * a[2];
        const az = c[0] * a[1] - c[1] * a[0];
        const bx = a[1] * b[2] - a[2] * b[1];
        const by = a[2] * b[0] - a[0] * b[2];
        const bz = a[0] * b[1] - a[1] * b[0];
        const x = (a[3] * cx + b[3] * ax + c[3] * bx) / det;
        const y = (a[3] * cy + b[3] * ay + c[3] * by) / det;
        const z = (a[3] * cz + b[3] * az + c[3] * bz) / det;
        let ok = true;
        for (let q = 0; q < n && ok; q++) if (planes[q][0] * x + planes[q][1] * y + planes[q][2] * z > planes[q][3] + eps) ok = false;
        if (!ok) continue;
        let v = verts.find((w) => hyp(w.x - x, w.y - y, w.z - z) < 1e-4);
        if (!v) {
          v = { x, y, z };
          verts.push(v);
        }
      }
  const pos = [];
  const nor = [];
  for (let i = 0; i < n; i++) {
    const p = planes[i];
    const on = verts.filter((v) => Math.abs(p[0] * v.x + p[1] * v.y + p[2] * v.z - p[3]) < 2e-5);
    if (on.length < 3) continue;
    let mx = 0;
    let my = 0;
    let mz = 0;
    for (const v of on) {
      mx += v.x / on.length;
      my += v.y / on.length;
      mz += v.z / on.length;
    }
    const ref = Math.abs(p[0]) < 0.8 ? [1, 0, 0] : [0, 1, 0];
    const dot = ref[0] * p[0] + ref[1] * p[1] + ref[2] * p[2];
    let ux = ref[0] - p[0] * dot;
    let uy = ref[1] - p[1] * dot;
    let uz = ref[2] - p[2] * dot;
    const ul = hyp(ux, uy, uz);
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const wx = p[1] * uz - p[2] * uy;
    const wy = p[2] * ux - p[0] * uz;
    const wz = p[0] * uy - p[1] * ux;
    on.sort((s, t) => Math.atan2((s.x - mx) * wx + (s.y - my) * wy + (s.z - mz) * wz, (s.x - mx) * ux + (s.y - my) * uy + (s.z - mz) * uz) - Math.atan2((t.x - mx) * wx + (t.y - my) * wy + (t.z - mz) * wz, (t.x - mx) * ux + (t.y - my) * uy + (t.z - mz) * uz));
    for (let k = 1; k < on.length - 1; k++) {
      for (const v of [on[0], on[k], on[k + 1]]) {
        pos.push(v.x, v.y, v.z);
        nor.push(p[0], p[1], p[2]);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

export function wrap(f, opt = {}) {
  const d = detail();
  const nu = Math.max(8, Math.round((opt.nu ?? 48) * d));
  const nv = Math.max(6, Math.round((opt.nv ?? 24) * d));
  const o = opt.origin || [0, 0, 0];
  const pos = [];
  const put = (phi, theta) => {
    const s = Math.sin(phi);
    const p = surfacePoint(f, o, [s * Math.cos(theta), Math.cos(phi), s * Math.sin(theta)], opt.far ?? 6);
    pos.push(p[0], p[1], p[2]);
  };
  put(0, 0);
  for (let v = 1; v < nv; v++) for (let u = 0; u < nu; u++) put(Math.pow(v / nv, opt.bias ?? 1) * Math.PI, (u / nu) * Math.PI * 2);
  put(Math.PI, 0);
  const last = pos.length / 3 - 1;
  const ind = [];
  for (let u = 0; u < nu; u++) {
    const n = (u + 1) % nu;
    ind.push(0, 1 + n, 1 + u);
    for (let v = 0; v < nv - 2; v++) {
      const a = 1 + v * nu + u;
      const b = 1 + v * nu + n;
      const c = 1 + (v + 1) * nu + n;
      const e = 1 + (v + 1) * nu + u;
      ind.push(a, b, c, a, c, e);
    }
    ind.push(last, 1 + (nv - 2) * nu + u, 1 + (nv - 2) * nu + n);
  }
  const nor = new Float32Array(pos.length);
  const e = opt.eps ?? 0.02;
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

export function ball(radius, w = 28, h = 18) {
  const d = detail();
  return new THREE.SphereGeometry(radius, Math.max(8, Math.round(w * d)), Math.max(6, Math.round(h * d)));
}

export function fibonacci(n) {
  const out = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    out.push([Math.cos(ga * i) * r, y, Math.sin(ga * i) * r]);
  }
  return out;
}
