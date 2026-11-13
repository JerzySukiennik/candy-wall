// Candy Wall: turns a candy definition into render-ready layers and cut-ready fragment sets.
import * as THREE from 'three';
import { ensureRest, validate } from './lib/geo.js';
import { mat } from './lib/mat.js';
import { GRP_CAVITY, GRP_SURFACE, Soup, components, measure, soupFromGeometry, soupToGeometry, splitSoup } from './lib/cut.js';

const TASTES = ['sweet', 'sour', 'spicy', 'salty', 'bitter', 'mint', 'fizz'];
const cache = new Map();

export function prepare(def, variant = 0) {
  const key = def.id + ':' + variant;
  if (cache.has(key)) return cache.get(key);
  const built = def.build(variant);
  const box = new THREE.Box3();
  const layers = built.layers.map((l, i) => {
    const g = l.geometry;
    if (!g.attributes.normal) g.computeVertexNormals();
    ensureRest(g);
    g.computeBoundingBox();
    g.computeBoundingSphere();
    box.union(g.boundingBox);
    const role = l.role || (l.inside !== undefined ? 'core' : 'body');
    const cap = l.cap || (role === 'core' ? l.material : mat.capOf(l.material));
    const bs = g.boundingBox.getSize(new THREE.Vector3());
    return { index: i, geometry: g, material: l.material, cap, cavity: l.cavity || null, role, inside: role === 'core' ? l.inside ?? 0 : -1, fill: l.fill || null, anchor: l.anchor || null, stick: role === 'attach' && Math.max(bs.x, bs.y, bs.z) > 2.6 };
  });
  for (const l of layers) if (l.role === 'core' && !layers[l.inside].cavity) layers[l.inside].cavity = layers[l.inside].material.transparent ? layers[l.inside].material : layers[l.inside].cap;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  let volume = 0;
  for (const l of layers) if (l.role === 'body') volume += Math.abs(validate(l.geometry).volume);
  const feel = { hardness: 0.5, bounce: 0.4, sticky: 0.1, density: 1.2, ...(def.feel || {}), ...(built.feel || {}) };
  const taste = {};
  for (const t of TASTES) taste[t] = (built.taste || def.taste || {})[t] || 0;
  const prep = {
    def,
    variant,
    layers,
    size,
    center,
    radius: size.length() / 2,
    volume,
    mass: Math.max(0.2, volume * feel.density),
    feel,
    taste,
    name: built.name || def.name,
    breaks: { mode: 'slice', toughness: feel.hardness, shards: 5, ...(def.breaks || {}), ...(built.breaks || {}) },
    mouth: { bites: 3, sound: 'chewy', ...(def.mouth || {}), ...(built.mouth || {}) },
    sound: { land: 'soft', cut: 'squeak', pitch: 1, ...(def.sound || {}), ...(built.sound || {}) },
    set: null,
  };
  cache.set(key, prep);
  return prep;
}

export function wholeSet(prep) {
  if (prep.set) return prep.set;
  const soups = prep.layers.map((l) => (l.role === 'attach' ? null : soupFromGeometry(l.geometry, GRP_SURFACE)));
  for (const l of prep.layers) {
    if (l.role !== 'core') continue;
    const host = soups[l.inside];
    const wall = soupFromGeometry(l.geometry, GRP_CAVITY, true, new Soup(!!host.uv, !!host.col));
    for (const k of ['pos', 'nor', 'rest', 'grp']) for (let i = 0; i < wall[k].length; i++) host[k].push(wall[k][i]);
    if (host.uv) for (let i = 0; i < wall.uv.length; i++) host.uv.push(wall.uv[i]);
    if (host.col) for (let i = 0; i < wall.col.length; i++) host.col.push(wall.col[i]);
  }
  prep.set = { prep, soups, attach: prep.layers.filter((l) => l.role === 'attach').map((l) => l.index), whole: true };
  return prep.set;
}

export function splitSet(set, n, d) {
  const a = { prep: set.prep, soups: [], attach: [], whole: false };
  const b = { prep: set.prep, soups: [], attach: [], whole: false };
  let cut = false;
  set.soups.forEach((s, i) => {
    if (!s) {
      a.soups[i] = b.soups[i] = null;
      return;
    }
    const r = splitSoup(s, n, d);
    a.soups[i] = r.a;
    b.soups[i] = r.b;
    if (r.a && r.b) cut = true;
  });
  if (!cut) return null;
  for (const i of set.attach) {
    const l = set.prep.layers[i];
    const p = l.anchor || l.geometry.boundingSphere.center.toArray();
    (p[0] * n.x + p[1] * n.y + p[2] * n.z - d > 0 ? a : b).attach.push(i);
  }
  return [a, b].filter((x) => x.soups.some(Boolean));
}

