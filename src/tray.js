// Candy Wall: the white flower tray (centre bowl and eight petal compartments, SDF model, collider built only from boxes: wall segments around every compartment over a floor of strips) and the clear-plastic material.
import * as THREE from 'three';
import { RAPIER, GROUP } from './physics.js';
import { meshSDF } from './lib/geo.js';

export function clearPlastic(opt = {}) {
  const m = new THREE.MeshPhysicalMaterial({
    color: opt.color ?? 0x050506,
    roughness: opt.roughness ?? 0.06,
    metalness: 0,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    side: opt.side ?? THREE.DoubleSide,
    envMapIntensity: opt.env ?? 1.5,
    specularIntensity: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  const u = { uBase: { value: opt.base ?? 0.05 }, uEdge: { value: opt.edge ?? 0.34 }, uShine: { value: opt.shine ?? 0.9 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uBase;\nuniform float uEdge;\nuniform float uShine;')
      .replace(
        '#include <opaque_fragment>',
        `float pF = pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 2.4);
        float pL = dot(outgoingLight, vec3(0.3, 0.5, 0.2));
        outgoingLight = min(outgoingLight, vec3(0.9)) + vec3(0.5, 0.56, 0.66) * pF * 0.35;
        diffuseColor.a = clamp(uBase + pF * uEdge + pL * uShine, 0.0, 1.0);
        #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => 'clear-plastic';
  return m;
}

const H = 4.2;
const FLOOR = 0.5;
const R0 = 5.3;
const P1 = { c: 9.5, r: 3.25 };
const P2 = { c: 13.2, r: 4.2 };
const WALLT = 0.6;
const OUTER = P2.c + P2.r + WALLT;
const SECTOR = Math.PI / 4;

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function petal(x, z, s) {
  const c = Math.cos(s * SECTOR);
  const n = Math.sin(s * SECTOR);
  const u = c * x + n * z;
  const v = -n * x + c * z;
  return smin(Math.hypot(u - P1.c, v) - P1.r, Math.hypot(u - P2.c, v) - P2.r, 2.6);
}

function cavity2(x, z) {
  const s = Math.round(Math.atan2(z, x) / SECTOR);
  return Math.min(Math.hypot(x, z) - R0, petal(x, z, s));
}

function body2(x, z) {
  const s = Math.round(Math.atan2(z, x) / SECTOR);
  let d = petal(x, z, s);
  d = smin(d, petal(x, z, s - 1), 1.6);
  d = smin(d, petal(x, z, s + 1), 1.6);
  d = smin(d, Math.hypot(x, z) - R0, 1.2);
  return d - WALLT;
}

function traySDF(x, y, z) {
  const b = body2(x, z) + 0.35;
  const w = Math.abs(y - H / 2) - H / 2 + 0.35;
  const body = Math.min(Math.max(b, w), 0) + Math.hypot(Math.max(b, 0), Math.max(w, 0)) - 0.35;
  const c = cavity2(x, z) + 0.1 * (H - y);
  const f = FLOOR - y;
  const k = 1.5;
  const hh = Math.max(k - Math.abs(c - f), 0) / k;
  const cav = Math.max(c, f) + hh * hh * k * 0.25;
  return Math.max(body, -cav);
}

function buildGeometry(res) {
  const e = OUTER + 0.5;
  const g = meshSDF(traySDF, { min: [-e, -0.3, -e], max: [e, H + 0.3, e], res });
  return g;
}

function outline(f, cx, cz, n, rMax) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let lo = rMax;
    while (lo > 0 && f(cx + c * lo, cz + s * lo) > 0) lo -= 0.2;
    let hi = lo + 0.2;
    for (let k = 0; k < 16; k++) {
      const m = (lo + hi) / 2;
      if (f(cx + c * m, cz + s * m) > 0) hi = m;
      else lo = m;
    }
    pts.push([cx + c * lo, cz + s * lo]);
  }
  return pts;
}

function buildCollider() {
  const boxes = [];
  const WALL = 1.2;
  const cell = (f, cx, cz, n, rMax) => {
    const pts = outline((x, z) => f(x, z) + 0.28, cx, cz, n, rMax);
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      let nx = dz / len;
      let nz = -dx / len;
      const mx = (a[0] + b[0]) / 2;
      const mz = (a[1] + b[1]) / 2;
      if (nx * (mx - cx) + nz * (mz - cz) < 0) {
        nx = -nx;
        nz = -nz;
      }
      boxes.push({ x: mx + (nx * WALL) / 2, y: H / 2, z: mz + (nz * WALL) / 2, hx: len / 2 + 0.24, hy: H / 2, hz: WALL / 2, yaw: Math.atan2(-dz, dx) });
    }
  };
  cell((x, z) => Math.hypot(x, z) - R0, 0, 0, 20, R0 + 1);
  const pc = (P1.c + P2.c) / 2;
  for (let s = 0; s < 8; s++) cell((x, z) => petal(x, z, s), Math.cos(s * SECTOR) * pc, Math.sin(s * SECTOR) * pc, 22, 7.5);
  const inside = (x, z) => cavity2(x, z) + 0.1 * (H - FLOOR) < 0;
  const BAND = 1.2;
  const DX = 0.15;
  for (let z0 = -OUTER; z0 < OUTER; z0 += BAND) {
    let start = null;
    for (let x = -OUTER; x <= OUTER + DX; x += DX) {
      const on = inside(x, z0) || inside(x, z0 + BAND / 2) || inside(x, z0 + BAND);
      if (on && start === null) start = x - DX;
      if (!on && start !== null) {
        boxes.push({ x: (start + x) / 2, y: FLOOR - 1.75, z: z0 + BAND / 2, hx: (x - start) / 2, hy: 1.75, hz: BAND / 2, yaw: 0 });
        start = null;
      }
    }
  }
  return boxes;
}

export class Tray {
  constructor(physics, home) {
    this.home = home.clone();
    this.depth = H;
    this.floorY = FLOOR;
    this.radius = OUTER;
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.inner.position.copy(home).multiplyScalar(-1);
    this.group.add(this.inner);
    this.group.position.copy(home);
    const geo = buildGeometry(150);
    const mesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xd9d9d5, roughness: 0.32, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.2, specularIntensity: 0.6 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.mesh = mesh;
    this.group.add(mesh);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(OUTER * 2 + 8, OUTER * 2 + 8), new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, opacity: 0.6, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.renderOrder = 1;
    this.group.add(shadow);

    const boxes = buildCollider();
    for (const o of boxes) {
      const h = Math.sin(o.yaw / 2);
      physics.world.createCollider(
        RAPIER.ColliderDesc.cuboid(o.hx, o.hy, o.hz)
          .setTranslation(home.x + o.x, home.y + o.y, home.z + o.z)
          .setRotation({ x: 0, y: h, z: 0, w: Math.cos(o.yaw / 2) })
          .setFriction(0.4)
          .setRestitution(0.12)
          .setCollisionGroups(GROUP.world)
      );
    }

    this.cells = [{ index: 0, x: home.x, z: home.z, r: R0, capacity: Math.PI * R0 * R0 * (H - FLOOR) * 0.86, angle: 0, radial: 0 }];
    const pr = (P1.c * 0.42 + P2.c * 0.58);
    for (let i = 0; i < 8; i++) {
      const a = i * SECTOR;
      this.cells.push({ index: i + 1, x: home.x + Math.cos(a) * pr, z: home.z + Math.sin(a) * pr, r: 3.6, capacity: (Math.PI * P1.r * P1.r + Math.PI * P2.r * P2.r) * 0.9 * (H - FLOOR) * 0.86, angle: a, radial: pr });
    }
    this.offset = new THREE.Vector3();
    this.angle = 0;
    this.matrix = new THREE.Matrix4();
    this.inverse = new THREE.Matrix4();
    this.setPose(this.offset, 0);
  }

  cellAt(x, z) {
    const dx = x - this.home.x;
    const dz = z - this.home.z;
    const r = Math.hypot(dx, dz);
    if (r < R0 + WALLT * 0.5) return this.cells[0];
    if (r > OUTER) return null;
    const s = ((Math.round(Math.atan2(dz, dx) / SECTOR) % 8) + 8) % 8;
    return this.cells[s + 1];
  }

  contains(x, y, z, pad = 0) {
    return Math.hypot(x - this.home.x, z - this.home.z) < OUTER + pad && y < this.home.y + H + 7;
  }

  setPose(offset, angle) {
    this.offset.copy(offset);
    this.angle = angle;
    this.group.position.copy(this.home).add(offset);
    this.group.rotation.y = angle;
    this.group.updateMatrix();
    this.matrix.copy(this.group.matrix).multiply(_t.makeTranslation(-this.home.x, -this.home.y, -this.home.z));
    this.inverse.copy(this.matrix).invert();
  }
}

const _t = new THREE.Matrix4();

let shadowTex = null;
function softShadowTexture() {
  if (shadowTex) return shadowTex;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.28, s / 2, s / 2, s * 0.5);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  shadowTex = new THREE.CanvasTexture(cv);
  return shadowTex;
}
