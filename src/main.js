// Candy Wall: game flow (wall, dispenser focus, table), pointer routing, pouring, feeding, sounds and the render loop.
import * as THREE from 'three';
import { IS_TOUCH, PARAMS, TABLE, TEST, WALL } from './config.js';
import { Stage } from './stage.js';
import { Physics } from './physics.js';
import { Tray } from './tray.js';
import { Wall } from './wall.js';
import { Piece, Pieces } from './pieces.js';
import { Fx } from './fx.js';
import { Head } from './head.js';
import { Tools } from './tools.js';
import { audio } from './audio.js';
import { CANDIES, PACKS } from './candies/index.js';
import { buildMeshes, measureSet, prepare, wholeSet } from './candy.js';
import { Tweens, clamp, damp, ease, lerp, rand, rayY, smooth } from './util.js';

const $ = (id) => document.getElementById(id);
const canvas = $('c');
const stage = new Stage(canvas);
const { scene, camera } = stage;
const physics = await Physics.create();
const tweens = new Tweens();
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const portrait = camera.aspect < 0.85;
const L = portrait
  ? { tray: V(0, 0, 21), work: V(0, 0, -4), head: V(0, 0, -37), rig: { t: [0, 18.6, 9.7], w: 36, h: 62, elev: 38 }, sticks: V(15.5, 0.14, -14), knife: V(-15, 0.1, -2) }
  : { tray: V(-27, 0, 9), work: V(8, 0, 9), head: V(8, 0, -34), rig: { t: [-7, 15.1, 1.7], w: 92, h: 55, elev: 33 }, sticks: V(24.5, 0.14, -2), knife: V(30, 0.1, 10) };

const game = {
  stage,
  physics,
  audio,
  tweens,
  view: 'boot',
  bin: null,
  cell: 0,
  panX: 0,
  dirty: true,
  bounds: { x0: -TABLE.w / 2 + 4, x1: TABLE.w / 2 - 4, z0: L.head.z + 4, z1: TABLE.d / 2 - 4 },
  wake() {
    game.dirty = true;
  },
  surfaceAt(x, z) {
    return Math.abs(x) <= TABLE.w / 2 && Math.abs(z) <= TABLE.d / 2 ? 0 : -200;
  },
};

const table = new THREE.Mesh(new THREE.BoxGeometry(TABLE.w, 3, TABLE.d), new THREE.MeshPhysicalMaterial({ color: 0x070709, roughness: 0.3, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.1, specularIntensity: 0.3, envMapIntensity: 0.32 }));
table.position.y = -1.5;
table.receiveShadow = true;
scene.add(table);
physics.fixedBox(0, -1.5, 0, TABLE.w / 2, 1.5, TABLE.d / 2, { friction: 0.6, restitution: 0.15 });

