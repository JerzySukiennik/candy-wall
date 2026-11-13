// Planet gummy: blue sphere marbled like a planet, with a white foam mantle and a red jam core that oozes when cut.
import { mat } from '../../lib/mat.js';
import { ball, glsl } from './_shared.js';

const R = 1.5;

export default {
  id: 'planet-gummy',
  name: 'Planet Gummies',
  group: 'gummy',
  variants: 3,
  feel: { hardness: 0.38, bounce: 0.7, sticky: 0.1, density: 1.1 },
  breaks: { mode: 'slice', toughness: 0.35 },
  taste: { sweet: 0.85, sour: 0.2 },
  mouth: { bites: 4, sound: 'gooey' },
  sound: { land: 'rubber', cut: 'squish', pitch: 0.78 },
  build(v) {
    const seed = (v * 13.7).toFixed(1);
    const planet = `vec3 planetSkin(vec3 p) {
      vec3 q = p * 0.75 + ${seed};
      vec3 w = q + 1.6 * vec3(cFbm(q * 1.2 + 3.1), cFbm(q * 1.2 + 7.7), cFbm(q * 1.2 + 1.3));
      float n = cFbm(w);
      vec3 c = mix(${glsl(0x0a2fb8)}, ${glsl(0x1aa0ff)}, smoothstep(0.3, 0.62, n));
      c = mix(c, ${glsl(0x18c48a)}, smoothstep(0.6, 0.68, cFbm(q * 1.5 + 21.0)) * 0.85);
      float cloud = smoothstep(0.5, 0.64, cFbm(w * 1.9 + vec3(0.0, p.y * 0.8, 0.0)));
      return mix(c, ${glsl(0xf2f8ff)}, cloud * 0.9);
    }`;
    const skin = `${planet}
    vec3 candyPattern(vec3 p, vec3 base) {
      return planetSkin(p);
    }`;
    const inside = `${planet}
    vec3 candyPattern(vec3 p, vec3 base) {
      return mix(${glsl(0xf4f8ff)}, planetSkin(p), smoothstep(${(R - 0.26).toFixed(2)}, ${(R - 0.22).toFixed(2)}, length(p)));
    }`;
    const jam = mat.liquid({ color: 0xd00a2a, clarity: 0.35 });
    return {
      name: 'Planet Gummy',
      layers: [
        { geometry: ball(R, 30, 20), material: mat.gummy({ color: 0xffffff, clarity: 0.4, gloss: 0.95, pattern: skin }), cap: mat.foam({ color: 0xffffff, pattern: inside }), cavity: jam },
        { geometry: ball(0.78, 20, 12), inside: 0, material: jam, fill: { type: 'gel', color: 0xd00a2a, viscosity: 0.5, amount: 0.85 } },
      ],
    };
  },
};
