// Twin cherry: two sugared red gummy cherries joined by a forked green gummy stem with a leaf (two bodies).
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, link, solid } from './_shared.js';

export default {
  id: 'twin-cherry',
  name: 'Twin Cherries',
  group: 'gummy',
  variants: 1,
  feel: { hardness: 0.45, bounce: 0.5, sticky: 0.1, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.45 },
  taste: { sweet: 0.8, sour: 0.3 },
  mouth: { bites: 5, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 0.94 },
  build() {
    const fruit = floor(S.mirror(S.move(S.scale(S.sphere(0.92), 1, 0.86, 1), 1.16, 0.32, 0.85), 'x'), 0, 0.1);
    const arm = S.mirror(S.smooth(0.12, link([1.16, 1.08, 0.72], [1.0, 0.82, 0.02], 0.2, 0.2), link([1.0, 0.82, 0.02], [0.62, 0.3, -0.9], 0.2, 0.2), link([0.62, 0.3, -0.9], [0, 0.27, -1.75], 0.2, 0.23)), 'x');
    const leaf = S.move(S.rotY(S.ellipsoid(0.6, 0.17, 0.3), 0.45), 0.5, 0.2, -2.0);
    const stem = floor(S.smooth(0.12, arm, S.move(S.sphere(0.3), 0, 0.27, -1.8), leaf), 0, 0.05);
    const cherries = (x, y, z) => Math.max(fruit(x, y, z), -stem(x, y, z) - 0.02);
    const a = solid(cherries, { min: [-2.3, -0.16, -0.25], max: [2.3, 1.28, 1.95], res: 31 });
    const b = solid(stem, { min: [-1.6, -0.16, -2.75], max: [1.6, 1.45, 1.12], res: 26 });
    centre([a, b]);
    return {
      name: 'Twin Cherry Gummy',
      layers: [
        { geometry: a, material: mat.gummy({ color: 0xcf0a24, clarity: 0.6, gloss: 0.6, sugar: 0.55, sugarScale: 15 }) },
        { geometry: b, material: mat.gummy({ color: 0x2aa838, clarity: 0.55, gloss: 0.6, sugar: 0.45, sugarScale: 15 }) },
      ],
    };
  },
};
