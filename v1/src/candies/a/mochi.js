// Mochi: powder-dusted, very soft daifuku with a strawberry cream centre that stays put when it is cut.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, glsl, solid, v3 } from './_shared.js';

const SKINS = [
  { name: 'Strawberry Cream Mochi', skin: 0xfaf3e8, dough: 0xfffaf2 },
  { name: 'Sakura Strawberry Mochi', skin: 0xffc6d4, dough: 0xffd6e0 },
  { name: 'Matcha Strawberry Mochi', skin: 0xc9dc9c, dough: 0xd6e6ae },
];

export default {
  id: 'mochi',
  name: 'Mochi',
  group: 'chewy',
  variants: SKINS.length,
  feel: { hardness: 0.06, bounce: 0.2, sticky: 0.55, density: 1.05 },
  breaks: { mode: 'slice', toughness: 0.08 },
  taste: { sweet: 0.7, sour: 0.1 },
  mouth: { bites: 3, sound: 'soft' },
  sound: { land: 'soft', cut: 'squish', pitch: 0.76 },
  build(v) {
    const k = SKINS[v];
    const lump = (x, y, z) => S.ellipsoid(1.72, 1.12, 1.72)(x, y, z) + 0.05 * Math.sin(x * 2.1 + v) * Math.sin(z * 1.8 + 1.3 + v * 2) * Math.cos(y * 2);
    const skin = solid(floor(lump, -0.82, 0.4), { min: [-1.95, -1.0, -1.95], max: [1.95, 1.34, 1.95], res: 21 });
    const cream = solid(S.move(S.ellipsoid(1.28, 0.7, 1.28), 0, 0.08, 0), { min: [-1.45, -0.78, -1.45], max: [1.45, 0.94, 1.45], res: 15 });
    const off = centre([skin, cream]);
    const dust = `vec3 candyPattern(vec3 p, vec3 base) {
      float d = cFbm(p * 1.3 + ${(v * 5.3).toFixed(1)});
      return mix(base * 0.96, vec3(1.0), smoothstep(0.3, 0.72, d) * 0.7);
    }`;
    const filling = `vec3 candyPattern(vec3 p, vec3 base) {
      vec3 q = (p - ${v3([off[0], off[1] + 0.08, off[2]])}) / vec3(0.72, 0.42, 0.72);
      float r = length(q) + 0.12 * (cNoise(p * 4.0) - 0.5);
      vec3 jam = mix(${glsl(0xe8102f)}, ${glsl(0xff5a66)}, cNoise(p * 7.0));
      return mix(jam, base, smoothstep(0.92, 1.02, r));
    }`;
    return {
      name: k.name,
      layers: [
        { geometry: skin, material: mat.foam({ color: k.skin, pattern: dust }), cap: mat.gummy({ color: k.dough, clarity: 0.3, gloss: 0.5, opaque: true }) },
        { geometry: cream, inside: 0, material: mat.cream({ color: 0xffe2e8, pattern: filling }), fill: { type: 'cream', color: 0xffe2e8, viscosity: 0.9, amount: 0.2 } },
      ],
    };
  },
};
