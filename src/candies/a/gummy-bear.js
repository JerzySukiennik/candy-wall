// Gummy bear: classic firm moulded bear lying on its flat back, five fruit colours.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, lay, solid } from './_shared.js';

const FLAVOURS = [
  { name: 'Raspberry', color: 0xb8081f },
  { name: 'Orange', color: 0xe86a08 },
  { name: 'Lemon', color: 0xeab308 },
  { name: 'Apple', color: 0x1f9a28 },
  { name: 'Pineapple', color: 0xe9d9a0 },
];

export default {
  id: 'gummy-bear',
  name: 'Gummy Bears',
  group: 'gummy',
  variants: FLAVOURS.length,
  feel: { hardness: 0.5, bounce: 0.5, sticky: 0.1, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.5 },
  taste: { sweet: 0.8, sour: 0.1 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'rubber', cut: 'squeak', pitch: 1.22 },
  build(v) {
    const f = FLAVOURS[v];
    const at = (g, x, y, z) => S.move(g, x, y, z);
    const pair = (g, x, y, z) => S.mirror(S.move(g, x, y, z), 'x');
    const bear = S.smooth(
      0.13,
      at(S.ellipsoid(0.58, 0.52, 0.5), 0, 0.8, 0.36),
      at(S.ellipsoid(0.62, 0.74, 0.54), 0, -0.3, 0.36),
      at(S.ellipsoid(0.4, 0.46, 0.3), 0, -0.34, 0.74),
      at(S.ellipsoid(0.26, 0.2, 0.22), 0, 0.66, 0.8),
      pair(S.sphere(0.21), 0.42, 1.2, 0.26),
      pair(S.ellipsoid(0.21, 0.24, 0.25), 0.56, 0.1, 0.62),
      pair(S.ellipsoid(0.27, 0.3, 0.32), 0.38, -0.98, 0.5)
    );
    const g = solid(floor(lay(bear), 0, 0.05), { min: [-0.95, -0.15, -1.6], max: [0.95, 1.25, 1.5], res: 30 });
    centre([g]);
    return { name: f.name + ' Gummy Bear', layers: [{ geometry: g, material: mat.gummy({ color: f.color, clarity: 0.6, gloss: 0.9 }) }] };
  },
};
