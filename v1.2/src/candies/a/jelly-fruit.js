// Jelly fruit: very soft, wobbly, clear jelly pods moulded as little fruits (orange, grape bunch, pear, peach).
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, link, solid } from './_shared.js';

function orange() {
  const f = (x, y, z) => {
    const q = Math.hypot(x, z);
    const r = Math.hypot(x, y * 1.12, z);
    return r - 1.22 * (1 + 0.032 * Math.cos(Math.atan2(z, x) * 8) * Math.min(1, q / 0.6));
  };
  const nub = S.move(S.ellipsoid(0.2, 0.12, 0.2), 0, 1.08, 0);
  return solid(floor(S.smooth(0.08, f, nub), -0.62, 0.15), { min: [-1.5, -0.8, -1.5], max: [1.5, 1.38, 1.5], res: 22 });
}

function grape() {
  const balls = [];
  const rows = [4, 3, 2, 1];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) balls.push(S.move(S.sphere(0.5), (i - (n - 1) / 2) * 0.74, 0.16 + (r % 2) * 0.06, -1.0 + r * 0.66));
  });
  const stalk = link([0, 0.2, -1.2], [0.1, 0.3, -1.75], 0.17, 0.14);
  return solid(floor(S.smooth(0.14, ...balls, stalk), -0.12, 0.08), { min: [-1.8, -0.28, -2.1], max: [1.8, 0.9, 1.7], res: 29 });
}

function pear() {
  const f = S.scale(S.smooth(0.1, link([-0.55, 0, 0], [0.85, 0.02, 0], 0.98, 0.52), link([1.2, 0.05, 0], [1.75, 0.2, 0.05], 0.15, 0.12)), 1, 0.9, 1);
  return solid(floor(f, -0.5, 0.15), { min: [-1.75, -0.66, -1.2], max: [2.1, 1.05, 1.2], res: 24 });
}

function peach() {
  const round = S.scale(S.sphere(1.12), 1.06, 0.9, 1);
  const f = (x, y, z) => round(x, y, z) + 0.1 * Math.exp(-(x * x) / 0.014) * Math.min(1, Math.max(0, (y + 0.2) / 0.5));
  const nub = link([0, 0.8, -0.62], [0.06, 0.88, -1.0], 0.22, 0.17);
  return solid(floor(S.smooth(0.1, f, nub), -0.5, 0.18), { min: [-1.4, -0.66, -1.4], max: [1.4, 1.22, 1.3], res: 22 });
}

const KINDS = [
  { name: 'Orange Jelly Fruit', color: 0xff8a14, make: orange },
  { name: 'Grape Jelly Fruit', color: 0x8f3fe0, make: grape },
  { name: 'Pear Jelly Fruit', color: 0x9be02a, make: pear },
  { name: 'Peach Jelly Fruit', color: 0xff6f9c, make: peach },
];

export default {
  id: 'jelly-fruit',
  name: 'Jelly Fruits',
  group: 'jelly',
  variants: KINDS.length,
  feel: { hardness: 0.08, bounce: 0.95, sticky: 0.05, density: 1.05 },
  breaks: { mode: 'slice', toughness: 0.06 },
  taste: { sweet: 0.75, sour: 0.15 },
  mouth: { bites: 2, sound: 'soft' },
  sound: { land: 'soft', cut: 'squish', pitch: 0.82 },
  build(v) {
    const k = KINDS[v];
    const g = k.make();
    centre([g]);
    return {
      name: k.name,
      layers: [{ geometry: g, material: mat.gummy({ color: k.color, clarity: 0.8, gloss: 1 }), cap: mat.gummy({ color: k.color, clarity: 0.72, gloss: 1 }) }],
    };
  },
};
