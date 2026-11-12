// Popping rocks: jagged faceted clusters of carbonated sugar crystals (union of random convex polyhedra, flat shaded) that fizz in the mouth.
import { S } from '../../lib/geo.js';
import { rng } from '../../util.js';
import { M, TAU, facet, recentre, seal } from './_shared.js';

const KINDS = [
  { name: 'Strawberry Popping Rocks', color: 0xff3b6b },
  { name: 'Blue Raspberry Popping Rocks', color: 0x3aa7ff },
  { name: 'Green Apple Popping Rocks', color: 0x7be33a },
];
const AXES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function crystal(r, c, size) {
  const planes = [];
  for (const a of AXES) {
    const n = [a[0] + (r() - 0.5) * 0.7, a[1] + (r() - 0.5) * 0.7, a[2] + (r() - 0.5) * 0.7];
    const l = Math.hypot(n[0], n[1], n[2]);
    planes.push([n[0] / l, n[1] / l, n[2] / l, size * (0.7 + 0.35 * r())]);
  }
  const extra = 4 + Math.floor(r() * 4);
  for (let i = 0; i < extra; i++) {
    const y = 2 * r() - 1;
    const a = TAU * r();
    const s = Math.sqrt(1 - y * y);
    planes.push([s * Math.cos(a), y, s * Math.sin(a), size * (0.5 + 0.35 * r())]);
  }
  return (x, y, z) => {
    let d = -Infinity;
    for (const p of planes) {
      const q = (x - c[0]) * p[0] + (y - c[1]) * p[1] + (z - c[2]) * p[2] - p[3];
      if (q > d) d = q;
    }
    return d;
  };
}

export default {
  id: 'popping-rocks',
  name: 'Popping Rocks',
  group: 'hard',
  variants: KINDS.length,
  feel: { hardness: 0.96, bounce: 0.2, sticky: 0.05, density: 1.1 },
  breaks: { mode: 'shatter', toughness: 0.25, shards: 6, crumbs: { color: 0xffe3ee, amount: 0.9 } },
  taste: { sweet: 0.7, sour: 0.3, fizz: 1 },
  mouth: { bites: 3, sound: 'fizz' },
  sound: { land: 'tiny', cut: 'crack', pitch: 1.34 },
  build(v) {
    const k = KINDS[v];
    const r = rng(1301 + v * 97);
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const c = i === 0 ? [0, 0, 0] : [(r() - 0.5) * 1.5, (r() - 0.5) * 0.8, (r() - 0.5) * 1.3];
      parts.push(crystal(r, c, i === 0 ? 0.62 : 0.34 + 0.24 * r()));
    }
    const g = facet(recentre(seal(S.smooth(0.1, ...parts), [-2.0, -1.6, -2.0], [2.0, 1.6, 2.0], 0.105)));
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 q = p * 17.0;
  vec3 ci = floor(q);
  float d = length(fract(q) - 0.5 - (cHash3(ci) - 0.5) * 0.6);
  float bubble = smoothstep(0.2, 0.12, d) * step(0.72, cHash1(ci + 3.0));
  vec3 c = base * (0.72 + 0.5 * cNoise(p * 7.0));
  return mix(c, vec3(1.0), bubble * 0.55);
}`;
    return {
      name: k.name,
      layers: [
        { geometry: g, material: M.hard({ color: k.color, clarity: 0.5, glow: 0.3, sugar: 0.22, sugarScale: 26, pattern }), cap: M.hard({ color: k.color, clarity: 0.4, opaque: true, pattern }) },
      ],
    };
  },
};
