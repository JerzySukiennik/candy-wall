// Candy Wall: the white flower tray (centre bowl and eight petal compartments, SDF model, trimesh collider) and the clear-plastic material.
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

    const col = buildGeometry(84);
    const verts = new Float32Array(col.attributes.position.array);
    for (let i = 0; i < verts.length; i += 3) {
      verts[i] += home.x;
      verts[i + 1] += home.y;
      verts[i + 2] += home.z;
    }
    const cd = RAPIER.ColliderDesc.trimesh(verts, new Uint32Array(col.index.array)).setFriction(0.4).setRestitution(0.12).setCollisionGroups(GROUP.world);
    physics.world.createCollider(cd);
    col.dispose();

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
