// Tanghulu: three strawberries (solid cores with seeds and a leafy top) sealed in one clear glassy sugar shell on a bamboo skewer.
import * as THREE from 'three';
import { detail } from '../../lib/geo.js';
import { M, spin } from './_shared.js';

const LEN = 2.7;
const PITCH = 2.78;
const A0 = -2.68;
const RB = 1.2;
const COAT = 0.26;
const SCALE = [1, 0.95, 0.88];
const shape = (t) => (t <= 0 || t >= 1 ? 0 : Math.pow(Math.sin(Math.PI * Math.pow(t, 0.6)), 0.8));
const HEAD = `float i = clamp(floor((p.x - ${A0.toFixed(2)} + 0.04) / ${PITCH.toFixed(2)}), 0.0, 2.0);
  float t = clamp((p.x - (${A0.toFixed(2)} + i * ${PITCH.toFixed(2)})) / ${LEN.toFixed(2)}, 0.001, 0.999);
  float prof = pow(sin(3.14159 * pow(t, 0.6)), 0.8);
  float rad = ${RB.toFixed(2)} * prof * (i < 0.5 ? ${SCALE[0].toFixed(2)} : i < 1.5 ? ${SCALE[1].toFixed(2)} : ${SCALE[2].toFixed(2)});
  float ang = atan(p.z, p.y) + i * 1.3;`;

export default {
  id: 'tanghulu',
  name: 'Strawberry Tanghulu',
  group: 'hard',
  variants: 1,
  feel: { hardness: 0.95, bounce: 0.1, sticky: 0.2, density: 1.1 },
  breaks: { mode: 'shatter', toughness: 0.4, shards: 6, crumbs: { color: 0xffe9c0, amount: 0.7 } },
  taste: { sweet: 0.85, sour: 0.25 },
  mouth: { bites: 5, sound: 'crunch' },
  sound: { land: 'glass', cut: 'crack', pitch: 0.82 },
  build() {
    const x0 = A0 - COAT;
    const x1 = A0 + 2 * PITCH + LEN + COAT;
    const hull = [];
    for (let k = 0; k <= 46; k++) {
      const x = x0 + ((x1 - x0) * (1 - Math.cos((Math.PI * k) / 46))) / 2;
      let r = 0;
      for (let i = 0; i < 3; i++) r = Math.max(r, (RB * SCALE[i] + COAT) * shape((x - (A0 + i * PITCH - COAT)) / (LEN + 2 * COAT)));
      if (x > A0 + 0.5 && x < x1 - 0.8) r = Math.max(r, 0.5);
      hull.push([k === 0 || k === 46 ? 0 : r, x]);
    }
    const shell = spin(hull, 22, { axis: 'x', warp: (p, a) => {
      const w = 1 + 0.025 * Math.sin(a * 3 + p[0] * 1.7) + 0.02 * Math.sin(a * 5 - p[0] * 2.3);
      return [p[0], p[1] * w, p[2] * w];
    } });
    const layers = [{ geometry: shell, material: M.hard({ color: 0xfff1d6, clarity: 0.95, glow: 0.1, alpha: 0.2 }), cap: M.hard({ color: 0xffe2a8, clarity: 0.5, opaque: true }) }];
    const seeds = `vec3 candyPattern(vec3 p, vec3 base) {
  ${HEAD}
  float tr = t * 9.0;
  float row = floor(tr);
  float n = max(3.0, floor(11.0 * prof + 0.5));
  float u = ang / 6.28318 * n + 0.5 * mod(row, 2.0);
  vec2 cell = vec2((fract(u) - 0.5) * (6.28318 * rad / n) / ${(LEN / 9).toFixed(3)}, fract(tr) - 0.5);
  float d = length(cell);
  vec3 c = base * (0.82 + 0.3 * cNoise(p * 3.0));
  c = mix(c, base * 0.55, smoothstep(0.36, 0.2, d));
  c = mix(c, vec3(0.95, 0.78, 0.3), smoothstep(0.17, 0.1, d));
  c = mix(c, vec3(0.98, 0.78, 0.7), smoothstep(0.13, 0.03, t) * 0.55);
  float leaf = step(t, 0.045 + 0.13 * pow(abs(cos(ang * 2.5)), 3.0));
  return mix(c, vec3(0.16, 0.42, 0.1) * (0.7 + 0.6 * cNoise(p * 9.0)), leaf);
}`;
    const flesh = `vec3 candyPattern(vec3 p, vec3 base) {
  ${HEAD}
  float rel = length(p.yz) / max(rad, 0.05);
  vec3 c = mix(vec3(1.0, 0.84, 0.82), vec3(0.9, 0.16, 0.2), smoothstep(0.1, 0.82, rel));
  c = mix(c, vec3(1.0, 0.92, 0.9), (0.5 + 0.5 * sin(ang * 14.0)) * 0.4 * smoothstep(0.8, 0.3, rel));
  c = mix(c, vec3(1.0, 0.95, 0.9), smoothstep(0.22, 0.12, rel));
  return mix(c, base, smoothstep(0.88, 0.94, rel));
}`;
    for (let i = 0; i < 3; i++) {
      const pts = [];
      for (let k = 0; k <= 12; k++) {
        const t = (1 - Math.cos((Math.PI * k) / 12)) / 2;
        pts.push([k === 0 || k === 12 ? 0 : RB * SCALE[i] * shape(t), A0 + i * PITCH + LEN * t]);
      }
      layers.push({
        geometry: spin(pts, 18, { axis: 'x' }),
        inside: 0,
        material: M.gummy({ color: 0xcf0d18, clarity: 0.1, gloss: 0.5, glow: 0.12, pattern: seeds }),
        cap: M.gummy({ color: 0xd3101c, clarity: 0.3, gloss: 0.7, opaque: true, pattern: flesh }),
        fill: { type: 'solid', color: 0xe8404a },
      });
    }
    const stick = new THREE.CylinderGeometry(0.13, 0.13, 11.8, Math.max(6, Math.round(8 * detail())));
    stick.rotateZ(Math.PI / 2);
    layers.push({ geometry: stick, role: 'attach', anchor: [A0 + PITCH + LEN / 2, 0, 0], material: M.matte({ color: 0xd9bb88, roughness: 0.8 }) });
    return { layers };
  },
};
