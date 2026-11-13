// Juice burst: very soft opaque hexagonal gem with a thin wall around a big pocket of runny juice that gushes when cut.
import { mat } from '../../lib/mat.js';
import { centre, solid } from './_shared.js';

const FLAVOURS = [
  { name: 'Peach', shell: 0xffa37a, juice: 0xff6a1f, taste: { sweet: 0.9, sour: 0.15 } },
  { name: 'Grape', shell: 0xb48cff, juice: 0x7424e0, taste: { sweet: 0.85, sour: 0.2 } },
  { name: 'Green Apple', shell: 0xb6ec6c, juice: 0x62cc00, taste: { sweet: 0.7, sour: 0.45 } },
  { name: 'Wild Berry', shell: 0xff7fb4, juice: 0xf01566, taste: { sweet: 0.85, sour: 0.25 } },
];
const A = 1.02;
const H = 0.56;
const CB = Math.cos(0.7);
const SB = Math.sin(0.7);

function gem(x, y, z) {
  let d = Math.abs(y) - H;
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3;
    const q = x * Math.cos(a) + z * Math.sin(a);
    d = Math.max(d, q - A, q * CB + y * SB - (A * CB + 0.1 * SB), q * CB - y * SB - (A * CB + 0.36 * SB));
  }
  return d - 0.16;
}

export default {
  id: 'juice-burst',
  name: 'Juice Bursts',
  group: 'jelly',
  variants: FLAVOURS.length,
  feel: { hardness: 0.2, bounce: 0.6, sticky: 0.1, density: 1.15 },
  breaks: { mode: 'slice', toughness: 0.15 },
  taste: { sweet: 0.85, sour: 0.2 },
  mouth: { bites: 2, sound: 'gooey' },
  sound: { land: 'soft', cut: 'squish', pitch: 1.2 },
  build(v) {
    const f = FLAVOURS[v];
    const body = solid(gem, { min: [-1.5, -0.9, -1.5], max: [1.5, 0.9, 1.5], res: 21 });
    const core = solid((x, y, z) => gem(x, y, z) + 0.23, { min: [-1.25, -0.7, -1.25], max: [1.25, 0.7, 1.25], res: 15 });
    centre([body, core]);
    const juice = mat.liquid({ color: f.juice, clarity: 0.85 });
    return {
      name: f.name + ' Juice Burst',
      taste: f.taste,
      layers: [
        { geometry: body, material: mat.gummy({ color: f.shell, clarity: 0.3, gloss: 0.75 }), cavity: juice },
        { geometry: core, inside: 0, material: juice, fill: { type: 'liquid', color: f.juice, viscosity: 0.1, amount: 1 } },
      ],
    };
  },
};
