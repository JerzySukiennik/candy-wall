// Marshmallows: puffy white and pink cylinders plus a twisted two-colour rope, the softest thing on the wall.
import { M, TAU, glsl, grid, noise3, spin } from './_shared.js';

const KINDS = [
  { name: 'White Marshmallow', color: 0xfbf7f0 },
  { name: 'Pink Marshmallow', color: 0xffc2d4 },
  { name: 'Twisted Marshmallow', color: 0xfbf7f0 },
];
const PORE = `float n = cNoise(p * 30.0);
  c *= (0.95 + 0.07 * cFbm(p * 6.0)) * (1.0 - 0.1 * smoothstep(0.6, 0.9, n));`;
const L = 5.2;
const K = (TAU * 1.25) / L;

function cylinder(seed) {
  const R = 1.35;
  const H = 1.25;
  const c = 0.34;
  const pts = [[0, -H], [(R - c) * 0.55, -H], [R - c, -H]];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 0.5;
    pts.push([R - c + c * Math.sin(a), -H + c - c * Math.cos(a)]);
  }
  pts.push([R * 1.012, -H / 3], [R * 1.012, H / 3]);
  for (let i = 6; i >= 1; i--) {
    const a = (i / 6) * Math.PI * 0.5;
    pts.push([R - c + c * Math.sin(a), H - c + c * Math.cos(a)]);
  }
  pts.push([R - c, H], [(R - c) * 0.55, H], [0, H]);
  return spin(pts, 40, {
    warp: (p) => {
      const w = 1 + 0.07 * (noise3(p[0] * 0.8 + seed, p[1] * 0.8, p[2] * 0.8) - 0.5);
      return [p[0] * w, p[1] + 0.05 * (noise3(p[0] * 0.7, seed + 3, p[2] * 0.7) - 0.5) * (p[1] / H), p[2] * w];
    },
  });
}

function twist() {
  const rows = [0, 0.012, 0.03, 0.06];
  for (let i = 0; i <= 32; i++) rows.push(0.1 + (0.8 * i) / 32);
  rows.push(0.94, 0.97, 0.988, 1);
  const a = 0.72;
  const c = 0.44;
  return grid(rows, 32, (u, v) => {
    const x = -L / 2 + L * u;
    const th = v * TAU;
    const t = th - K * x;
    const m = Math.min(u, 1 - u) / 0.1;
    const e = m >= 1 ? 1 : Math.sqrt(Math.max(0, 1 - (1 - m) * (1 - m)));
    const r = e * (c * Math.abs(Math.cos(t)) + Math.sqrt(a * a - c * c * Math.sin(t) * Math.sin(t)));
    return [x, r * Math.cos(th), r * Math.sin(th)];
  });
}

export default {
  id: 'marshmallow',
  name: 'Marshmallows',
  group: 'foam',
  variants: KINDS.length,
  feel: { hardness: 0.05, bounce: 0.3, sticky: 0.25, density: 0.3 },
  breaks: { mode: 'slice', toughness: 0.08 },
  taste: { sweet: 0.85 },
  mouth: { bites: 2, sound: 'soft' },
  sound: { land: 'foam', cut: 'foam', pitch: 1.26 },
  build(v) {
    const k = KINDS[v];
    if (v < 2) {
      const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 c = base;
  ${PORE}
  return c;
}`;
      return { name: k.name, layers: [{ geometry: cylinder(v * 9.1 + 2), material: M.foam({ color: k.color }), cap: M.foam({ color: k.color, pattern }) }] };
    }
    const two = (pores) => `vec3 candyPattern(vec3 p, vec3 base) {
  float a = atan(p.z, p.y) - ${K.toFixed(5)} * p.x;
  vec3 c = mix(base, ${glsl(0xffb3ca)}, smoothstep(-0.05, 0.05, cos(a)));
  ${pores ? PORE : ''}
  return c;
}`;
    return { name: k.name, layers: [{ geometry: twist(), material: M.foam({ color: k.color, pattern: two(false) }), cap: M.foam({ color: k.color, pattern: two(true) }) }] };
  },
};
