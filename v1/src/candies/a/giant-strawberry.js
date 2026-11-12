// Giant gummy strawberry: big firm moulded berry with seed dimples, raised leaves and a solid green top as a second body.
import { S } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';
import { centre, floor, glsl, link, roundCone, solid, surfacePoint, v3 } from './_shared.js';

const cone = roundCone(1.95, 0.55, 2.8);
const berry = (x, y, z) => cone(y / 0.88, x + 0.8, z) * 0.88;
const leafEdge = (x, y, z) => {
  const w = 0.5 + 0.5 * Math.cos(Math.atan2(z, y) * 6);
  return x + 2.3 - Math.pow(w, 1.4) * 1.7 * Math.min(1, Math.max(0, (Math.hypot(y, z) - 0.5) / 0.6));
};

function seedSpots() {
  const rows = [[-0.2, 9], [0.45, 8], [1.1, 6], [1.7, 5], [2.2, 3]];
  const out = [];
  rows.forEach(([xa, n], r) => {
    for (let i = 0; i < n; i++) {
      const a = ((i + (r % 2) * 0.5) / n) * Math.PI * 2 + 0.3;
      const dir = [0.18, Math.cos(a), Math.sin(a)];
      const l = Math.hypot(...dir);
      const d = dir.map((c) => c / l);
      const p = surfacePoint(berry, [xa, 0, 0], d);
      out.push({ pit: p, seed: [p[0] - d[0] * 0.09, p[1] - d[1] * 0.09, p[2] - d[2] * 0.09] });
    }
  });
  return out;
}

export default {
  id: 'giant-strawberry',
  name: 'Giant Gummy Strawberries',
  group: 'gummy',
  variants: 1,
  feel: { hardness: 0.6, bounce: 0.4, sticky: 0.12, density: 1.35 },
  breaks: { mode: 'slice', toughness: 0.7 },
  taste: { sweet: 0.9, sour: 0.15 },
  mouth: { bites: 7, sound: 'chewy' },
  sound: { land: 'rubber', cut: 'squeak', pitch: 0.72 },
  build() {
    const spots = seedSpots();
    const dimpled = (x, y, z) => {
      let d = berry(x, y, z);
      if (d < -0.5 || d > 0.5) return d;
      for (const s of spots) {
        const r = (x - s.pit[0]) ** 2 + (y - s.pit[1]) ** 2 + (z - s.pit[2]) ** 2;
        if (r < 0.5) d += 0.13 * Math.exp(-r / 0.045);
      }
      return d;
    };
    const relief = (x, y, z) => Math.max(berry(x, y, z) - 0.07, leafEdge(x, y, z));
    const red = floor((x, y, z) => Math.max(Math.min(dimpled(x, y, z), relief(x, y, z)), -x - 2.32), -1.48, 0.1);
    const stem = link([-2.55, 0.1, 0], [-3.0, 0.3, 0.08], 0.2, 0.15);
    const green = floor(S.smooth(0.12, (x, y, z) => Math.max(berry(x, y, z) - 0.07, x + 2.3), stem), -1.48, 0.1);
    const body = solid(red, { min: [-2.5, -1.7, -2.2], max: [2.75, 1.95, 2.2], res: 25 });
    const top = solid(green, { min: [-3.4, -1.5, -1.6], max: [-2.1, 1.5, 1.6], res: 15 });
    const off = centre([body, top]);
    const list = spots.map((s) => v3([s.seed[0] + off[0], s.seed[1] + off[1], s.seed[2] + off[2]])).join(', ');
    const shared = `
      float sbEdge(vec3 q) {
        float w = 0.5 + 0.5 * cos(atan(q.z, q.y) * 6.0);
        return q.x + 2.3 - pow(w, 1.4) * 1.7 * clamp((length(q.yz) - 0.5) / 0.6, 0.0, 1.0);
      }
      float sbDepth(vec3 q) {
        vec2 c = vec2(length(vec2(q.y / 0.88, q.z)), q.x + 0.8);
        float k = dot(c, vec2(-0.5, 0.8660));
        if (k < 0.0) return (length(c) - 1.95) * 0.88;
        if (k > 2.4249) return (length(c - vec2(0.0, 2.8)) - 0.55) * 0.88;
        return (dot(c, vec2(0.8660, 0.5)) - 1.95) * 0.88;
      }
      vec3 sbLeaf(vec3 q) {
        float vein = abs(sin(atan(q.z, q.y) * 3.0)) * length(q.yz);
        return mix(${glsl(0x1f7a22)}, ${glsl(0x35b030)}, smoothstep(0.02, 0.07, vein));
      }`;
    const pattern = `${shared}
    vec3 candyPattern(vec3 p, vec3 base) {
      const vec3 SEEDS[${spots.length}] = vec3[${spots.length}](${list});
      vec3 q = p - ${v3(off)};
      float m = 9.0;
      for (int i = 0; i < ${spots.length}; i++) m = min(m, length(p - SEEDS[i]));
      vec3 c = base * (1.0 - 0.3 * smoothstep(0.26, 0.1, m));
      c = mix(c, ${glsl(0xffe08a)}, smoothstep(0.085, 0.055, m));
      return mix(c, sbLeaf(q), smoothstep(0.015, -0.015, sbEdge(q)));
    }`;
    const inside = `${shared}
    vec3 candyPattern(vec3 p, vec3 base) {
      vec3 q = p - ${v3(off)};
      float leaf = smoothstep(0.015, -0.015, sbEdge(q)) * smoothstep(-0.3, -0.26, sbDepth(q));
      vec3 c = base * (0.72 + 0.28 * smoothstep(-1.1, -0.05, sbDepth(q)));
      return mix(c, sbLeaf(q), leaf);
    }`;
    const leafy = `${shared}
    vec3 candyPattern(vec3 p, vec3 base) {
      return sbLeaf(p - ${v3(off)});
    }`;
    return {
      name: 'Giant Gummy Strawberry',
      layers: [
        { geometry: body, material: mat.gummy({ color: 0xd80f2a, clarity: 0.6, gloss: 0.85, pattern }), cap: mat.gummy({ color: 0xf01c36, clarity: 0.6, gloss: 0.6, opaque: true, pattern: inside }) },
        { geometry: top, material: mat.gummy({ color: 0x35b030, clarity: 0.6, gloss: 0.85, pattern: leafy }), cap: mat.gummy({ color: 0x35b030, clarity: 0.6, gloss: 0.6, opaque: true }) },
      ],
    };
  },
};
