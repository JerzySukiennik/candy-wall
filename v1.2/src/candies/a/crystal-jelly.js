// Crystal jelly (kohakutou): faceted pastel gem with a thin crisp frosted sugar crust around a soft glossy jelly heart.
import { mat } from '../../lib/mat.js';
import { rng } from '../../util.js';
import { centre, fibonacci, mix, polytope } from './_shared.js';

const COLOURS = [
  { name: 'Sakura', crust: 0xffc2d6, jelly: 0xff4f93 },
  { name: 'Mint', crust: 0xbff2dc, jelly: 0x1fcf98 },
  { name: 'Lavender', crust: 0xdccbff, jelly: 0x8f5cff },
  { name: 'Sky', crust: 0xc2e4ff, jelly: 0x2f9bff },
];
const CRUST = 0.17;

function facets(v) {
  const r = rng(101 + v * 17);
  const a = 1.25 + r() * 0.4;
  const b = 0.74;
  const c = 0.82 + r() * 0.22;
  const planes = [[0, -1, 0, 0.6], [1, 0, 0, a * 1.04], [-1, 0, 0, a * 1.04], [0, 0, 1, c * 1.04], [0, 0, -1, c * 1.04], [0, 1, 0, b * 1.02]];
  for (const d of fibonacci(10)) {
    const n = [d[0] + (r() - 0.5) * 0.55, d[1] * 0.8 + 0.3 + (r() - 0.5) * 0.3, d[2] + (r() - 0.5) * 0.55];
    const l = Math.hypot(n[0], n[1], n[2]);
    n[0] /= l;
    n[1] /= l;
    n[2] /= l;
    if (n[1] < -0.35) continue;
    planes.push([n[0], n[1], n[2], Math.hypot(a * n[0], b * n[1], c * n[2]) * (0.8 + r() * 0.2)]);
  }
  return planes;
}

export default {
  id: 'crystal-jelly',
  name: 'Crystal Jellies',
  group: 'jelly',
  variants: COLOURS.length,
  feel: { hardness: 0.47, bounce: 0.15, sticky: 0.02, density: 1.35 },
  breaks: { mode: 'slice', toughness: 0.35, crumbs: { color: 0xffffff, amount: 0.35 } },
  taste: { sweet: 0.95 },
  mouth: { bites: 4, sound: 'crisp' },
  sound: { land: 'hard', cut: 'crunch', pitch: 1.3 },
  build(v) {
    const k = COLOURS[v];
    const planes = facets(v);
    const shell = polytope(planes);
    const heart = polytope(planes.map((p) => [p[0], p[1], p[2], p[3] - CRUST]));
    centre([shell, heart]);
    return {
      name: k.name + ' Crystal Jelly',
      layers: [
        { geometry: shell, material: mat.gummy({ color: k.crust, clarity: 0.55, gloss: 0.08, sugar: 0.3, sugarScale: 30 }), cap: mat.matte({ color: mix(k.crust, 0xffffff, 0.6), roughness: 0.9 }) },
        { geometry: heart, inside: 0, material: mat.gummy({ color: k.jelly, clarity: 0.6, gloss: 0.95 }), fill: { type: 'solid', color: k.jelly, viscosity: 1, amount: 0 } },
      ],
    };
  },
};
