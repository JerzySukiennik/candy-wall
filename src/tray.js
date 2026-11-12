// Candy Wall: the clear divided plastic tray (model, clear-plastic material, colliders, compartments).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TRAY } from './config.js';
import { roundedRectShape } from './util.js';

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
        outgoingLight += vec3(0.5, 0.56, 0.66) * pF * 0.35;
        diffuseColor.a = clamp(uBase + pF * uEdge + pL * uShine, 0.0, 1.0);
        #include <opaque_fragment>`
      );
  };
  m.customProgramCacheKey = () => 'clear-plastic';
  return m;
}

export class Tray {
  constructor(physics, home) {
    this.home = home.clone();
    this.group = new THREE.Group();
    this.inner = new THREE.Group();
    this.inner.position.copy(home);
    this.group.add(this.inner);
    const { cols, rows, cell, wall, depth } = TRAY;
    this.w = cols * cell + wall;
    this.d = rows * cell + wall;
    this.depth = depth;
    this.floorY = 0.3;
    const parts = [];
    const box = (w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, z);
      parts.push(g);
    };
    const base = new THREE.ExtrudeGeometry(roundedRectShape(this.w + 1.2, this.d + 1.2, 1.4), { depth: this.floorY, bevelEnabled: false, curveSegments: 6 });
    base.rotateX(-Math.PI / 2);
    base.translate(0, 0, 0);
    parts.push(base);
    for (let i = 0; i <= cols; i++) box(wall, depth, this.d, -this.w / 2 + wall / 2 + i * cell, this.floorY + depth / 2, 0);
    for (let j = 0; j <= rows; j++) box(this.w, depth, wall, 0, this.floorY + depth / 2, -this.d / 2 + wall / 2 + j * cell);
    const geo = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
    const mesh = new THREE.Mesh(geo, clearPlastic({ base: 0.045, edge: 0.4 }));
    mesh.renderOrder = 6;
    this.inner.add(mesh);
    const rim = [];
    const strip = (w, d, x, z) => {
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      g.translate(x, this.floorY + depth + 0.005, z);
      rim.push(g);
    };
    for (let i = 0; i <= cols; i++) strip(wall, this.d, -this.w / 2 + wall / 2 + i * cell, 0);
    for (let j = 0; j <= rows; j++) strip(this.w, wall, 0, -this.d / 2 + wall / 2 + j * cell);
    const rimMesh = new THREE.Mesh(mergeGeometries(rim), new THREE.MeshBasicMaterial({ color: 0xdfe9ff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    rimMesh.renderOrder = 7;
    this.inner.add(rimMesh);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(this.w + 5, this.d + 5), new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, opacity: 0.55, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.renderOrder = 1;
    this.inner.add(shadow);

    this.cells = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        this.cells.push({ index: j * cols + i, x: home.x - this.w / 2 + wall + (i + 0.5) * cell - wall / 2, z: home.z - this.d / 2 + wall + (j + 0.5) * cell - wall / 2, half: (cell - wall) / 2, candy: null, count: 0 });
      }
    const hx = home.x;
    const hz = home.z;
    const hy = home.y;
    physics.fixedBox(hx, hy + this.floorY / 2, hz, this.w / 2 + 0.6, this.floorY / 2, this.d / 2 + 0.6, { friction: 0.5 });
    const ph = (depth + 0.4) / 2;
    for (let i = 0; i <= cols; i++) {
      const edge = i === 0 || i === cols;
      const t = edge ? 0.5 : wall / 2;
      const off = edge ? (i === 0 ? -1 : 1) * (0.5 - wall / 2) : 0;
      physics.fixedBox(hx - this.w / 2 + wall / 2 + i * cell + off, hy + this.floorY + ph - 0.2, hz, t, ph, this.d / 2, { friction: 0.35 });
    }
    for (let j = 0; j <= rows; j++) {
      const edge = j === 0 || j === rows;
      const t = edge ? 0.5 : wall / 2;
      const off = edge ? (j === 0 ? -1 : 1) * (0.5 - wall / 2) : 0;
      physics.fixedBox(hx, hy + this.floorY + ph - 0.2, hz - this.d / 2 + wall / 2 + j * cell + off, this.w / 2, ph, t, { friction: 0.35 });
    }
    this.offset = new THREE.Vector3();
  }

  cellAt(x, z) {
    for (const c of this.cells) if (Math.abs(x - c.x) <= c.half + TRAY.wall && Math.abs(z - c.z) <= c.half + TRAY.wall) return c;
    return null;
  }

  contains(x, y, z, pad = 0) {
    return Math.abs(x - this.home.x) < this.w / 2 + pad && Math.abs(z - this.home.z) < this.d / 2 + pad && y < this.home.y + this.depth + 6;
  }

  setOffset(v) {
    this.offset.copy(v);
    this.group.position.copy(v);
  }
}

let shadowTex = null;
function softShadowTexture() {
  if (shadowTex) return shadowTex;
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dx = Math.max(0, Math.abs(x - s / 2) - s * 0.34) / (s * 0.16);
      const dy = Math.max(0, Math.abs(y - s / 2) - s * 0.34) / (s * 0.16);
      const d = Math.min(1, Math.hypot(dx, dy));
      const a = (1 - d) * (1 - d);
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
      img.data[i + 3] = a * 255;
    }
  ctx.putImageData(img, 0, 0);
  shadowTex = new THREE.CanvasTexture(cv);
  return shadowTex;
}
