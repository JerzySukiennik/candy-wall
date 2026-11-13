// Macarons: two smooth almond shells with ruffled feet around a piped cream disc (three bodies) in four pastel flavours.
import { bake } from '../../lib/geo.js';
import { M, PORES, blend, noise3, spin } from './_shared.js';

const KINDS = [
  { name: 'Raspberry Macaron', shell: 0xf4a3b9, cream: 0xdf4f7c, taste: { sweet: 0.85, sour: 0.2 } },
  { name: 'Pistachio Macaron', shell: 0xb5cd86, cream: 0xe4ecb4, taste: { sweet: 0.85, salty: 0.05 } },
  { name: 'Lemon Macaron', shell: 0xf6dc74, cream: 0xfff3b4, taste: { sweet: 0.8, sour: 0.35 } },
  { name: 'Lavender Macaron', shell: 0xc4afe8, cream: 0x8a61c7, taste: { sweet: 0.9 } },
];

function shell(seed) {
  const pts = [[0, 0.2], [1.0, 0.2], [1.8, 0.2, 1], [2.0, 0.24], [2.1, 0.33], [2.08, 0.43], [1.98, 0.5], [2.02, 0.55]];
  for (let i = 1; i < 9; i++) {
    const a = (i / 9) * Math.PI * 0.5;
    pts.push([2.05 * Math.pow(Math.cos(a), 0.55), 0.55 + 0.6 * Math.pow(Math.sin(a), 0.85)]);
  }
  pts.push([0, 1.15]);
  return spin(pts, 48, {
    warp: (p, a, u) => {
      if (u < 3 || u > 7) return p;
      const w = 1 + 0.07 * (noise3(Math.cos(a) * 9 + seed, p[1] * 16, Math.sin(a) * 9) - 0.5) * (u === 7 ? 0.4 : 1);
      return [p[0] * w, p[1] + 0.04 * (noise3(Math.cos(a) * 7, seed, Math.sin(a) * 7) - 0.5), p[2] * w];
    },
  });
}

export default {
  id: 'macaron',
  name: 'Macarons',
  group: 'crunchy',
  variants: KINDS.length,
  feel: { hardness: 0.42, bounce: 0.1, sticky: 0.15, density: 0.55 },
  breaks: { mode: 'crumble', toughness: 0.15, shards: 4, crumbs: { color: 0xfbe9d4, amount: 0.6 } },
  taste: { sweet: 0.85 },
  mouth: { bites: 3, sound: 'crisp' },
  sound: { land: 'soft', cut: 'crumble', pitch: 1.12 },
  build(v) {
    const k = KINDS[v];
    const skin = `vec3 candyPattern(vec3 p, vec3 base) {
  float foot = smoothstep(0.57, 0.52, abs(p.y)) * smoothstep(1.72, 1.86, length(p.xz));
  float bub = cNoise(p * vec3(20.0, 28.0, 20.0));
  vec3 c = base * (0.95 + 0.08 * cFbm(p * 3.0));
  return mix(c, base * (0.66 + 0.5 * bub), foot);
}`;
    const upper = shell(v * 3.7 + 1);
    const lower = bake(shell(v * 3.7 + 8), { rotate: [Math.PI, 0.9, 0] });
    const cream = spin([[0, -0.22], [1.2, -0.22], [1.75, -0.22], [1.9, -0.12], [1.94, 0], [1.9, 0.12], [1.75, 0.22], [1.2, 0.22], [0, 0.22]], 40, {
      warp: (p, a) => {
        const w = 1 + 0.02 * Math.sin(a * 5 + v);
        return [p[0] * w, p[1], p[2] * w];
      },
    });
    const outer = () => M.cream({ color: k.shell, pattern: skin });
    const inner = () => M.crisp({ color: blend(k.shell, 0xfff3dc, 0.4), pattern: PORES });
    return {
      name: k.name,
      taste: k.taste,
      layers: [
        { geometry: upper, material: outer(), cap: inner() },
        { geometry: cream, material: M.cream({ color: k.cream }), cap: M.cream({ color: blend(k.cream, 0xffffff, 0.15) }) },
        { geometry: lower, material: outer(), cap: inner() },
      ],
    };
  },
};
