// Candy Wall: Jurek's head (rigged GLB with ARKit morphs): gaze, blinking, biting and chewing, taste reactions with flush, sweat, tears, steam and mist.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Spring, clamp, damp, rand, smooth } from './util.js';

const _v = new THREE.Vector3();
const _u = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const SCALE = 100;
const flush = { value: 0 };

function fixMaterial(m, mesh) {
  const n = m.name || '';
  if (/^Skin/.test(n)) {
    const nm = new THREE.MeshPhysicalMaterial({ map: m.map, normalMap: m.normalMap, aoMap: m.aoMap || m.metalnessMap, roughnessMap: m.roughnessMap, roughness: 1, metalness: 0 });
    nm.aoMapIntensity = 0.9;
    nm.sheen = 0.35;
    nm.sheenRoughness = 0.5;
    nm.sheenColor = new THREE.Color(0xffd9c8);
    nm.specularIntensity = 0.55;
    nm.clearcoat = 0.04;
    nm.clearcoatRoughness = 0.35;
    if (nm.map) nm.map.anisotropy = 8;
    nm.name = n;
    nm.onBeforeCompile = (sh) => {
      sh.uniforms.uFlush = flush;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uFlush;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.22, 0.5, 0.44) + vec3(0.06, 0.0, 0.0), uFlush);')
        .replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
        reflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(0.10, 0.035, 0.02) * (1.0 - 0.6 * dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)));`
        );
    };
    nm.customProgramCacheKey = () => 'head-skin';
    return nm;
  }
  if (/^(Hair_Strands|Eyebrow_Strands)/.test(n)) {
    const nm = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, sheen: 0.12, sheenRoughness: 0.5, sheenColor: new THREE.Color(0x8a6a44) });
    nm.name = n;
    return nm;
  }
  if (/^(Hair_RT_Cards|Eyebrow_RT|Hair_RT_Cap|Hair_Scalp_Cap)/.test(n)) {
    m.side = THREE.DoubleSide;
    if (/Cards|Eyebrow_RT/.test(n)) {
      m.alphaTest = 0.4;
      m.transparent = false;
      m.depthWrite = true;
      m.alphaToCoverage = true;
    }
    m.roughness = 0.65;
    return m;
  }
  if (/^EyeCornea|^Wet/.test(n)) {
    m.transparent = true;
    m.premultipliedAlpha = true;
    m.depthWrite = false;
    mesh.renderOrder = 10;
    return m;
  }
  if (/^Collar/.test(n)) {
    m.sheen = 0;
    return m;
  }
  return m;
}

const EMOTES = {
  sweet: { dur: 1.7, attack: 0.2 },
  sour: { dur: 2.3, attack: 0.1 },
  spicy: { dur: 4.2, attack: 0.7 },
  bitter: { dur: 2.2, attack: 0.18 },
  salty: { dur: 1.4, attack: 0.12 },
  mint: { dur: 2.6, attack: 0.25 },
  fizz: { dur: 2.8, attack: 0.1 },
  wow: { dur: 1.3, attack: 0.1 },
  wince: { dur: 0.32, attack: 0.04 },
};

export class Head {
  constructor(game) {
    this.game = game;
    this.emit = () => {};
    this.group = new THREE.Group();
    this.group.visible = false;
    this.loaded = false;
    this.present = false;
    this.w = {};
    this.wt = {};
    this.bind = {};
    this.lookTarget = new THREE.Vector3(0, 14, 80);
    this.hy = 0;
    this.hp = 0;
    this.gy = 0;
    this.gp = 0;
    this.open = 0;
    this.jawOverride = -1;
    this.chew = null;
    this.full = 0;
    this.smileHold = 0;
    this.wide = 0;
    this.talk = 0;
    this.blinkIn = 1.5;
    this.blink = -1;
    this.sacIn = 1;
    this.sacX = 0;
    this.sacY = 0;
    this.nod = new Spring(0, 120, 0.45);
    this.tilt = new Spring(0, 60, 0.5);
    this.turn = new Spring(0, 70, 0.55);
    this.mouthLocal = new THREE.Vector3(0, -0.04, 0.09);
    this.wakeFor = 0;
    this.emotes = [];
    this.flush = 0;
    this.flushT = 0;
    this.time = 0;
    this.busy = false;
    this.home = new THREE.Vector3();
  }

  async load(home) {
    this.home.copy(home);
    const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('assets/head/jurek_head_realtime.opt.glb');
    const root = gltf.scene;
    const bones = {};
    let skin = null;
    root.traverse((o) => {
      if (o.isBone) bones[o.name.replace(/[._]/g, '').toLowerCase()] = o;
      if (o.isMesh) {
        o.frustumCulled = false;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const fixed = mats.map((m) => fixMaterial(m, o));
        o.material = Array.isArray(o.material) ? fixed : fixed[0];
        const mn = fixed[0].name || '';
        o.castShadow = !/Eye|Lashes|Wet|Cornea|Caruncle|Teeth|Gums|Tongue/.test(mn);
        o.receiveShadow = false;
        const d = o.morphTargetDictionary;
        if (d) {
          for (const name in d) (this.bind[name] = this.bind[name] || []).push([o.morphTargetInfluences, d[name], /^Eye/.test(o.name) || /^Eye/.test(o.parent.name)]);
          if ('mouthPucker' in d && /^Skin/.test(mn)) skin = o;
        }
      }
    });
    this.bones = { head: bones.head, neck: bones.neck, jaw: bones.jaw, eyeL: bones.eyel, eyeR: bones.eyer };
    root.scale.setScalar(SCALE);
    this.group.add(root);
    this.root = root;
    const box = new THREE.Box3().setFromObject(root);
    this.baseY = -box.min.y - 1.2;
    this.group.position.set(home.x, this.baseY, home.z);
    this.group.updateMatrixWorld(true);
    const B = this.bones;
    this.rest = {};
    for (const k of ['head', 'eyeL', 'eyeR']) {
      const b = B[k];
      if (!b) continue;
      this.rest[k] = { world: b.getWorldQuaternion(new THREE.Quaternion()), parent: b.parent.getWorldQuaternion(new THREE.Quaternion()) };
    }
    if (skin && B.head) {
      const d = skin.morphTargetDictionary;
      const attr = skin.geometry.morphAttributes.position[d.mouthPucker];
      const n = attr.count;
      const mag = new Float32Array(n);
      for (let i = 0; i < n; i++) mag[i] = Math.hypot(attr.getX(i), attr.getY(i), attr.getZ(i));
      const order = Array.from(mag.keys()).sort((a, b) => mag[b] - mag[a]).slice(0, 70);
      const c = new THREE.Vector3();
      for (const i of order) {
        skin.getVertexPosition(i, _v);
        _v.applyMatrix4(skin.matrixWorld);
        c.add(_v);
      }
      c.multiplyScalar(1 / order.length);
      this.mouthLocal.copy(B.head.worldToLocal(c));
    }
    this.loaded = true;
  }

  mouth(out) {
    if (!this.loaded || !this.bones.head) return out.set(this.home.x, 12, this.home.z + 9);
    return this.bones.head.localToWorld(out.copy(this.mouthLocal));
  }

  point(dx, dy, dz, out) {
    const B = this.bones;
    if (B.eyeL && B.eyeR) {
      B.eyeL.getWorldPosition(out);
      B.eyeR.getWorldPosition(_u);
      out.add(_u).multiplyScalar(0.5);
    } else this.mouth(out).y += 6;
    _u.set(dx, dy, dz).applyEuler(_e.set(0, this.hy, 0));
    return out.add(_u);
  }

  wake(sec) {
    this.wakeFor = Math.max(this.wakeFor, sec);
  }

  emote(kind, k = 1, delay = 0) {
    const def = EMOTES[kind];
    if (!def) return;
    this.emotes.push({ kind, k: clamp(k, 0, 1), t: -delay, dur: def.dur * (0.6 + 0.7 * k), attack: def.attack, fired: false });
    this.wake(def.dur * 2 + delay + 1);
  }

  startChew(o) {
    this.chew = { left: o.bites, total: o.bites, period: o.period ?? 0.38, t: 0, bit: -1, sticky: o.sticky ?? 0, hard: o.hard ?? 0, done: o.done };
    this.full = Math.min(4, this.full + 1);
    this.busy = true;
    this.wake(o.bites * (o.period ?? 0.38) + 2);
  }

  flinch() {
    this.blink = 0;
    this.nod.v -= 1.4;
    this.wake(1);
  }

  update(dt) {
    if (!this.loaded || !this.present) return false;
    this.time += dt;
    let moving = this.wakeFor > 0;
    this.wakeFor = Math.max(0, this.wakeFor - dt);
    const B = this.bones;
    const w = this.wt;
    for (const k in w) w[k] = 0;

    this.blinkIn -= dt;
    if (this.blinkIn <= 0 && this.blink < 0) {
      this.blink = 0;
      this.blinkIn = 1.8 + Math.random() * 3.6;
    }
    let bl = 0;
    if (this.blink >= 0) {
      this.blink += dt / 0.17;
      bl = Math.sin(Math.min(1, this.blink) * Math.PI);
      if (this.blink >= 1) this.blink = -1;
      moving = true;
    }
    this.sacIn -= dt;
    if (this.sacIn <= 0) {
      this.sacIn = 0.7 + Math.random() * 1.9;
      this.sacX = (Math.random() - 0.5) * 0.035;
      this.sacY = (Math.random() - 0.5) * 0.02;
      this.wake(0.25);
    }

    let shake = 0;
    let pull = 0;
    let dart = 0;
    let squint = 0;
    let wide = this.wide;
    let smile = 0;
    let pant = 0;
    let flushT = 0;
    for (let i = this.emotes.length - 1; i >= 0; i--) {
      const em = this.emotes[i];
      em.t += dt;
      if (em.t < 0) continue;
      if (em.t >= em.dur) {
        this.emotes.splice(i, 1);
        continue;
      }
      moving = true;
      const k = em.k;
      const e = smooth(0, em.attack, em.t) * (1 - smooth(em.dur * 0.72, em.dur, em.t));
      if (!em.fired) {
        em.fired = true;
        this.emit('emote', em);
      }
      const x = e * k;
      const add = (name, v) => (w[name] = Math.min(1, (w[name] || 0) + v));
      switch (em.kind) {
        case 'sweet':
          smile = Math.max(smile, 0.75 * e * (0.5 + 0.5 * k));
          add('eyeSquintLeft', 0.35 * x);
          add('eyeSquintRight', 0.35 * x);
          bl = Math.max(bl, 0.3 * x);
          break;
        case 'sour':
          squint = Math.max(squint, x);
          add('mouthPucker', 0.8 * x);
          add('browDownLeft', 0.95 * x);
          add('browDownRight', 0.95 * x);
          add('noseSneerLeft', 0.8 * x);
          add('noseSneerRight', 0.8 * x);
          add('cheekSquintLeft', 0.9 * x);
          add('cheekSquintRight', 0.9 * x);
          add('mouthPressLeft', 0.5 * x);
          add('mouthPressRight', 0.5 * x);
          bl = Math.max(bl, 0.82 * x);
          shake += Math.sin(this.time * 58) * 0.035 * x;
          pull = Math.max(pull, 0.5 * x);
          if (k > 0.85 && em.t > 0.5 && Math.random() < dt * 9) this.tear();
          break;
        case 'spicy': {
          const burn = smooth(0.2, 0.9, em.t) * (1 - smooth(em.dur * 0.75, em.dur, em.t)) * k;
          wide = Math.max(wide, burn);
          pant = Math.max(pant, burn);
          flushT = Math.max(flushT, burn);
          add('browInnerUp', 0.9 * burn);
          add('mouthFunnel', 0.45 * burn);
          add('tongueOut', 0.5 * burn * (k > 0.55 ? 1 : 0));
          shake += Math.sin(this.time * 7) * 0.05 * burn;
          if (Math.random() < dt * (4 + 14 * k) * burn) this.sweat();
          if (k > 0.72 && Math.random() < dt * 22 * burn) this.steam();
          if (k > 0.9 && Math.random() < dt * 5 * burn) this.tear();
          break;
        }
        case 'bitter':
          add('mouthFrownLeft', 0.9 * x);
          add('mouthFrownRight', 0.9 * x);
          add('noseSneerLeft', 0.9 * x);
          add('noseSneerRight', 0.9 * x);
          add('browDownLeft', 0.6 * x);
          add('browDownRight', 0.6 * x);
          add('tongueOut', 0.45 * x * smooth(0.25, 0.6, em.t));
          add('mouthLowerDownLeft', 0.4 * x);
          add('mouthLowerDownRight', 0.4 * x);
          squint = Math.max(squint, 0.55 * x);
          pull = Math.max(pull, 0.8 * x);
          this.turn.t = 0.22 * x;
          break;
        case 'salty': {
          const sm = Math.max(0, Math.sin(em.t * 15)) * e;
          add('mouthPressLeft', 0.6 * x);
          add('mouthPressRight', 0.6 * x);
          add('mouthPucker', 0.45 * sm * k);
          add('browOuterUpLeft', 0.5 * x);
          add('browOuterUpRight', 0.2 * x);
          add('eyeSquintLeft', 0.3 * x);
          break;
        }
        case 'mint':
          wide = Math.max(wide, 0.8 * x);
          add('mouthFunnel', 0.75 * x);
          add('jawOpen', 0.2 * x);
          add('browInnerUp', 0.6 * x);
          if (Math.random() < dt * 26 * x) this.mist();
          break;
        case 'fizz':
          add('cheekPuff', (0.2 + 0.4 * Math.abs(Math.sin(this.time * 47) * Math.sin(this.time * 31))) * x);
          wide = Math.max(wide, 0.6 * x);
          smile = Math.max(smile, 0.35 * x);
          dart = Math.max(dart, x);
          shake += Math.sin(this.time * 80) * 0.012 * x;
          break;
        case 'wow':
          wide = Math.max(wide, x);
          add('browInnerUp', 0.8 * x);
          add('jawOpen', 0.22 * x);
          break;
        case 'wince':
          squint = Math.max(squint, 0.7 * x);
          add('browDownLeft', 0.5 * x);
          add('browDownRight', 0.5 * x);
          break;
      }
    }
    if (Math.abs(this.turn.t) > 0 && !this.emotes.some((e) => e.kind === 'bitter')) this.turn.t = 0;
    this.flushT = flushT;
    if (Math.abs(this.flush - flushT) > 0.002) {
      this.flush = damp(this.flush, flushT, flushT > this.flush ? 2.2 : 0.8, dt);
      flush.value = this.flush;
      moving = true;
    }

    if (B.head) {
      this.point(0, 0, 0, _v);
      const lt = this.lookTarget;
      const dx = lt.x + (dart ? Math.sin(this.time * 9) * 14 * dart : 0) - _v.x;
      const dy = lt.y + (dart ? Math.cos(this.time * 13) * 6 * dart : 0) - _v.y;
      const dz = lt.z - _v.z;
      const yaw = Math.atan2(dx, dz);
      const pitch = Math.atan2(dy, Math.hypot(dx, dz));
      const thy = clamp(yaw * 0.5, -0.5, 0.5);
      const thp = clamp(pitch * 0.4, -0.22, 0.3);
      if (Math.abs(thy - this.hy) + Math.abs(thp - this.hp) + Math.abs(yaw - this.gy) + Math.abs(pitch - this.gp) > 2e-4) moving = true;
      this.hy = damp(this.hy, thy, 7, dt);
      this.hp = damp(this.hp, thp, 7, dt);
      this.gy = damp(this.gy, yaw, 16, dt);
      this.gp = damp(this.gp, pitch, 16, dt);
      for (const s of [this.nod, this.tilt, this.turn])
        if (s.moving) {
          s.step(dt);
          moving = true;
        }
      const ch = this.chew;
      const chewBob = ch ? Math.sin((ch.t / ch.period) * Math.PI * 2) * 0.012 : 0;
      _e.set(-this.hp + this.nod.x * 0.12 + chewBob - pull * 0.09, this.hy + shake + this.turn.x, this.tilt.x);
      const rh = _q.setFromEuler(_e);
      const r = this.rest.head;
      B.head.quaternion.copy(r.parent).invert().multiply(rh).multiply(r.world);
      B.head.updateMatrixWorld(true);
      const hw = B.head.getWorldQuaternion(new THREE.Quaternion());
      const ey = clamp(this.gy + this.sacX, this.hy - 0.5, this.hy + 0.5);
      const ep = clamp(this.gp + this.sacY, this.hp - 0.5, this.hp + 0.36);
      _e.set(-ep, ey, 0);
      const re = _q.setFromEuler(_e);
      for (const k of ['eyeL', 'eyeR']) {
        if (!B[k]) continue;
        B[k].quaternion.copy(hw).invert().multiply(re).multiply(this.rest[k].world);
      }
      const down = clamp((this.hp - ep) / 0.4, 0, 1);
      w.eyeLookDownLeft = w.eyeLookDownRight = down * 0.8;
    }

    let jaw = this.open * 0.7;
    let close = 0;
    let puff = 0;
    let jl = 0;
    let jr = 0;
    const ch = this.chew;
    if (ch) {
      ch.t += dt;
      const ph = (ch.t % ch.period) / ch.period;
      const amp = 0.2 + 0.1 * ch.hard + 0.16 * ch.sticky;
      const c = ph < 0.55 ? Math.sin((ph / 0.55) * Math.PI) * amp : 0.02;
      const cyc = Math.floor(ch.t / ch.period);
      if (ph >= 0.55 && ch.bit !== cyc && ch.left > 0) {
        ch.bit = cyc;
        ch.left--;
        this.emit('bite', ch.total - ch.left, ch.total);
        if (ch.hard > 0.5) this.emote('wince', ch.hard);
      }
      const k = 1 - this.open;
      jaw = Math.max(jaw, (0.05 + c) * k);
      close = c * 0.9 * k;
      const s = Math.sin((ch.t / ch.period) * Math.PI);
      jl = Math.max(0, s) * 0.3 * k;
      jr = Math.max(0, -s) * 0.3 * k;
      puff = 0.1 + 0.11 * this.full;
      moving = true;
      if (ch.left <= 0 && ph > 0.9) {
        const done = ch.done;
        this.chew = null;
        this.full = 0;
        this.nod.v += 1.6;
        this.emit('gulp');
        this.busy = false;
        if (done) done();
      }
    }
    if (pant > 0) {
      jaw = Math.max(jaw, (0.3 + 0.2 * Math.sin(this.time * 21)) * pant);
      close = 0;
    }
    if (this.talk > 0.01) {
      jaw = Math.max(jaw, this.talk * 0.55);
      w.mouthFunnel = Math.max(w.mouthFunnel || 0, this.talk * 0.25);
      moving = true;
    }
    if (this.jawOverride >= 0) {
      jaw = this.jawOverride;
      close = 0;
      moving = true;
    }
    if (this.smileHold > 0) {
      this.smileHold -= dt;
      smile = Math.max(smile, 0.62);
    } else smile = Math.max(smile, this.open > 0.05 ? 0.08 : 0.12);
    w.jawOpen = Math.max(w.jawOpen || 0, jaw);
    w.mouthClose = close;
    w.jawLeft = jl;
    w.jawRight = jr;
    w.cheekPuff = Math.max(w.cheekPuff || 0, puff);
    w.mouthFunnel = Math.max(w.mouthFunnel || 0, this.open * 0.16);
    w.mouthUpperUpLeft = w.mouthUpperUpRight = this.open * 0.22;
    w.mouthLowerDownLeft = Math.max(w.mouthLowerDownLeft || 0, this.open * 0.25);
    w.mouthLowerDownRight = Math.max(w.mouthLowerDownRight || 0, this.open * 0.25);
    const sm = smile * (ch ? 0.35 : 1) * (1 - squint);
    w.mouthSmileLeft = w.mouthSmileRight = sm;
    w.cheekSquintLeft = Math.max(w.cheekSquintLeft || 0, sm * 0.55);
    w.cheekSquintRight = Math.max(w.cheekSquintRight || 0, sm * 0.55);
    w.eyeSquintLeft = Math.max(w.eyeSquintLeft || 0, squint);
    w.eyeSquintRight = Math.max(w.eyeSquintRight || 0, squint);
    w.eyeBlinkLeft = w.eyeBlinkRight = bl;
    w.eyeWideLeft = w.eyeWideRight = wide * (1 - bl);
    w.browInnerUp = Math.max(w.browInnerUp || 0, wide * 0.7);
    w.browOuterUpLeft = Math.max(w.browOuterUpLeft || 0, wide * 0.45);
    w.browOuterUpRight = Math.max(w.browOuterUpRight || 0, wide * 0.45);

    for (const name in w) {
      const list = this.bind[name];
      if (!list) continue;
      const cur = this.w[name] || 0;
      const t = w[name];
      if (Math.abs(t - cur) < 5e-4) continue;
      const rate = name === 'jawOpen' || name === 'mouthClose' ? 30 : name.startsWith('eyeBlink') ? 60 : name === 'cheekPuff' ? 40 : 14;
      const nv = damp(cur, t, rate, dt);
      this.w[name] = nv;
      const eyeLook = name.startsWith('eyeLook');
      for (const [inf, idx, isEye] of list) if (!(eyeLook && isEye)) inf[idx] = nv;
      moving = true;
    }
    return moving;
  }

  sweat() {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.point(side * rand(2.5, 6.5), rand(2.5, 6), rand(4.5, 7.5), _v);
    this.game.fx.puff(_v, { count: 1, spread: 0.2, vy: -2, jitter: 1.5, gravity: 130, drag: 0.2, life: 0.75, size: 0.75, grow: 0.2, color: 0xe6f5ff, alpha: 0.9 });
  }

  tear() {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.point(side * 3.3, -1.2, 7.6, _v);
    this.game.fx.puff(_v, { count: 1, spread: 0.1, vy: -3, jitter: 0.6, gravity: 90, drag: 0.2, life: 0.9, size: 0.8, grow: 0.1, color: 0xbfe2ff, alpha: 0.9 });
  }

  steam() {
    const side = Math.random() < 0.5 ? -1 : 1;
    this.point(side * 9.6, rand(-1, 1.5), 1.5, _v);
    this.game.fx.puff(_v, { count: 1, spread: 0.5, vx: side * 26, vy: 18, jitter: 5, drag: 1.5, life: 1.2, size: 5.5, grow: 2.6, color: 0xffffff, alpha: 0.5 });
  }

  mist() {
    this.mouth(_v);
    _v.z += 1.5;
    this.game.fx.puff(_v, { count: 1, spread: 0.4, vz: 26, vy: 2, jitter: 4, drag: 1.5, life: 1.2, size: 3.6, grow: 2.2, color: 0xcfe9ff, alpha: 0.26 });
  }
}
