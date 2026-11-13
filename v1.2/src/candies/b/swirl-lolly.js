// Swirl lollipops: big flat coiled-rope rainbow discs lying on a paper stick; the hard head shatters, the stick is an attach layer.
import * as THREE from 'three';
import { detail } from '../../lib/geo.js';
import { M, TAU, glsl, grid } from './_shared.js';

const R = 2.8;
const T = 0.45;
const CX = 3.1;
const TURNS = 4.5;
const KINDS = [
  { name: 'Rainbow Swirl Lollipop', pal: [0xff2b3a, 0xff8a1e, 0xffd92e, 0x3ccf4e, 0x2f8fff, 0x9a4dff] },
  { name: 'Pastel Swirl Lollipop', pal: [0xff9ec4, 0xffc48a, 0xfff2a0, 0xa8ecc0, 0xa0d2ff, 0xcdb0ff] },
  { name: 'Berry Swirl Lollipop', pal: [0xff2b5e, 0xfff6f2, 0xff7ab0, 0xfff6f2, 0xb0124a, 0xfff6f2] },
];

export default {
  id: 'swirl-lolly',
  name: 'Swirl Lollipops',
  group: 'lolly',
  variants: KINDS.length,
  feel: { hardness: 0.975, bounce: 0.15, sticky: 0, density: 1.5 },
  breaks: { mode: 'shatter', toughness: 0.7, shards: 7, crumbs: { color: 0xffe9f0, amount: 0.6 } },
  taste: { sweet: 0.95, sour: 0.1 },
  mouth: { bites: 6, sound: 'crack' },
  sound: { land: 'glass', cut: 'crack', pitch: 0.86 },
  build(v) {
    const k = KINDS[v];
    const rows = [];
    for (let i = 0; i < 22; i++) rows.push(i / 22.6);
    rows.push(0.975, 0.993, { u: 1, keep: true }, 1.007, 1.025);
    for (let i = 8; i >= 0; i--) rows.push(2 - i / 9.2);
    const head = grid(rows, 48, (u, a01) => {
      const rho = u <= 1 ? u : 2 - u;
      const a = a01 * TAU;
      const base = T * Math.sqrt(Math.max(0, 1 - Math.pow(rho, 6)));
      const bump = 0.5 + 0.5 * Math.cos(TAU * (rho * TURNS - a01));
      const y = u <= 1 ? base * (0.78 + 0.22 * Math.pow(bump, 0.7)) : -base * 0.92;
      return [CX + R * rho * Math.cos(a), y, R * rho * Math.sin(a)];
    });
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 pal[6] = vec3[6](${k.pal.map(glsl).join(', ')});
  vec2 q = p.xz - vec2(${CX.toFixed(2)}, 0.0);
  float r = length(q) / ${R.toFixed(2)};
  float v = atan(q.y, q.x) / 6.2831853;
  vec3 c = pal[int(mod(floor(fract(v * 2.0 + r * 1.25) * 6.0), 6.0))];
  float g = 1.0 - smoothstep(0.0, 0.08, abs(fract(r * ${TURNS.toFixed(1)} - v) - 0.5));
  return c * c * (0.92 - 0.3 * g);
}`;
    const len = CX - 1.2 + 5.9;
    const stick = new THREE.CylinderGeometry(0.19, 0.19, len, Math.max(6, Math.round(12 * detail())));
    stick.rotateZ(Math.PI / 2);
    stick.translate(-5.9 + len / 2, 0, 0);
    return {
      name: k.name,
      layers: [
        { geometry: head, material: M.hard({ clarity: 0.3, glow: 0.16, pattern }), cap: M.hard({ clarity: 0.2, opaque: true, pattern }) },
        { geometry: stick, role: 'attach', anchor: [CX, 0, 0], material: M.matte({ color: 0xf6f3ea, roughness: 0.7 }) },
      ],
    };
  },
};
