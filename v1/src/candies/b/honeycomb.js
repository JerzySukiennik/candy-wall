// Honeycomb: a broken chunk of golden cinder toffee half dipped in milk chocolate; every cut face shows the bubbles (3D cell pattern).
import { M, centreAll, glsl, noise3, seal } from './_shared.js';

const B = [1.7, 1.0, 1.2];
const RR = 0.22;
const GOLD = 0xe6a22a;

function shape(x, y, z) {
  const qx = Math.abs(x) - B[0] + RR;
  const qy = Math.abs(y) - B[1] + RR;
  const qz = Math.abs(z) - B[2] + RR;
  const box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - RR;
  return box + 0.12 * (Math.sin(1.9 * x + 1.3) * Math.sin(2.3 * y + 0.5) + Math.sin(2.7 * z + 2.1) * Math.sin(1.7 * x + 4.0)) + 0.05 * Math.sin(5.1 * x) * Math.sin(4.7 * y + 1.0) * Math.sin(5.3 * z + 2.0);
}

const dip = (x, y, z) => 0.94 * x + 0.3 * y + 0.14 * z - 0.1 + 0.1 * Math.sin(2.5 * z + 1) * Math.cos(2.1 * y);

const HONEY = (off) => `float hcBub(vec3 p, float s, float seed) {
  vec3 q = p * s + seed;
  vec3 ci = floor(q);
  float rad = 0.2 + 0.26 * cHash1(ci + 5.0);
  float d = length(fract(q) - 0.5 - (cHash3(ci) - 0.5) * 0.4);
  return smoothstep(rad, rad - 0.1, d);
}
vec3 hcHoney(vec3 p) {
  vec3 gold = ${glsl(GOLD)};
  float hole = max(hcBub(p, 2.6, 0.0), max(hcBub(p, 5.2, 7.3) * 0.85, hcBub(p, 10.5, 2.1) * 0.6));
  vec3 wall = gold * (0.9 + 0.32 * cNoise(p * 8.0));
  return mix(wall, gold * vec3(0.4, 0.24, 0.1), hole);
}
float hcShape(vec3 p) {
  p += vec3(${off.map((x) => x.toFixed(4)).join(', ')});
  vec3 q = abs(p) - vec3(${B.map((x) => x.toFixed(2)).join(', ')}) + ${RR.toFixed(2)};
  float box = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - ${RR.toFixed(2)};
  return box + 0.12 * (sin(1.9 * p.x + 1.3) * sin(2.3 * p.y + 0.5) + sin(2.7 * p.z + 2.1) * sin(1.7 * p.x + 4.0)) + 0.05 * sin(5.1 * p.x) * sin(4.7 * p.y + 1.0) * sin(5.3 * p.z + 2.0);
}`;

export default {
  id: 'honeycomb',
  name: 'Chocolate Honeycomb',
  group: 'crunchy',
  variants: 1,
  feel: { hardness: 0.88, bounce: 0.08, sticky: 0.2, density: 0.6 },
  breaks: { mode: 'crumble', toughness: 0.3, shards: 5, crumbs: { color: 0xe8ab3a, amount: 0.85 } },
  taste: { sweet: 0.95, bitter: 0.1 },
  mouth: { bites: 5, sound: 'crunch' },
  sound: { land: 'hard', cut: 'crumble', pitch: 0.88 },
  build() {
    const min = [-2.2, -1.5, -1.7];
    const max = [2.2, 1.5, 1.7];
    const rough = (x, y, z) => shape(x, y, z) + 0.07 * (noise3(x * 4.2, y * 4.2, z * 4.2) - 0.5);
    const bare = seal((x, y, z) => Math.max(rough(x, y, z), -(dip(x, y, z) + 0.04)), min, max, 0.2);
    const coat = seal((x, y, z) => Math.max(shape(x, y, z) - 0.14, dip(x, y, z)), min, max, 0.2);
    const c = centreAll([bare, coat]);
    const glsls = HONEY(c);
    const honey = `${glsls}
vec3 candyPattern(vec3 p, vec3 base) {
  return hcHoney(p);
}`;
    const dipped = `${glsls}
vec3 candyPattern(vec3 p, vec3 base) {
  vec3 choc = base * (0.9 + 0.24 * cFbm(p * 9.0));
  return mix(hcHoney(p), choc, smoothstep(-0.03, 0.0, hcShape(p)));
}`;
    return {
      layers: [
        { geometry: bare, material: M.wax({ color: GOLD, pattern: honey }), cap: M.wax({ color: GOLD, pattern: honey }) },
        { geometry: coat, material: M.chocolate({ color: 'milk', gloss: 0.6 }), cap: M.wax({ color: 0x6a3d22, glow: 0.1, pattern: dipped }) },
      ],
    };
  },
};
