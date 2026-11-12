// Peppermint swirls: thick pinwheel mint discs whose stripes only run through the outer skin, so a break shows a white heart.
import { M, glsl, spin } from './_shared.js';

const KINDS = [
  { name: 'Peppermint Swirl', stripe: 0xd9121f, taste: { sweet: 0.7, mint: 0.9 } },
  { name: 'Spearmint Swirl', stripe: 0x12a352, taste: { sweet: 0.75, mint: 0.8 } },
];
const R = 1.3;
const H = 0.5;

export default {
  id: 'peppermint-swirl',
  name: 'Peppermint Swirls',
  group: 'hard',
  variants: KINDS.length,
  feel: { hardness: 0.97, bounce: 0.2, sticky: 0, density: 1.5 },
  breaks: { mode: 'shatter', toughness: 0.6, shards: 4, crumbs: { color: 0xffffff, amount: 0.55 } },
  taste: { sweet: 0.7, mint: 0.9 },
  mouth: { bites: 5, sound: 'crack' },
  sound: { land: 'glass', cut: 'crack', pitch: 1.22 },
  build(v) {
    const k = KINDS[v];
    const pts = [[0, -H]];
    for (let i = 1; i < 16; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 16;
      pts.push([R * Math.pow(Math.cos(a), 0.6), H * Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 0.7)]);
    }
    pts.push([0, H]);
    const g = spin(pts, 40);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
  float r = length(p.xz);
  float a = atan(p.z, p.x);
  float s = sin(a * 6.0 + r * 2.1);
  float wide = smoothstep(0.3, 0.38, s);
  float thin = smoothstep(0.1, 0.05, abs(sin(a * 6.0 + r * 2.1 + 3.14159) - 0.82));
  float depth = min(${R.toFixed(2)} - r, ${H.toFixed(2)} - abs(p.y));
  float skin = smoothstep(0.24, 0.17, depth);
  return mix(base, ${glsl(k.stripe)}, max(wide, thin) * skin);
}`;
    return {
      name: k.name,
      taste: k.taste,
      layers: [{ geometry: g, material: M.hard({ color: 0xfbfaf6, clarity: 0.25, glow: 0.14, pattern }), cap: M.hard({ color: 0xfbfaf6, clarity: 0.15, opaque: true, pattern }) }],
    };
  },
};
