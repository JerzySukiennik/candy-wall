// Liquid gem: crystal-clear gummy dome with a bright syrup centre that shows through the shell and pours out when cut.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, solid } from './_shared.js';

const FLAVOURS = [
  { name: 'Strawberry', shell: 0xff7088, syrup: 0xe4002c, taste: { sweet: 0.85, sour: 0.15 } },
  { name: 'Mango', shell: 0xffc45a, syrup: 0xff8a00, taste: { sweet: 0.9, sour: 0.1 } },
  { name: 'Lime', shell: 0x9be85a, syrup: 0x35b000, taste: { sweet: 0.7, sour: 0.4 } },
  { name: 'Blue Raspberry', shell: 0x66b4ff, syrup: 0x0a48e0, taste: { sweet: 0.8, sour: 0.25 } },
];

export default {
  id: 'liquid-gem',
  name: 'Liquid Gems',
  group: 'gummy',
  variants: FLAVOURS.length,
  feel: { hardness: 0.44, bounce: 0.55, sticky: 0.15, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.4 },
  taste: { sweet: 0.8, sour: 0.2 },
  mouth: { bites: 4, sound: 'gooey' },
  sound: { land: 'soft', cut: 'squeak', pitch: 1.08 },
  build(v) {
    const f = FLAVOURS[v];
    const dome = floor(S.move(S.sphere(1.5), 0, -0.4, 0), -0.75, 0.3);
    const body = solid(dome, { min: [-1.7, -0.95, -1.7], max: [1.7, 1.3, 1.7], res: 19 });
    const core = solid(S.move(S.ellipsoid(1.0, 0.6, 1.0), 0, 0.04, 0), { min: [-1.25, -0.76, -1.25], max: [1.25, 0.84, 1.25], res: 13 });
    centre([body, core]);
    const syrup = mat.liquid({ color: f.syrup, clarity: 0.3, glow: 0.3 });
    const wet = mat.liquid({ color: f.syrup, clarity: 0.5 });
    return {
      name: f.name + ' Liquid Gem',
      taste: f.taste,
      layers: [
        { geometry: body, material: mat.gummy({ color: f.shell, clarity: 0.94, gloss: 1 }), cap: mat.gummy({ color: f.shell, clarity: 0.76, gloss: 0.9 }), cavity: wet },
        { geometry: core, inside: 0, material: syrup, cap: wet, fill: { type: 'liquid', color: f.syrup, viscosity: 0.35, amount: 1 } },
      ],
    };
  },
};
