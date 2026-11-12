// Fried egg: soft foam egg-white slab with a clear yellow gummy yolk dome on top (two bodies).
import { S, S2 } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { rng } from '../../util.js';
import { above, centre, lay, solid } from './_shared.js';

export default {
  id: 'fried-egg',
  name: 'Fried Eggs',
  group: 'foam',
  variants: 3,
  feel: { hardness: 0.35, bounce: 0.5, sticky: 0.1, density: 0.9 },
  breaks: { mode: 'slice', toughness: 0.3 },
  taste: { sweet: 0.85 },
  mouth: { bites: 3, sound: 'soft' },
  sound: { land: 'foam', cut: 'foam', pitch: 0.96 },
  build(v) {
    const r = rng(11 + v * 5);
    const lobes = [S2.circle(1.4)];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + r() * 1.2;
      const d = 0.75 + r() * 0.35;
      lobes.push(S2.move(S2.circle(0.62 + r() * 0.25), Math.cos(a) * d, Math.sin(a) * d));
    }
    const white = solid(lay(S.extrude(S2.smooth(0.55, ...lobes), 0.27, 0.2)), { min: [-2.2, -0.44, -2.2], max: [2.2, 0.44, 2.2], res: 28 });
    const yolk = solid(above(S.move(S.ellipsoid(0.86, 0.74, 0.86), 0.08, -0.02, 0.04), 0.25), { min: [-0.95, 0.09, -1.0], max: [1.1, 0.88, 1.06], res: 15 });
    centre([white, yolk]);
    return {
      name: 'Fried Egg Gummy',
      layers: [
        { geometry: white, material: mat.foam({ color: 0xfffaf2 }), cap: mat.foam({ color: 0xffffff }) },
        { geometry: yolk, material: mat.gummy({ color: 0xff9a00, clarity: 0.6, gloss: 1 }), cap: mat.gummy({ color: 0xffb400, clarity: 0.6, gloss: 0.7, opaque: true }) },
      ],
    };
  },
};
