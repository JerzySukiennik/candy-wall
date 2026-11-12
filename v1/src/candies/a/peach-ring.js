// Peach ring: soft sugared ring with a blushing peach gummy top on a pale cream base.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, glsl, solid } from './_shared.js';

const KINDS = [
  { name: 'Peach Ring', lo: 0xffc22e, hi: 0xff5a2e, base: 0xfff0d2 },
  { name: 'White Peach Ring', lo: 0xffd9b8, hi: 0xff6f8f, base: 0xfffaf0 },
];

export default {
  id: 'peach-ring',
  name: 'Peach Rings',
  group: 'sour',
  variants: KINDS.length,
  feel: { hardness: 0.3, bounce: 0.45, sticky: 0.12, density: 1.15 },
  breaks: { mode: 'slice', toughness: 0.28 },
  taste: { sweet: 0.75, sour: 0.4 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 1.16 },
  build(v) {
    const k = KINDS[v];
    const ring = floor(S.scale(S.torus(1.32, 0.56), 1, 0.84, 1), -0.36, 0.1);
    const g = solid(ring, { min: [-2.05, -0.52, -2.05], max: [2.05, 0.64, 2.05], res: 27 });
    const off = centre([g]);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      float blush = smoothstep(-0.5, 0.8, sin(atan(p.z, p.x) + 0.7) + 0.7 * (cNoise(p * 1.4) - 0.5));
      vec3 top = mix(${glsl(k.lo)}, ${glsl(k.hi)}, blush);
      return mix(${glsl(k.base)}, top, smoothstep(-0.025, 0.025, p.y - ${(off[1] - 0.1).toFixed(4)}));
    }`;
    return {
      name: k.name,
      layers: [
        {
          geometry: g,
          material: mat.gummy({ color: 0xffffff, clarity: 0.5, gloss: 0.4, sugar: 0.82, sugarScale: 14, pattern }),
          cap: mat.gummy({ color: 0xffffff, clarity: 0.55, gloss: 0.6, opaque: true, pattern }),
        },
      ],
    };
  },
};
