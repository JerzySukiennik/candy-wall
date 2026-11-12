// Jawbreakers: big speckled hard balls; the cut face shows concentric coloured sugar layers (rings on the distance from the centre).
import { M, ball, glsl } from './_shared.js';

const R = 1.55;
const RINGS = [0xff5fa2, 0xffe14a, 0x4bd16a, 0x49a8ff, 0xff9a3c, 0xfdfbf4];
const KINDS = [
  { name: 'White Jawbreaker', shell: 0xf7f3ea, shift: 0 },
  { name: 'Yellow Jawbreaker', shell: 0xffe36a, shift: 2 },
  { name: 'Blue Jawbreaker', shell: 0x7cc4ff, shift: 4 },
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
  vec3 pal[5] = vec3[5](${[0xff3d6e, 0x2f8fff, 0xffc21a, 0x35c25a, 0xa14dff].map(glsl).join(', ')});
  vec3 c = base;
  for (int i = 0; i < 2; i++) {
    vec3 q = p * (i == 0 ? 2.9 : 5.1) + float(i) * 7.7;
    vec3 ci = floor(q);
    float d = length(fract(q) - 0.5 - (cHash3(ci) - 0.5) * 0.5);
    float rad = 0.1 + 0.22 * cHash1(ci + 2.0);
    c = mix(c, pal[int(cHash1(ci + 5.0) * 4.99)], smoothstep(rad, rad - 0.03, d));
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
      layers: [{ geometry: g, material: M.shell({ color: k.shell, gloss: 0.85, pattern: speck }), cap: M.hard({ color: k.shell, clarity: 0.15, opaque: true, pattern: rings }) }],
    };
  },
};
