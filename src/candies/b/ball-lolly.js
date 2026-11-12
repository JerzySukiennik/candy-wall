// Ball lollipops: glossy hard candy balls with a mould seam and a pink bubblegum centre, resting on a tilted paper stick.
import * as THREE from 'three';
import { bake, detail } from '../../lib/geo.js';
import { M, ball } from './_shared.js';

const KINDS = [
  { name: 'Cherry Ball Lollipop', color: 0xe0112b, taste: { sweet: 0.9, sour: 0.15 } },
  { name: 'Blue Raspberry Ball Lollipop', color: 0x1c7df0, taste: { sweet: 0.85, sour: 0.3 } },
  { name: 'Green Apple Ball Lollipop', color: 0x58c322, taste: { sweet: 0.8, sour: 0.4 } },
  { name: 'Orange Ball Lollipop', color: 0xff8a14, taste: { sweet: 0.9, sour: 0.2 } },
];
const RAD = 1.3;
const LEN = 8.2;
const CX = 3.42;

export default {
  id: 'ball-lolly',
  name: 'Ball Lollipops',
  group: 'lolly',
  variants: KINDS.length,
  feel: { hardness: 0.98, bounce: 0.18, sticky: 0, density: 1.45 },
  breaks: { mode: 'shatter', toughness: 0.8, shards: 5, crumbs: { color: 0xffe4e8, amount: 0.5 } },
  taste: { sweet: 0.9, sour: 0.2 },
  mouth: { bites: 7, sound: 'crack' },
  sound: { land: 'hard', cut: 'crack', pitch: 0.98 },
  build(v) {
    const k = KINDS[v];
    const head = bake(ball(RAD, 40, 24, (d, lat) => RAD * (1 + 0.022 * Math.exp(-Math.pow(lat / 0.075, 2)))), { move: [CX, 0, 0] });
    const gum = bake(ball(0.72, 22, 12), { move: [CX, 0, 0] });
    const tilt = Math.asin((RAD - 0.19) / LEN);
    const stick = new THREE.CylinderGeometry(0.19, 0.19, LEN, Math.max(6, Math.round(12 * detail())));
    stick.rotateZ(Math.PI / 2);
    stick.translate(-LEN / 2, 0, 0);
    stick.rotateZ(tilt);
    stick.translate(CX, 0, 0);
    return {
      name: k.name,
      taste: k.taste,
      layers: [
        { geometry: head, material: M.hard({ color: k.color, clarity: 0.5 }) },
        { geometry: gum, inside: 0, material: M.gummy({ color: 0xff9cc4, clarity: 0.05, gloss: 0.3 }), fill: { type: 'solid', color: 0xff9cc4 } },
        { geometry: stick, role: 'attach', anchor: [CX, 0, 0], material: M.matte({ color: 0xf6f3ea, roughness: 0.7 }) },
      ],
    };
  },
};
