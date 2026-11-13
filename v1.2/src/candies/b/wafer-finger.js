// Wafer fingers: enrobed chocolate bars with a rippled top; the snapped face shows stacked wafer sheets and cream (layers on p.y).
import { S2 } from '../../lib/geo.js';
import { M, clamp, glsl, lines, slab } from './_shared.js';

const HX = 4.5;
const HZ = 1.1;
const Y0 = -0.6;
const EDGE = [0, 0.03, 0.07, 0.12, 0.18, 0.25, 0.33];

function axis(half, step) {
  return [...EDGE.map((e) => -half + e), ...lines(-half + 0.45, half - 0.45, step), ...EDGE.map((e) => half - e)].sort((a, b) => a - b);
}

export default {
  id: 'wafer-finger',
  name: 'Wafer Fingers',
  group: 'crunchy',
  variants: 1,
  feel: { hardness: 0.89, bounce: 0.05, sticky: 0.02, density: 0.6 },
  breaks: { mode: 'snap', toughness: 0.3, crumbs: { color: 0xe6c88c, amount: 0.5 } },
  taste: { sweet: 0.8, bitter: 0.05 },
  mouth: { bites: 4, sound: 'crisp' },
  sound: { land: 'choc', cut: 'snap', pitch: 1.1 },
  build() {
    const outline = S2.box(HX, HZ, 0.3);
    const top = (x, z) => {
      const t = clamp(-outline(x, z) / 0.3);
      const shoulder = Math.sqrt(1 - (1 - t) * (1 - t));
      return Y0 + 0.1 + (1.06 + 0.035 * Math.sin(x * 4.6 + 1.2 * Math.sin(z * 2.4))) * shoulder;
    };
    const g = slab(axis(HX, 0.3), axis(HZ, 0.26), top, Y0);
    const layers = `vec3 candyPattern(vec3 p, vec3 base) {
  vec3 q = abs(p) - vec3(${HX.toFixed(2)}, 0.6, ${HZ.toFixed(2)}) + 0.25;
  float d = length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - 0.25;
  float y = (p.y + 0.48) / 0.1372;
  float wafer = 1.0 - mod(floor(y), 2.0);
  float cell = smoothstep(0.3, 0.5, abs(fract(p.x * 5.5 + p.z * 5.5) - 0.5)) * smoothstep(0.15, 0.4, abs(fract(y) - 0.5));
  vec3 w = ${glsl(0xf6e2b0)} * (0.84 + 0.22 * cNoise(p * vec3(30.0, 44.0, 30.0))) * (1.0 - 0.3 * cell);
  vec3 cr = ${glsl(0x7d4c29)} * (0.92 + 0.14 * cNoise(p * 14.0));
  vec3 c = mix(cr, w, wafer);
  vec3 coat = base * (0.9 + 0.24 * cFbm(p * 9.0));
  return mix(c, coat, smoothstep(-0.125, -0.1, d));
}`;
    return { layers: [{ geometry: g, material: M.chocolate({ color: 'milk', gloss: 0.6 }), cap: M.chocolate({ color: 'milk', gloss: 0.06, pattern: layers }) }] };
  },
};
