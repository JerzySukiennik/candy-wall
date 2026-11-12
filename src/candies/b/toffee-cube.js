// Toffee cubes: soft salted caramel cubes that sag a little at the base, with loose sea salt flakes on top (each flake is its own attach layer).
import * as THREE from 'three';
import { bake } from '../../lib/geo.js';
import { rng } from '../../util.js';
import { M, noise3, roundBox } from './_shared.js';

const DROP = -0.03;

export default {
  id: 'toffee-cube',
  name: 'Salted Toffee Cubes',
  group: 'chewy',
  variants: 1,
  feel: { hardness: 0.72, bounce: 0.15, sticky: 0.9, density: 1.25 },
  breaks: { mode: 'slice', toughness: 0.6 },
  taste: { sweet: 0.9, salty: 0.35 },
  mouth: { bites: 7, sound: 'gooey' },
  sound: { land: 'soft', cut: 'squish', pitch: 0.9 },
  build() {
    const body = bake(
      roundBox(1, 0.9, 1, 7, 40, 26, (p) => {
        const sag = 1 + 0.045 * (0.5 - p[1] / 1.8) + 0.03 * (noise3(p[0] * 1.3 + 4, p[1] * 1.3, p[2] * 1.3) - 0.5);
        return [p[0] * sag, p[1], p[2] * sag];
      }),
      { move: [0, DROP, 0] }
    );
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
  return base * (0.88 + 0.24 * cFbm(p * vec3(1.6, 5.0, 1.6)));
}`;
    const layers = [
      { geometry: body, material: M.gummy({ color: 0x6b3814, clarity: 0.1, gloss: 0.6, glow: 0.05, back: 0.2, pattern }), cap: M.gummy({ color: 0x80461a, clarity: 0.15, gloss: 0.85, glow: 0.08, back: 0.2, opaque: true, pattern }) },
    ];
    const r = rng(77);
    const salt = M.hard({ color: 0xffffff, clarity: 0.8, glow: 0.35 });
    const spots = [[-0.46, -0.34], [0.36, -0.5], [0.02, 0.06], [-0.3, 0.46], [0.52, 0.3], [-0.05, -0.52], [0.22, 0.52]];
    spots.forEach(([x, z], i) => {
      const w = 0.11 + 0.1 * r();
      const g = i % 2 ? new THREE.ConeGeometry(w * 0.8, 0.08, 4, 1) : new THREE.BoxGeometry(w, 0.04, w * (0.6 + 0.3 * r()));
      const h = i % 2 ? 0.04 : 0.02;
      bake(g, { rotate: [(r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3], move: [x, 0.885 + h + DROP, z] });
      layers.push({ geometry: g, role: 'attach', anchor: [x, 0.9 + DROP, z], material: salt });
    });
    return { layers };
  },
};
