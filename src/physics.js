// Candy Wall: Rapier world wrapper (centimetre units, time-capped stepping that halves the rate under load), static scenery colliders and ray queries.
import RAPIER from '../vendor/rapier/rapier.es.js';

export { RAPIER };

export const STEP = 1 / 120;
export const GROUP = { world: 0x0001ffff, piece: 0x0002ffff, held: 0x00040001, ghost: 0x00080000 };

export class Physics {
  static async create() {
    await RAPIER.init();
    return new Physics();
  }

  constructor() {
    const w = (this.world = new RAPIER.World({ x: 0, y: -981, z: 0 }));
    w.timestep = STEP;
    const ip = w.integrationParameters;
    if ('lengthUnit' in ip) ip.lengthUnit = 20;
    if ('numSolverIterations' in ip) ip.numSolverIterations = 6;
    this.acc = 0;
    this.cost = 0;
    this.coarse = false;
    this.byCollider = new Map();
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  fixedBox(cx, cy, cz, hx, hy, hz, opt = {}) {
    const d = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setTranslation(cx, cy, cz)
      .setFriction(opt.friction ?? 0.7)
      .setRestitution(opt.restitution ?? 0.1)
      .setCollisionGroups(GROUP.world);
    return this.world.createCollider(d);
  }

  step(dt, before) {
    this.acc = Math.min(this.acc + dt, STEP * 5);
    if (this.coarse ? this.cost < 2.2 : this.cost > 4.5) this.coarse = !this.coarse;
    const h = this.coarse ? STEP * 2 : STEP;
    this.world.timestep = h;
    const t0 = performance.now();
    let n = 0;
    while (this.acc >= h) {
      if (before) before(h);
      const a = performance.now();
      this.world.step();
      const now = performance.now();
      this.cost += (now - a - this.cost) * 0.25;
      this.acc -= h;
      n++;
      if (now - t0 > 9) {
        this.acc = 0;
        break;
      }
    }
    return n;
  }

  register(collider, owner) {
    this.byCollider.set(collider.handle, owner);
  }

  unregister(collider) {
    this.byCollider.delete(collider.handle);
  }

  cast(origin, dir, max = 600, pred = null) {
    const r = this.ray;
    r.origin.x = origin.x;
    r.origin.y = origin.y;
    r.origin.z = origin.z;
    r.dir.x = dir.x;
    r.dir.y = dir.y;
    r.dir.z = dir.z;
    const hit = this.world.castRay(r, max, true, undefined, undefined, undefined, undefined, pred ? (c) => pred(this.byCollider.get(c.handle), c) : undefined);
    if (!hit) return null;
    const t = hit.timeOfImpact ?? hit.toi;
    return { t, owner: this.byCollider.get(hit.collider.handle) || null, collider: hit.collider, x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t };
  }
}
