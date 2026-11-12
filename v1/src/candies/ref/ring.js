// Reference candy: two-tone sour sugar ring (vertex colours + sugar crystals).
import { S, meshSDF, tint } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';

const PAIRS = [[0xff8a3c, 0xfff0c8], [0x7be04a, 0xfff7d0], [0xff5fa2, 0xfff0e6]];

export default {
  id: 'ref-ring',
  name: 'Sour Rings',
  group: 'sour',
  variants: PAIRS.length,
  feel: { hardness: 0.3, bounce: 0.5, sticky: 0.1, density: 1.2 },
  breaks: { mode: 'slice', toughness: 0.25 },
  taste: { sweet: 0.6, sour: 0.6 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 1.2 },
  build(v) {
    const g = meshSDF(S.scale(S.torus(1.3, 0.55), 1, 0.8, 1), { min: [-2.05, -0.6, -2.05], max: [2.05, 0.6, 2.05], res: 30 });
    const [top, bottom] = PAIRS[v];
    tint(g, (x, y) => (y > -0.05 ? top : bottom));
    const m = mat.gummy({ vertexColors: true, clarity: 0.45, gloss: 0.4, sugar: 0.75 });
    return { layers: [{ geometry: g, material: m, cap: mat.gummy({ vertexColors: true, clarity: 0.5, gloss: 0.6, opaque: true }) }] };
  },
};
