// Wax bottle: little soft wax bottle lying on its side, filled with thin fruit syrup that runs out when it is cut.
import { bake, lathe } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, glsl, mix } from './_shared.js';

const FLAVOURS = [
  { name: 'Cherry', syrup: 0xe20f2a },
  { name: 'Orange', syrup: 0xff7f00 },
  { name: 'Lime', syrup: 0x4fc800 },
  { name: 'Blue Raspberry', syrup: 0x1458f0 },
];
const OUTER = [[0, 2.1], [0.34, 2.1], [0.43, 2.02], [0.43, 1.82], [0.35, 1.74], [0.33, 1.3], [0.4, 0.98], [0.66, 0.52], [0.75, 0.2], [0.76, -0.9], [0.75, -1.7], [0.7, -1.98], [0.55, -2.1], [0, -2.1]];
const INNER = [[0, 1.86], [0.15, 1.86], [0.16, 1.3], [0.22, 0.98], [0.48, 0.5], [0.57, 0.16], [0.58, -1.7], [0.52, -1.9], [0, -1.92]];

export default {
  id: 'wax-bottle',
  name: 'Wax Bottles',
  group: 'chewy',
  variants: FLAVOURS.length,
  feel: { hardness: 0.28, bounce: 0.15, sticky: 0.05, density: 0.95 },
  breaks: { mode: 'slice', toughness: 0.3 },
  taste: { sweet: 0.9, sour: 0.1 },
  mouth: { bites: 5, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squish', pitch: 1.14 },
  build(v) {
    const f = FLAVOURS[v];
    const body = bake(lathe(OUTER.slice().reverse(), 26), { rotate: [0, 0, -Math.PI / 2] });
    const core = bake(lathe(INNER.slice().reverse(), 18), { rotate: [0, 0, -Math.PI / 2] });
    const off = centre([body, core]);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      float x = p.x - ${off[0].toFixed(4)};
      vec3 c = mix(base, ${glsl(mix(f.syrup, 0xfff6e6, 0.72))}, smoothstep(1.15, 1.72, x));
      return c * (0.9 + 0.2 * cNoise(p * vec3(1.2, 6.0, 6.0)));
    }`;
    const syrup = mat.liquid({ color: f.syrup, clarity: 0.75 });
    return {
      name: f.name + ' Wax Bottle',
      layers: [
        { geometry: body, material: mat.wax({ color: mix(f.syrup, 0xfff2dc, 0.3), glow: 0.36, pattern }), cap: mat.wax({ color: mix(f.syrup, 0xfffaf0, 0.8) }), cavity: syrup },
        { geometry: core, inside: 0, material: syrup, fill: { type: 'liquid', color: f.syrup, viscosity: 0.15, amount: 1 } },
      ],
    };
  },
};
