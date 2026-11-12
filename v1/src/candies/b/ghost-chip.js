// Ghost chips: one brutally hot black triangular tortilla chip, blistered and warped, dusted with red chili powder.
import { M, PORES, glsl, noise3, recentre, sheet, sstep } from './_shared.js';

const INR = 1.8;

export default {
  id: 'ghost-chip',
  name: 'Ghost Pepper Chips',
  group: 'spicy',
  variants: 1,
  feel: { hardness: 0.94, bounce: 0.1, sticky: 0, density: 0.5 },
  breaks: { mode: 'shatter', toughness: 0.18, shards: 5, crumbs: { color: 0x4a1610, amount: 0.6 } },
  taste: { spicy: 1, salty: 0.6 },
  mouth: { bites: 4, sound: 'crunch' },
  sound: { land: 'crisp', cut: 'crunch', pitch: 1.18 },
  build() {
    const outline = (a) => {
      let s = 0;
      for (let i = 0; i < 3; i++) s += Math.pow(Math.max(0, Math.cos(a - Math.PI / 2 - (i * Math.PI * 2) / 3)), 10);
      return INR / Math.pow(s, 0.1);
    };
    const height = (x, z) => 0.03 * x * x - 0.022 * z * z + 0.1 * Math.sin(x * 0.8 + 0.5) + 0.16 * sstep(0.52, 0.8, noise3(x * 1.05 + 3, 0.5, z * 1.05)) + 0.05 * (noise3(x * 2.4, 4, z * 2.4) - 0.5);
    const g = recentre(sheet(outline, 9, 48, height, 0.16, { edge: 0.05, mult: 3 }));
    const pattern = `float gcDot(vec3 f, float s, float keep, float seed) {
  vec3 q = f * s + seed;
  vec3 ci = floor(q);
  float d = length(fract(q).xz - 0.5 - (cHash3(ci).xy - 0.5) * 0.6);
  return smoothstep(0.3, 0.18, d) * step(keep, cHash1(ci + 3.0));
}
vec3 candyPattern(vec3 p, vec3 base) {
  vec3 f = vec3(p.x, 0.0, p.z);
  float t = cFbm(f * 1.4 + 2.0);
  vec3 c = mix(base, ${glsl(0x3a2415)}, smoothstep(0.42, 0.72, t));
  c = mix(c, ${glsl(0x6b4a26)}, gcDot(f, 6.0, 0.8, 5.5) * 0.6);
  float dust = cFbm(f * 3.0 + 9.0);
  c = mix(c, ${glsl(0xa5160b)}, smoothstep(0.47, 0.74, dust) * 0.7);
  return mix(c, ${glsl(0xff4a1c)}, gcDot(f, 17.0, 0.72, 1.5) * 0.65);
}`;
    return {
      layers: [
        { geometry: g, material: M.crisp({ color: 0x211a16, pattern, sugar: 0.26, sugarScale: 15, sugarColor: 0xe32411 }), cap: M.crisp({ color: 0x2d241f, pattern: PORES }) },
      ],
    };
  },
};
