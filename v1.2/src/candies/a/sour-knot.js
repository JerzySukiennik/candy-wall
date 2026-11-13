// Sour knot: a thin sugared gummy rope tied into a pretzel-style knot that lies flat, in three two-tone colours.
import { mat } from '../../lib/mat.js';
import { centre, glsl, sweep } from './_shared.js';

const KINDS = [
  { name: 'Strawberry Sour Knot', a: 0xf0183a, b: 0xff8fa8 },
  { name: 'Blue Raspberry Sour Knot', a: 0x168cf5, b: 0x7fe0ff },
  { name: 'Green Apple Sour Knot', a: 0x35c92f, b: 0xe6f03a },
];
const R = 0.27;
const HALF = [
  [-1.0, 0.7, -1.4],
  [-0.62, 0.52, -0.62],
  [0, 0.8, 0.12],
  [0.62, 0.5, 0.72],
  [1.28, 0.3, 1.16],
  [1.92, 0.27, 0.88],
  [2.2, 0.27, 0.1],
  [1.86, 0.27, -0.82],
  [1.02, 0.27, -1.46],
];

export default {
  id: 'sour-knot',
  name: 'Sour Knots',
  group: 'sour',
  variants: KINDS.length,
  feel: { hardness: 0.3, bounce: 0.4, sticky: 0.12, density: 1.25 },
  breaks: { mode: 'slice', toughness: 0.32 },
  taste: { sweet: 0.55, sour: 0.75 },
  mouth: { bites: 5, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 1.1 },
  build(v) {
    const k = KINDS[v];
    const path = HALF.map(([x, y, u]) => [x, y, -u]);
    path.push([0, 0.27, 1.72]);
    for (let i = HALF.length - 1; i >= 0; i--) {
      const [x, y, u] = HALF[i];
      path.push([-x, i === 2 || i === 3 ? 0.27 : i === 1 ? 0.4 : y, -u]);
    }
    const g = sweep(path, { radius: R, sides: 9, step: 0.13, cap: R });
    centre([g]);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      return mix(${glsl(k.a)}, ${glsl(k.b)}, smoothstep(-1.6, 1.6, p.x + 0.5 * (cNoise(p * 1.3) - 0.5)));
    }`;
    return {
      name: k.name,
      layers: [
        {
          geometry: g,
          material: mat.gummy({ color: 0xffffff, clarity: 0.55, gloss: 0.4, sugar: 0.8, sugarScale: 16, pattern }),
          cap: mat.gummy({ color: 0xffffff, clarity: 0.6, gloss: 0.7, opaque: true, pattern }),
        },
      ],
    };
  },
};
