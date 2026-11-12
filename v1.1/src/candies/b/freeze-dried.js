// Freeze-dried candies: puffed rainbow balls whose shell has split along curved cracks where the pale airy inside bulges out.
import { bake } from '../../lib/geo.js';
import { M, ball, blend, fbm3, sstep } from './_shared.js';

const KINDS = [
  { name: 'Strawberry Freeze-Dried Candy', color: 0xe0252f, taste: { sweet: 0.8, sour: 0.35 } },
  { name: 'Orange Freeze-Dried Candy', color: 0xff8a1e, taste: { sweet: 0.8, sour: 0.45 } },
  { name: 'Lemon Freeze-Dried Candy', color: 0xffd92e, taste: { sweet: 0.7, sour: 0.6 } },
  { name: 'Lime Freeze-Dried Candy', color: 0x35b84a, taste: { sweet: 0.7, sour: 0.55 } },
  { name: 'Grape Freeze-Dried Candy', color: 0x7a3fc2, taste: { sweet: 0.85, sour: 0.3 } },
];
const A = 4.6;
const OFF = [0.37, 1.21, 2.6];
const W = 0.42;
const gyro = (x, y, z) => Math.sin(A * x) * Math.cos(A * y) + Math.sin(A * y) * Math.cos(A * z) + Math.sin(A * z) * Math.cos(A * x);

export default {
  id: 'freeze-dried',
  name: 'Freeze-Dried Candies',
  group: 'crunchy',
  variants: KINDS.length,
  feel: { hardness: 0.78, bounce: 0.1, sticky: 0, density: 0.25 },
  breaks: { mode: 'crumble', toughness: 0.12, shards: 5, crumbs: { color: 0xfff1e0, amount: 0.9 } },
  taste: { sweet: 0.8, sour: 0.45 },
  mouth: { bites: 3, sound: 'crunch' },
  sound: { land: 'tiny', cut: 'crumble', pitch: 1.24 },
  build(v) {
    const k = KINDS[v];
    const g = ball(1, 48, 30, (d) => {
      const crack = 1 - sstep(0, 1, Math.abs(gyro(d[0] + OFF[0], d[1] + OFF[1], d[2] + OFF[2])));
      const lump = fbm3(d[0] * 1.6 + 3, d[1] * 1.6, d[2] * 1.6, 2) - 0.37;
      return 1 + 0.22 * lump + 0.12 * crack;
    });
    bake(g, { rotate: [v * 1.3, v * 2.1, v * 0.7] });
    const skin = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 q = normalize(p) + vec3(${OFF.map((x) => x.toFixed(2)).join(', ')});
  float a = ${A.toFixed(1)};
  float g = abs(sin(a * q.x) * cos(a * q.y) + sin(a * q.y) * cos(a * q.z) + sin(a * q.z) * cos(a * q.x));
  float crack = 1.0 - smoothstep(0.0, 1.0, (g + 0.22 * (cNoise(p * 8.0) - 0.5) - ${(W * 0.85).toFixed(3)}) / ${(W * 0.15).toFixed(3)});
  vec3 pale = mix(base, vec3(1.0, 0.97, 0.92), 0.8) * (0.86 + 0.2 * cNoise(p * 16.0));
  vec3 c = base * (0.86 + 0.22 * cFbm(p * 4.0));
  c = mix(c, pale, smoothstep(0.62, 0.8, cFbm(p * 7.0 + 4.0)) * 0.45);
  return mix(c, pale, crack);
}`;
    const puff = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 q = p * 7.0;
  vec3 ci = floor(q);
  float rad = 0.18 + 0.24 * cHash1(ci + 5.0);
  float hole = smoothstep(rad, rad - 0.1, length(fract(q) - 0.5 - (cHash3(ci) - 0.5) * 0.4));
  return base * (0.9 + 0.14 * cNoise(p * 20.0)) * (1.0 - 0.3 * hole);
}`;
    return {
      name: k.name,
      taste: k.taste,
      layers: [{ geometry: g, material: M.cream({ color: k.color, pattern: skin }), cap: M.foam({ color: blend(k.color, 0xfff6e8, 0.72), pattern: puff }) }],
    };
  },
};
