// Candy Wall bench: inspect candies under the game lighting, validate geometry and preview cuts.
// URL: bench.html?pack=a|b|ref|all [&id=<candy id>] [&v=<variant>] [&cut=<cm>|groove] [&axis=x|y|z] [&gap=<cm>] [&yaw=<deg>] [&elev=<deg>] [&zoom=<x>] [&pile=<n>] [&shatter=<n>]
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Stage } from './stage.js';
import { PACKS } from './candies/index.js';
import { buildMeshes, measureSet, prepare, report, setParts, splitSet, wholeSet } from './candy.js';
import { rng } from './util.js';

const q = new URLSearchParams(location.search);
const packName = q.get('pack') || 'all';
const list = packName === 'all' ? [...PACKS.a, ...PACKS.b, ...PACKS.ref] : PACKS[packName] || [];
const stage = new Stage(document.getElementById('c'));
const { scene, camera, renderer } = stage;
const info = document.getElementById('info');
const labels = document.getElementById('labels');

const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: 0.4, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.addEventListener('change', () => (dirty = true));
let dirty = true;
const tags = [];

function place(group, x, z, lift) {
  const b = new THREE.Box3().setFromObject(group);
  group.position.set(x, lift - b.min.y, z);
}

function addLabel(text, pos, bad) {
  const el = document.createElement('div');
  el.textContent = text;
  if (bad) el.className = 'bad';
  labels.appendChild(el);
  tags.push({ el, pos });
}

function cutOnce(set, n, d, gap) {
  const parts = splitSet(set, n, d);
  if (!parts) return [{ set, shift: 0 }];
  const out = [];
  parts.forEach((side, si) => {
    for (const p of setParts(side)) out.push({ set: p, shift: (si === 0 ? 1 : -1) * gap * 0.5 });
  });
  return out;
}

function showSingle(def) {
  const v = +(q.get('v') || 0);
  const prep = prepare(def, v);
  const rep = report(def);
  const whole = wholeSet(prep);
  const axis = q.get('axis') || 'x';
  const n = new THREE.Vector3(axis === 'x' ? 1 : 0, axis === 'y' ? 1 : 0, axis === 'z' ? 1 : 0);
  const gap = +(q.get('gap') || 1.2);
  const spread = prep.size.x + 2.5;
  const g0 = buildMeshes(whole);
  place(g0, q.has('cut') || q.has('shatter') ? -spread : 0, 0, 0);
  scene.add(g0);
  let lines = [`${def.id}  v${v}/${def.variants || 1}  "${prep.name}"`, `size ${rep.size.join(' x ')} cm   volume ${rep.volume} cm3   mass ${rep.mass} g   tris ${rep.tris}`];
  for (const l of rep.layers) lines.push(`  layer ${l.role}: ${l.tris} tris, ${l.watertight ? 'watertight' : 'NOT WATERTIGHT (open ' + l.open + ', nonManifold ' + l.nonManifold + ')'}`);
  if (rep.notes.length) lines.push('NOTES: ' + rep.notes.join('; '));
  if (q.has('cut')) {
    let d = 0;
    let nn = n;
    if (q.get('cut') === 'groove' && prep.breaks.grooves && prep.breaks.grooves.length) {
      const gr = prep.breaks.grooves[+(q.get('g') || 0) % prep.breaks.grooves.length];
      nn = new THREE.Vector3(...gr.n).normalize();
      d = gr.d;
    } else d = +(q.get('cut') || 0);
    const parts = cutOnce(whole, nn, d, gap);
    const holder = new THREE.Group();
    for (const p of parts) {
      const m = buildMeshes(p.set);
      m.position.addScaledVector(nn, p.shift);
      holder.add(m);
    }
    place(holder, spread * 0.4, 0, 0);
    scene.add(holder);
    lines.push(`cut ${q.get('cut')} along ${axis}: ${parts.length} parts`);
  }
  if (q.has('shatter')) {
    const r = rng(7);
    let sets = [whole];
    const k = +(q.get('shatter') || 5);
    for (let i = 0; i < k; i++) {
      const nn = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize();
      const big = sets.reduce((a, b) => (measureSet(a).volume > measureSet(b).volume ? a : b));
      const m = measureSet(big);
      const d = nn.x * m.center[0] + nn.y * m.center[1] + nn.z * m.center[2];
      const parts = splitSet(big, nn, d);
      if (!parts) continue;
      sets = sets.filter((s) => s !== big);
      for (const side of parts) for (const p of setParts(side)) sets.push(p);
    }
    const holder = new THREE.Group();
    for (const s of sets) {
      const m = measureSet(s);
      const mesh = buildMeshes(s);
      mesh.position.set(m.center[0] * 0.45, m.center[1] * 0.45, m.center[2] * 0.45);
      holder.add(mesh);
    }
    place(holder, spread * 0.4, 0, 0);
    scene.add(holder);
    lines.push(`shatter: ${sets.length} shards`);
  }
  if (q.has('pile')) {
    const r = rng(3);
    const cnt = +(q.get('pile') || 10);
    for (let i = 0; i < cnt; i++) {
      const pv = prepare(def, i % (def.variants || 1));
      const m = buildMeshes(wholeSet(pv));
      m.rotation.set(r() * 6.28, r() * 6.28, r() * 6.28);
      const a = r() * 6.28;
      const rad = Math.sqrt(r()) * prep.radius * 2.2;
      place(m, Math.cos(a) * rad, -prep.size.z - prep.radius * 3 + Math.sin(a) * rad, r() * prep.radius);
      scene.add(m);
    }
  }
  info.textContent = lines.join('\n');
  console.log('[bench] ' + JSON.stringify(rep));
  const zoom = +(q.get('zoom') || 1);
  const span = Math.max(prep.radius * 2, 3) * (q.has('cut') || q.has('shatter') ? 2.3 : 1.5) / zoom;
  frame(new THREE.Vector3(0, prep.size.y * 0.5, q.has('pile') ? -prep.radius * 1.5 : 0), span * (q.has('pile') ? 1.5 : 1));
}

