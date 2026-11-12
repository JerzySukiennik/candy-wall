// Chocolate bars: 3 x 2 moulded squares on a base plate that snap along the grooves, in milk, dark and white.
import { GRAIN, M, slab, sstep } from './_shared.js';

const KINDS = [
  { name: 'Milk Chocolate Bar', color: 'milk', taste: { sweet: 0.8, bitter: 0.1 } },
  { name: 'Dark Chocolate Bar', color: 'dark', taste: { sweet: 0.35, bitter: 0.6 } },
  { name: 'White Chocolate Bar', color: 'white', taste: { sweet: 0.95 } },
];
const CELL = [1, 0.95, 0.9, 0.85, 0.8, 0.74, 0.54, 0.46];

function axis(cells) {
  const out = new Set();
  for (let c = 0; c < cells; c++) {
    const mid = -cells + 1 + c * 2;
    for (const u of CELL) {
      out.add(Math.round((mid - u) * 1000) / 1000);
      out.add(Math.round((mid + u) * 1000) / 1000);
    }
  }
  return [...out].sort((a, b) => a - b);
}

const local = (x, cells) => x - (-cells + 1 + 2 * Math.min(cells - 1, Math.max(0, Math.floor((x + cells) / 2))));
const prof = (u) => sstep(0.96, 0.74, Math.abs(u));

export default {
  id: 'choc-bar',
  name: 'Chocolate Bars',
  group: 'chocolate',
  variants: KINDS.length,
  feel: { hardness: 0.85, bounce: 0.05, sticky: 0.02, density: 1.3 },
  breaks: { mode: 'snap', toughness: 0.5, grooves: [{ n: [1, 0, 0], d: -1 }, { n: [1, 0, 0], d: 1 }, { n: [0, 0, 1], d: 0 }], crumbs: { color: 0x4a2a17, amount: 0.3 } },
  taste: { sweet: 0.7, bitter: 0.15 },
  mouth: { bites: 4, sound: 'snap' },
  sound: { land: 'choc', cut: 'snap', pitch: 0.94 },
  build(v) {
    const k = KINDS[v];
    const top = (x, z) => {
      const ux = local(x, 3);
      const uz = local(z, 2);
      return -0.11 + 0.5 * prof(ux) * prof(uz) + 0.04 * (1 - sstep(0.46, 0.54, Math.max(Math.abs(ux), Math.abs(uz))));
    };
    const g = slab(axis(3), axis(2), top, -0.43);
    return {
      name: k.name,
      taste: k.taste,
      layers: [{ geometry: g, material: M.chocolate({ color: k.color, gloss: 0.62 }), cap: M.chocolate({ color: k.color, gloss: 0.06, pattern: GRAIN }) }],
    };
  },
};
