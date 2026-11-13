// Sour cube: sugared two-layer cube, clear fruit jelly sitting on a soft foam layer (two bodies).
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { above, below, centre, snapY, solid } from './_shared.js';

const FLAVOURS = [
  { name: 'Strawberry', jelly: 0xe8142f, foam: 0xffc4d0 },
  { name: 'Lemon Lime', jelly: 0x4fd02a, foam: 0xfff3a8 },
  { name: 'Blue Raspberry', jelly: 0x1a84f0, foam: 0xf2f8ff },
  { name: 'Orange', jelly: 0xff7a12, foam: 0xffe2bd },
];
const SPLIT = -0.22;

export default {
  id: 'sour-cube',
  name: 'Sour Cubes',
  group: 'sour',
  variants: FLAVOURS.length,
  feel: { hardness: 0.4, bounce: 0.55, sticky: 0.1, density: 1.1 },
  breaks: { mode: 'slice', toughness: 0.36 },
  taste: { sweet: 0.6, sour: 0.6 },
  mouth: { bites: 3, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 1.18 },
  build(v) {
    const f = FLAVOURS[v];
    const cube = S.box(0.9, 0.9, 0.9, 0.16);
    const top = snapY(solid(above(cube, SPLIT - 0.01), { min: [-1.08, -0.42, -1.08], max: [1.08, 1.08, 1.08], res: 16 }), SPLIT - 0.01, 0.06, cube);
    const bottom = snapY(solid(below(cube, SPLIT + 0.01), { min: [-1.08, -1.08, -1.08], max: [1.08, -0.02, 1.08], res: 16 }), SPLIT + 0.01, 0.06, cube);
    centre([top, bottom]);
    return {
      name: f.name + ' Sour Cube',
      layers: [
        { geometry: top, material: mat.gummy({ color: f.jelly, clarity: 0.6, gloss: 0.8, sugar: 0.55, sugarScale: 17 }), cap: mat.gummy({ color: f.jelly, clarity: 0.6, gloss: 0.8, opaque: true }) },
        { geometry: bottom, material: mat.foam({ color: f.foam, sugar: 0.55, sugarScale: 17 }), cap: mat.foam({ color: f.foam }) },
      ],
    };
  },
};
