// Chili mango: soft mango-slice gummy dusted with red chili powder, sweet, a little sour and properly hot.
import { S, S2 } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, glsl, lay, solid } from './_shared.js';

export default {
  id: 'chili-mango',
  name: 'Chili Mango Slices',
  group: 'spicy',
  variants: 2,
  feel: { hardness: 0.33, bounce: 0.35, sticky: 0.18, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.4 },
  taste: { sweet: 0.6, sour: 0.3, spicy: 0.6 },
  mouth: { bites: 5, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squeak', pitch: 0.92 },
  build(v) {
    const bend = v ? -0.5 : 0.5;
    const slice = S2.smooth(
      0.7,
      S2.move(S2.circle(0.7), -1.75, bend * 0.9),
      S2.move(S2.circle(0.95), -0.7, -bend * 0.2),
      S2.move(S2.circle(0.95), 0.6, -bend * 0.25),
      S2.move(S2.circle(0.6), 1.85, bend * 0.8)
    );
    const g = solid(lay(S.extrude(slice, 0.37, 0.33)), { min: [-2.75, -0.54, -1.6], max: [2.75, 0.54, 1.6], res: 32 });
    centre([g]);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      float dust = smoothstep(0.33, 0.62, cFbm(p * 2.4 + ${(v * 9.1).toFixed(1)}));
      vec3 c = mix(base, ${glsl(0xb3240c)}, dust * 0.74);
      float fleck = step(0.9, cHash1(floor(p * 24.0)));
      return mix(c, ${glsl(0x7a1206)}, fleck * 0.85);
    }`;
    return {
      name: 'Chili Mango Slice',
      layers: [
        {
          geometry: g,
          material: mat.gummy({ color: 0xffa114, clarity: 0.6, gloss: 0.55, sugar: 0.8, sugarColor: 0xc8260e, sugarScale: 17, pattern }),
          cap: mat.gummy({ color: 0xffae22, clarity: 0.6, gloss: 0.7, opaque: true }),
        },
      ],
    };
  },
};
