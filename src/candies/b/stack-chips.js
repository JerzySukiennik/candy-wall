// Stack crisps: saddle-shaped potato crisps (hyperbolic paraboloid sheet with real thickness) in salted, paprika and sour cream and onion.
import { M, glsl, noise3, sheet } from './_shared.js';

const KINDS = [
  { name: 'Salted Stack Crisp', color: 0xe9bf5c, sugar: 0.2, dust: 0xffffff, taste: { salty: 0.75, sweet: 0.05 } },
  { name: 'Paprika Stack Crisp', color: 0xe5a549, sugar: 0.45, dust: 0xd43a18, taste: { salty: 0.6, spicy: 0.25, sweet: 0.1 } },
  { name: 'Sour Cream and Onion Stack Crisp', color: 0xedcd78, sugar: 0.14, dust: 0xffffff, taste: { salty: 0.6, sour: 0.2, sweet: 0.05 } },
];

const TOAST = `float t = cFbm(p * vec3(1.3, 3.0, 1.3) + 4.0);
  float pore = cNoise(p * 16.0);
  vec3 c = base * (0.76 + 0.44 * t) * (0.94 + 0.12 * pore);
  float blis = smoothstep(0.6, 0.78, cNoise(vec3(p.x, 0.0, p.z) * 2.6 + 3.0));
  c = mix(c, c * 1.14 + 0.02, blis);
  float spot = smoothstep(0.7, 0.8, cNoise(vec3(p.x, 0.0, p.z) * 4.3 + 17.0));
  c = mix(c, c * vec3(0.8, 0.62, 0.4), spot * 0.6);
  float rim = smoothstep(0.8, 1.0, length(p.xz / vec2(3.25, 2.25)));
  c = mix(c, c * vec3(0.92, 0.74, 0.5), rim * 0.55);`;

const PATTERNS = [
  `vec3 candyPattern(vec3 p, vec3 base) {
  ${TOAST}
  return c;
}`,
  `vec3 candyPattern(vec3 p, vec3 base) {
  ${TOAST}
  float d = cFbm(p * vec3(4.0, 1.0, 4.0) + 9.0);
  c = mix(c, ${glsl(0xc9401a)}, smoothstep(0.34, 0.66, d) * 0.72);
  vec3 q = floor(vec3(p.x, 0.0, p.z) * 30.0);
  c = mix(c, ${glsl(0x8a1c0c)}, step(0.9, cHash1(q)) * 0.75);
  return c;
}`,
  `vec3 candyPattern(vec3 p, vec3 base) {
  ${TOAST}
  float d = cFbm(p * vec3(5.0, 1.0, 5.0) + 2.0);
  c = mix(c, ${glsl(0xfff6dc)}, smoothstep(0.42, 0.7, d) * 0.4);
  vec3 q = vec3(p.x, 0.0, p.z) * 7.0;
  vec3 ci = floor(q);
  vec2 cf = fract(q.xz) - 0.5;
  vec3 rnd = cHash3(ci);
  float sp = smoothstep(0.24, 0.14, length((cf - (rnd.xy - 0.5) * 0.5) * vec2(1.0, 0.55 + rnd.z))) * step(0.5, cHash1(ci + 3.0));
  c = mix(c, ${glsl(0x2f6b1f)} * (0.6 + 0.7 * cHash1(ci + 9.0)), sp);
  return c;
}`,
];

export default {
  id: 'stack-chips',
  name: 'Stack Crisps',
  group: 'salty',
  variants: KINDS.length,
  feel: { hardness: 0.93, bounce: 0.12, sticky: 0, density: 0.4 },
  breaks: { mode: 'shatter', toughness: 0.12, shards: 5, crumbs: { color: 0xecc56c, amount: 0.5 } },
  taste: { salty: 0.7, sweet: 0.05 },
  mouth: { bites: 3, sound: 'crisp' },
  sound: { land: 'crisp', cut: 'crunch', pitch: 1.3 },
  build(v) {
    const k = KINDS[v];
    const outline = (a) => Math.pow(Math.pow(Math.abs(Math.cos(a)) / 3.25, 2.5) + Math.pow(Math.abs(Math.sin(a)) / 2.25, 2.5), -1 / 2.5);
    const height = (x, z) => 0.085 * x * x - 0.11 * z * z - 0.17 + 0.11 * (noise3(x * 1.6 + v * 7.3, 1.5, z * 1.6) - 0.5);
    const g = sheet(outline, 10, 52, height, 0.12, { edge: 0.05 });
    return {
      name: k.name,
      taste: k.taste,
      layers: [
        {
          geometry: g,
          material: M.crisp({ color: k.color, pattern: PATTERNS[v], sugar: k.sugar, sugarScale: 16, sugarColor: k.dust, back: 0.45, glow: 0.05 }),
          cap: M.crisp({ color: 0xf3db8e }),
        },
      ],
    };
  },
};
