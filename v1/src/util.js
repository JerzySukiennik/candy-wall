// Candy Wall: math helpers, springs, tweens and ray utilities.
import * as THREE from 'three';

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const damp = (cur, target, rate, dt) => target + (cur - target) * Math.exp(-rate * dt);
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (list) => list[(Math.random() * list.length) | 0];

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const ease = {
  lin: (t) => t,
  out3: (t) => 1 - (1 - t) ** 3,
  out5: (t) => 1 - (1 - t) ** 5,
  in2: (t) => t * t,
  in3: (t) => t * t * t,
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2,
};

export class Spring {
  constructor(x = 0, k = 180, z = 0.6) {
    this.x = x;
    this.v = 0;
    this.t = x;
    this.k = k;
    this.z = z;
  }

  step(dt) {
    const c = 2 * Math.sqrt(this.k) * this.z;
    const n = Math.max(1, Math.ceil(dt / 0.006));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += ((this.t - this.x) * this.k - this.v * c) * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  snap(x) {
    this.x = this.t = x;
    this.v = 0;
  }

  get moving() {
    return Math.abs(this.t - this.x) > 2e-4 || Math.abs(this.v) > 2e-3;
  }
}

export class Tweens {
  constructor() {
    this.list = [];
  }

  add(o) {
    o.t = -(o.delay || 0);
    o.dur = o.dur || 0.0001;
    this.list.push(o);
    return o;
  }

  after(delay, done) {
    return this.add({ delay, dur: 0.0001, done });
  }

  step(dt) {
    const l = this.list;
    for (let i = 0; i < l.length; i++) {
      const o = l[i];
      o.t += dt;
      if (o.t < 0) continue;
      const k = Math.min(1, o.t / o.dur);
      if (o.update) o.update((o.ease || ease.inOut)(k), k);
      if (k >= 1) {
        l.splice(i--, 1);
        if (o.done) o.done();
      }
    }
  }

  get active() {
    return this.list.length > 0;
  }
}

export function rayPlane(ray, point, normal, out) {
  const dn = ray.direction.dot(normal);
  if (Math.abs(dn) < 1e-6) return null;
  const t = ((point.x - ray.origin.x) * normal.x + (point.y - ray.origin.y) * normal.y + (point.z - ray.origin.z) * normal.z) / dn;
  if (t < 0) return null;
  return out.copy(ray.direction).multiplyScalar(t).add(ray.origin);
}

export function rayY(ray, y, out) {
  const d = ray.direction.y;
  if (Math.abs(d) < 1e-6) return null;
  const t = (y - ray.origin.y) / d;
  if (t < 0) return null;
  return out.copy(ray.direction).multiplyScalar(t).add(ray.origin);
}

export function raySphere(ray, c, r, out) {
  const ox = ray.origin.x - c.x;
  const oy = ray.origin.y - c.y;
  const oz = ray.origin.z - c.z;
  const d = ray.direction;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0) return null;
  return out.copy(d).multiplyScalar(t).add(ray.origin);
}

export function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
