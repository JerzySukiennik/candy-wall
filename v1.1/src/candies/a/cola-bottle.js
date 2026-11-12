// Cola bottle: firm two-tone moulded bottle (amber neck, cola-brown base) with a flat back, plus a sugared fizzy variant.
import { S, S2 } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, glsl, solid } from './_shared.js';

const KINDS = [
  { name: 'Cola Bottle', sugar: 0, taste: { sweet: 0.8, sour: 0.1 } },
  { name: 'Fizzy Cola Bottle', sugar: 0.75, taste: { sweet: 0.65, sour: 0.5, fizz: 0.7 } },
];

export default {
  id: 'cola-bottle',
  name: 'Cola Bottles',
  group: 'gummy',
  variants: KINDS.length,
  feel: { hardness: 0.62, bounce: 0.42, sticky: 0.08, density: 1.35 },
  breaks: { mode: 'slice', toughness: 0.65 },
  taste: { sweet: 0.8, sour: 0.1 },
  mouth: { bites: 5, sound: 'chewy' },
  sound: { land: 'rubber', cut: 'squeak', pitch: 1.12 },
  build(v) {
    const k = KINDS[v];
    const profile = S2.union(
      S2.smooth(0.3, S2.move(S2.box(0.62, 0.86, 0.26), 0, -0.76), S2.move(S2.box(0.29, 0.62, 0.14), 0, 0.62)),
      S2.move(S2.box(0.37, 0.13, 0.06), 0, 1.3),
      S2.move(S2.box(0.655, 0.07, 0.05), 0, -1.38),
      S2.move(S2.box(0.655, 0.07, 0.05), 0, -0.32)
    );
    const round = S.revolve(profile);
    const bottle = S.scale((x, y, z) => round(-y / 0.74, x, z) * 0.74, 1.15);
    const g = solid(floor(bottle, -0.14, 0.05), { min: [-2.05, -0.3, -0.95], max: [1.85, 0.75, 0.95], res: 38 });
    const off = centre([g]);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      float t = smoothstep(-0.07, 0.07, p.x - ${(off[0] - 0.3).toFixed(4)} + 0.1 * (cNoise(p * 4.0) - 0.5));
      return mix(${glsl(0x3d1406)}, ${glsl(0xc9700f)}, t);
    }`;
    const m = mat.gummy({ color: 0xffffff, clarity: 0.6, gloss: 0.85, sugar: k.sugar, sugarScale: 16, pattern });
    return { name: k.name, taste: k.taste, layers: [{ geometry: g, material: m }] };
  },
};
