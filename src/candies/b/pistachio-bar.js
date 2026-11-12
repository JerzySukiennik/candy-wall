// Pistachio bars: thick two-pillow chocolate chunks painted with green and gold streaks, filled with pistachio cream and crispy pastry strands.
import { bake } from '../../lib/geo.js';
import { GRAIN, M, glsl, roundBox, slab } from './_shared.js';

const U = [0, 0.2, 0.38, 0.54, 0.68, 0.79, 0.87, 0.93, 0.97, 1];

function axis(mids, half) {
  const out = new Set();
  for (const m of mids) for (const u of U) {
    out.add(Math.round((m - u * half) * 1000) / 1000);
    out.add(Math.round((m + u * half) * 1000) / 1000);
  }
  return [...out].sort((a, b) => a - b);
}

const pillow = (u) => Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(1, Math.abs(u)), 4)));

export default {
  id: 'pistachio-bar',
  name: 'Pistachio Chocolate Chunks',
  group: 'chocolate',
  variants: 1,
  feel: { hardness: 0.82, bounce: 0.04, sticky: 0.1, density: 1.2 },
  breaks: { mode: 'snap', toughness: 0.55, grooves: [{ n: [1, 0, 0], d: 0 }], crumbs: { color: 0x5a3219, amount: 0.35 } },
  taste: { sweet: 0.85, salty: 0.15, bitter: 0.05 },
  mouth: { bites: 5, sound: 'crunch' },
  sound: { land: 'choc', cut: 'snap', pitch: 0.8 },
  build() {
    const top = (x, z) => 0.6 + 0.25 * pillow((Math.abs(x) - 1.15) / 1.15) * pillow(z / 1.5);
    const body = slab(axis([-1.15, 1.15], 1.15), axis([0], 1.5), top, -0.85);
    const core = bake(roundBox(2.1, 0.55, 1.3, 5, 28, 16), { move: [0, -0.12, 0] });
    const paint = `vec3 candyPattern(vec3 p, vec3 base) {
  float top = smoothstep(0.52, 0.64, p.y);
  vec2 q = vec2(p.x * 0.8 + p.z * 0.6, p.z * 0.8 - p.x * 0.6);
  float a = cFbm(vec3(q.x * 0.9, q.y * 4.2, 1.7));
  float b = cFbm(vec3(q.x * 1.1 + 5.0, q.y * 4.6, 8.3));
  vec3 c = mix(base, ${glsl(0x6f8f2c)}, smoothstep(0.6, 0.64, a) * top);
  return mix(c, ${glsl(0xc9962e)}, smoothstep(0.64, 0.67, b) * top);
}`;
    const filling = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 c = base * (0.8 + 0.4 * cFbm(p * 3.0));
  vec3 q = p * 4.5;
  vec3 ci = floor(q);
  float nut = smoothstep(0.34, 0.26, length(fract(q) - 0.5 - (cHash3(ci) - 0.5) * 0.4)) * step(0.55, cHash1(ci + 4.0));
  c = mix(c, ${glsl(0x6c8a26)}, nut * 0.8);
  float f1 = abs(cNoise(p * vec3(5.0, 24.0, 24.0)) - 0.5);
  float f2 = abs(cNoise(p.zyx * vec3(5.0, 24.0, 24.0) + 13.0) - 0.5);
  float strand = smoothstep(0.05, 0.015, min(f1, f2));
  return mix(c, ${glsl(0xecc978)}, strand * 0.85);
}`;
    return {
      layers: [
        { geometry: body, material: M.chocolate({ color: 'milk', gloss: 0.66, pattern: paint }), cap: M.chocolate({ color: 'milk', gloss: 0.08, pattern: GRAIN }) },
        { geometry: core, inside: 0, material: M.cream({ color: 0xa9c24e, glow: 0.14, pattern: filling }), fill: { type: 'cream', color: 0x9fb548, viscosity: 0.95, amount: 0.2 } },
      ],
    };
  },
};