export function setParts(set) {
  const items = [];
  set.soups.forEach((s, li) => {
    if (!s) return;
    const comps = set.whole ? [s] : components(s);
    for (const c of comps) {
      const m = measure(c);
      if (m.volume < 1e-5 && c.count < 4) continue;
      items.push({ li, soup: c, m });
    }
  });
  const parent = items.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const pad = 0.04;
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      if (items[i].li === items[j].li) continue;
      const A = items[i].m;
      const B = items[j].m;
      let hit = true;
      for (let k = 0; k < 3; k++) if (A.min[k] - pad > B.max[k] || B.min[k] - pad > A.max[k]) hit = false;
      if (hit) parent[find(i)] = find(j);
    }
  const groups = new Map();
  items.forEach((it, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(it);
  });
  const out = [];
  for (const list of groups.values()) {
    const part = { prep: set.prep, soups: set.prep.layers.map(() => null), attach: [], whole: false };
    for (const it of list) {
      if (part.soups[it.li]) {
        const dst = part.soups[it.li];
        for (const k of ['pos', 'nor', 'rest', 'grp']) for (let i = 0; i < it.soup[k].length; i++) dst[k].push(it.soup[k][i]);
        if (dst.uv) for (let i = 0; i < it.soup.uv.length; i++) dst.uv.push(it.soup.uv[i]);
        if (dst.col) for (let i = 0; i < it.soup.col.length; i++) dst.col.push(it.soup.col[i]);
      } else part.soups[it.li] = it.soup;
    }
    out.push(part);
  }
  if (out.length === 1) {
    out[0].attach = set.attach.slice();
    out[0].whole = set.whole;
  } else if (set.attach.length) {
    for (const ai of set.attach) {
      const l = set.prep.layers[ai];
      const p = l.anchor || l.geometry.boundingSphere.center.toArray();
      let best = out[0];
      let bd = Infinity;
      for (const part of out) {
        const m = measureSet(part);
        const dd = Math.hypot(m.center[0] - p[0], m.center[1] - p[1], m.center[2] - p[2]);
        if (dd < bd) {
          bd = dd;
          best = part;
        }
      }
      best.attach.push(ai);
    }
  }
  return out;
}

export function measureSet(set) {
  let vol = 0;
  let bodyVol = 0;
  const c = [0, 0, 0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  set.soups.forEach((s, i) => {
    if (!s) return;
    const m = measure(s);
    const role = set.prep.layers[i].role;
    const w = Math.max(1e-6, m.volume);
    vol += w;
    if (role === 'body') bodyVol += m.volume;
    for (let k = 0; k < 3; k++) {
      c[k] += m.center[k] * w;
      min[k] = Math.min(min[k], m.min[k]);
      max[k] = Math.max(max[k], m.max[k]);
    }
  });
  for (const ai of set.attach) {
    const bb = set.prep.layers[ai].geometry.boundingBox;
    const lo = bb.min.toArray();
    const hi = bb.max.toArray();
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], lo[k]);
      max[k] = Math.max(max[k], hi[k]);
    }
  }
  if (vol <= 0) {
    if (!set.attach.length) return { volume: 0, center: [0, 0, 0], min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
    return { volume: 0, center: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
  }
  const center = [c[0] / vol, c[1] / vol, c[2] / vol];
  return { volume: bodyVol, center, min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

export function buildMeshes(set, center = [0, 0, 0], opt = {}) {
  const group = new THREE.Group();
  const prep = set.prep;
  set.soups.forEach((s, i) => {
    if (!s) return;
    const l = prep.layers[i];
    let mesh;
    if (set.whole) {
      mesh = new THREE.Mesh(l.geometry, l.material);
      mesh.position.set(-center[0], -center[1], -center[2]);
    } else {
      const g = soupToGeometry(s, center);
      mesh = new THREE.Mesh(g, [l.material, l.cap, l.cavity || l.cap]);
      mesh.userData.own = true;
    }
    mesh.userData.layer = i;
    mesh.castShadow = opt.shadow !== false;
    mesh.receiveShadow = false;
    if (l.material.transparent) mesh.renderOrder = 2;
    group.add(mesh);
  });
  for (const ai of set.attach) {
    const l = prep.layers[ai];
    const mesh = new THREE.Mesh(l.geometry, l.material);
    mesh.position.set(-center[0], -center[1], -center[2]);
    mesh.userData.layer = ai;
    mesh.castShadow = opt.shadow !== false;
    group.add(mesh);
  }
  return group;
}

export function disposeMeshes(group) {
  group.traverse((o) => {
    if (o.isMesh && o.userData.own) o.geometry.dispose();
  });
}

export function report(def) {
  const out = { id: def.id, name: def.name, variants: def.variants || 1, layers: [], ok: true, notes: [] };
  let prep;
  try {
    prep = prepare(def, 0);
  } catch (e) {
    out.ok = false;
    out.notes.push('build failed: ' + e.message);
    return out;
  }
  out.size = prep.size.toArray().map((x) => Math.round(x * 100) / 100);
  out.volume = Math.round(prep.volume * 100) / 100;
  out.mass = Math.round(prep.mass * 10) / 10;
  let tris = 0;
  for (const l of prep.layers) {
    const v = validate(l.geometry);
    tris += v.tris;
    out.layers.push({ role: l.role, tris: v.tris, watertight: v.watertight, open: v.open, nonManifold: v.nonManifold, size: v.size });
    if (l.role !== 'attach' && !v.watertight) {
      out.ok = false;
      out.notes.push(`layer ${l.index} is not watertight (open ${v.open}, non-manifold ${v.nonManifold})`);
    }
    if (l.role !== 'attach' && v.volume < 0) {
      out.ok = false;
      out.notes.push(`layer ${l.index} is inside out (negative volume)`);
    }
  }
  out.tris = tris;
  const off = prep.center.length();
  if (off > Math.max(0.25, prep.radius * 0.2)) out.notes.push(`not centred: bbox centre is ${off.toFixed(2)} cm from origin`);
  const big = Math.max(...out.size);
  if (big > 13) out.notes.push(`too long: ${big} cm (max 13)`);
  if (tris > 9000) out.notes.push(`heavy: ${tris} triangles (aim below 5000)`);
  return out;
}
