// Gumballs: glossy candy shells around a chewy pastel gum core that stays put when the ball is cut.
import { M, ball, blend } from './_shared.js';

const KINDS = [
  { name: 'Red Gumball', color: 0xe3122c },
  { name: 'Blue Gumball', color: 0x1f6fe8 },
  { name: 'Yellow Gumball', color: 0xffcf14 },
  { name: 'Green Gumball', color: 0x27b345 },
  { name: 'Orange Gumball', color: 0xff7a12 },
  { name: 'Purple Gumball', color: 0x8a3fd9 },
];

export default {
  id: 'gumball',
  name: 'Gumballs',
  group: 'chewy',
  variants: KINDS.length,
  feel: { hardness: 0.66, bounce: 0.45, sticky: 0.3, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.65, crumbs: { color: 0xffffff, amount: 0.2 } },
  taste: { sweet: 0.85 },
  mouth: { bites: 8, sound: 'chewy' },
  sound: { land: 'hard', cut: 'crack', pitch: 1.16 },
  build(v) {
    const k = KINDS[v];
    const gum = blend(k.color, 0xffffff, 0.3);
    return {
      name: k.name,
      layers: [
        { geometry: ball(1.1, 36, 22), material: M.shell({ color: k.color, gloss: 0.95 }), cap: M.matte({ color: blend(k.color, 0xffffff, 0.85), roughness: 0.7 }) },
        { geometry: ball(0.9, 26, 14), inside: 0, material: M.gummy({ color: gum, clarity: 0.05, gloss: 0.2 }), fill: { type: 'solid', color: gum } },
      ],
    };
  },
};
