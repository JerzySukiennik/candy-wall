// Sandwich cookies: two dark cocoa biscuits embossed with a generic rosette (procedural normal map) around a white cream disc, three bodies.
import { bake } from '../../lib/geo.js';
import { canvasTexture } from '../../lib/mat.js';
import { M, PORES, TAU, grid, spin, sstep } from './_shared.js';

const R = 2.2;
const SPAN = R * 2 * 1.02;
const TOP = 0.67;
const BOT = 0.17;
const PROFILE = [[0, TOP], [0.75, TOP], [1.45, TOP], [1.95, TOP], [2.1, TOP], [2.17, TOP - 0.03], [2.2, TOP - 0.1], [2.2, BOT + 0.08], [2.15, BOT], [1.2, BOT], [0, BOT]];
let TEX = null;

const band = (r, a, b) => sstep(a - 0.012, a + 0.012, r) * (1 - sstep(b - 0.012, b + 0.012, r));

function height(u, v) {
  const x = (u - 0.5) * 2.04;
  const z = (v - 0.5) * 2.04;
  const r = Math.hypot(x, z);
  if (r > 1.01) return 0;
  const a = Math.atan2(z, x);
  let e = band(r, 0.9, 0.975);
  e = Math.max(e, band(r, 0.73, 0.87) * sstep(-0.15, 0.3, Math.cos(a * 36)));
  e = Math.max(e, band(r, 0.655, 0.69));
  const a12 = a - Math.round(a / (TAU / 12)) * (TAU / 12);
  e = Math.max(e, 1 - sstep(0.045, 0.07, Math.hypot(r * Math.cos(a12) - 0.52, r * Math.sin(a12))));
  const a6 = a - Math.round(a / (TAU / 6)) * (TAU / 6);
  e = Math.max(e, 1 - sstep(0.75, 1, Math.hypot((r * Math.cos(a6) - 0.24) / 0.13, (r * Math.sin(a6)) / 0.075)));
  return Math.max(e, 1 - sstep(0.05, 0.075, r));
}

function textures() {
  if (TEX) return TEX;
  const N = 256;
  const h = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) h[j * N + i] = height((i + 0.5) / N, 1 - (j + 0.5) / N);
  const at = (i, j) => h[Math.min(N - 1, Math.max(0, j)) * N + Math.min(N - 1, Math.max(0, i))];
  const fill = (fn) => (ctx, size) => {
    const img = ctx.createImageData(size, size);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const c = fn(i, j);
        const o = (j * N + i) * 4;
        img.data[o] = c[0];
        img.data[o + 1] = c[1];
        img.data[o + 2] = c[2];
        img.data[o + 3] = 255;
      }
    ctx.putImageData(img, 0, 0);
  };
  const map = canvasTexture(
    N,
    fill((i, j) => {
      const g = 255 * (0.7 + 0.3 * at(i, j));
      return [g, g, g];
    }),
    { repeat: false }
  );
  const normalMap = canvasTexture(
    N,
    fill((i, j) => {
      const dx = (at(i + 1, j) - at(i - 1, j)) * 2.1;
      const dy = (at(i, j - 1) - at(i, j + 1)) * 2.1;
      const l = Math.hypot(dx, dy, 1);
      return [(-dx / l) * 127.5 + 127.5, (-dy / l) * 127.5 + 127.5, (1 / l) * 127.5 + 127.5];
    }),
    { data: true, repeat: false }
  );
  TEX = { map, normalMap };
  return TEX;
}

function biscuit() {
  const rows = PROFILE.map((p, i) => ({ u: i, crease: i === 8, keep: true }));
  return grid(
    rows,
    60,
    (u, v) => {
      const p = PROFILE[u];
      const a = v * TAU;
      const r = p[0] > 2.12 ? p[0] * (1 + 0.016 * Math.cos(a * 20)) : p[0];
      return [r * Math.cos(a), p[1], r * Math.sin(a)];
    },
    { mult: 20, minSegs: 40, uv: (p, u, side) => (u > 8 || (u === 8 && side === 1) ? [0.004, 0.004] : [0.5 + p[0] / SPAN, 0.5 + p[2] / SPAN]) }
  );
}

export default {
  id: 'sandwich-cookie',
  name: 'Sandwich Cookies',
  group: 'crunchy',
  variants: 1,
  feel: { hardness: 0.9, bounce: 0.05, sticky: 0.05, density: 0.9 },
  breaks: { mode: 'crumble', toughness: 0.35, shards: 4, crumbs: { color: 0x2e1c14, amount: 0.8 } },
  taste: { sweet: 0.8, bitter: 0.2 },
  mouth: { bites: 4, sound: 'crunch' },
  sound: { land: 'hard', cut: 'crumble', pitch: 1.0 },
  build() {
    const t = textures();
    const upper = biscuit();
    const lower = bake(biscuit(), { rotate: [Math.PI, 0, 0] });
    const cream = spin([[0, -0.19], [1.5, -0.19], [1.86, -0.19], [1.98, -0.1], [2.01, 0], [1.98, 0.1], [1.86, 0.19], [1.5, 0.19], [0, 0.19]], 40);
    const dark = () => M.crisp({ color: 0x3f271b, map: t.map, normalMap: t.normalMap, normalScale: 1 });
    const crumb = () => M.crisp({ color: 0x36211a, pattern: PORES });
    return {
      layers: [
        { geometry: upper, material: dark(), cap: crumb() },
        { geometry: cream, material: M.cream({ color: 0xf8f2e4 }), cap: M.cream({ color: 0xfffaf0 }) },
        { geometry: lower, material: dark(), cap: crumb() },
      ],
    };
  },
};
