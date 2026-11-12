// Sour belt: long flat wavy ribbed strip with colour bands running along its length under a heavy sour-sugar coat.
import { mat } from '../../lib/mat.js';
import { centre, glsl, sweep } from './_shared.js';

const SETS = [
  { name: 'Rainbow Sour Belt', cols: [0xf0182c, 0xff8a12, 0xffd81a, 0x2fbf45, 0x1a8cf0], taste: { sweet: 0.55, sour: 0.8 } },
  { name: 'Berry Sour Belt', cols: [0xff3f96, 0xb44cff, 0x3d6bff, 0x1fd0c0, 0xff3f96], taste: { sweet: 0.5, sour: 0.9 } },
];
const W = 1;
const T = 0.125;
const RIDGES = 6;

function profile() {
  const pts = [[-W + 0.07, -T], [W - 0.07, -T], [W, -T * 0.3], [W, T * 0.3]];
  const span = W * 2 - 0.14;
  for (let i = 0; i <= RIDGES * 2; i++) pts.push([W - 0.07 - (i * span) / (RIDGES * 2), T - (i % 2 ? 0.04 : 0)]);
  pts.push([-W, T * 0.3], [-W, -T * 0.3]);
  return pts;
}

export default {
  id: 'sour-belt',
  name: 'Sour Belts',
  group: 'sour',
  variants: SETS.length,
  feel: { hardness: 0.22, bounce: 0.2, sticky: 0.2, density: 1.2 },
  breaks: { mode: 'slice', toughness: 0.2 },
  taste: { sweet: 0.55, sour: 0.8 },
  mouth: { bites: 3, sound: 'chewy' },
  sound: { land: 'soft', cut: 'squish', pitch: 1.0 },
  build(v) {
    const set = SETS[v];
    const path = [];
    for (let i = 0; i <= 12; i++) {
      const x = -4.5 + i * 0.75;
      path.push([x, 0.1 * Math.sin(x * 1.25 + v * 2.1) + 0.035 * Math.sin(x * 2.9 + 1 + v), 0]);
    }
    const g = sweep(path, { profile: profile(), step: 0.19 });
    centre([g]);
    const n = set.cols.length;
    let bands = `vec3 c = ${glsl(set.cols[0])};`;
    for (let i = 1; i < n; i++) bands += `\n      c = mix(c, ${glsl(set.cols[i])}, smoothstep(${(i - 0.07).toFixed(2)}, ${(i + 0.07).toFixed(2)}, t));`;
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      float t = (p.z + ${W.toFixed(1)}) * ${(n / (W * 2)).toFixed(3)};
      ${bands}
      return c;
    }`;
    return {
      name: set.name,
      taste: set.taste,
      layers: [
        {
          geometry: g,
          material: mat.gummy({ color: 0xffffff, clarity: 0.5, gloss: 0.3, sugar: 0.9, sugarScale: 15, pattern }),
          cap: mat.gummy({ color: 0xffffff, clarity: 0.55, gloss: 0.6, opaque: true, pattern }),
        },
      ],
    };
  },
};
