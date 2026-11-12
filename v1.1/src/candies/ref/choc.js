// Reference candy: small milk chocolate bar that snaps along its grooves.
import { S, meshSDF } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';

export default {
  id: 'ref-choc',
  name: 'Chocolate Bars',
  group: 'chocolate',
  variants: 2,
  feel: { hardness: 0.85, bounce: 0.05, sticky: 0, density: 1.3 },
  breaks: { mode: 'snap', toughness: 0.5, grooves: [{ n: [1, 0, 0], d: -1 }, { n: [1, 0, 0], d: 1 }, { n: [0, 0, 1], d: 0 }], crumbs: { color: 0x4a2a17, amount: 0.3 } },
  taste: { sweet: 0.7, bitter: 0.15 },
  mouth: { bites: 3, sound: 'snap' },
  sound: { land: 'choc', cut: 'snap', pitch: 1 },
  build(v) {
    const pips = [];
    for (const x of [-2, 0, 2]) for (const z of [-1, 1]) pips.push(S.move(S.box(0.86, 0.3, 0.86, 0.2), x, 0.12, z));
    const bar = S.smooth(0.12, S.move(S.box(3.0, 0.2, 2.0, 0.12), 0, -0.22, 0), ...pips);
    const g = meshSDF(bar, { min: [-3.2, -0.6, -2.2], max: [3.2, 0.6, 2.2], res: 46 });
    const kind = v === 0 ? 'milk' : 'dark';
    return { name: (v === 0 ? 'Milk' : 'Dark') + ' Chocolate Bar', taste: v === 0 ? { sweet: 0.8, bitter: 0.1 } : { sweet: 0.35, bitter: 0.6 }, layers: [{ geometry: g, material: mat.chocolate({ color: kind, gloss: 0.6 }), cap: mat.chocolate({ color: kind, gloss: 0.05 }) }] };
  },
};
