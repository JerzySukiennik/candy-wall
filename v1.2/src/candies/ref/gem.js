// Reference candy: clear dome gummy with a liquid syrup centre (transparent shell + draining core).
import { S, meshSDF } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';

const FLAVOURS = [
  { name: 'Strawberry', shell: 0xff4b6e, syrup: 0xd4002a },
  { name: 'Lime', shell: 0x9be84a, syrup: 0x2f9d00 },
  { name: 'Blue Raspberry', shell: 0x58b8ff, syrup: 0x0a3fd0 },
];

export default {
  id: 'ref-gem',
  name: 'Liquid Gems',
  group: 'gummy',
  variants: FLAVOURS.length,
  feel: { hardness: 0.4, bounce: 0.7, sticky: 0.15, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.35 },
  taste: { sweet: 0.8, sour: 0.15 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 1.1 },
  build(v) {
    const f = FLAVOURS[v];
    const dome = S.smoothInter(0.3, S.ellipsoid(1.55, 1.35, 1.55), S.plane(0, -1, 0, 0.7));
    const body = meshSDF(S.move(dome, 0, -0.32, 0), { min: [-1.8, -1.3, -1.8], max: [1.8, 1.3, 1.8], res: 30 });
    const core = meshSDF(S.move(S.ellipsoid(0.92, 0.62, 0.92), 0, -0.2, 0), { min: [-1.2, -1.1, -1.2], max: [1.2, 0.7, 1.2], res: 20 });
    return {
      name: f.name + ' Liquid Gem',
      layers: [
        { geometry: body, material: mat.gummy({ color: f.shell, clarity: 0.95, gloss: 0.95 }) },
        { geometry: core, inside: 0, material: mat.liquid({ color: f.syrup, clarity: 0.5 }), fill: { type: 'liquid', color: f.syrup, viscosity: 0.35, amount: 1 } },
      ],
    };
  },
};
