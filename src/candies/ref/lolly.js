// Reference candy: pinwheel hard-candy lollipop lying flat (shatter mode); crisp stripes from a GLSL pattern; the paper stick is an uncuttable attach layer.
import * as THREE from 'three';
import { S, meshSDF } from '../../lib/geo.js';
import { mat } from '../../lib/mat.js';

const COLS = [[0xff2d4a, 0xffffff], [0x2d9bff, 0xffffff], [0xff9a1f, 0xfff3b0]];
const glsl = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

export default {
  id: 'ref-lolly',
  name: 'Pinwheel Lollipops',
  group: 'lolly',
  variants: COLS.length,
  feel: { hardness: 1, bounce: 0.15, sticky: 0, density: 1.5 },
  breaks: { mode: 'shatter', toughness: 0.7, shards: 6, crumbs: { color: 0xffe6ea, amount: 0.6 } },
  taste: { sweet: 0.9 },
  mouth: { bites: 5, sound: 'crack' },
  sound: { land: 'glass', cut: 'crack', pitch: 1.15 },
  build(v) {
    const head = meshSDF(S.move(S.ellipsoid(1.7, 0.6, 1.7), 2.4, 0, 0), { min: [0.5, -0.8, -1.9], max: [4.3, 0.8, 1.9], res: 30 });
    const [a, b] = COLS[v];
    const pattern = `vec3 candyPattern(vec3 p, vec3 base) {
      vec2 q = p.xz - vec2(2.4, 0.0);
      float s = sin(atan(q.y, q.x) * 6.0 + length(q) * 3.2);
      return mix(${glsl(a)}, ${glsl(b)}, smoothstep(-0.08, 0.08, s));
    }`;
    const stick = new THREE.CylinderGeometry(0.16, 0.16, 6.6, 10);
    stick.rotateZ(Math.PI / 2);
    stick.translate(-1.6, 0, 0);
    return {
      layers: [
        { geometry: head, material: mat.hard({ clarity: 0.3, pattern }), cap: mat.hard({ clarity: 0.2, opaque: true, pattern }) },
        { geometry: stick, role: 'attach', anchor: [1.4, 0, 0], material: mat.matte({ color: 0xf4f1e8, roughness: 0.75 }) },
      ],
    };
  },
};
