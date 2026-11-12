// Candy Wall: candy material factories (fake translucency, sugar crystals, procedural patterns) tuned for the dark studio.
import * as THREE from 'three';

const lerp = (a, b, t) => a + (b - a) * t;
const sat = (x) => Math.min(1, Math.max(0, x));

const NOISE = /* glsl */ `
float cHash1(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
vec3 cHash3(vec3 p) {
  return vec3(cHash1(p), cHash1(p + 19.19), cHash1(p + 47.77));
}
float cNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(cHash1(i), cHash1(i + vec3(1, 0, 0)), f.x), mix(cHash1(i + vec3(0, 1, 0)), cHash1(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(cHash1(i + vec3(0, 0, 1)), cHash1(i + vec3(1, 0, 1)), f.x), mix(cHash1(i + vec3(0, 1, 1)), cHash1(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float cFbm(vec3 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * cNoise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return s;
}
`;

const KINDS = {
  gummy: (o) => {
    const c = sat(o.clarity ?? 0.6);
    const g = sat(o.gloss ?? 0.75);
    return { roughness: lerp(0.5, 0.14, g), clearcoat: g, clearcoatRoughness: 0.16, glow: 0.16 + 0.5 * c, core: lerp(0.8, 0.3, c), back: 0.35 + 1.1 * c, fres: 1.7, alpha: c > 0.6 ? lerp(0.92, 0.3, (c - 0.6) / 0.4) : 1, spec: 1 };
  },
  hard: (o) => {
    const c = sat(o.clarity ?? 0.75);
    return { roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03, glow: 0.14 + 0.5 * c, core: lerp(0.85, 0.35, c), back: 0.4 + 1.3 * c, fres: 2.2, alpha: c > 0.6 ? lerp(0.95, 0.34, (c - 0.6) / 0.4) : 1, spec: 1 };
  },
  shell: (o) => ({ roughness: lerp(0.4, 0.12, sat(o.gloss ?? 0.8)), clearcoat: 0.7, clearcoatRoughness: 0.1, glow: 0.05, core: 1, back: 0.05, fres: 2, alpha: 1, spec: 1 }),
  chocolate: (o) => ({ roughness: lerp(0.62, 0.3, sat(o.gloss ?? 0.5)), clearcoat: 0.12, clearcoatRoughness: 0.4, glow: 0.015, core: 1, back: 0, fres: 2, alpha: 1, spec: 0.55, sheen: 0.25 }),
  foam: () => ({ roughness: 0.92, clearcoat: 0, clearcoatRoughness: 0, glow: 0.1, core: 0.9, back: 0.25, fres: 1.2, alpha: 1, spec: 0.25, sheen: 0.7 }),
  crisp: () => ({ roughness: 0.86, clearcoat: 0, clearcoatRoughness: 0, glow: 0.03, core: 1, back: 0.12, fres: 2, alpha: 1, spec: 0.35 }),
  cream: () => ({ roughness: 0.55, clearcoat: 0.1, clearcoatRoughness: 0.5, glow: 0.06, core: 1, back: 0.1, fres: 2, alpha: 1, spec: 0.5, sheen: 0.3 }),
  liquid: (o) => {
    const c = sat(o.clarity ?? 0.6);
    return { roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, glow: 0.3 + 0.45 * c, core: lerp(0.9, 0.5, c), back: 0.5 + c, fres: 1.4, alpha: 1, spec: 1 };
  },
  wax: () => ({ roughness: 0.42, clearcoat: 0.2, clearcoatRoughness: 0.4, glow: 0.2, core: 0.7, back: 0.5, fres: 1.4, alpha: 1, spec: 0.6 }),
  matte: (o) => ({ roughness: o.roughness ?? 0.82, clearcoat: 0, clearcoatRoughness: 0, glow: 0.01, core: 1, back: 0, fres: 2, alpha: 1, spec: 0.3 }),
  foil: (o) => ({ roughness: o.roughness ?? 0.24, clearcoat: 0, clearcoatRoughness: 0, glow: 0, core: 1, back: 0, fres: 2, alpha: 1, spec: 1, metal: 1 }),
};

const CHOC = { milk: 0x6a3d22, dark: 0x2c170e, white: 0xf2e4c4, ruby: 0xd98a9c, caramel: 0xb9742c, blond: 0xd9b074 };

function colorOf(c, kind) {
  if (c === undefined || c === null) return new THREE.Color(kind === 'chocolate' ? CHOC.milk : 0xffffff);
  if (c.isColor) return c.clone();
  if (typeof c === 'string' && CHOC[c] !== undefined) return new THREE.Color(CHOC[c]);
  return new THREE.Color(c);
}

function hashOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

