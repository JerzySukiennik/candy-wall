// Gummy worm: long soft ridged neon worm in two blended colours, gently curved and lying flat, one sour sugared variant.
import { mat } from '../../lib/mat.js';
import { rng } from '../../util.js';
import { centre, glsl, sweep } from './_shared.js';

const PAIRS = [
  { name: 'Cherry Lemon Gummy Worm', a: 0xf01238, b: 0xffd91a, sugar: 0, taste: { sweet: 0.8, sour: 0.15 } },
  { name: 'Lime Orange Gummy Worm', a: 0x2fd03a, b: 0xff7a12, sugar: 0, taste: { sweet: 0.8, sour: 0.2 } },
  { name: 'Blue Raspberry Gummy Worm', a: 0x1590ff, b: 0xff3fa8, sugar: 0, taste: { sweet: 0.85, sour: 0.15 } },
  { name: 'Sour Grape Apple Gummy Worm', a: 0x9a3fff, b: 0x74f02a, sugar: 0.8, taste: { sweet: 0.5, sour: 0.85 } },
];

export default {
  id: 'gummy-worm',
  name: 'Gummy Worms',
  group: 'gummy',
  variants: PAIRS.length,
  feel: { hardness: 0.25, bounce: 0.5, sticky: 0.15, density: 1.25 },
  breaks: { mode: 'slice', toughness: 0.22 },
  taste: { sweet: 0.8, sour: 0.15 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 0.9 },
  build(v) {
    const k = PAIRS[v];
    const r = rng(31 + v * 7);
    const phase = r() * 6.28;
    const amp = 0.3 + r() * 0.3;
    const path = [];
    for (let i = 0; i <= 10; i++) {
      const x = -3.95 + i * 0.79;
      path.push([x, 0, amp * Math.sin(x * 0.72 + phase)]);
    }
    const radius = (s, a, L) => {
      const w = Math.min(1, Math.max(0, (Math.min(s, L - s) - 0.8) / 0.6));
      return (0.37 + 0.06 * Math.sin((s / L) * Math.PI)) * (1 + 0.09 * w * Math.cos((s * Math.PI * 2) / 0.44));
    };
    const g = sweep(path, { radius, sides: 10, step: 0.11, cap: 0.38, warp: (u, w) => [u, Math.max(w, -0.25)] });
    centre([g]);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      return mix(${glsl(k.a)}, ${glsl(k.b)}, smoothstep(-0.9, 0.9, p.x + 0.25 * (cNoise(p * 1.7) - 0.5)));
    }`;
    return {
      name: k.name,
      taste: k.taste,
      layers: [{ geometry: g, material: mat.gummy({ color: 0xffffff, clarity: 0.6, gloss: 0.88, sugar: k.sugar, sugarScale: 15, pattern }) }],
    };
  },
};
