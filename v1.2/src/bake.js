// Candy Wall pile baker: fills a dispenser bin with real physics and saves the settled poses (run through bake.html?ids=a,b,c).
import * as THREE from 'three';
import { RAPIER, Physics, GROUP } from './physics.js';
import { PACKS } from './candies/index.js';
import { prepare } from './candy.js';
import { wholeShape } from './shape.js';
import { BIN, BINBOX } from './config.js';
import { hashStr, rng } from './util.js';

const q = new URLSearchParams(location.search);
const all = [...PACKS.a, ...PACKS.b];
const ids = (q.get('ids') || '').split(',').filter(Boolean);
const log = document.getElementById('log');
const say = (t) => {
  log.textContent += t + '\n';
  console.log('[bake] ' + t);
};
const tick = () => new Promise((r) => setTimeout(r, 0));
await RAPIER.init();

async function bake(def) {
  const physics = new Physics();
  const world = physics.world;
  const { w: W, d: D, fill } = BINBOX;
  const H = BIN.h;
  const nv = def.variants || 1;
  const preps = [];
  for (let v = 0; v < nv; v++) preps.push(prepare(def, v));
  const shape = wholeShape(preps[0], RAPIER);
  const s = shape.mean;
  const wall = (cx, cy, cz, hx, hy, hz) => world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz).setFriction(0.3).setRestitution(0.05));
  const slab = (z0, y0, z1, y1, out) => {
    const dz = z1 - z0;
    const dy = y1 - y0;
    const len = Math.hypot(dz, dy);
    const th = Math.atan2(-dy, dz);
    const nz = (dy / len) * out;
    const ny = (-dz / len) * out;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), th);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(W / 2 + 2, 0.5, len / 2 + 0.5)
        .setTranslation(0, (y0 + y1) / 2 + ny * 0.5, (z0 + z1) / 2 + nz * 0.5)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setFriction(0.3)
        .setRestitution(0.05)
    );
  };
  const zF = D / 2 + 0.1;
  const zN = BIN.noseZ - 0.3 - D / 2;
  const yN = BIN.noseY - 0.25;
  const zC = BIN.hingeZ - 0.3 - D / 2;
  wall(0, -1, 0, W / 2 + 2, 1, D / 2 + 6);
  wall(-W / 2 - 1, H, 0, 1, H * 2, D / 2 + 6);
  wall(W / 2 + 1, H, 0, 1, H * 2, D / 2 + 6);
  wall(0, H, -D / 2 - 1, W / 2 + 2, H * 2, 1);
  slab(zF, 0, zN, yN, 1);
  slab(zC, H - 0.25, zN, yN, -1);
  const front = Math.min(D, Math.max(3.4, 2.5 * s + 0.6));
  const top = Math.min(fill, Math.max(3.0, 2.3 * s + 0.6));
  let block = null;
  if (D - front > 1.4 && fill - top > 1.5) {
    block = { z1: D / 2 - front, y1: fill - top };
    wall(0, block.y1 / 2, (-D / 2 + block.z1) / 2, W / 2, block.y1 / 2, (block.z1 + D / 2) / 2);
  }
  const r = rng(hashStr(def.id) + 17);
  const bodies = [];
  const feel = preps[0].feel;
  const spawn = (y) => {
    const v = Math.floor(r() * nv) % nv;
    const sh = wholeShape(preps[v], RAPIER);
    const mx = Math.max(0, W / 2 - sh.longest * 0.5 - 0.1);
    const mz = Math.max(0, D / 2 - Math.min(sh.longest, D - 0.4) * 0.5 - 0.6);
    const e = new THREE.Euler(r() * 6.283, r() * 6.283, r() * 6.283);
    if (sh.longest > D * 0.75) e.set((r() - 0.5) * 0.3, (r() - 0.5) * 0.5 + (r() < 0.5 ? 0 : Math.PI), (r() - 0.5) * 0.3);
    const qt = new THREE.Quaternion().setFromEuler(e);
    if (sh.longest > D * 0.75 && preps[v].size.z > preps[v].size.x) qt.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
    const bd = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation((r() - 0.5) * 2 * mx, y, (r() - 0.5) * 2 * mz)
      .setRotation(qt)
      .setLinearDamping(0.6)
      .setAngularDamping(1.2)
      .setCcdEnabled(true);
    const body = world.createRigidBody(bd);
    world.createCollider(sh.make().setMass(Math.max(0.2, preps[v].mass)).setFriction(0.45 + feel.sticky * 0.5).setRestitution(0.05).setCollisionGroups(GROUP.piece), body);
    bodies.push({ body, v });
  };
  const topOf = () => {
    const ys = bodies.map((b) => b.body.translation().y).sort((a, b) => a - b);
    return ys.length ? ys[Math.floor(ys.length * 0.92)] + s * 0.5 : 0;
  };
  const per = Math.max(2, Math.min(40, Math.round(((W * D) / (shape.longest * shape.longest)) * 0.55)));
  const limit = 700;
  let guard = 0;
  while (bodies.length < limit && guard++ < 400) {
    const t = topOf();
    if (t >= fill + s * 0.4) break;
    for (let i = 0; i < per && bodies.length < limit; i++) spawn(Math.max(t, 0) + shape.longest * (0.9 + Math.floor(i / Math.max(1, per / 3)) * 1.25) + 0.5);
    for (let k = 0; k < 70; k++) world.step();
    if (guard % 4 === 0) await tick();
  }
  for (let k = 0; k < 420; k++) {
    world.step();
    if (k % 60 === 0) await tick();
  }
  const kept = bodies.filter((b) => {
    const t = b.body.translation();
    return t.y < fill + s * 0.4 && t.y > -0.5 && Math.abs(t.x) < W / 2 + 0.2 && t.z > -D / 2 - 0.2 && t.z < zN + 0.5;
  });
  const pos = kept.map((b) => b.body.translation());
  const rad = s * 0.5;
  const dirs = [];
  for (let i = 0; i < 26; i++) {
    const y = 1 - (i / 25) * 1.25;
    const rr = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996;
    const d = new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    if (d.z < -0.35) d.z = -d.z;
    dirs.push(d.normalize());
  }
  const ao = pos.map((p, i) => {
    let open = 0;
    for (const d of dirs) {
      let hit = false;
      for (let j = 0; j < pos.length && !hit; j++) {
        if (j === i) continue;
        const dx = pos[j].x - p.x;
        const dy = pos[j].y - p.y;
        const dz = pos[j].z - p.z;
        const along = dx * d.x + dy * d.y + dz * d.z;
        if (along < rad * 0.5 || along > rad * 7) continue;
        const px = dx - d.x * along;
        const py = dy - d.y * along;
        const pz = dz - d.z * along;
        if (px * px + py * py + pz * pz < rad * rad * 0.8) hit = true;
      }
      if (!hit) open++;
    }
    return open / dirs.length;
  });
  const out = { id: def.id, n: kept.length, box: [W, D, fill], block, p: [], q: [], v: [], ao: [] };
  const order = kept.map((_, i) => i).sort((a, b) => pos[a].y - pos[b].y);
  for (const i of order) {
    const t = pos[i];
    const rot = kept[i].body.rotation();
    out.p.push(Math.round(t.x * 100), Math.round(t.y * 100), Math.round(t.z * 100));
    out.q.push(Math.round(rot.x * 10000), Math.round(rot.y * 10000), Math.round(rot.z * 10000), Math.round(rot.w * 10000));
    out.v.push(kept[i].v);
    out.ao.push(Math.round(Math.min(1, 0.22 + 0.78 * Math.pow(ao[i], 0.8)) * 255));
  }
  await fetch('/save/piles/' + def.id + '.json', { method: 'POST', body: JSON.stringify(out) });
  world.free();
  return `${def.id}: ${kept.length} pieces (${shape.kind}, mean ${s.toFixed(2)} cm${block ? ', shell' : ''})`;
}

const done = [];
for (const id of ids) {
  const def = all.find((d) => d.id === id);
  if (!def) {
    say('missing ' + id);
    continue;
  }
  try {
    const t0 = performance.now();
    const line = await bake(def);
    say(line + ' in ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s');
    done.push(id);
  } catch (e) {
    say('FAILED ' + id + ': ' + e.message);
  }
}
say('done ' + done.length + '/' + ids.length);
window.T = { ready: true, done };
