/* ==========================================================================
   Last Survivor — 02 · utils.js
   Math helpers, seeded RNG, geometry, persistent save data, fullscreen.
   ========================================================================== */
'use strict';

LS.U = (() => {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  function seeded(seed) {
    let s = (seed * 2654435761) >>> 0 || 1;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function shuffle(arr, r = Math.random) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // Closest distance from point to segment, also returns t along the segment
  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy || 1;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
    const cx = ax + dx * t, cy = ay + dy * t;
    return { d: Math.hypot(px - cx, py - cy), t, cx, cy };
  }

  // Circle vs AABB. Returns penetration normal & depth or null.
  function circleRect(cx, cy, r, rc) {
    const nx = clamp(cx, rc.x, rc.x + rc.w), ny = clamp(cy, rc.y, rc.y + rc.h);
    let dx = cx - nx, dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;
    if (d2 > 1e-6) { const d = Math.sqrt(d2); return { nx: dx / d, ny: dy / d, depth: r - d }; }
    // centre inside rect: push out along the shallowest axis
    const l = cx - rc.x, rr = rc.x + rc.w - cx, t = cy - rc.y, b = rc.y + rc.h - cy;
    const m = Math.min(l, rr, t, b);
    if (m === t) return { nx: 0, ny: -1, depth: t + r };
    if (m === b) return { nx: 0, ny: 1, depth: b + r };
    if (m === l) return { nx: -1, ny: 0, depth: l + r };
    return { nx: 1, ny: 0, depth: rr + r };
  }

  const pointInRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

  /* ---------------- Save data ---------------- */
  const defaults = () => ({
    level: 1,
    coins: 0,
    hero: 'rookie',
    heroes: ['rookie'],
    weapons: LS.STARTER_WEAPONS.slice(),
    deck: LS.STARTER_WEAPONS.slice(),
    wins: 0,
    losses: 0,
    settings: { sfx: 0.8, music: 0.55, shake: true, guide: true, quality: 'high' },
  });
  let save = defaults();
  function load() {
    try {
      const raw = localStorage.getItem(LS.CONFIG.SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw), def = defaults();
        save = Object.assign(def, d);
        save.settings = Object.assign(def.settings, d.settings || {});
      }
    } catch (e) { /* storage unavailable: play with defaults */ }
    return save;
  }
  function persist() {
    try { localStorage.setItem(LS.CONFIG.SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
  }
  function reset() { save = defaults(); persist(); return save; }

  /* ---------------- Fullscreen ---------------- */
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function toggleFullscreen() {
    const el = document.documentElement;
    if (!isFullscreen()) {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) { const p = req.call(el); if (p && p.catch) p.catch(() => {}); }
    } else {
      const ex = document.exitFullscreen || document.webkitExitFullscreen;
      if (ex) { const p = ex.call(document); if (p && p.catch) p.catch(() => {}); }
    }
  }

  return {
    clamp, lerp, rand, randInt, pick, dist, easeOutBack, easeOutCubic, easeInOut, gauss, seeded, shuffle,
    segDist, circleRect, pointInRect,
    load, persist, reset, get save() { return save; },
    isFullscreen, toggleFullscreen,
  };
})();
