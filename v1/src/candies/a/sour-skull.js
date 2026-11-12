// Sour skull: neon moulded skull with a flat back, dusted in sour sugar and filled with thick, very sour gel.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, lay, solid, v3 } from './_shared.js';

const KINDS = [
  { name: 'Toxic Lime', skull: 0x66f01a, gel: 0xfff01a },
  { name: 'Hot Pink', skull: 0xff2f9c, gel: 0x2fd0ff },
  { name: 'Atomic Orange', skull: 0xff6a12, gel: 0xa23bff },
  { name: 'Electric Blue', skull: 0x18c4ff, gel: 0xff3f8f },
];

export default {
  id: 'sour-skull',
  name: 'Sour Skulls',
  group: 'sour',
  variants: KINDS.length,
  feel: { hardness: 0.52, bounce: 0.5, sticky: 0.12, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.5 },
  taste: { sweet: 0.4, sour: 0.95 },
  mouth: { bites: 5, sound: 'gooey' },
  sound: { land: 'rubber', cut: 'squeak', pitch: 0.98 },
  build(v) {
    const k = KINDS[v];
    const at = (g, x, y, z) => S.move(g, x, y, z);
    const pair = (g, x, y, z) => S.mirror(S.move(g, x, y, z), 'x');
    const bone = S.smooth(0.3, at(S.ellipsoid(1.08, 0.98, 1.0), 0, 0.42, 0.3), at(S.box(0.64, 0.5, 0.6, 0.24), 0, -0.74, 0.28));
    const holes = S.union(pair(S.ellipsoid(0.33, 0.35, 0.42), 0.45, 0.28, 1.36), at(S.ellipsoid(0.15, 0.22, 0.36), 0, -0.24, 1.14));
    const carved = S.smoothSub(0.08, bone, holes);
    const teeth = (x, y, z) => {
      let d = carved(x, y, z);
      if (y < -0.6 && z > 0.35) {
        const w = Math.min(1, (-0.6 - y) / 0.15);
        for (const tx of [-0.36, -0.12, 0.12, 0.36]) d += 0.1 * w * Math.exp(-((x - tx) ** 2) / 0.0035);
        d += 0.07 * Math.exp(-((y + 0.92) ** 2) / 0.004);
      }
      return d;
    };
    const body = solid(floor(lay(S.scale(teeth, 1.1)), 0, 0.07), { min: [-1.4, -0.16, -1.75], max: [1.4, 1.6, 1.55], res: 25 });
    const core = solid(lay(S.scale(at(S.ellipsoid(0.74, 0.62, 0.33), 0, 0.36, 0.5), 1.1)), { min: [-1.0, 0.02, -1.3], max: [1.0, 1.08, 0.5], res: 15 });
    const off = centre([body, core]);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      vec3 q = (p - ${v3(off)}) / 1.1;
      vec3 b = vec3(abs(q.x), -q.z, q.y);
      float eye = length((b - vec3(0.45, 0.28, 1.36)) / vec3(0.36, 0.38, 0.46));
      float nose = length((b - vec3(0.0, -0.24, 1.14)) / vec3(0.18, 0.25, 0.4));
      float shade = max(smoothstep(1.05, 0.8, eye), smoothstep(1.05, 0.8, nose));
      float gaps = smoothstep(0.05, 0.02, abs(b.x - 0.12)) + smoothstep(0.05, 0.02, abs(b.x - 0.36));
      gaps = max(gaps, smoothstep(0.045, 0.02, abs(b.y + 0.92)));
      shade = max(shade, 0.8 * min(1.0, gaps) * step(b.y, -0.66) * step(0.55, b.z));
      return base * (1.0 - 0.62 * shade);
    }`;
    const gel = mat.liquid({ color: k.gel, clarity: 0.45 });
    return {
      name: k.name + ' Sour Skull',
      layers: [
        { geometry: body, material: mat.gummy({ color: k.skull, clarity: 0.6, gloss: 0.7, sugar: 0.3, sugarScale: 17, pattern }), cap: mat.gummy({ color: k.skull, clarity: 0.6, gloss: 0.6, opaque: true }), cavity: gel },
        { geometry: core, inside: 0, material: gel, fill: { type: 'gel', color: k.gel, viscosity: 0.6, amount: 0.9 } },
      ],
    };
  },
};
