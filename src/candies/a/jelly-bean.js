// Jelly bean: glossy hard sugar shell around a soft jelly core, six colours including a cinnamon-hot and a sour one.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, glsl, solid } from './_shared.js';

const FLAVOURS = [
  { name: 'Cherry', shell: 0xd3122b, jelly: 0xff5a6e, taste: { sweet: 0.9, sour: 0.1 } },
  { name: 'Lemon', shell: 0xffd41a, jelly: 0xfff0a0, taste: { sweet: 0.8, sour: 0.3 } },
  { name: 'Blueberry', shell: 0x2748c8, jelly: 0x8fa6ff, speck: 0x0e1c66, taste: { sweet: 0.9, sour: 0.1 } },
  { name: 'Bubblegum', shell: 0xff7fc0, jelly: 0xffd0e6, taste: { sweet: 1 } },
  { name: 'Cinnamon Fire', shell: 0x9c0f14, jelly: 0xe0452a, speck: 0x4a0508, taste: { sweet: 0.6, spicy: 0.7 } },
  { name: 'Sour Apple', shell: 0x6fdc1f, jelly: 0xd8ff9a, taste: { sweet: 0.45, sour: 0.8 } },
];
const bean = S.scale(S.smooth(0.4, S.move(S.sphere(0.5), -0.56, 0, 0.13), S.move(S.sphere(0.53), 0, 0, -0.1), S.move(S.sphere(0.5), 0.56, 0, 0.13)), 1, 0.9, 1);

export default {
  id: 'jelly-bean',
  name: 'Jelly Beans',
  group: 'chewy',
  variants: FLAVOURS.length,
  feel: { hardness: 0.55, bounce: 0.3, sticky: 0.02, density: 1.4 },
  breaks: { mode: 'slice', toughness: 0.5, crumbs: { color: 0xffffff, amount: 0.15 } },
  taste: { sweet: 0.9 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'hard', cut: 'crunch', pitch: 1.38 },
  build(v) {
    const f = FLAVOURS[v];
    const shell = solid(bean, { min: [-1.25, -0.66, -0.82], max: [1.25, 0.66, 0.82], res: 27 });
    const core = solid(S.round(bean, -0.17), { min: [-1.05, -0.5, -0.64], max: [1.05, 0.5, 0.64], res: 16 });
    centre([shell, core]);
    const pattern = f.speck
      ? `vec3 candyPattern(vec3 p, vec3 base) {
      vec3 c = floor(p * 9.0);
      float d = length(fract(p * 9.0) - 0.5 - (cHash3(c) - 0.5) * 0.5);
      return mix(base, ${glsl(f.speck)}, step(0.72, cHash1(c + 5.0)) * smoothstep(0.3, 0.2, d));
    }`
      : undefined;
    return {
      name: f.name + ' Jelly Bean',
      taste: f.taste,
      layers: [
        { geometry: shell, material: mat.shell({ color: f.shell, gloss: 0.95, pattern }), cap: mat.matte({ color: f.shell, roughness: 0.6 }) },
        { geometry: core, inside: 0, material: mat.gummy({ color: f.jelly, clarity: 0.5, gloss: 0.6 }), fill: { type: 'solid', color: f.jelly, viscosity: 1, amount: 0 } },
      ],
    };
  },
};
