// Jawbreakers: big speckled hard balls; the cut face shows concentric coloured sugar layers (rings on the distance from the centre).
import { M, ball, glsl } from './_shared.js';

const R = 1.55;
const RINGS = [0xff5fa2, 0xffe14a, 0x4bd16a, 0x49a8ff, 0xff9a3c, 0xfdfbf4];
const KINDS = [
  { name: 'White Jawbreaker', shell: 0xf4f0e6, shift: 0 },
  { name: 'Yellow Jawbreaker', shell: 0xffd21f, shift: 2 },
  { name: 'Blue Jawbreaker', shell: 0x1b86e6, shift: 4 },
  { name: 'Orange Jawbreaker', shell: 0xff7416, shift: 1 },
  { name: 'Green Jawbreaker', shell: 0x2fbf45, shift: 3 },
  { name: 'Red Jawbreaker', shell: 0xe3223b, shift: 5 },
];

export default {
  id: 'jawbreaker',
  name: 'Jawbreakers',
  group: 'hard',
  variants: KINDS.length,
  feel: { hardness: 1, bounce: 0.25, sticky: 0, density: 1.6 },
  breaks: { mode: 'shatter', toughness: 1, shards: 6, crumbs: { color: 0xfff1f4, amount: 0.7 } },
  taste: { sweet: 1 },
  mouth: { bites: 9, sound: 'crack' },
  sound: { land: 'hard', cut: 'crack', pitch: 0.7 },
  build(v) {
    const k = KINDS[v];
    const g = ball(R, 40, 24);
    const speck = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 pal[6] = vec3[6](${[0xe8203f, 0x1f7fe6, 0xffcf1a, 0x2fb84a, 0xff6f1a, 0xf6f2e8].map(glsl).join(', ')});
  vec3 c = base;
  vec3 w = p + 0.2 * vec3(cNoise(p * 3.3), cNoise(p * 3.3 + 9.0), cNoise(p * 3.3 + 17.0));
  for (int i = 0; i < 3; i++) {
    float sc = i == 0 ? 1.2 : (i == 1 ? 2.4 : 5.6);
    vec3 q = w * sc + float(i) * 13.7 + ${(v * 3.1).toFixed(1)};
    vec3 ci = floor(q);
    vec3 f = fract(q) - 0.5 - (cHash3(ci) - 0.5) * 0.6;
    float keep = step(i == 0 ? 0.5 : (i == 1 ? 0.48 : 0.6), cHash1(ci + 4.0));
    float rad = (i == 0 ? 0.36 : 0.27) * (0.55 + 0.65 * cHash1(ci + 2.0));
    float d = length(f * vec3(1.0, 1.0 + 0.9 * (cHash1(ci + 8.0) - 0.5), 1.0));
    c = mix(c, pal[int(cHash1(ci + 5.0) * 5.99)], keep * smoothstep(rad, rad - 0.03, d));
  }
  return c;
}`;
    const rings = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 pal[6] = vec3[6](${RINGS.map(glsl).join(', ')});
  float r = length(p);
  float t = r / 0.2 + 0.35;
  vec3 c = pal[int(mod(floor(t) + ${k.shift.toFixed(1)}, 6.0))];
  c *= 1.0 - 0.2 * smoothstep(0.4, 0.5, abs(fract(t) - 0.5));
  c *= 0.9 + 0.14 * cNoise(p * 22.0);
  return mix(c, base, smoothstep(${(R - 0.07).toFixed(2)}, ${(R - 0.04).toFixed(2)}, r));
}`;
    return {
      name: k.name,
      layers: [{ geometry: g, material: M.shell({ color: k.shell, gloss: 0.95, pattern: speck }), cap: M.hard({ color: k.shell, clarity: 0.15, opaque: true, pattern: rings }) }],
    };
  },
};
