// Berry bead: raspberry and blackberry domes, a crunchy coat of hard sugar beads around a soft jelly heart.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, fibonacci, floor, solid, v3, wrap } from './_shared.js';

const KINDS = [
  { name: 'Raspberry Bead', bead: 0xd9163f, jelly: 0xff8aa2, taste: { sweet: 0.8, sour: 0.3 } },
  { name: 'Blackberry Bead', bead: 0x4a2278, jelly: 0xb478e6, taste: { sweet: 0.85, sour: 0.2 } },
];
const base = S.move(S.ellipsoid(0.86, 0.98, 0.86), 0, -0.22, 0);

function beadCentres() {
  const out = [];
  for (const d of fibonacci(84)) {
    const p = [d[0] * 0.8, d[1] * 0.92 - 0.22, d[2] * 0.8];
    if (p[1] > -0.62) out.push(p);
  }
  return out;
}

export default {
  id: 'berry-bead',
  name: 'Berry Beads',
  group: 'crunchy',
  variants: KINDS.length,
  feel: { hardness: 0.42, bounce: 0.3, sticky: 0.03, density: 1.3 },
  breaks: { mode: 'slice', toughness: 0.4, crumbs: { color: 0xd9163f, amount: 0.4 } },
  taste: { sweet: 0.8, sour: 0.25 },
  mouth: { bites: 4, sound: 'crunch' },
  sound: { land: 'tiny', cut: 'crunch', pitch: 1.34 },
  build(v) {
    const k = KINDS[v];
    const beads = beadCentres();
    const coat = (x, y, z) => {
      let d = base(x, y, z);
      if (d > 0.5) return d;
      for (const b of beads) {
        const e = Math.hypot(x - b[0], y - b[1], z - b[2]) - 0.2;
        const h = Math.max(0.05 - Math.abs(d - e), 0) / 0.05;
        d = Math.min(d, e) - h * h * 0.0125;
      }
      return d;
    };
    const shell = wrap(floor(coat, -0.6, 0.05), { origin: [0, -0.15, 0], nu: 60, nv: 30, bias: 0.85, far: 3 });
    const heart = solid(floor(S.round(base, -0.2), -0.42, 0.1), { min: [-0.85, -0.58, -0.85], max: [0.85, 0.74, 0.85], res: 12 });
    const off = centre([shell, heart]);
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      vec3 q = (p - ${v3([off[0], off[1] - 0.22, off[2]])}) / vec3(0.86, 0.98, 0.86);
      float lift = (length(q) - 1.0) * 0.86;
      return base * (0.5 + 0.5 * smoothstep(-0.01, 0.09, lift));
    }`;
    return {
      name: k.name,
      taste: k.taste,
      layers: [
        { geometry: shell, material: mat.shell({ color: k.bead, gloss: 0.9, pattern }), cap: mat.matte({ color: k.bead, roughness: 0.7 }) },
        { geometry: heart, inside: 0, material: mat.gummy({ color: k.jelly, clarity: 0.6, gloss: 0.9 }), fill: { type: 'solid', color: k.jelly, viscosity: 1, amount: 0 } },
      ],
    };
  },
};
