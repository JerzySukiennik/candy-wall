// Candy Wall: renderer, dark ASMR studio lighting, framed camera rigs and screen/world helpers.
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BG, IS_TOUCH, PARAMS } from './config.js';
import { ease, lerp } from './util.js';

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    r.setClearColor(BG, 1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 5, 900);
    this.scene.environment = this.buildStudio(r);
    this.scene.environmentIntensity = 0.85;

    const back = (this.back = new THREE.DirectionalLight(0xdfe8ff, 1.1));
    back.position.set(10, 150, -70);
    this.scene.add(back, back.target);
    const key = (this.key = new THREE.DirectionalLight(0xfff4e6, 2.9));
    key.position.set(-28, 120, 46);
    key.castShadow = true;
    const s = key.shadow;
    const size = IS_TOUCH ? 1024 : 2048;
    s.mapSize.set(size, size);
    s.camera.left = -62;
    s.camera.right = 62;
    s.camera.top = 52;
    s.camera.bottom = -52;
    s.camera.near = 40;
    s.camera.far = 260;
    s.bias = -0.0004;
    s.normalBias = 0.04;
    s.radius = 4;
    s.blurSamples = IS_TOUCH ? 8 : 12;
    this.scene.add(key, key.target);
    this.scene.add(new THREE.HemisphereLight(0xcfd6e6, 0x0a0a0c, 0.12));
    const fill = new THREE.DirectionalLight(0xffeedd, 0.55);
    fill.position.set(30, 30, 90);
    this.scene.add(fill);

    this.composer = null;
    if (PARAMS.get('bloom') === '1') {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      const c = (this.composer = new EffectComposer(r, rt));
      c.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.16, 0.5, 1.7);
      c.addPass(this.bloom);
      c.addPass(new OutputPass());
    }

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.cur = { t: new THREE.Vector3(0, 6, 0), w: 70, h: 44, elev: 34, fov: 28, yaw: 0 };
    this.from = null;
    this.to = null;
    this.k = 1;
    this.dur = 1;
    this.shakeAmp = 0;
    this.shakeT = 0;
    this.resize();
  }

  buildStudio(renderer) {
    const s = new THREE.Scene();
    const glow = (k, tint = [1, 1, 1]) => new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(k * tint[0], k * tint[1], k * tint[2]), side: THREE.DoubleSide });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(80, 32, 16), glow(0.018)));
    const panel = (w, h, k, pos, look = [0, 0, 0], tint) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glow(k, tint));
      m.position.set(...pos);
      m.lookAt(...look);
      s.add(m);
    };
    panel(46, 30, 7.5, [-6, 44, 10]);
    panel(60, 26, 2.6, [0, 16, -50], [0, 8, 0], [0.92, 0.96, 1.0]);
    panel(8, 44, 3.2, [44, 14, 6], [0, 6, 0], [1.0, 0.95, 0.9]);
    panel(6, 40, 2.2, [-46, 12, -6], [0, 6, 0], [0.9, 0.95, 1.0]);
    panel(30, 4, 1.6, [0, 6, 52], [0, 10, 0]);
    panel(120, 120, 0.05, [0, -20, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    const tex = pm.fromScene(s, 0.012, 1, 300).texture;
    pm.dispose();
    return tex;
  }

  async loadEnv(url, rotY = 0, intensity = 1) {
    const tex = await new RGBELoader().loadAsync(url);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    const pm = new THREE.PMREMGenerator(this.renderer);
    const env = pm.fromEquirectangular(tex).texture;
    pm.dispose();
    tex.dispose();
    this.scene.environment = env;
    this.scene.environmentRotation.set(0, rotY, 0);
    this.scene.environmentIntensity = intensity;
    return env;
  }

  focusShadow(x, y, z, half) {
    const k = this.key;
    k.target.position.set(x, y, z);
    k.position.set(x - 26, y + 112, z + 52);
    const c = k.shadow.camera;
    c.left = -half;
    c.right = half;
    c.top = half;
    c.bottom = -half;
    c.near = 40;
    c.far = 260;
    c.updateProjectionMatrix();
    k.target.updateMatrixWorld();
    k.shadow.needsUpdate = true;
  }

  setRig(g, dur = 1.1) {
    this.from = { t: this.cur.t.clone(), w: this.cur.w, h: this.cur.h, elev: this.cur.elev, fov: this.cur.fov, yaw: this.cur.yaw };
    this.to = { t: new THREE.Vector3(...g.t), w: g.w, h: g.h, elev: g.elev, fov: g.fov ?? 28, yaw: g.yaw ?? 0 };
    this.k = 0;
    this.dur = dur;
    if (dur <= 0) {
      this.k = 1;
      this.applyRig(1);
    }
  }

  applyRig(e) {
    const a = this.from;
    const b = this.to;
    if (a && b) {
      this.cur.t.lerpVectors(a.t, b.t, e);
      this.cur.w = lerp(a.w, b.w, e);
      this.cur.h = lerp(a.h, b.h, e);
      this.cur.elev = lerp(a.elev, b.elev, e);
      this.cur.fov = lerp(a.fov, b.fov, e);
      this.cur.yaw = lerp(a.yaw, b.yaw, e);
    }
    this.place();
  }

  place() {
    const c = this.cur;
    const cam = this.camera;
    cam.fov = c.fov;
    const th = Math.tan((c.fov * Math.PI) / 360);
    const dist = Math.max(c.h / 2 / th, c.w / 2 / (th * cam.aspect));
    const el = (c.elev * Math.PI) / 180;
    const yw = (c.yaw * Math.PI) / 180;
    let sx = 0;
    let sy = 0;
    if (this.shakeAmp > 0.0005) {
      sx = Math.sin(this.shakeT * 71) * this.shakeAmp;
      sy = Math.cos(this.shakeT * 93) * this.shakeAmp;
    }
    const hz = dist * Math.cos(el);
    cam.position.set(c.t.x + sx + hz * Math.sin(yw), c.t.y + dist * Math.sin(el) + sy, c.t.z + hz * Math.cos(yw));
    cam.near = Math.max(2, dist * 0.2);
    cam.far = dist * 5 + 500;
    cam.lookAt(c.t.x + sx, c.t.y + sy, c.t.z);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    this.dist = dist;
  }

  shake(amount) {
    this.shakeAmp = Math.min(0.3, this.shakeAmp + amount);
  }

  get moving() {
    return this.k < 1 || this.shakeAmp > 0.0005;
  }

  update(dt) {
    let moving = false;
    if (this.k < 1) {
      this.k = Math.min(1, this.k + dt / this.dur);
      this.applyRig(ease.inOut(this.k));
      moving = true;
    }
    if (this.shakeAmp > 0.0005) {
      this.shakeT += dt;
      this.shakeAmp *= Math.exp(-dt * 13);
      this.place();
      moving = true;
    }
    return moving;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, +PARAMS.get('pr') || (IS_TOUCH ? 2 : 1.5)));
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.camera.aspect = w / h;
    this.place();
  }

  ray(cx, cy) {
    this.ndc.set((cx / this.w) * 2 - 1, -(cy / this.h) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return this.raycaster.ray;
  }

  toScreen(v, out) {
    out.copy(v).project(this.camera);
    out.x = (out.x * 0.5 + 0.5) * this.w;
    out.y = (-out.y * 0.5 + 0.5) * this.h;
    return out;
  }

  render() {
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  precompile(object) {
    if (this.composer) return;
    this.renderer.compileAsync(object, this.camera, this.scene).catch(() => {});
  }

  prewarm(root) {
    const r = this.renderer;
    const hidden = [];
    const culled = [];
    root.traverse((o) => {
      if (!o.visible) {
        o.visible = true;
        hidden.push(o);
      }
      if (o.frustumCulled && (o.isMesh || o.isPoints || o.isLine)) {
        o.frustumCulled = false;
        culled.push(o);
      }
    });
    r.setScissorTest(true);
    r.setScissor(0, 0, 1, 1);
    this.render();
    r.setScissorTest(false);
    for (const o of hidden) o.visible = false;
    for (const o of culled) o.frustumCulled = true;
  }
}
