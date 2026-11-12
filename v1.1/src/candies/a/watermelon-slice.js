// Watermelon slice: sour sugared wedge with a green rind, white pith and red flesh with seeds, all from one 3D pattern.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, glsl, lay, solid } from './_shared.js';

const R = 2.45;
const HALF = (40 * Math.PI) / 180;
const SEEDS = [[1.5, -0.38], [1.55, 0], [1.5, 0.38], [0.95, -0.2], [0.95, 0.2]];

export default {
  id: 'watermelon-slice',
  name: 'Watermelon Slices',
  group: 'sour',
  variants: 1,
  feel: { hardness: 0.35, bounce: 0.4, sticky: 0.1, density: 1.25 },
  breaks: { mode: 'slice', toughness: 0.35 },
  taste: { sweet: 0.6, sour: 0.65 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 1.04 },
  build() {
    const c = Math.cos(HALF);
    const s = Math.sin(HALF);
    const wedge = (x, y) => Math.max(Math.hypot(x, y) - (R - 0.16), Math.abs(x) * c - (y - 0.25) * s) - 0.16;
    const g = solid(lay(S.extrude(wedge, 0.37, 0.12)), { min: [-1.85, -0.55, -2.65], max: [1.85, 0.55, 0.15], res: 30 });
    const off = centre([g]);
    const seeds = SEEDS.map(([r, a]) => `vec2(${(Math.sin(a) * r).toFixed(4)}, ${(-Math.cos(a) * r).toFixed(4)})`).join(', ');
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      const vec2 SEEDS[${SEEDS.length}] = vec2[${SEEDS.length}](${seeds});
      vec3 q = p - vec3(${off.map((n) => n.toFixed(4)).join(', ')});
      float r = length(q.xz) + 0.03 * (cNoise(q * 5.0) - 0.5);
      vec3 flesh = mix(${glsl(0xff2f4a)}, ${glsl(0xe01236)}, cNoise(q * 3.0));
      float seed = 0.0;
      for (int i = 0; i < ${SEEDS.length}; i++) {
        vec2 d = q.xz - SEEDS[i];
        vec2 n = normalize(SEEDS[i]);
        float along = dot(d, n);
        float across = dot(d, vec2(-n.y, n.x));
        seed = max(seed, smoothstep(1.0, 0.8, length(vec2(along / 0.13, across / 0.07))));
      }
      flesh = mix(flesh, ${glsl(0x24100a)}, seed * smoothstep(0.2, 0.26, abs(q.y)));
      vec3 c = mix(flesh, ${glsl(0xf6f7e4)}, smoothstep(${(R - 0.5).toFixed(2)}, ${(R - 0.46).toFixed(2)}, r));
      return mix(c, ${glsl(0x1f9a32)}, smoothstep(${(R - 0.33).toFixed(2)}, ${(R - 0.29).toFixed(2)}, r));
    }`;
    return {
      name: 'Sour Watermelon Slice',
      layers: [
        {
          geometry: g,
          material: mat.gummy({ color: 0xffffff, clarity: 0.5, gloss: 0.45, sugar: 0.72, sugarScale: 14, pattern }),
          cap: mat.gummy({ color: 0xffffff, clarity: 0.55, gloss: 0.6, opaque: true, pattern }),
        },
      ],
    };
  },
};
