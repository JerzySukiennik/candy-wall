// Candy Wall: sample-based audio (real recordings only, context and samples prepared at boot): one-shots with random variants, per-candy pitch and tone, voice lines with a level meter for lip sync.
let ctx = null;
let master = null;
let enabled = true;
let manifest = null;
let loading = false;
const buffers = {};
const last = {};
const lastPick = {};
let voiceNode = null;
let analyser = null;
let meter = null;

async function loadGroup(dir, name, files) {
  const list = [];
  await Promise.all(
    files.map(async (f, i) => {
      try {
        const r = await fetch(dir + f);
        if (!r.ok) return;
        list[i] = await ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) {}
    })
  );
  buffers[name] = list.filter(Boolean);
}

async function loadAll() {
  if (loading) return;
  loading = true;
  try {
    const r = await fetch('assets/audio/manifest.json');
    if (!r.ok) return;
    manifest = await r.json();
  } catch (e) {
    return;
  }
  const jobs = [];
  for (const [name, files] of Object.entries(manifest.sfx || {})) jobs.push(() => loadGroup('assets/audio/', name, files));
  for (const [name, files] of Object.entries(manifest.voice || {})) jobs.push(() => loadGroup('assets/voice/', 'voice:' + name, files));
  let i = 0;
  const worker = async () => {
    while (i < jobs.length) await jobs[i++]();
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
}

function source(name) {
  const list = buffers[name];
  if (!list || !list.length) return null;
  let k = (Math.random() * list.length) | 0;
  if (list.length > 1 && k === lastPick[name]) k = (k + 1) % list.length;
  lastPick[name] = k;
  const src = ctx.createBufferSource();
  src.buffer = list[k];
  return src;
}

export const audio = {
  get enabled() {
    return enabled;
  },
  get ready() {
    return !!ctx;
  },
  has(name) {
    return !!(buffers[name] && buffers[name].length);
  },
  init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -15;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    master.connect(comp);
    comp.connect(ctx.destination);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    meter = new Uint8Array(analyser.fftSize);
    analyser.connect(master);
    loadAll();
  },
  unlock() {
    if (!ctx) this.init();
    if (ctx && ctx.state !== 'running') ctx.resume();
  },
  setEnabled(on) {
    enabled = on;
    if (master) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.03);
  },
  play(name, o = {}) {
    if (!ctx || !enabled) return false;
    const now = ctx.currentTime;
    const gap = o.gap ?? 0.035;
    if (last[name] && now - last[name] < gap) return false;
    const src = source(name);
    if (!src) return false;
    last[name] = now;
    src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * (o.jitter ?? 0.1));
    const g = ctx.createGain();
    g.gain.value = Math.min(1.6, o.vol ?? 1);
    let node = src;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      node.connect(f);
      node = f;
    }
    if (o.highpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = o.highpass;
      node.connect(f);
      node = f;
    }
    node.connect(g);
    if (o.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      g.connect(p);
      p.connect(master);
    } else g.connect(master);
    if (o.delay) src.start(now + o.delay);
    else src.start();
    return true;
  },
  voice(name, o = {}) {
    if (!ctx || !enabled) return 0;
    const src = source('voice:' + name);
    if (!src) return 0;
    if (voiceNode) {
      try {
        voiceNode.stop();
      } catch (e) {}
    }
    const g = ctx.createGain();
    g.gain.value = o.vol ?? 1;
    src.playbackRate.value = o.rate ?? 1;
    src.connect(g);
    g.connect(analyser);
    src.start(ctx.currentTime + (o.delay ?? 0));
    voiceNode = src;
    src.onended = () => {
      if (voiceNode === src) voiceNode = null;
    };
    return src.buffer.duration + (o.delay ?? 0);
  },
  level() {
    if (!analyser || !voiceNode) return 0;
    analyser.getByteTimeDomainData(meter);
    let s = 0;
    for (let i = 0; i < meter.length; i += 4) {
      const v = (meter[i] - 128) / 128;
      s += v * v;
    }
    return Math.min(1, Math.sqrt(s / (meter.length / 4)) * 4.5);
  },
};