function make(kind, o = {}) {
  const k = KINDS[kind](o);
  const sugar = sat(o.sugar ?? 0);
  const glow = o.glow ?? k.glow;
  const clear = k.alpha < 1 && o.opaque !== true;
  const m = new THREE.MeshPhysicalMaterial({
    color: colorOf(o.color, kind),
    roughness: lerp(k.roughness, 0.6, sugar * 0.8),
    metalness: k.metal || 0,
    clearcoat: k.clearcoat * (1 - sugar),
    clearcoatRoughness: k.clearcoatRoughness,
    specularIntensity: k.spec,
    vertexColors: !!o.vertexColors,
    map: o.map || null,
    normalMap: o.normalMap || null,
    roughnessMap: o.roughnessMap || null,
    side: o.side ?? THREE.FrontSide,
    transparent: clear,
    depthWrite: true,
  });
  if (o.normalScale) m.normalScale.setScalar(o.normalScale);
  if (k.sheen) {
    m.sheen = k.sheen;
    m.sheenRoughness = 0.6;
    m.sheenColor = new THREE.Color(kind === 'chocolate' ? 0x9a6a48 : 0xffffff);
  }
  m.envMapIntensity = o.env ?? 1;
  const u = {
    uGlow: { value: glow },
    uCoreDim: { value: k.core },
    uFresPow: { value: k.fres },
    uBack: { value: o.back ?? k.back },
    uAlpha: { value: o.alpha ?? k.alpha },
    uSugar: { value: sugar },
    uSugarScale: { value: o.sugarScale ?? 11 },
    uSugarTint: { value: new THREE.Color(o.sugarColor ?? 0xffffff) },
  };
  const pattern = o.pattern || '';
  const id = pattern ? hashOf(pattern) : 0;
  m.userData.candy = { kind, opts: o, uniforms: u };
  m.customProgramCacheKey = () => `candy:${clear ? 1 : 0}:${sugar > 0 ? 1 : 0}:${id}`;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 rest;\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = rest;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRest;
        uniform float uGlow;
        uniform float uCoreDim;
        uniform float uFresPow;
        uniform float uBack;
        uniform float uAlpha;
        uniform float uSugar;
        uniform float uSugarScale;
        uniform vec3 uSugarTint;
        ${NOISE}
        ${pattern}`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 cV = normalize(vViewPosition);
          ${pattern ? 'diffuseColor.rgb = candyPattern(vRest, diffuseColor.rgb);' : ''}
          ${
            sugar > 0
              ? `vec3 sp = vRest * uSugarScale;
          vec3 ci = floor(sp);
          vec3 cf = fract(sp) - 0.5;
          vec3 rnd = cHash3(ci);
          float cd = length(cf - (rnd - 0.5) * 0.5);
          float cry = smoothstep(0.47, 0.2, cd) * step(1.0 - uSugar, cHash1(ci + 7.0));
          vec3 facet = normalize(cHash3(ci + 3.0) - 0.5);
          normal = normalize(normal + (viewMatrix * vec4(facet, 0.0)).xyz * cry * 0.95);
          diffuseColor.rgb = mix(diffuseColor.rgb, uSugarTint, cry * 0.7);
          roughnessFactor = mix(roughnessFactor, 0.2, cry);`
              : ''
          }
          float ndv = clamp(abs(dot(normal, cV)), 0.0, 1.0);
          float fres = pow(1.0 - ndv, uFresPow);
          totalEmissiveRadiance += diffuseColor.rgb * uGlow * mix(uCoreDim, 1.0, fres);
          #if NUM_DIR_LIGHTS > 0
            vec3 cL = directionalLights[0].direction;
            float cBack = pow(clamp(dot(cV, -normalize(cL + normal * 0.4)), 0.0, 1.0), 2.5);
            totalEmissiveRadiance += diffuseColor.rgb * directionalLights[0].color * cBack * uBack * 0.12;
          #endif
          ${clear ? 'diffuseColor.a *= mix(uAlpha, 1.0, fres);' : ''}
        }`
      );
    if (clear)
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `{
          vec3 cS = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
          #ifdef USE_CLEARCOAT
            cS += clearcoatSpecularDirect + clearcoatSpecularIndirect;
          #endif
          diffuseColor.a = clamp(diffuseColor.a + dot(cS, vec3(0.3333)) * 1.3, 0.0, 1.0);
        }
        #include <opaque_fragment>`
      );
  };
  return m;
}

export const mat = {
  gummy: (o) => make('gummy', o),
  hard: (o) => make('hard', o),
  shell: (o) => make('shell', o),
  chocolate: (o) => make('chocolate', typeof o === 'string' || typeof o === 'number' ? { color: o } : o),
  foam: (o) => make('foam', o),
  crisp: (o) => make('crisp', o),
  cream: (o) => make('cream', o),
  liquid: (o) => make('liquid', o),
  wax: (o) => make('wax', o),
  matte: (o) => make('matte', typeof o === 'string' || typeof o === 'number' ? { color: o } : o),
  foil: (o) => make('foil', typeof o === 'string' || typeof o === 'number' ? { color: o } : o),
  capOf(material, over = {}) {
    const c = material.userData.candy;
    if (!c) return material;
    const o = { ...c.opts, sugar: 0, map: null, normalMap: null, roughnessMap: null, ...over };
    if (c.kind === 'gummy' || c.kind === 'hard') {
      o.gloss = over.gloss ?? 0.55;
      o.opaque = over.opaque ?? true;
      o.glow = over.glow ?? (KINDS[c.kind](c.opts).glow + 0.12);
    }
    if (c.kind === 'chocolate') o.gloss = over.gloss ?? 0.15;
    if (c.kind === 'shell') return make('matte', { color: over.color ?? c.opts.color, vertexColors: c.opts.vertexColors });
    return make(c.kind, o);
  },
  CHOC,
};

export function canvasTexture(size, draw, opt = {}) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  draw(ctx, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = opt.data ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = opt.repeat === false ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
