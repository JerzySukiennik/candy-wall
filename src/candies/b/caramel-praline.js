// Caramel pralines: moulded chocolate domes with a drizzle on top and a liquid golden caramel centre that pours out when cut.
import { GRAIN, M, glsl, spin } from './_shared.js';

const KINDS = [
  { name: 'Milk Caramel Praline', color: 'milk', drizzle: 0x24120a, taste: { sweet: 0.95, salty: 0.1 } },
  { name: 'Dark Caramel Praline', color: 'dark', drizzle: 0xf1dba6, taste: { sweet: 0.75, bitter: 0.3, salty: 0.1 } },
];

function dome(R, y0, H, foot, n) {
  const pts = [[0, y0], [R * 0.55, y0], [R - 0.05, y0, 1], [R, y0 + 0.05]];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 0.5;
    pts.push([R * Math.pow(Math.cos(a), 0.75), y0 + foot + (H - foot) * Math.pow(Math.sin(a), 0.95)]);
  }
  pts.push([0, y0 + H]);
  return pts;
}

export default {
  id: 'caramel-praline',
  name: 'Caramel Pralines',
  group: 'chocolate',
  variants: KINDS.length,
  feel: { hardness: 0.8, bounce: 0.05, sticky: 0.25, density: 1.25 },
  breaks: { mode: 'snap', toughness: 0.4, crumbs: { color: 0x4a2a17, amount: 0.2 } },
  taste: { sweet: 0.95, salty: 0.1 },
  mouth: { bites: 4, sound: 'gooey' },
  sound: { land: 'choc', cut: 'snap', pitch: 1.04 },
  build(v) {
    const k = KINDS[v];
    const body = spin(dome(1.5, -0.95, 1.9, 0.16, 12), 44);
    const core = spin(dome(1.17, -0.72, 1.36, 0.08, 8), 28);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
  float w = p.x * 0.8 + p.z * 0.6 + 0.07 * sin(p.z * 7.0 + p.x * 3.0);
  float s = abs(fract(w * 2.5) - 0.5);
  float line = smoothstep(0.12, 0.08, s) * smoothstep(-0.5, -0.3, p.y);
  return mix(base, ${glsl(k.drizzle)}, line);
}`;
    const caramel = 0xdc8a16;
    return {
      name: k.name,
      taste: k.taste,
      layers: [
        { geometry: body, material: M.chocolate({ color: k.color, gloss: 0.72, pattern }), cap: M.chocolate({ color: k.color, gloss: 0.08, pattern: GRAIN }) },
        { geometry: core, inside: 0, material: M.liquid({ color: caramel, clarity: 0.55 }), fill: { type: 'liquid', color: caramel, viscosity: 0.85, amount: 0.9 } },
      ],
    };
  },
};
