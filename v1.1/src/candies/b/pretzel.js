// Mini pretzels: a knotted rope of baked dough with coarse salt; plain, or half dipped in dark chocolate (the cut face finds the pretzel inside the coat analytically).
import { detail } from '../../lib/geo.js';
import { M, PORES, centreAll, glsl, rope, seal } from './_shared.js';

const KINDS = [
  { name: 'Salted Mini Pretzel', taste: { salty: 0.75, sweet: 0.1 } },
  { name: 'Chocolate-Dipped Mini Pretzel', taste: { salty: 0.45, sweet: 0.65 } },
];
const PATH = [
  [-1.25, 0.34, 1.3], [-0.6, 0.3, 0.45], [0, 0.3, -0.2], [0.6, 0.1, -0.85], [1.3, 0, -1.35], [2.0, 0, -1.0], [2.25, 0, -0.1], [1.85, 0, 0.95], [1.0, 0, 1.55], [0, 0, 1.75],
  [-1.0, 0, 1.55], [-1.85, 0, 0.95], [-2.25, 0, -0.1], [-2.0, 0, -1.0], [-1.3, 0, -1.35], [-0.6, 0, -0.85], [0, 0, -0.2], [0.6, 0.12, 0.45], [1.25, 0.34, 1.3],
];
const BREAD = 0xead9b0;

export default {
  id: 'pretzel',
  name: 'Mini Pretzels',
  group: 'salty',
  variants: KINDS.length,
  feel: { hardness: 0.92, bounce: 0.1, sticky: 0, density: 0.5 },
  breaks: { mode: 'snap', toughness: 0.2, crumbs: { color: 0xd9b271, amount: 0.5 } },
  taste: { salty: 0.75, sweet: 0.1 },
  mouth: { bites: 4, sound: 'crunch' },
  sound: { land: 'crisp', cut: 'snap', pitch: 1.14 },
  build(v) {
    const k = KINDS[v];
    const N = 56;
    const fine = (cell) => Math.min(cell, 0.25 * detail());
    const knot = rope(PATH, (t) => 0.27 + 0.11 * Math.pow(Math.sin(Math.PI * t), 2), { samples: N, pad: 0.2, parts: [0.22, 0.78], k: 0.15 });
    const crust = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 c = base * (0.6 + 0.6 * cFbm(p * 2.2));
  c = mix(c * vec3(1.5, 1.3, 1.0), c, smoothstep(-0.35, 0.0, p.y));
  float split = smoothstep(0.035, 0.0, abs(cNoise(p * 1.3 + 3.0) - 0.5));
  return mix(c, ${glsl(0xd2a468)}, split * 0.5);
}`;
    const baked = () => M.chocolate({ color: 0x7c3a14, gloss: 0.62, pattern: crust, sugar: 0.14, sugarScale: 6.5 });
    const crumb = () => M.crisp({ color: BREAD, pattern: PORES });
    if (v === 0) {
      const g = seal(knot.f, knot.min, knot.max, fine(0.17));
      centreAll([g]);
      return { name: k.name, taste: k.taste, layers: [{ geometry: g, material: baked(), cap: crumb() }] };
    }
    const dip = (x, y, z) => 0.97 * x + 0.24 * z + 0.4;
    const plain = seal((x, y, z) => Math.max(knot.f(x, y, z), -(dip(x, y, z) + 0.03)), knot.min, knot.max, fine(0.19));
    const coat = seal((x, y, z) => Math.max(knot.f(x, y, z) - 0.1, dip(x, y, z)), knot.min, knot.max, fine(0.19));
    const c = centreAll([plain, coat]);
    const heart = `const vec3 PZ[${N + 1}] = vec3[${N + 1}](${knot.pts.map((q) => `vec3(${q.map((x) => x.toFixed(3)).join(', ')})`).join(', ')});
vec3 candyPattern(vec3 p, vec3 base) {
  vec3 w = p + vec3(${c.map((x) => x.toFixed(4)).join(', ')});
  float best = 1e9;
  for (int i = 0; i < ${N}; i++) {
    vec3 a = PZ[i];
    vec3 ba = PZ[i + 1] - a;
    vec3 pa = w - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float s = sin(3.14159 * (float(i) + h) / ${N}.0);
    best = min(best, length(pa - ba * h) - (0.27 + 0.11 * s * s));
  }
  float n = cNoise(p * 34.0);
  vec3 bread = ${glsl(BREAD)} * (0.86 + 0.2 * cFbm(p * 7.0)) * (1.0 - 0.3 * smoothstep(0.62, 0.9, n));
  vec3 choc = base * (0.9 + 0.24 * cFbm(p * 9.0));
  return mix(bread, choc, smoothstep(-0.035, -0.005, best));
}`;
    return {
      name: k.name,
      taste: k.taste,
      layers: [
        { geometry: plain, material: baked(), cap: crumb() },
        { geometry: coat, material: M.chocolate({ color: 'dark', gloss: 0.68 }), cap: M.chocolate({ color: 'dark', gloss: 0.08, pattern: heart }) },
      ],
    };
  },
};