function showGrid() {
  const cols = Math.max(1, Math.ceil(Math.sqrt(list.length * 1.6)));
  const step = 9;
  const lines = [`pack ${packName}: ${list.length} candies`];
  let bad = 0;
  list.forEach((def, i) => {
    const x = ((i % cols) - (cols - 1) / 2) * step;
    const z = (Math.floor(i / cols) - (Math.ceil(list.length / cols) - 1) / 2) * step;
    const rep = report(def);
    console.log('[bench] ' + JSON.stringify(rep));
    if (!rep.ok) {
      bad++;
      lines.push(`${def.id}: ${rep.notes.join('; ')}`);
      addLabel(def.id + ' !', new THREE.Vector3(x, 0, z + 3.6), true);
      return;
    }
    if (rep.notes.length) lines.push(`${def.id}: ${rep.notes.join('; ')}`);
    const n = Math.min(def.variants || 1, 3);
    for (let v = 0; v < n; v++) {
      const prep = prepare(def, v);
      const m = buildMeshes(wholeSet(prep));
      const off = n === 1 ? 0 : (v - (n - 1) / 2) * Math.min(3.2, prep.size.x + 0.4);
      place(m, x + off, z + (v % 2) * 0.8, 0);
      scene.add(m);
    }
    addLabel(def.id, new THREE.Vector3(x, 0, z + 3.6), false);
  });
  lines.push(bad ? `${bad} candies failed validation` : 'all candies passed validation');
  info.textContent = lines.join('\n');
  const rows = Math.ceil(list.length / cols);
  frame(new THREE.Vector3(0, 1, 0), Math.max(cols * step, rows * step * 1.7) + 6);
}

function frame(target, span) {
  const yaw = ((+(q.get('yaw') || 20)) * Math.PI) / 180;
  const elev = ((+(q.get('elev') || 32)) * Math.PI) / 180;
  camera.fov = 28;
  const dist = span / 2 / Math.tan((14 * Math.PI) / 180) / Math.min(1, camera.aspect);
  camera.position.set(target.x + Math.sin(yaw) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, target.z + Math.cos(yaw) * Math.cos(elev) * dist);
  camera.near = dist * 0.05;
  camera.far = dist * 20;
  camera.updateProjectionMatrix();
  controls.target.copy(target);
  controls.update();
  stage.key.target.position.copy(target);
  stage.key.position.set(target.x - 28, target.y + 120, target.z + 46);
}

if (q.get('env')) {
  await stage.loadEnv('Niepotrzebne/hdri/' + q.get('env') + '_1k.hdr', +(q.get('envrot') || 0), +(q.get('envint') || 1));
  if (q.get('tone') === 'aces') renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if (q.get('tone') === 'agx') renderer.toneMapping = THREE.AgXToneMapping;
  if (q.get('exp')) renderer.toneMappingExposure = +q.get('exp');
  if (q.get('key')) stage.key.intensity = +q.get('key');
  if (q.get('back')) stage.back.intensity = +q.get('back');
}
const one = q.get('id') ? list.find((d) => d.id === q.get('id')) : null;
try {
  if (q.get('id') && !one) info.textContent = `no candy "${q.get('id')}" in pack ${packName}`;
  else if (one) showSingle(one);
  else showGrid();
} catch (e) {
  info.textContent = 'ERROR ' + e.message + '\n' + e.stack;
  console.error('[bench] error', e);
}

const _v = new THREE.Vector3();
function tick() {
  requestAnimationFrame(tick);
  if (!dirty) return;
  dirty = false;
  renderer.render(scene, camera);
  for (const t of tags) {
    _v.copy(t.pos).project(camera);
    t.el.style.left = ((_v.x * 0.5 + 0.5) * innerWidth).toFixed(0) + 'px';
    t.el.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight).toFixed(0) + 'px';
  }
}
window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  dirty = true;
});
stage.place = () => {};
tick();
window.T = { ready: true, stage, list };
