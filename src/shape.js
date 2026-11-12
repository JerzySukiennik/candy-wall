// Candy Wall: picks a cheap physics shape for a whole candy (ball, capsule, cylinder or convex hull).
import { hullPoints } from './lib/cut.js';
import { measureSet, wholeSet } from './candy.js';

export function wholeShape(prep, RAPIER) {
  if (prep.shape) return prep.shape;
  const set = wholeSet(prep);
  const m = prep.wholeMeasure || (prep.wholeMeasure = measureSet(set));
  const d = [prep.size.x, prep.size.y, prep.size.z];
  const order = [0, 1, 2].sort((a, b) => d[b] - d[a]);
  const [ia, ib, ic] = order;
  const a = d[ia];
  const b = d[ib];
  const c = d[ic];
  const off = [prep.center.x - m.center[0], prep.center.y - m.center[1], prep.center.z - m.center[2]];
  const plain = !prep.layers.some((l) => l.role === 'attach') && prep.def.collider !== 'hull';
  const turn = (axis) => (axis === 0 ? { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 } : axis === 2 ? { x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 } : { x: 0, y: 0, z: 0, w: 1 });
  let kind = 'hull';
  let make;
  const vol = Math.max(0.01, prep.volume);
  const rBall = (a + b + c) / 6;
  const rCap = (b + c) / 4;
  const rCyl = (a + b) / 4;
  const fitBall = vol / ((4 / 3) * Math.PI * rBall ** 3);
  const fitCap = vol / (Math.PI * rCap * rCap * Math.max(0.01, a - 2 * rCap) + (4 / 3) * Math.PI * rCap ** 3);
  const fitCyl = vol / (Math.PI * rCyl * rCyl * c);
  if (plain && a / c < 1.24 && fitBall > 0.7) {
    kind = 'ball';
    const r = (a + b + c) / 6;
    make = () => RAPIER.ColliderDesc.ball(r).setTranslation(off[0], off[1], off[2]);
  } else if (plain && a / b > 1.55 && b / c < 1.5 && fitCap > 0.68) {
    kind = 'capsule';
    const r = (b + c) / 4;
    const hh = Math.max(0.01, a / 2 - r);
    make = () => RAPIER.ColliderDesc.capsule(hh, r).setTranslation(off[0], off[1], off[2]).setRotation(turn(ia));
  } else if (plain && c / b < 0.66 && a / b < 1.3 && fitCyl > 0.62) {
    kind = 'cylinder';
    const r = (a + b) / 4;
    const hh = c / 2;
    const br = Math.min(hh * 0.7, r * 0.3, 0.3);
    make = () => RAPIER.ColliderDesc.roundCylinder(Math.max(0.01, hh - br), Math.max(0.01, r - br), br).setTranslation(off[0], off[1], off[2]).setRotation(turn(ic));
  } else {
    const soups = set.soups.filter(Boolean);
    for (const ai of set.attach) {
      const pa = prep.layers[ai].geometry.attributes.position;
      const step = Math.max(1, Math.floor(pa.count / 24));
      const pos = [];
      for (let i = 0; i < pa.count; i += step) pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
      soups.push({ pos });
    }
    const pts = hullPoints(soups, m.center, 40);
    make = () => RAPIER.ColliderDesc.convexHull(pts) || RAPIER.ColliderDesc.cuboid(Math.max(0.08, d[0] / 2), Math.max(0.08, d[1] / 2), Math.max(0.08, d[2] / 2));
  }
  prep.shape = { kind, make, center: m.center, mean: Math.cbrt(Math.max(0.05, a * b * c)), longest: a, thin: c };
  return prep.shape;
}
