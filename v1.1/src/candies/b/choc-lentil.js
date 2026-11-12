// Chocolate lentils: candy-coated chocolate lenses modelled about 1.6 cm across; a cut shows the white sugar shell around a milk chocolate core.
import { M, spin } from './_shared.js';

const KINDS = [
  { name: 'Red Chocolate Lentil', color: 0xd9202a },
  { name: 'Orange Chocolate Lentil', color: 0xf47a1a },
  { name: 'Yellow Chocolate Lentil', color: 0xf9d21c },
  { name: 'Green Chocolate Lentil', color: 0x2fa84a },
  { name: 'Blue Chocolate Lentil', color: 0x2468d8 },
  { name: 'Brown Chocolate Lentil', color: 0x5a321c },
];

function lens(R, H, n) {
  const pts = [[0, -H]];
  for (let i = 1; i < n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push([R * Math.pow(Math.cos(a), 0.85), H * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.9)]);
  }
  pts.push([0, H]);
  return pts;
}

export default {
  id: 'choc-lentil',
  name: 'Chocolate Lentils',
  group: 'chocolate',
  variants: KINDS.length,
  feel: { hardness: 0.87, bounce: 0.25, sticky: 0, density: 1.35 },
  breaks: { mode: 'snap', toughness: 0.3, crumbs: { color: 0xf6f0e4, amount: 0.35 } },
  taste: { sweet: 0.85, bitter: 0.05 },
  mouth: { bites: 3, sound: 'crunch' },
  sound: { land: 'tiny', cut: 'crack', pitch: 1.4 },
  build(v) {
    const k = KINDS[v];
    return {
      name: k.name,
      layers: [
        { geometry: spin(lens(0.8, 0.43, 14), 32), material: M.shell({ color: k.color, gloss: 0.9 }), cap: M.matte({ color: 0xf6f0e4, roughness: 0.6 }) },
        { geometry: spin(lens(0.61, 0.25, 8), 22), inside: 0, material: M.chocolate({ color: 'milk', gloss: 0.2 }), fill: { type: 'solid', color: 0x6a3d22 } },
      ],
    };
  },
};
