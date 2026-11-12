// Biscuit sticks: thin baked sticks dipped for most of their length in chocolate, strawberry or matcha coating; the snapped face shows the biscuit core.
import { M, glsl, spin } from './_shared.js';

const KINDS = [
  { name: 'Chocolate Biscuit Stick', coat: 0x5f351d, fleck: null, taste: { sweet: 0.7, bitter: 0.1 } },
  { name: 'Strawberry Biscuit Stick', coat: 0xf5a3b8, fleck: 0xcf3a5c, taste: { sweet: 0.8, sour: 0.15 } },
  { name: 'Matcha Biscuit Stick', coat: 0x93b354, fleck: 0x5f7f2c, taste: { sweet: 0.6, bitter: 0.3 } },
];
const BISCUIT = 0xdcb267;

export default {
  id: 'biscuit-stick',
  name: 'Biscuit Sticks',
  group: 'crunchy',
  variants: KINDS.length,
  feel: { hardness: 0.91, bounce: 0.08, sticky: 0, density: 0.7 },
  breaks: { mode: 'snap', toughness: 0.15, crumbs: { color: 0xe0bd7a, amount: 0.35 } },
  taste: { sweet: 0.7 },
  mouth: { bites: 3, sound: 'snap' },
  sound: { land: 'stick', cut: 'snap', pitch: 1.36 },
  build(v) {
    const k = KINDS[v];
    const handle = spin([[0, -5.6], [0.14, -5.59], [0.21, -5.54], [0.24, -5.44], [0.24, -4.8], [0.24, -4.2], [0.24, -3.6], [0.24, -3.1], [0, -3.1]], 18, { axis: 'x' });
    const dip = [[0, -3.22], [0.22, -3.22], [0.31, -3.2], [0.335, -3.1], [0.32, -2.9], [0.31, -2.4]];
    for (let x = -1.6; x < 5; x += 0.8) dip.push([0.31, x]);
    dip.push([0.31, 5.2], [0.29, 5.42], [0.22, 5.55], [0.1, 5.6], [0, 5.6]);
    const coat = spin(dip, 18, { axis: 'x', warp: (p, a, u) => (u < 5 ? [p[0] + 0.06 * Math.sin(a * 3 + 1) * (1 - u / 5), p[1], p[2]] : p) });
    const toast = `vec3 candyPattern(vec3 p, vec3 base) {
  float n = cFbm(p * vec3(3.0, 9.0, 9.0));
  return base * (0.8 + 0.4 * n) * (1.0 - 0.25 * step(0.86, cHash1(floor(p * 40.0))));
}`;
    const skin = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 c = base * (0.93 + 0.14 * cFbm(p * 5.0));
  ${k.fleck ? `c = mix(c, ${glsl(k.fleck)}, step(0.9, cHash1(floor(p * 26.0))) * 0.7);` : ''}
  return c;
}`;
    const heart = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 b = ${glsl(BISCUIT)} * (0.86 + 0.24 * cNoise(p * 34.0));
  return mix(b, base, smoothstep(0.225, 0.245, length(p.yz)));
}`;
    return {
      name: k.name,
      taste: k.taste,
      layers: [
        { geometry: coat, material: M.chocolate({ color: k.coat, gloss: 0.6, pattern: skin }), cap: M.chocolate({ color: k.coat, gloss: 0.1, pattern: heart }) },
        { geometry: handle, material: M.crisp({ color: BISCUIT, pattern: toast }), cap: M.crisp({ color: 0xead09a }) },
      ],
    };
  },
};
