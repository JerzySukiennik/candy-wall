// Sour bombs: slightly lumpy hard balls under a matte crust of sour powder and crystals; the break shows the vivid glassy candy inside.
import { M, ball, blend, fbm3 } from './_shared.js';

const KINDS = [
  { name: 'Lemon Sour Bomb', color: 0xffe21a },
  { name: 'Green Apple Sour Bomb', color: 0x5fd62a },
  { name: 'Blue Raspberry Sour Bomb', color: 0x2a8fff },
  { name: 'Cherry Sour Bomb', color: 0xff2d55 },
];
const R = 1.15;

export default {
  id: 'sour-bomb',
  name: 'Sour Bombs',
  group: 'sour',
  variants: KINDS.length,
  feel: { hardness: 0.985, bounce: 0.2, sticky: 0.05, density: 1.5 },
  breaks: { mode: 'shatter', toughness: 0.75, shards: 5, crumbs: { color: 0xfafff0, amount: 0.8 } },
  taste: { sweet: 0.5, sour: 1 },
  mouth: { bites: 6, sound: 'crack' },
  sound: { land: 'hard', cut: 'crack', pitch: 1.07 },
  build(v) {
    const k = KINDS[v];
    const g = ball(R, 40, 24, (d) => R * (1 + 0.07 * (fbm3(d[0] * 1.8 + v * 5.1, d[1] * 1.8, d[2] * 1.8, 2) - 0.37)));
    const powder = `vec3 candyPattern(vec3 p, vec3 base) {
  float n = cFbm(p * 5.0);
  return mix(base, vec3(1.0), 0.2 + 0.36 * n);
}`;
    const inside = `vec3 candyPattern(vec3 p, vec3 base) {
  float r = length(p);
  vec3 c = base * (0.82 + 0.26 * cFbm(p * 4.0));
  return mix(c, vec3(1.0), smoothstep(${(R - 0.14).toFixed(2)}, ${(R - 0.07).toFixed(2)}, r) * 0.75);
}`;
    return {
      name: k.name,
      layers: [
        {
          geometry: g,
          material: M.hard({ color: k.color, clarity: 0.2, sugar: 1, sugarScale: 19, sugarColor: blend(k.color, 0xffffff, 0.8), pattern: powder }),
          cap: M.hard({ color: k.color, clarity: 0.45, opaque: true, pattern: inside }),
        },
      ],
    };
  },
};
