// Gum drop: classic soft sugared dome with a flat base, five fruit colours.
import { lathe } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre } from './_shared.js';

const FLAVOURS = [
  { name: 'Cherry', color: 0xd80f2a },
  { name: 'Orange', color: 0xff7a0f },
  { name: 'Lemon', color: 0xffd000 },
  { name: 'Lime', color: 0x2bb83a },
  { name: 'Grape', color: 0x7a2bd0 },
];

function profile() {
  const pts = [[0, 0.78]];
  for (let i = 1; i <= 7; i++) {
    const a = (i / 7) * Math.PI * 0.5;
    pts.push([Math.sin(a) * 0.74, 0.24 + Math.cos(a) * 0.54]);
  }
  pts.push([0.86, -0.25], [0.97, -0.62], [0.96, -0.72], [0.88, -0.78], [0, -0.78]);
  return pts.reverse();
}

export default {
  id: 'gum-drop',
  name: 'Gum Drops',
  group: 'gummy',
  variants: FLAVOURS.length,
  feel: { hardness: 0.3, bounce: 0.35, sticky: 0.14, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.3 },
  taste: { sweet: 0.9, sour: 0.1 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squish', pitch: 1.26 },
  build(v) {
    const f = FLAVOURS[v];
    const g = lathe(profile(), 28);
    centre([g]);
    return {
      name: f.name + ' Gum Drop',
      layers: [{ geometry: g, material: mat.gummy({ color: f.color, clarity: 0.5, gloss: 0.4, sugar: 0.92, sugarScale: 17 }), cap: mat.gummy({ color: f.color, clarity: 0.6, gloss: 0.7, opaque: true }) }],
    };
  },
};
