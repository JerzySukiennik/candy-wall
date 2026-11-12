// Fireballs: red-hot cinnamon hard candy balls with a molten mottled glaze; the break shows pale sugar layers under the red coat.
import { M, ball } from './_shared.js';

const R = 1.25;

export default {
  id: 'fireball',
  name: 'Cinnamon Fireballs',
  group: 'spicy',
  variants: 1,
  feel: { hardness: 0.99, bounce: 0.22, sticky: 0, density: 1.55 },
  breaks: { mode: 'shatter', toughness: 0.85, shards: 5, crumbs: { color: 0xffd9d2, amount: 0.6 } },
  taste: { sweet: 0.6, spicy: 0.9 },
  mouth: { bites: 6, sound: 'crack' },
  sound: { land: 'hard', cut: 'crack', pitch: 0.92 },
  build() {
    const molten = `vec3 candyPattern(vec3 p, vec3 base) {
  float n = cFbm(p * 2.3 + 5.0);
  float m = cFbm(p * 6.0 + 1.0);
  vec3 hot = base * vec3(1.3, 0.62, 0.3) + vec3(0.1, 0.015, 0.0);
  return mix(base * 0.62, hot, smoothstep(0.34, 0.68, n)) * (0.9 + 0.2 * m);
}`;
    const layers = `vec3 candyPattern(vec3 p, vec3 base) {
  float r = length(p);
  float t = r / 0.17;
  vec3 c = mix(vec3(0.98, 0.92, 0.88), vec3(0.96, 0.5, 0.45), mod(floor(t), 2.0));
  c *= 1.0 - 0.14 * smoothstep(0.4, 0.5, abs(fract(t) - 0.5));
  return mix(c, base, smoothstep(${(R - 0.24).toFixed(2)}, ${(R - 0.2).toFixed(2)}, r));
}`;
    return {
      layers: [{ geometry: ball(R, 40, 24), material: M.hard({ color: 0xcc120c, clarity: 0.5, glow: 0.4, pattern: molten }), cap: M.hard({ color: 0xcc120c, clarity: 0.3, opaque: true, pattern: layers }) }],
    };
  },
};