const tray = (game.tray = new Tray(physics, L.tray));
scene.add(tray.group);
const trayTarget = new THREE.Vector3();
const trayOff = new THREE.Vector3();
const cellGlow = new THREE.Mesh(new THREE.PlaneGeometry(7.1, 7.1), new THREE.MeshBasicMaterial({ color: 0x9fc4ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
cellGlow.rotation.x = -Math.PI / 2;
cellGlow.renderOrder = 5;
tray.group.add(cellGlow);

const pieces = (game.pieces = new Pieces(game));
const fx = (game.fx = new Fx(game));
const head = (game.head = new Head(game));
scene.add(head.group);
const tools = (game.tools = new Tools(game));
tools.setRest(L.sticks, L.knife);
const wall = (game.wall = new Wall(game, CANDIES));
scene.add(wall.group);

const ui = (game.ui = {
  caption(text) {
    const el = $('caption');
    const t = text || (game.view === 'focus' && game.bin ? game.bin.def.name : '');
    if (t) el.textContent = t;
    el.classList.toggle('show', !!t);
  },
  setTool(t) {
    $('b-sticks').classList.toggle('sel', t === 'sticks');
    $('b-knife').classList.toggle('sel', t === 'knife');
  },
  sync() {
    const atTable = game.view === 'table';
    document.body.classList.toggle('table', atTable);
    $('b-back').hidden = game.view !== 'focus';
    $('b-view').setAttribute('aria-label', atTable ? 'Back to the wall' : 'Go to the table');
    for (const id of ['b-sticks', 'b-knife', 'b-clear']) $(id).hidden = !atTable;
    ui.setTool(tools.tool);
    ui.caption('');
  },
});

const DROP = 6.2;
const slides = [];

function overviewRig() {
  const r = wall.overviewRig(camera.aspect, game.panX);
  game.panLimit = r.pan;
  game.panX = r.t[0];
  return { t: [r.t[0], r.t[1] - 14, r.t[2] + 8], w: r.w, h: r.h + 28, elev: 9, fov: 28 };
}

function focusRig(bin) {
  const p = camera.aspect < 0.85;
  return { t: [bin.x, bin.y - (p ? 2.5 : 1), WALL.z + 24], w: p ? 34 : 56, h: p ? 60 : 52, elev: 30, fov: 28 };
}

function dockOffset() {
  return V(game.panX - tray.home.x, WALL.counterY - tray.home.y, WALL.z + 18 - tray.home.z);
}

function focusOffset(bin, cell) {
  const c = tray.cells[cell];
  return V(bin.spout.x - c.x, bin.spout.y - DROP - (tray.home.y + tray.floorY + tray.depth), bin.spout.z + 1.2 - c.z);
}

function cellStats() {
  const n = tray.cells.map(() => ({ count: 0, vol: 0 }));
  for (const p of pieces.list) {
    if (p.zone !== 'tray') continue;
    const c = tray.cellAt(p.pos.x, p.pos.z);
    if (!c) continue;
    n[c.index].count++;
    n[c.index].vol += p.size[0] * p.size[1] * p.size[2] * 0.5;
  }
  return n;
}

function cellFull(st, bin) {
  const s = bin.size;
  const v = s ? s.x * s.y * s.z * 0.5 : 4;
  return st.count >= 26 || (st.count > 0 && st.vol + v > 96);
}

function pickCell(bin) {
  const st = cellStats();
  if (!cellFull(st[game.cell], bin) && st[game.cell].count === 0) return game.cell;
  for (let i = 0; i < st.length; i++) if (st[i].count === 0) return i;
  if (!cellFull(st[game.cell], bin)) return game.cell;
  for (let i = 0; i < st.length; i++) if (!cellFull(st[i], bin)) return i;
  return game.cell;
}

function setCell(i, sound = true) {
  if (game.cell !== i && sound) audio.play('tray_set', { vol: 0.35, rate: 1.3 });
  game.cell = i;
  if (game.view === 'focus' && game.bin) trayTarget.copy(focusOffset(game.bin, i));
  game.wake();
}

function setView(v, bin = null) {
  const prev = game.view;
  tools.cancel();
  stopPour();
  game.view = v;
  wall.setFocus(v === 'focus' ? bin : null);
  if (v === 'wall') {
    game.bin = null;
    stage.setRig(overviewRig(), prev === 'boot' ? 0 : 1.1);
    trayTarget.copy(dockOffset());
    headOut();
  } else if (v === 'focus') {
    game.bin = bin;
    game.cell = pickCell(bin);
    stage.setRig(focusRig(bin), 0.85);
    trayTarget.copy(focusOffset(bin, game.cell));
    headOut();
    if (prev !== 'focus') audio.play('whoosh', { vol: 0.25 });
  } else {
    game.bin = null;
    stage.setRig(L.rig, 1.25);
    trayTarget.set(0, 0, 0);
    tweens.after(0.55, () => game.view === 'table' && headIn());
    tweens.after(0.9, () => game.view === 'table' && audio.play('tray_set', { vol: 0.6 }));
    audio.play('whoosh', { vol: 0.3, rate: 0.9 });
  }
  if (prev === 'boot') {
    trayOff.copy(trayTarget);
    tray.setOffset(trayOff);
  }
  ui.sync();
  hint(v);
  game.wake();
}

const hints = { wall: 'Tap a dispenser', focus: 'Hold the dispenser to pour', table: 'Drag a sweet to the head, or pick up the knife' };
const hinted = {};
function hint(v) {
  if (hinted[v] || !hints[v] || TEST) return;
  hinted[v] = true;
  tweens.after(0.9, () => {
    if (game.view !== v) return;
    $('caption').textContent = hints[v];
    $('caption').classList.add('show');
    tweens.after(3.2, () => game.view === v && tools.state === 'idle' && ui.caption(''));
  });
}

let headTween = null;
function headIn() {
  if (!head.loaded || head.present) return;
  head.present = true;
  head.group.visible = true;
  head.wide = 0.8;
  head.wake(3);
  const x0 = L.head.x + 150;
  if (headTween) headTween.dur = 0;
  headTween = tweens.add({
    dur: 1.0,
    ease: ease.out5,
    update: (e) => head.group.position.set(lerp(x0, L.head.x, e), head.baseY, L.head.z),
    done: () => {
      head.nod.v += 1.5;
      head.wide = 0.25;
      head.smileHold = 1.4;
      lastFed = performance.now();
    },
  });
}

function headOut() {
  if (!head.loaded || !head.present) return;
  const x0 = head.group.position.x;
  if (headTween) headTween.dur = 0;
  headTween = tweens.add({
    dur: 0.6,
    ease: ease.in3,
    update: (e) => head.group.position.set(lerp(x0, L.head.x + 150, e), head.baseY, L.head.z),
    done: () => {
      head.present = false;
      head.group.visible = false;
    },
  });
}

let pouring = false;
let pourAcc = 0;
let pourRattle = 0;
function startPour() {
  if (pouring || !game.bin || !game.bin.ready) return;
  pouring = true;
  pourAcc = 0.85;
  game.bin.leverT = 1;
  audio.play('lever', { vol: 0.8 });
  game.wake();
}

function stopPour() {
  if (!pouring) return;
  pouring = false;
  if (game.bin) game.bin.leverT = 0;
  audio.play('lever', { vol: 0.45, rate: 1.25 });
  game.wake();
}

function pourStep(dt) {
  const bin = game.bin;
  if (!pouring || !bin) return;
  const s = bin.size;
  const vol = s.x * s.y * s.z;
  const rate = clamp(24 / Math.pow(vol, 0.62), 1.5, 8.5);
  pourAcc += dt * rate;
  if (pourAcc < 1) return;
  pourAcc -= 1;
  if (pieces.list.length >= 210) {
    stopPour();
    return;
  }
  const st = cellStats();
  for (const sl of slides) {
    st[sl.cell].count++;
    st[sl.cell].vol += sl.prep.size.x * sl.prep.size.y * sl.prep.size.z * 0.5;
  }
  if (cellFull(st[game.cell], bin)) {
    const next = pickCell(bin);
    if (next === game.cell || cellFull(st[next], bin)) {
      stopPour();
      return;
    }
    setCell(next);
    pourAcc = -0.4;
    return;
  }
  slideOut(bin, wall.takeOne(bin));
  pourRattle -= 1;
  if (pourRattle <= 0) {
    pourRattle = 3;
    const land = bin.def.sound && bin.def.sound.land;
    if (land === 'hard' || land === 'glass' || land === 'tiny' || land === 'choc') audio.play('pour_candy', { vol: 0.35, rate: rand(0.9, 1.2), gap: 0.2 });
  }
}

function slideOut(bin, variant) {
  const prep = prepare(bin.def, Math.max(0, variant));
  const set = wholeSet(prep);
  const group = buildMeshes(set, (prep.wholeMeasure || (prep.wholeMeasure = measureSet(set))).center, { shadow: false });
  group.matrixAutoUpdate = false;
  tray.group.add(group);
  const long = Math.max(prep.size.x, prep.size.z) > 6.4;
  const q = new THREE.Quaternion();
  if (long) q.setFromEuler(new THREE.Euler(0.42, prep.size.x >= prep.size.z ? Math.PI / 2 : 0, 0, 'YXZ'));
  else q.setFromEuler(new THREE.Euler(rand(6.28), rand(6.28), rand(6.28)));
  const lift = Math.min(prep.size.x, prep.size.y, prep.size.z) * 0.5 + 0.2;
  const jx = long ? 0 : rand(-1, 1) * Math.max(0, 3.2 - Math.max(prep.size.x, prep.size.z) * 0.5);
  const from = V(bin.chuteTop.x + jx, bin.chuteTop.y + lift, bin.chuteTop.z + 1.2);
  const to = V(bin.spout.x + jx * 0.6, bin.spout.y + lift + 0.4, bin.spout.z - (long ? Math.max(prep.size.x, prep.size.z) * 0.32 : 0.6));
  slides.push({ prep, set, group, q, from, to, t: 0, dur: 0.3, spin: V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(long ? 0 : 7), cell: game.cell });
}

const _sq = new THREE.Quaternion();
function stepSlides(dt) {
  for (let i = slides.length - 1; i >= 0; i--) {
    const s = slides[i];
    s.t += dt;
    const k = Math.min(1, s.t / s.dur);
    const e = k * k;
    const pos = _t.copy(s.from).lerp(s.to, e).sub(trayOff);
    if (s.spin.lengthSq() > 0) {
      _sq.setFromAxisAngle(_m.copy(s.spin).normalize(), s.spin.length() * dt);
      s.q.premultiply(_sq);
    }
    s.group.matrix.compose(pos, s.q, V(1, 1, 1));
    s.group.matrixWorldNeedsUpdate = true;
    if (k >= 1) {
      tray.group.remove(s.group);
      slides.splice(i, 1);
      const dir = _m.copy(s.to).sub(s.from).multiplyScalar((2 / s.dur) * 0.2);
      pieces.spawn(s.set, { pos: pos.clone(), quat: s.q, vel: V(dir.x, dir.y - 12, dir.z), spin: { x: s.spin.x * 0.6, y: s.spin.y * 0.6, z: s.spin.z * 0.6 }, zone: 'tray' });
    }
  }
  return slides.length > 0;
}

function spawnIntoCell(def, variant, cellIndex, drop = 8) {
  const prep = prepare(def, Math.max(0, variant));
  const c = tray.cells[cellIndex];
  const room = Math.max(0, c.half - Math.max(prep.size.x, prep.size.z) * 0.5);
  const j = Math.min(room, 1.6);
  const long = Math.max(prep.size.x, prep.size.z) > c.half * 2;
  const q = new THREE.Quaternion();
  if (long) q.setFromEuler(new THREE.Euler(rand(-0.25, 0.25), rand(-0.5, 0.5) + (Math.random() < 0.5 ? 0 : Math.PI), rand(0.5, 0.9) * (Math.random() < 0.5 ? -1 : 1)));
  else q.setFromEuler(new THREE.Euler(rand(6.28), rand(6.28), rand(6.28)));
  const pos = V(c.x + rand(-j, j), tray.home.y + tray.floorY + tray.depth + drop, c.z + rand(-j, j));
  return pieces.spawnWhole(prep, { pos, quat: q, vel: V(rand(-4, 4), -30, rand(-4, 4)), spin: { x: rand(-5, 5), y: rand(-5, 5), z: rand(-5, 5) }, zone: 'tray' });
}

const CUT = { squeak: 'cut_squeak', squish: 'cut_squish', foam: 'cut_foam', snap: 'cut_crunch', crack: 'cut_crunch', crunch: 'cut_crunch', crumble: 'cut_crunch' };
const BRK = { snap: 'snap', crack: 'crack', crunch: 'cut_crunch', crumble: 'crumble', squeak: 'snap', squish: 'squish', foam: 'cut_foam' };

game.sound = (p, kind, vol = 1) => {
  const s = p.prep.sound;
  const soft = p.soft;
  const pitch = s.pitch * lerp(1.12, 0.94, clamp(p.frac, 0, 1));
  switch (kind) {
    case 'squish':
      if (soft > 0.18) audio.play('squish', { vol: vol * (0.35 + soft * 0.8), rate: pitch * lerp(1.35, 0.85, soft) });
      else audio.play('land_' + s.land, { vol: vol * 0.45, rate: pitch * 1.2 });
      break;
    case 'grab':
      audio.play('chopsticks', { vol: 0.28, rate: 1.15 });
      if (soft > 0.3) audio.play('squish', { vol: 0.3 * vol, rate: pitch * 1.25 });
      break;
    case 'saw':
      audio.play(CUT[s.cut] || 'cut_squeak', { vol, rate: pitch, gap: 0.1 });
      break;
    case 'cut':
      if (soft > 0.3) audio.play('cut_squish', { vol: 0.45, rate: pitch });
      break;
    case 'hit':
      audio.play('knife_board', { vol: 0.6, rate: 1.25 });
      audio.play(BRK[s.cut] || 'crack', { vol: 0.3, rate: pitch * 1.35 });
      break;
    case 'break':
      audio.play(BRK[s.cut] || 'snap', { vol: 1, rate: pitch });
      if (p.prep.breaks.mode === 'shatter') audio.play('shatter', { vol: 0.75, rate: pitch, delay: 0.02 });
      if (p.prep.breaks.mode === 'crumble') audio.play('crumble', { vol: 0.8, rate: pitch, delay: 0.03 });
      break;
    case 'scrape':
      audio.play('cut_crunch', { vol: 0.28, rate: pitch * 1.45 });
      break;
    case 'burst':
      audio.play('squirt', { vol: 1, rate: pitch });
      audio.play('squish', { vol: 0.8, rate: pitch * 0.9 });
      break;
  }
};

game.onImpact = (p, strength) => {
  const s = p.prep.sound;
  const pan = clamp((p.pos.x + (p.zone === 'tray' ? trayOff.x : 0) - stage.cur.t.x) / 40, -0.7, 0.7);
  audio.play('land_' + s.land, { vol: strength * clamp(0.35 + p.mass / 14, 0.3, 1.15), rate: s.pitch * lerp(1.12, 0.9, strength) * lerp(1.2, 1, clamp(p.frac, 0, 1)), gap: 0.045, pan });
};

game.onDrip = () => audio.play('drip', { vol: 0.35, rate: rand(0.9, 1.3), gap: 0.11 });

game.onBroken = (p, out, info = {}) => {
  const liquid = p.prep.layers.find((l) => l.fill && (l.fill.type === 'liquid' || l.fill.type === 'gel'));
  if (liquid && info.first && out.some((q) => q.liquids.length)) {
    const visc = liquid.fill.viscosity ?? 0.4;
    const pt = info.point || p.pos;
    if (visc < 0.5) {
      const n = info.n || V(1, 0, 0);
      const side = V(0, 0, 0).crossVectors(n, V(0, 1, 0)).normalize();
      fx.squirt(pt, side, liquid.fill, Math.round(lerp(22, 6, visc * 2)), 50);
      fx.squirt(pt, side.multiplyScalar(-1), liquid.fill, Math.round(lerp(22, 6, visc * 2)), 50);
      audio.play('squirt', { vol: 0.8, rate: rand(0.95, 1.2) });
    } else audio.play('goo', { vol: 0.6, rate: rand(0.9, 1.1) });
    if (head.present && !head.busy) {
      head.emote('wow', 0.7);
      head.lookTarget.copy(pt);
      lookHold = 1.4;
    }
  }
};

const _m = new THREE.Vector3();
const _t = new THREE.Vector3();
let lookHold = 0;
let lastFed = performance.now();

game.canEat = (p) => {
  if (!head.present || head.busy || !head.loaded || !(p.volume > 0)) return false;
  head.mouth(_m);
  return _t.copy(p.pos).sub(_m).length() < 7.8 + Math.min(4, p.radius);
};

game.feedTrack = (p) => {
  if (!head.present) return;
  head.mouth(_m);
  const d = Math.max(0, p.pos.distanceTo(_m) - p.radius * 0.5);
  head.lookTarget.copy(p.pos).lerp(camera.position, smooth(18, 5, d) * 0.5);
  head.open = head.busy ? 0 : smooth(20, 7, d);
  head.wide = 0.25 + 0.4 * smooth(26, 8, d);
  head.wake(0.6);
  lookHold = 0.3;
};

game.eat = (p) => {
  head.mouth(_m);
  const mouth = _m.clone();
  let eaten = [p];
  const longest = Math.max(...p.size);
  const prepL = p.prep.layers;
  const sticks = (set) => set.attach.filter((ai) => prepL[ai].stick);
  const big = longest > 4.4 || (sticks(p.set).length > 0 && p.volume > 0);
  if (big && p.volume > 0) {
    const q = p.quat;
    const ez = (Math.abs(V(1, 0, 0).applyQuaternion(q).z) * p.size[0] + Math.abs(V(0, 1, 0).applyQuaternion(q).z) * p.size[1] + Math.abs(V(0, 0, 1).applyQuaternion(q).z) * p.size[2]) / 2;
    const depth = Math.min(2.3, ez);
    const plane = V(p.pos.x, p.pos.y, p.pos.z - ez + depth);
    const out = pieces.cut(p, V(0, 0, 1), plane, 0);
    if (out) {
      eaten = out.filter((o) => o.pos.z < plane.z && sticks(o.set).length === 0);
      const rest = out.filter((o) => !eaten.includes(o));
      if (!eaten.length) {
        const cand = out.filter((o) => o.volume > 0).sort((a, b) => a.pos.z - b.pos.z)[0];
        if (cand) eaten = [cand];
      }
      for (const r of rest) {
        if (eaten.includes(r)) continue;
        r.body.setLinvel({ x: rand(-6, 6), y: 10, z: 34 }, true);
        game.onBroken(p, [r], { first: p.set.whole, point: plane, n: V(1, 0, 0) });
      }
    }
  }
  const prep = p.prep;
  let frac = 0;
  let liquid = false;
  for (const e of eaten) {
    frac += e.frac;
    if (e.liquidLeft > 0.05 || (e.set.whole && prep.layers.some((l) => l.fill && (l.fill.type === 'liquid' || l.fill.type === 'gel')))) liquid = true;
    if (sticks(e.set).length) {
      const stick = { prep, soups: prep.layers.map(() => null), attach: sticks(e.set), whole: false };
      const c0 = V(...e.center);
      const m = { center: [0, 0, 0] };
      const bb = new THREE.Box3();
      for (const ai of stick.attach) bb.union(prep.layers[ai].geometry.boundingBox);
      bb.getCenter(_t);
      m.center = _t.toArray();
      const pos = V(...m.center).sub(c0).applyQuaternion(e.quat).add(e.pos);
      pieces.spawn(stick, { pos, quat: e.quat, vel: V(0, 6, 30), zone: 'table' });
    }
    const g = e.group;
    const from = e.pos.clone();
    const sc0 = 1;
    pieces.physics.unregister(e.collider);
    pieces.physics.world.removeRigidBody(e.body);
    pieces.list.splice(pieces.list.indexOf(e), 1);
    e.dead = true;
    scene.add(g);
    const inside = mouth.clone().add(V(0, -0.3, -2.2));
    tweens.add({
      dur: 0.17,
      ease: ease.in2,
      update: (k) => {
        g.matrix.compose(_t.copy(from).lerp(inside, k), e.quat, V(1, 1, 1).multiplyScalar(lerp(sc0, 0.55, k)));
        g.matrixWorldNeedsUpdate = true;
      },
      done: () => {
        scene.remove(g);
        g.traverse((o) => o.isMesh && o.userData.own && o.geometry.dispose());
      },
    });
  }
  const k = lerp(0.62, 1, clamp(frac * 1.6, 0, 1));
  const taste = {};
  for (const t in prep.taste) taste[t] = clamp(prep.taste[t] * k, 0, 1);
  const feel = prep.feel;
  const meal = { prep, taste, liquid, hard: feel.hardness >= 0.93 ? 1 : 0, sticky: feel.sticky, voiced: false, bites: 0 };
  head.busy = true;
  head.jawOverride = 0.78;
  head.open = 0;
  head.wake(3);
  lastFed = performance.now();
  tweens.after(0.17, () => {
    head.jawOverride = 0.04;
    biteSound(meal, 1.1);
    stage.shake(meal.hard ? 0.035 : 0.012);
    reactFast(meal);
  });
  tweens.after(0.3, () => {
    head.jawOverride = -1;
    const bites = Math.max(1, Math.round((prep.mouth.bites || 3) * lerp(0.6, 1, clamp(frac * 1.6, 0, 1))));
    head.startChew({ bites, period: lerp(0.33, 0.5, feel.sticky) * (meal.hard ? 1.1 : 1), sticky: feel.sticky, hard: meal.hard, done: () => reactAfter(meal) });
    head.meal = meal;
  });
  game.wake();
};

function biteSound(meal, vol = 1) {
  const s = meal.prep.mouth.sound;
  const pitch = meal.prep.sound.pitch;
  if (s === 'fizz') {
    audio.play('bite_crunch', { vol: vol * 0.7, rate: pitch * 1.2 });
    audio.play('fizz', { vol: 0.9, rate: rand(0.9, 1.2), gap: 0.25 });
  } else audio.play('bite_' + s, { vol, rate: pitch * rand(0.95, 1.05), gap: 0.08 });
}

function say(meal, key, delay = 0, chance = 1) {
  if (meal.voiced || Math.random() > chance) return;
  meal.voiced = true;
  tweens.after(delay, () => {
    const d = audio.voice(key);
    if (d) head.wake(d + 1);
  });
}

function reactFast(meal) {
  const t = meal.taste;
  const hot = t.spicy >= 0.4;
  if (t.sour >= 0.4) {
    head.emote('sour', t.sour, 0.12);
    if (!hot && t.sour >= 0.55) say(meal, 'sour', 0.45);
  }
  if (t.bitter >= 0.45) {
    head.emote('bitter', t.bitter, 0.3);
    if (!hot) say(meal, 'bitter', 0.7);
  }
  if (t.fizz >= 0.4) {
    head.emote('fizz', t.fizz, 0.2);
    for (let i = 0; i < 5; i++) tweens.after(0.3 + i * 0.5, () => audio.play('fizz', { vol: 0.8 * t.fizz, rate: rand(0.9, 1.25), gap: 0.2 }));
    if (!hot) say(meal, 'fizz', 0.8);
  }
  if (t.salty >= 0.5 && t.spicy < 0.4) {
    head.emote('salty', t.salty, 0.5);
    say(meal, 'salty', 0.9, 0.5);
  }
  if (meal.liquid) {
    head.emote('wow', 0.8, 0.1);
    audio.play('squirt', { vol: 0.5, rate: 1.2 });
    if (!hot) say(meal, 'liquid', 0.5, 0.7);
  }
  if (meal.hard && !hot) say(meal, 'hard', 0.6, 0.35);
}

function reactAfter(meal) {
  const t = meal.taste;
  audio.play('gulp', { vol: 0.8 });
  lastFed = performance.now();
  if (t.spicy >= 0.3) {
    head.emote('spicy', t.spicy, 0.35);
    meal.voiced = false;
    say(meal, t.spicy >= 0.75 ? 'spicy_max' : 'spicy', 0.9);
    if (t.spicy >= 0.7) tweens.after(1.1, () => audio.play('sizzle', { vol: 0.5 }));
    for (let i = 0; i < Math.round(2 + t.spicy * 4); i++) tweens.after(1.6 + i * 0.75, () => audio.play('pant', { vol: 0.55 * t.spicy, rate: rand(0.95, 1.1), gap: 0.3 }));
    return;
  }
  if (t.mint >= 0.5) {
    head.emote('mint', t.mint, 0.15);
    audio.play('breath_cold', { vol: 0.7, delay: 0.3 });
    say(meal, 'mint', 0.6);
    return;
  }
  if (t.sour < 0.55 && t.bitter < 0.45) {
    head.emote('sweet', Math.max(0.4, t.sweet), 0.1);
    audio.play('lip_smack', { vol: 0.4, delay: 0.25 });
    say(meal, 'sweet', 0.45, 0.45);
  }
}

head.emit = (name, a) => {
  if (name === 'bite' && head.meal) biteSound(head.meal, 0.85);
};

let ptr = null;
function onDown(e) {
  if (ptr) return;
  audio.unlock();
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch (err) {}
  ptr = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, moved: 0, pan0: game.panX, mode: '' };
  game.wake();
  if (game.view === 'table') {
    const other = tools.tool === 'sticks' ? [tools.knife] : tools.sticks;
    stage.ray(e.clientX, e.clientY);
    if (tools.state === 'idle' && stage.raycaster.intersectObjects(other, true).length) {
      ptr.mode = 'swap';
      tools.setTool(tools.tool === 'sticks' ? 'knife' : 'sticks');
      return;
    }
    ptr.mode = 'tool';
    tools.pointerDown(e.clientX, e.clientY);
  } else if (game.view === 'focus') {
    const ray = stage.ray(e.clientX, e.clientY);
    const rim = tray.home.y + tray.floorY + tray.depth + trayOff.y;
    const hit = rayY(ray, rim, _t);
    const c = hit ? tray.cellAt(hit.x - trayOff.x, hit.z - trayOff.z) : null;
    const bin = wall.pick(ray);
    if (c && (!bin || hit.z > WALL.z + 11)) {
      ptr.mode = 'cell';
      ptr.cell = c.index;
    } else if (bin === game.bin) {
      ptr.mode = 'pour';
      startPour();
    } else if (bin) {
      ptr.mode = 'bin';
      ptr.bin = bin;
    } else ptr.mode = 'swipe';
  } else if (game.view === 'wall') ptr.mode = 'pan';
}

function onMove(e) {
  if (!ptr || e.pointerId !== ptr.id) {
    if (game.view === 'table' && !IS_TOUCH) {
      tools.pointerMove(e.clientX, e.clientY);
      game.wake();
    }
    return;
  }
  ptr.x = e.clientX;
  ptr.y = e.clientY;
  ptr.moved = Math.max(ptr.moved, Math.hypot(ptr.x - ptr.x0, ptr.y - ptr.y0));
  game.wake();
  if (ptr.mode === 'tool') tools.pointerMove(e.clientX, e.clientY);
  else if (ptr.mode === 'pan' && game.panLimit > 0) {
    const perPx = stage.cur.h / stage.h;
    game.panX = clamp(ptr.pan0 - (ptr.x - ptr.x0) * perPx, -game.panLimit, game.panLimit);
    stage.cur.t.x = game.panX;
    stage.place();
    trayTarget.copy(dockOffset());
  }
}

function onUp(e) {
  if (!ptr || e.pointerId !== ptr.id) return;
  const p = ptr;
  ptr = null;
  game.wake();
  if (p.mode === 'tool') tools.pointerUp();
  else if (p.mode === 'pour') stopPour();
  else if (p.mode === 'cell' && p.moved < 12) setCell(p.cell);
  else if (p.mode === 'bin' && p.moved < 12) setView('focus', p.bin);
  else if (p.mode === 'pan' && p.moved < 10) {
    const bin = wall.pick(stage.ray(p.x, p.y));
    if (bin && bin.ready) setView('focus', bin);
  }
  if ((p.mode === 'swipe' || p.mode === 'bin' || p.mode === 'cell') && p.moved > 60 && Math.abs(p.x - p.x0) > Math.abs(p.y - p.y0) * 1.5 && game.bin) {
    const dir = p.x < p.x0 ? 1 : -1;
    const col = game.bin.col + dir;
    if (col >= 0 && col < WALL.cols) {
      const nb = wall.bins[game.bin.row * WALL.cols + col];
      if (nb && nb.ready) setView('focus', nb);
    }
  }
}

canvas.addEventListener('pointerdown', onDown);
canvas.addEventListener('pointermove', onMove);
canvas.addEventListener('pointerup', onUp);
canvas.addEventListener('pointercancel', onUp);
canvas.addEventListener('pointerleave', () => {
  tools.hover.on = false;
  game.wake();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener(
  'wheel',
  (e) => {
    if (game.view !== 'wall' || !(game.panLimit > 0)) return;
    game.panX = clamp(game.panX + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.12, -game.panLimit, game.panLimit);
    stage.cur.t.x = game.panX;
    stage.place();
    trayTarget.copy(dockOffset());
    game.wake();
  },
  { passive: true }
);

$('b-view').addEventListener('click', () => {
  audio.unlock();
  setView(game.view === 'table' ? 'wall' : 'table');
});
$('b-back').addEventListener('click', () => setView('wall'));
$('b-sticks').addEventListener('click', () => tools.setTool('sticks'));
$('b-knife').addEventListener('click', () => tools.setTool('knife'));
$('b-clear').addEventListener('click', wipe);
$('b-mute').addEventListener('click', () => {
  audio.unlock();
  audio.setEnabled(!audio.enabled);
  $('b-mute').classList.toggle('muted', !audio.enabled);
});
window.addEventListener('keydown', (e) => {
  if (e.key === '1') tools.setTool('sticks');
  else if (e.key === '2' || e.key === 'k') tools.setTool('knife');
  else if (e.key === ' ') setView(game.view === 'table' ? 'wall' : 'table');
  else if (e.key === 'Escape' && game.view === 'focus') setView('wall');
  else if (game.view === 'focus' && game.bin && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
    const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    const col = clamp(game.bin.col + dc, 0, WALL.cols - 1);
    const row = clamp(game.bin.row + dr, 0, WALL.rows - 1);
    const nb = wall.bins[row * WALL.cols + col];
    if (nb && nb.ready && nb !== game.bin) setView('focus', nb);
  }
});

function wipe() {
  tools.cancel();
  const dirty = pieces.list.some((p) => p.zone === 'table') || fx.puddles.length || fx.crumbList.length;
  pieces.clear(dirty ? 'table' : 'tray');
  fx.clearTable();
  audio.play('whoosh', { vol: 0.4, rate: 1.2 });
  game.wake();
}

window.addEventListener('resize', () => {
  stage.resize();
  if (game.view === 'wall') stage.setRig(overviewRig(), 0);
  else if (game.view === 'focus' && game.bin) stage.setRig(focusRig(game.bin), 0);
  else if (game.view === 'table') stage.setRig(L.rig, 0);
  game.wake();
});

let last = performance.now();
let loadDone = false;
let idle = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  let active = game.dirty;
  game.dirty = false;
  if (tweens.active) {
    tweens.step(dt);
    active = true;
  }
  if (stage.update(dt)) active = true;
  if (wall.update(dt, loadDone ? 4 : 9)) active = true;
  if (!loadDone) {
    $('load').firstElementChild.style.width = (wall.loaded * 100).toFixed(0) + '%';
    if (wall.loaded >= 1) {
      loadDone = true;
      $('load').classList.add('done');
      if (window.T) window.T.ready = true;
    }
  }
  if (trayOff.distanceToSquared(trayTarget) > 1e-5) {
    trayOff.lerp(trayTarget, 1 - Math.exp(-dt * 9));
    if (trayOff.distanceToSquared(trayTarget) < 1e-5) trayOff.copy(trayTarget);
    tray.setOffset(trayOff);
    active = true;
  }
  const glowT = game.view === 'focus' ? 0.2 : 0;
  if (Math.abs(cellGlow.material.opacity - glowT) > 0.004 || game.view === 'focus') {
    cellGlow.material.opacity = damp(cellGlow.material.opacity, glowT, 8, dt);
    const c = tray.cells[game.cell];
    cellGlow.position.set(c.x, tray.home.y + tray.floorY + 0.03, c.z);
    cellGlow.visible = cellGlow.material.opacity > 0.005;
  }
  if (pouring) {
    pourStep(dt);
    active = true;
  }
  if (slides.length && stepSlides(dt)) active = true;
  let awake = tools.state === 'hold';
  if (!awake) for (const p of pieces.list) if (!p.body.isSleeping()) {
    awake = true;
    break;
  }
  if (awake) {
    physics.step(dt, (h) => {
      tools.beforeStep(h);
      pieces.before();
    });
    pieces.after();
    active = true;
  }
  if (pieces.update(dt)) active = true;
  if (fx.update(dt)) active = true;
  if (tools.update(dt)) active = true;
  if (head.present) {
    if (lookHold > 0) lookHold -= dt;
    else if (tools.state !== 'hold') {
      head.lookTarget.copy(camera.position);
      if (head.open !== 0) {
        head.open = 0;
        head.wake(0.5);
      }
      if (!head.busy && head.wide > 0.26) head.wide = damp(head.wide, 0.25, 4, dt);
    }
    head.talk = damp(head.talk, audio.level(), 30, dt);
    if (game.view === 'table' && !head.busy && now - lastFed > 26000 && tools.state === 'idle') {
      lastFed = now + 22000;
      const d = audio.voice('more');
      if (d) head.wake(d + 1);
      head.tilt.v += 0.9;
      head.wake(2);
    }
    if (head.update(dt)) active = true;
  }
  if (active) {
    idle = 0;
    stage.render();
  } else if (idle < 2) {
    idle++;
    stage.render();
  }
}

await head.load(L.head).catch((e) => console.error('[head] load failed', e));
setView(PARAMS.get('view') === 'table' ? 'table' : 'wall');
requestAnimationFrame(frame);

if (TEST) {
  window.T = {
    ready: false,
    game,
    stage,
    pieces,
    wall,
    tray,
    head,
    tools,
    fx,
    PACKS,
    view: setView,
    focus: (i) => setView('focus', wall.bins[i]),
    pour: (n = 6, cell) => {
      if (cell !== undefined) setCell(cell, false);
      for (let i = 0; i < n; i++) spawnIntoCell(game.bin.def, wall.takeOne(game.bin), game.cell, 6 + i * 2.2);
    },
    fill: (ids) => {
      ids.forEach((id, i) => {
        const def = CANDIES.find((d) => d.id === id) || CANDIES[i % CANDIES.length];
        const prep = prepare(def, 0);
        const n = clamp(Math.round(60 / (prep.size.x * prep.size.y * prep.size.z)), 1, 7);
        for (let k = 0; k < n; k++) spawnIntoCell(def, k % (def.variants || 1), i, 3 + k * 2.4);
      });
    },
    drop: (id, v = 0, x = L.work.x, z = L.work.z, y = 5) => {
      const def = CANDIES.find((d) => d.id === id) || CANDIES[0];
      return pieces.spawnWhole(prepare(def, v), { pos: V(x, y, z), zone: 'table' });
    },
    cut: (p, n = [1, 0, 0]) => {
      const out = pieces.cut(p, V(...n).normalize(), p.pos.clone());
      if (out) game.onBroken(p, out, { first: true, n: V(...n), point: p.pos.clone() });
      return out;
    },
    eat: (p) => game.eat(p),
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    ptr: (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, bubbles: true, pointerType: 'mouse', isPrimary: true })),
    screen: (v) => {
      const o = stage.toScreen(v, new THREE.Vector3());
      return [o.x, o.y];
    },
    drag: async (pts, ms = 500, hold = 0) => {
      const T = window.T;
      T.ptr('pointerdown', pts[0][0], pts[0][1]);
      if (hold) await T.wait(hold);
      const steps = Math.max(2, Math.round(ms / 16 / (pts.length - 1)));
      for (let i = 1; i < pts.length; i++)
        for (let k = 1; k <= steps; k++) {
          const a = pts[i - 1];
          const b = pts[i];
          T.ptr('pointermove', a[0] + ((b[0] - a[0]) * k) / steps, a[1] + ((b[1] - a[1]) * k) / steps);
          await T.wait(16);
        }
      T.ptr('pointerup', pts[pts.length - 1][0], pts[pts.length - 1][1]);
    },
    L,
    Piece,
  };
}
