/* ==========================================================================
   Last Survivor — 04 · audio.js
   Fully synthesised SFX and a procedural music sequencer (Web Audio API).
   No audio files needed: everything is generated at runtime.
   ========================================================================== */
'use strict';

LS.Audio = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf, comp;
  let sfxVol = 0.8, musicVol = 0.55, muted = false;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain();
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master); musicBus.connect(master);
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
  }
  function unlock() {
    init();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  function applyVolumes() {
    if (!ctx) return;
    master.gain.value = muted ? 0 : 1;
    sfxBus.gain.value = sfxVol;
    musicBus.gain.value = musicVol * 0.5;
  }
  function setVolumes(s, m) { sfxVol = s; musicVol = m; applyVolumes(); }
  function toggleMute() { muted = !muted; applyVolumes(); return muted; }
  const isMuted = () => muted;

  /* ---------------- primitives ---------------- */
  function tone({ type = 'sine', f0 = 440, f1 = null, t = 0, dur = 0.2, vol = 0.3, attack = 0.005, bus = sfxBus, filter = null, q = 1, detune = 0 }) {
    if (!ctx) return;
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.detune.value = detune;
    o.frequency.setValueAtTime(f0, now);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = o;
    if (filter) {
      const fl = ctx.createBiquadFilter(); fl.type = filter.type; fl.frequency.value = filter.f; fl.Q.value = q;
      o.connect(fl); node = fl;
    }
    node.connect(g); g.connect(bus);
    o.start(now); o.stop(now + dur + 0.05);
  }
  function noise({ t = 0, dur = 0.3, vol = 0.4, type = 'lowpass', f0 = 1200, f1 = null, q = 0.8, attack = 0.003, bus = sfxBus }) {
    if (!ctx) return;
    const now = ctx.currentTime + t;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, now);
    if (f1 !== null) fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(fl); fl.connect(g); g.connect(bus);
    s.start(now, Math.random()); s.stop(now + dur + 0.05);
  }

  /* ---------------- sound effects ---------------- */
  const SFX = {
    click() { tone({ type: 'triangle', f0: 720, f1: 1180, dur: 0.07, vol: 0.25 }); },
    hover() { tone({ type: 'sine', f0: 1400, dur: 0.035, vol: 0.06 }); },
    select() { tone({ type: 'square', f0: 660, dur: 0.06, vol: 0.12, filter: { type: 'lowpass', f: 2400 } }); tone({ type: 'square', f0: 990, t: 0.06, dur: 0.08, vol: 0.12, filter: { type: 'lowpass', f: 2400 } }); },
    denied() { tone({ type: 'sawtooth', f0: 160, f1: 110, dur: 0.22, vol: 0.18, filter: { type: 'lowpass', f: 900 } }); },
    pull() { tone({ type: 'sine', f0: 220, f1: 330, dur: 0.12, vol: 0.05 }); },
    throw() { noise({ type: 'bandpass', f0: 380, f1: 2600, q: 2.5, dur: 0.28, vol: 0.4 }); },
    gun() { noise({ type: 'highpass', f0: 1800, dur: 0.07, vol: 0.5 }); tone({ type: 'square', f0: 180, f1: 60, dur: 0.07, vol: 0.2 }); },
    shotgun() { noise({ type: 'lowpass', f0: 3000, f1: 300, dur: 0.35, vol: 0.8 }); tone({ type: 'sine', f0: 110, f1: 40, dur: 0.25, vol: 0.5 }); },
    hit(p = 1) {
      const v = Math.min(1, 0.35 + p * 0.5);
      tone({ type: 'sine', f0: 150, f1: 45, dur: 0.18, vol: v * 0.7 });
      noise({ type: 'lowpass', f0: 1800, f1: 200, dur: 0.12, vol: v * 0.5 });
    },
    pain() {
      const f = 240 + Math.random() * 120;
      tone({ type: 'sawtooth', f0: f, f1: f * 0.55, dur: 0.26, vol: 0.14, filter: { type: 'bandpass', f: 900 }, q: 3 });
      tone({ type: 'sawtooth', f0: f * 1.01, f1: f * 0.5, dur: 0.26, vol: 0.08, filter: { type: 'bandpass', f: 1800 }, q: 4 });
    },
    bounce(p = 1) { tone({ type: 'sine', f0: 520, f1: 260, dur: 0.07, vol: 0.12 * p + 0.04 }); },
    thud(p = 1) { tone({ type: 'sine', f0: 110, f1: 50, dur: 0.12, vol: 0.2 * p + 0.05 }); noise({ f0: 600, dur: 0.06, vol: 0.12 * p }); },
    crate() { for (let i = 0; i < 4; i++) noise({ t: i * 0.035, type: 'bandpass', f0: 700 + Math.random() * 900, q: 3, dur: 0.09, vol: 0.45 }); tone({ type: 'triangle', f0: 180, f1: 90, dur: 0.15, vol: 0.2 }); },
    explosion(size = 1) {
      const d = 0.7 + size * 0.9;
      noise({ type: 'lowpass', f0: 1600 * Math.min(1.5, size + 0.3), f1: 60, dur: d, vol: Math.min(1, 0.6 + size * 0.3), attack: 0.004 });
      tone({ type: 'sine', f0: 90, f1: 28, dur: d * 0.9, vol: Math.min(1, 0.5 + size * 0.3) });
      noise({ type: 'highpass', f0: 2500, dur: 0.12, vol: 0.3 });
    },
    nuke() {
      SFX.explosion(2.2);
      noise({ t: 0.25, type: 'lowpass', f0: 500, f1: 40, dur: 3.2, vol: 0.9, attack: 0.3 });
      tone({ t: 0.1, type: 'sine', f0: 50, f1: 22, dur: 3, vol: 0.8, attack: 0.2 });
    },
    blackhole() {
      tone({ type: 'sawtooth', f0: 900, f1: 40, dur: 1.8, vol: 0.18, filter: { type: 'lowpass', f: 1200 } });
      tone({ type: 'sine', f0: 60, f1: 30, dur: 1.9, vol: 0.4, attack: 0.3 });
    },
    headshot() { [1760, 2637, 3520].forEach((f, i) => tone({ type: 'sine', f0: f, dur: 0.5 - i * 0.1, vol: 0.12, t: 0.01 * i })); },
    coin() { tone({ type: 'square', f0: 988, dur: 0.08, vol: 0.12, filter: { type: 'lowpass', f: 4000 } }); tone({ type: 'square', f0: 1319, t: 0.07, dur: 0.22, vol: 0.12, filter: { type: 'lowpass', f: 4000 } }); },
    buy() { SFX.coin(); [1568, 2093, 2637].forEach((f, i) => tone({ type: 'triangle', f0: f, t: 0.18 + i * 0.06, dur: 0.18, vol: 0.1 })); },
    turn() { tone({ type: 'triangle', f0: 587, dur: 0.1, vol: 0.14 }); tone({ type: 'triangle', f0: 880, t: 0.1, dur: 0.16, vol: 0.14 }); },
    vs() { noise({ type: 'lowpass', f0: 3000, f1: 150, dur: 0.6, vol: 0.6 }); tone({ type: 'sawtooth', f0: 110, f1: 55, dur: 0.6, vol: 0.3, filter: { type: 'lowpass', f: 800 } }); },
    fall() { tone({ type: 'triangle', f0: 900, f1: 180, dur: 1.1, vol: 0.18 }); },
    splash() { noise({ type: 'highpass', f0: 800, f1: 3000, dur: 0.5, vol: 0.5 }); noise({ type: 'lowpass', f0: 600, dur: 0.4, vol: 0.4 }); },
    ko() { tone({ type: 'square', f0: 392, dur: 0.12, vol: 0.14, filter: { type: 'lowpass', f: 2000 } }); tone({ type: 'square', f0: 311, t: 0.12, dur: 0.12, vol: 0.14, filter: { type: 'lowpass', f: 2000 } }); tone({ type: 'square', f0: 233, t: 0.24, dur: 0.4, vol: 0.14, filter: { type: 'lowpass', f: 2000 } }); },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f0: f, t: i * 0.11, dur: 0.3, vol: 0.2 }));
      [523, 659, 784, 1047, 1319].forEach((f) => tone({ type: 'square', f0: f, t: 0.5, dur: 0.9, vol: 0.05, filter: { type: 'lowpass', f: 3000 } }));
    },
    lose() { [392, 349, 311, 262].forEach((f, i) => tone({ type: 'sawtooth', f0: f, f1: f * 0.97, t: i * 0.22, dur: 0.3, vol: 0.12, filter: { type: 'lowpass', f: 1400 } })); },
    fuse() { noise({ type: 'highpass', f0: 4000, dur: 0.05, vol: 0.05 }); },
  };
  function play(name, arg) { if (!ctx || muted) return; const f = SFX[name]; if (f) f(arg); }

  /* ---------------- music sequencer ---------------- */
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi → Hz
  const TRACKS = {
    menu: {
      bpm: 96,
      chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], // Am F C G
      step(b, time, spb) {
        const bar = Math.floor(b / 8) % 4, s = b % 8, ch = this.chords[bar];
        if (s === 0) ch.forEach((n) => tone({ type: 'triangle', f0: N(n), t: time, dur: spb * 8, vol: 0.05, attack: 0.3, bus: musicBus }));
        if (s === 0 || s === 4) tone({ type: 'sine', f0: N(ch[0] - 12), t: time, dur: spb * 3.5, vol: 0.16, bus: musicBus });
        const arp = [0, 1, 2, 1, 2, 0, 1, 2][s];
        tone({ type: 'sine', f0: N(ch[arp] + 12), t: time, dur: spb * 0.9, vol: 0.05, bus: musicBus });
        if (s % 2 === 1) noise({ t: time, type: 'highpass', f0: 7000, dur: 0.04, vol: 0.03, bus: musicBus });
      },
    },
    battle: {
      bpm: 132,
      roots: [45, 45, 41, 43], // A A F G
      lead: [76, null, 72, 74, 76, null, 79, 76, 74, null, 72, 69, 72, null, 74, null],
      step(b, time, spb) {
        const s = b % 16, bar = Math.floor(b / 16) % 4, root = this.roots[bar];
        // drums
        if (s % 4 === 0) { tone({ type: 'sine', f0: 150, f1: 40, t: time, dur: 0.18, vol: 0.45, bus: musicBus }); }
        if (s % 8 === 4) noise({ t: time, type: 'bandpass', f0: 1800, q: 0.7, dur: 0.14, vol: 0.22, bus: musicBus });
        if (s % 2 === 1) noise({ t: time, type: 'highpass', f0: 8000, dur: 0.03, vol: 0.05, bus: musicBus });
        // bass
        const bn = root - 12 + (s % 4 === 3 ? 12 : 0);
        tone({ type: 'square', f0: N(bn), t: time, dur: spb * 0.8, vol: 0.07, bus: musicBus, filter: { type: 'lowpass', f: 700 } });
        // lead (every other loop to breathe)
        const loop = Math.floor(b / 64) % 2;
        const ln = this.lead[s];
        if (loop === 1 && ln) tone({ type: 'square', f0: N(ln + (root - 45)), t: time, dur: spb * 1.6, vol: 0.035, bus: musicBus, filter: { type: 'lowpass', f: 2600 } });
        if (loop === 0 && s % 4 === 2) tone({ type: 'triangle', f0: N(root + 24 + [0, 7, 12, 7][bar]), t: time, dur: spb, vol: 0.04, bus: musicBus });
      },
    },
  };
  let cur = null, beat = 0, nextTime = 0, timer = null;
  function startMusic(name) {
    init();
    if (!ctx) return;
    if (cur === TRACKS[name]) return;
    stopMusic();
    cur = TRACKS[name];
    beat = 0; nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }
  function schedule() {
    if (!cur || !ctx) return;
    const spb = 60 / cur.bpm / 2; // eighth notes
    while (nextTime < ctx.currentTime + 0.15) {
      if (!muted && musicVol > 0.001) cur.step(beat, nextTime - ctx.currentTime, spb);
      nextTime += spb; beat++;
    }
  }
  function stopMusic() { clearInterval(timer); timer = null; cur = null; }

  return { unlock, play, setVolumes, toggleMute, isMuted, startMusic, stopMusic };
})();
