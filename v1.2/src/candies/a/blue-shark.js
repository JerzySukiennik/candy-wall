// Blue shark: moulded shark lying on its belly, translucent blue gummy back over a white foam belly, split by a 3D pattern.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, glsl, link, solid, v3 } from './_shared.js';

const SPLIT = -0.05;

export default {
  id: 'blue-shark',
  name: 'Blue Sharks',
  group: 'gummy',
  variants: 1,
  feel: { hardness: 0.4, bounce: 0.55, sticky: 0.1, density: 1.1 },
  breaks: { mode: 'slice', toughness: 0.38 },
  taste: { sweet: 0.85, sour: 0.1 },
  mouth: { bites: 4, sound: 'chewy' },
  sound: { land: 'rubber', cut: 'squeak', pitch: 0.86 },
  build() {
    const trunk = S.scale(S.smooth(0.2, link([0.9, 0, 0], [2.42, -0.12, 0], 0.66, 0.15), link([0.9, 0, 0], [-1.9, 0.05, 0], 0.66, 0.24)), 1, 0.86, 1);
    const tail = S.mirror(link([-1.8, 0.05, 0], [-2.55, 0.05, 0.78], 0.24, 0.17), 'z');
    const fins = S.mirror(link([0.75, -0.06, 0.35], [-0.1, -0.12, 1.2], 0.3, 0.17), 'z');
    const dorsal = link([0.45, 0.3, 0], [-0.5, 1.05, 0], 0.3, 0.12);
    const shark = floor(S.smooth(0.2, trunk, tail, fins, dorsal), -0.42, 0.08);
    const g = solid(shark, { min: [-2.95, -0.6, -1.6], max: [2.8, 1.36, 1.6], res: 40 });
    const off = centre([g]);
    const eye = [1.72 + off[0], 0.2 + off[1], 0.37 + off[2]];
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      float y = p.y - ${off[1].toFixed(4)};
      vec3 blue = mix(base, ${glsl(0x0b3fb0)}, 0.55 * smoothstep(0.1, 0.9, y));
      vec3 c = mix(${glsl(0xf4f9ff)}, blue, smoothstep(-0.015, 0.015, y - ${SPLIT.toFixed(2)} + 0.03 * (cNoise(p * 3.0) - 0.5)));
      float d = length(vec3(p.xy, abs(p.z)) - ${v3(eye)});
      return mix(c, ${glsl(0x061022)}, smoothstep(0.1, 0.075, d));
    }`;
    return {
      name: 'Blue Shark Gummy',
      layers: [{ geometry: g, material: mat.gummy({ color: 0x1c8cf5, clarity: 0.6, gloss: 0.88, pattern }), cap: mat.gummy({ color: 0x1c8cf5, clarity: 0.6, gloss: 0.6, opaque: true, pattern }) }],
    };
  },
};
