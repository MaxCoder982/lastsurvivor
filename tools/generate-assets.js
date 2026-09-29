#!/usr/bin/env node
/*
 * Last Survivor — asset generator.
 * Authors every 2D image and every pre-lit "3D" sprite used by the game as SVG.
 * Run:  node tools/generate-assets.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'assets');
let count = 0;
function out(rel, svg) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, svg.trim() + '\n');
  count++;
}
const svg = (w, h, body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${extra}>${body}</svg>`;

// Deterministic PRNG so the art is reproducible.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const r1 = (v) => Math.round(v * 10) / 10;

/* ------------------------------------------------------------------ */
/* Backgrounds                                                         */
/* ------------------------------------------------------------------ */
function ridge(rand, w, baseY, amp, step, jag) {
  let d = `M0 ${baseY}`;
  for (let x = 0; x <= w; x += step) {
    const y = baseY - amp * (0.5 + 0.5 * Math.sin(x / (step * 2.3) + rand() * jag)) - rand() * amp * 0.35;
    d += ` L${x} ${r1(y)}`;
  }
  return d + ` L${w} 1080 L0 1080 Z`;
}
function hills(rand, w, baseY, amp, n) {
  let d = `M0 ${baseY}`;
  const seg = w / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * seg, cx = x0 + seg / 2, x1 = x0 + seg;
    const top = baseY - amp * (0.6 + rand() * 0.6);
    d += ` Q${r1(cx)} ${r1(top)} ${r1(x1)} ${r1(baseY - rand() * amp * 0.2)}`;
  }
  return d + ` L${w} 1080 L0 1080 Z`;
}
function clouds(rand, n, color, opacity) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = rand() * 1920, y = 80 + rand() * 300, k = 0.6 + rand() * 0.9;
    s += `<g opacity="${opacity}" fill="${color}" transform="translate(${r1(x)} ${r1(y)}) scale(${r1(k)})">
      <ellipse cx="0" cy="0" rx="90" ry="34"/><ellipse cx="-50" cy="8" rx="60" ry="26"/>
      <ellipse cx="55" cy="10" rx="70" ry="24"/><ellipse cx="10" cy="-22" rx="52" ry="34"/></g>`;
  }
  return s;
}
function stars(rand, n) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = rand() * 1920, y = rand() * 650, rr = rand() * 1.8 + 0.4;
    s += `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r1(rr)}" fill="#fff" opacity="${r1(0.3 + rand() * 0.7)}"/>`;
  }
  return s;
}

const BG = {
  meadow() {
    const R = rng(11);
    return svg(1920, 1080, `
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#3fa9f5"/><stop offset="0.6" stop-color="#9ed8ff"/><stop offset="1" stop-color="#e7f7ff"/></linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#fffbe0"/><stop offset="0.35" stop-color="#fff2a8"/><stop offset="1" stop-color="#fff2a8" stop-opacity="0"/></radialGradient>
      </defs>
      <rect width="1920" height="1080" fill="url(#sky)"/>
      <circle cx="1500" cy="190" r="230" fill="url(#sun)"/>
      <circle cx="1500" cy="190" r="70" fill="#fffbe6"/>
      ${clouds(R, 7, '#ffffff', 0.9)}
      <path d="${ridge(R, 1920, 640, 260, 60, 3)}" fill="#8fb8d8"/>
      <path d="${ridge(R, 1920, 700, 170, 45, 2)}" fill="#6f9fc2" opacity="0.85"/>
      <path d="${hills(R, 1920, 820, 150, 6)}" fill="#7cc36a"/>
      <path d="${hills(R, 1920, 900, 120, 5)}" fill="#5aa94f"/>
      <path d="${hills(R, 1920, 990, 90, 7)}" fill="#3f8f3d"/>`);
  },
  desert() {
    const R = rng(22);
    let mesas = '';
    for (let i = 0; i < 5; i++) {
      const x = 80 + i * 400 + R() * 120, w = 160 + R() * 200, h = 160 + R() * 180;
      mesas += `<path d="M${r1(x)} 760 L${r1(x + 30)} ${r1(760 - h)} L${r1(x + w - 30)} ${r1(760 - h)} L${r1(x + w)} 760 Z" fill="#c9603f"/>
        <rect x="${r1(x + 30)}" y="${r1(760 - h)}" width="${r1(w - 60)}" height="14" fill="#e98a5a"/>`;
    }
    return svg(1920, 1080, `
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5b3a8c"/><stop offset="0.45" stop-color="#f06a6a"/><stop offset="0.8" stop-color="#ffb46b"/><stop offset="1" stop-color="#ffd89a"/></linearGradient>
      <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff3c4"/><stop offset="0.3" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff9b5a" stop-opacity="0"/></radialGradient></defs>
      <rect width="1920" height="1080" fill="url(#sky)"/>
      <circle cx="560" cy="600" r="320" fill="url(#sun)"/>
      <circle cx="560" cy="600" r="110" fill="#fff0bd"/>
      ${clouds(R, 4, '#ffd0b0', 0.5)}
      ${mesas}
      <path d="${hills(R, 1920, 860, 110, 4)}" fill="#e7a15e"/>
      <path d="${hills(R, 1920, 960, 90, 5)}" fill="#d98a48"/>
      <path d="${hills(R, 1920, 1030, 60, 6)}" fill="#c47436"/>`);
  },
  snow() {
    const R = rng(33);
    let peaks = '', pines = '', flakes = '';
    for (let i = 0; i < 6; i++) {
      const x = -100 + i * 380 + R() * 80, h = 330 + R() * 220, w = 520;
      peaks += `<path d="M${r1(x)} 760 L${r1(x + w / 2)} ${r1(760 - h)} L${r1(x + w)} 760 Z" fill="#8aa6c8"/>
        <path d="M${r1(x + w / 2 - 70)} ${r1(760 - h + 90)} L${r1(x + w / 2)} ${r1(760 - h)} L${r1(x + w / 2 + 70)} ${r1(760 - h + 90)} L${r1(x + w / 2 + 30)} ${r1(760 - h + 70)} L${r1(x + w / 2)} ${r1(760 - h + 100)} L${r1(x + w / 2 - 30)} ${r1(760 - h + 70)} Z" fill="#f4f9ff"/>`;
    }
    for (let i = 0; i < 40; i++) {
      const x = R() * 1920, y = 860 + R() * 60, s = 40 + R() * 60;
      pines += `<path d="M${r1(x)} ${r1(y - s * 1.8)} L${r1(x + s * 0.45)} ${r1(y)} L${r1(x - s * 0.45)} ${r1(y)} Z" fill="#2f5d62"/>`;
    }
    for (let i = 0; i < 120; i++) flakes += `<circle cx="${r1(R() * 1920)}" cy="${r1(R() * 1080)}" r="${r1(1 + R() * 3)}" fill="#fff" opacity="${r1(0.4 + R() * 0.6)}"/>`;
    return svg(1920, 1080, `
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#6f8fbf"/><stop offset="0.6" stop-color="#b9cfe8"/><stop offset="1" stop-color="#e9f2fb"/></linearGradient></defs>
      <rect width="1920" height="1080" fill="url(#sky)"/>
      ${clouds(R, 5, '#eef4fb', 0.7)}
      ${peaks}
      <path d="${hills(R, 1920, 900, 110, 5)}" fill="#dfe9f5"/>
      ${pines}
      <path d="${hills(R, 1920, 1010, 70, 6)}" fill="#f5f9ff"/>
      ${flakes}`);
  },
  night() {
    const R = rng(44);
    let city = '', windows = '';
    let x = 0;
    while (x < 1920) {
      const w = 70 + R() * 110, h = 180 + R() * 380;
      city += `<rect x="${r1(x)}" y="${r1(900 - h)}" width="${r1(w)}" height="${r1(h + 200)}" fill="#1c2340"/>`;
      for (let wy = 900 - h + 20; wy < 880; wy += 28)
        for (let wx = x + 10; wx < x + w - 14; wx += 22)
          if (R() < 0.35) windows += `<rect x="${r1(wx)}" y="${r1(wy)}" width="10" height="14" fill="${R() < 0.7 ? '#ffd86b' : '#8fe3ff'}" opacity="${r1(0.5 + R() * 0.5)}"/>`;
      x += w + 6;
    }
    let far = '';
    x = 0;
    while (x < 1920) {
      const w = 60 + R() * 90, h = 260 + R() * 320;
      far += `<rect x="${r1(x)}" y="${r1(820 - h)}" width="${r1(w)}" height="${r1(h + 300)}" fill="#2c3563"/>`;
      x += w + 2;
    }
    return svg(1920, 1080, `
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#070b24"/><stop offset="0.6" stop-color="#1b2257"/><stop offset="1" stop-color="#5a3a7a"/></linearGradient>
        <radialGradient id="moon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#9fb4ff" stop-opacity="0"/></radialGradient></defs>
      <rect width="1920" height="1080" fill="url(#sky)"/>
      ${stars(R, 220)}
      <circle cx="380" cy="200" r="200" fill="url(#moon)"/>
      <circle cx="380" cy="200" r="72" fill="#f3f1ff"/>
      <circle cx="355" cy="185" r="14" fill="#d8d6ee"/><circle cx="405" cy="225" r="9" fill="#d8d6ee"/>
      ${far}${city}${windows}
      <rect y="1000" width="1920" height="80" fill="#10142b"/>`);
  },
  volcano() {
    const R = rng(55);
    let ash = '';
    for (let i = 0; i < 90; i++) ash += `<circle cx="${r1(R() * 1920)}" cy="${r1(R() * 900)}" r="${r1(1 + R() * 3)}" fill="${R() < 0.5 ? '#ff8a3d' : '#ffcf6b'}" opacity="${r1(0.3 + R() * 0.6)}"/>`;
    return svg(1920, 1080, `
      <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#1a0b12"/><stop offset="0.55" stop-color="#5a1620"/><stop offset="1" stop-color="#c2412a"/></linearGradient>
        <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb347" stop-opacity="0.9"/><stop offset="1" stop-color="#ff4d1a" stop-opacity="0"/></radialGradient>
        <linearGradient id="lava" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd05a"/><stop offset="1" stop-color="#ff3b1a"/></linearGradient></defs>
      <rect width="1920" height="1080" fill="url(#sky)"/>
      <ellipse cx="1180" cy="330" rx="420" ry="260" fill="url(#glow)"/>
      <path d="M1180 350 C1100 250 1000 200 900 120 C1050 170 1150 160 1180 60 C1220 170 1320 150 1460 110 C1350 200 1260 260 1180 350Z" fill="#3a2a2e" opacity="0.8"/>
      <path d="M700 820 L1080 360 L1280 360 L1700 820 Z" fill="#3b1c1f"/>
      <path d="M1080 360 L1280 360 L1250 400 L1200 380 L1150 420 L1110 390 Z" fill="url(#lava)"/>
      <path d="M1150 420 C1140 520 1180 600 1120 700 C1110 760 1150 800 1140 820 L1170 820 C1180 760 1150 700 1190 610 C1220 520 1180 470 1200 380 Z" fill="url(#lava)" opacity="0.9"/>
      <path d="${ridge(R, 1920, 860, 160, 50, 2)}" fill="#2a1216"/>
      <path d="${hills(R, 1920, 1000, 80, 6)}" fill="#1a0a0d"/>
      ${ash}`);
  },
  menu() {
    const R = rng(66);
    let rays = '';
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * Math.PI * 2, a1 = a0 + Math.PI / 24;
      rays += `<path d="M960 1180 L${r1(960 + Math.cos(a0) * 2600)} ${r1(1180 + Math.sin(a0) * 2600)} L${r1(960 + Math.cos(a1) * 2600)} ${r1(1180 + Math.sin(a1) * 2600)} Z" fill="#ffffff" opacity="0.05"/>`;
    }
    let debris = '';
    for (let i = 0; i < 26; i++) {
      const x = R() * 1920, y = R() * 900, s = 8 + R() * 22, rot = R() * 360;
      debris += `<rect x="${r1(-s / 2)}" y="${r1(-s / 2)}" width="${r1(s)}" height="${r1(s)}" rx="3" fill="${['#ffcc33', '#ff5a5f', '#32e0c4', '#ffffff'][i % 4]}" opacity="${r1(0.25 + R() * 0.35)}" transform="translate(${r1(x)} ${r1(y)}) rotate(${r1(rot)})"/>`;
    }
    return svg(1920, 1080, `
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#16123a"/><stop offset="0.55" stop-color="#3b1f6e"/><stop offset="1" stop-color="#0d6a78"/></linearGradient>
        <radialGradient id="boom" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffe08a"/><stop offset="0.4" stop-color="#ff7a3d" stop-opacity="0.7"/><stop offset="1" stop-color="#ff3d6e" stop-opacity="0"/></radialGradient></defs>
      <rect width="1920" height="1080" fill="url(#bg)"/>
      ${rays}
      <circle cx="960" cy="1000" r="520" fill="url(#boom)" opacity="0.55"/>
      ${debris}
      <path d="M0 960 Q480 900 960 950 T1920 930 L1920 1080 L0 1080Z" fill="#0b0a1f" opacity="0.85"/>`);
  },
};

/* ------------------------------------------------------------------ */
/* UI icons (24x24 grid, white glyphs, tinted via CSS container)       */
/* ------------------------------------------------------------------ */
const ic = (body) => svg(48, 48, `<g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${body}</g>`);
const ICONS = {
  pause: ic(`<rect x="12" y="10" width="7" height="28" rx="2" fill="#fff" stroke="none"/><rect x="29" y="10" width="7" height="28" rx="2" fill="#fff" stroke="none"/>`),
  play: ic(`<path d="M15 9 L38 24 L15 39 Z" fill="#fff"/>`),
  restart: ic(`<path d="M38 24 A14 14 0 1 1 33.9 14.1"/><path d="M36 6 L35 15 L26 14"/>`),
  home: ic(`<path d="M8 23 L24 9 L40 23"/><path d="M13 20 V39 H35 V20"/><path d="M21 39 V29 H27 V39"/>`),
  gear: ic(`<circle cx="24" cy="24" r="6"/><path d="M24 5 V11 M24 37 V43 M5 24 H11 M37 24 H43 M10.6 10.6 L14.8 14.8 M33.2 33.2 L37.4 37.4 M10.6 37.4 L14.8 33.2 M33.2 14.8 L37.4 10.6"/><circle cx="24" cy="24" r="13"/>`),
  fullscreen: ic(`<path d="M8 17 V8 H17 M31 8 H40 V17 M40 31 V40 H31 M17 40 H8 V31"/>`),
  'fullscreen-exit': ic(`<path d="M17 8 V17 H8 M40 17 H31 V8 M31 40 V31 H40 M8 31 H17 V40"/>`),
  'sound-on': ic(`<path d="M8 18 H15 L25 9 V39 L15 30 H8 Z" fill="#fff"/><path d="M31 17 Q35 24 31 31 M36 12 Q43 24 36 36"/>`),
  'sound-off': ic(`<path d="M8 18 H15 L25 9 V39 L15 30 H8 Z" fill="#fff"/><path d="M32 18 L42 30 M42 18 L32 30"/>`),
  music: ic(`<path d="M18 36 V11 L38 7 V32"/><circle cx="13" cy="36" r="5" fill="#fff"/><circle cx="33" cy="32" r="5" fill="#fff"/>`),
  back: ic(`<path d="M28 10 L14 24 L28 38"/>`),
  close: ic(`<path d="M12 12 L36 36 M36 12 L12 36"/>`),
  lock: ic(`<rect x="11" y="21" width="26" height="19" rx="4" fill="#fff"/><path d="M16 21 V15 A8 8 0 0 1 32 15 V21"/>`),
  cards: ic(`<rect x="7" y="12" width="18" height="26" rx="3" transform="rotate(-12 16 25)"/><rect x="22" y="10" width="18" height="26" rx="3" fill="#fff" transform="rotate(10 31 23)"/>`),
  hero: ic(`<circle cx="24" cy="14" r="7"/><path d="M24 21 V33 M24 33 L16 43 M24 33 L32 43 M12 25 L24 24 L36 25"/>`),
  help: ic(`<circle cx="24" cy="24" r="17"/><path d="M18.5 19 A5.5 5.5 0 1 1 24 25 V28"/><circle cx="24" cy="34" r="1.5" fill="#fff"/>`),
  check: ic(`<path d="M10 25 L20 35 L38 13"/>`),
  heart: svg(48, 48, `<path d="M24 41 C8 30 4 21 8 14 C12 7 21 8 24 15 C27 8 36 7 40 14 C44 21 40 30 24 41Z" fill="#ff4d6d" stroke="#8a1030" stroke-width="2.5"/><ellipse cx="15" cy="17" rx="4" ry="2.5" fill="#fff" opacity="0.6" transform="rotate(-30 15 17)"/>`),
  coin: svg(48, 48, `<defs><radialGradient id="g" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff6b0"/><stop offset="0.5" stop-color="#ffcc33"/><stop offset="1" stop-color="#d98a00"/></radialGradient></defs>
    <circle cx="24" cy="24" r="20" fill="#a86400"/><circle cx="24" cy="22" r="20" fill="url(#g)"/><circle cx="24" cy="22" r="14" fill="none" stroke="#c77d00" stroke-width="2.5"/>
    <path d="M20 14 H28 L24 30 Z M24 30 L20 14" fill="#e59a00"/><path d="M19 15 L24 29 L29 15" fill="none" stroke="#fff3b0" stroke-width="2"/>`),
  trophy: svg(48, 48, `<defs><linearGradient id="t" x1="0" x2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="0.5" stop-color="#ffc21a"/><stop offset="1" stop-color="#d98a00"/></linearGradient></defs>
    <path d="M12 8 C4 8 4 20 14 22 M36 8 C44 8 44 20 34 22" fill="none" stroke="#d98a00" stroke-width="3.5"/>
    <path d="M12 6 H36 V16 C36 26 30 30 24 30 C18 30 12 26 12 16 Z" fill="url(#t)"/><rect x="21" y="29" width="6" height="7" fill="#d98a00"/><rect x="14" y="36" width="20" height="6" rx="2" fill="url(#t)"/>`),
  star: svg(48, 48, `<path d="M24 4 L29.5 17 L43.5 18 L32.8 27.2 L36.2 41 L24 33.5 L11.8 41 L15.2 27.2 L4.5 18 L18.5 17 Z" fill="#ffcf33" stroke="#b36b00" stroke-width="2.5" stroke-linejoin="round"/><path d="M17 20 L22 19" stroke="#fff6c2" stroke-width="3" stroke-linecap="round"/>`),
  skull: svg(48, 48, `<path d="M24 5 C13 5 7 12 7 21 C7 27 10 30 13 32 V39 H35 V32 C38 30 41 27 41 21 C41 12 35 5 24 5Z" fill="#f4f4f4" stroke="#222" stroke-width="2.5"/><circle cx="17" cy="21" r="5" fill="#222"/><circle cx="31" cy="21" r="5" fill="#222"/><path d="M24 26 L21 31 H27Z" fill="#222"/><path d="M19 35 V39 M24 35 V39 M29 35 V39" stroke="#222" stroke-width="2"/>`),
};

/* Emblem shown above the title on the main menu */
const EMBLEM = svg(320, 320, `
  <defs>
    <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffdf4d"/><stop offset="1" stop-color="#ff7a1a"/></linearGradient>
    <linearGradient id="in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1a5c"/><stop offset="1" stop-color="#120a2e"/></linearGradient>
  </defs>
  <path d="M160 14 L284 60 C284 170 240 250 160 304 C80 250 36 170 36 60 Z" fill="#1b0f3a"/>
  <path d="M160 26 L272 68 C270 166 230 238 160 288 C90 238 50 166 48 68 Z" fill="url(#sh)"/>
  <path d="M160 46 L252 81 C249 162 216 222 160 264 C104 222 71 162 68 81 Z" fill="url(#in)"/>
  <g stroke="#fff" stroke-width="13" stroke-linecap="round" fill="none">
    <circle cx="160" cy="102" r="20" fill="#fff" stroke="none"/>
    <path d="M160 124 L160 184 M160 184 L130 232 M160 184 L190 232 M160 140 L118 110 M160 140 L204 104"/>
  </g>
  <path d="M204 104 L226 70" stroke="#ffcf33" stroke-width="9" stroke-linecap="round"/>
  <circle cx="232" cy="62" r="13" fill="#ff4d4d" stroke="#fff" stroke-width="4"/>
  <path d="M100 250 L220 250" stroke="#ffcf33" stroke-width="6" stroke-linecap="round" opacity="0.7"/>`);

/* ------------------------------------------------------------------ */
/* Hats (100x100; head centre at 50,70 with head radius 22)            */
/* ------------------------------------------------------------------ */
const HATS = {
  cap: `<path d="M27 64 C27 40 73 40 73 64 Z" fill="#e63946"/><path d="M70 60 C84 60 94 64 96 68 L70 67Z" fill="#b71c2b"/><circle cx="50" cy="44" r="3" fill="#b71c2b"/><rect x="27" y="61" width="46" height="5" fill="#fff" opacity="0.35"/>`,
  helmet: `<path d="M24 70 C24 32 76 32 76 70 L70 70 C70 44 30 44 30 70Z" fill="#556b2f"/><path d="M22 70 C22 30 78 30 78 70 L78 64 C78 36 22 36 22 64Z" fill="#6b8e23"/><rect x="18" y="64" width="64" height="8" rx="4" fill="#4a5d23"/><path d="M34 50 L66 44" stroke="#8fae4a" stroke-width="3" opacity="0.6"/>`,
  crown: `<path d="M28 58 L28 36 L39 48 L50 30 L61 48 L72 36 L72 58 Z" fill="#ffcc1a" stroke="#b37700" stroke-width="2.5" stroke-linejoin="round"/><circle cx="50" cy="48" r="4" fill="#e63946"/><circle cx="37" cy="53" r="3" fill="#2a9df4"/><circle cx="63" cy="53" r="3" fill="#2a9df4"/><circle cx="28" cy="35" r="3" fill="#ffe680"/><circle cx="50" cy="29" r="3" fill="#ffe680"/><circle cx="72" cy="35" r="3" fill="#ffe680"/>`,
  ninja: `<rect x="26" y="58" width="48" height="9" rx="3" fill="#1d1d1d"/><path d="M26 62 L10 56 L12 66 Z M26 63 L8 70 L14 74Z" fill="#1d1d1d"/><rect x="44" y="59" width="12" height="7" rx="1" fill="#c0c0c0"/>`,
  wizard: `<path d="M22 64 L50 4 L60 30 L78 64 Z" fill="#3d2c8d"/><path d="M50 4 L60 30 L66 26 Z" fill="#2a1d66"/><ellipse cx="50" cy="64" rx="34" ry="7" fill="#2a1d66"/><path d="M44 30 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1Z" fill="#ffd84d"/><circle cx="58" cy="48" r="2.5" fill="#ffd84d"/>`,
  cowboy: `<ellipse cx="50" cy="60" rx="44" ry="9" fill="#8b5a2b"/><path d="M30 60 C28 36 38 34 50 40 C62 34 72 36 70 60Z" fill="#a0522d"/><rect x="30" y="52" width="40" height="6" fill="#5c3317"/>`,
  viking: `<path d="M26 66 C26 38 74 38 74 66Z" fill="#9aa4ad"/><rect x="47" y="40" width="6" height="26" fill="#7d868f"/><path d="M28 56 C14 50 10 36 14 24 C18 36 24 42 32 46Z" fill="#f3e9d2" stroke="#b8a882" stroke-width="2"/><path d="M72 56 C86 50 90 36 86 24 C82 36 76 42 68 46Z" fill="#f3e9d2" stroke="#b8a882" stroke-width="2"/><rect x="24" y="62" width="52" height="6" rx="3" fill="#6b7680"/>`,
  tophat: `<rect x="34" y="18" width="32" height="40" rx="3" fill="#1f1f1f"/><rect x="34" y="46" width="32" height="7" fill="#c1121f"/><ellipse cx="50" cy="60" rx="30" ry="6" fill="#111"/>`,
  halo: `<ellipse cx="50" cy="34" rx="22" ry="6" fill="none" stroke="#ffe066" stroke-width="5"/><ellipse cx="50" cy="34" rx="22" ry="6" fill="none" stroke="#fff8c4" stroke-width="1.5"/>`,
  chef: `<rect x="32" y="48" width="36" height="16" fill="#fafafa" stroke="#ddd" stroke-width="2"/><circle cx="36" cy="40" r="11" fill="#fff"/><circle cx="50" cy="32" r="13" fill="#fff"/><circle cx="64" cy="40" r="11" fill="#fff"/><path d="M40 52 V62 M50 52 V62 M60 52 V62" stroke="#e5e5e5" stroke-width="2"/>`,
  pirate: `<path d="M18 60 C22 36 40 34 50 42 C60 34 78 36 82 60 C66 54 34 54 18 60Z" fill="#222"/><circle cx="50" cy="49" r="5" fill="#fff"/><path d="M46 55 L54 55" stroke="#fff" stroke-width="2"/><path d="M24 66 L76 76" stroke="#222" stroke-width="3"/><ellipse cx="59" cy="73" rx="7" ry="5" fill="#222"/>`,
  astronaut: `<circle cx="50" cy="70" r="30" fill="#bde6ff" opacity="0.35" stroke="#e8f6ff" stroke-width="4"/><path d="M30 58 A24 24 0 0 1 58 46" stroke="#fff" stroke-width="4" fill="none" opacity="0.8" stroke-linecap="round"/><rect x="26" y="94" width="48" height="6" rx="3" fill="#dfe6ee"/>`,
  party: `<path d="M34 60 L50 18 L66 60Z" fill="#ff5ca8"/><path d="M40 45 L60 45 M37 53 L63 53 M44 33 L56 33" stroke="#ffe14d" stroke-width="4"/><circle cx="50" cy="16" r="6" fill="#4dd8ff"/>`,
  headphones: `<path d="M24 70 C24 36 76 36 76 70" fill="none" stroke="#222" stroke-width="6"/><rect x="18" y="62" width="12" height="20" rx="5" fill="#00c2a8"/><rect x="70" y="62" width="12" height="20" rx="5" fill="#00c2a8"/>`,
  bandana: `<path d="M27 60 C27 44 73 44 73 60 L73 64 L27 64Z" fill="#e63946"/><circle cx="40" cy="54" r="2" fill="#fff"/><circle cx="55" cy="50" r="2" fill="#fff"/><circle cx="64" cy="57" r="2" fill="#fff"/><path d="M27 62 L12 58 L16 70Z" fill="#c1121f"/>`,
  horns: `<path d="M34 54 C28 44 28 32 34 24 C36 36 40 44 44 50Z" fill="#b3001b"/><path d="M66 54 C72 44 72 32 66 24 C64 36 60 44 56 50Z" fill="#b3001b"/>`,
};

/* ------------------------------------------------------------------ */
/* Pre-lit "3D" weapon & prop sprites (100x100, lit from top-left)     */
/* ------------------------------------------------------------------ */
const sphere = (id, c0, c1, c2) =>
  `<radialGradient id="${id}" cx="0.35" cy="0.3" r="0.75"><stop offset="0" stop-color="${c0}"/><stop offset="0.55" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
const lin = (id, a, b, v = true) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${v ? 0 : 1}" y2="${v ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const shadowF = `<filter id="ds" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/></filter>`;

const WEAPONS = {
  rock: `<defs>${sphere('g', '#c9c3b8', '#8d867b', '#4e4a44')}${shadowF}</defs>
    <path filter="url(#ds)" d="M22 52 L30 28 L55 18 L78 30 L84 56 L70 78 L40 82 L22 68Z" fill="url(#g)"/>
    <path d="M30 28 L55 18 L60 34 L38 40Z" fill="#fff" opacity="0.18"/><path d="M52 60 L70 78 L40 82Z" fill="#000" opacity="0.15"/>`,
  brick: `<defs>${lin('g', '#e0714f', '#9c3b22')}${shadowF}</defs>
    <g filter="url(#ds)"><path d="M14 40 L70 30 L88 44 L32 56Z" fill="#f28a67"/><path d="M14 40 L32 56 L32 76 L14 60Z" fill="#8a3219"/><path d="M32 56 L88 44 L88 64 L32 76Z" fill="url(#g)"/></g>
    <circle cx="44" cy="44" r="4" fill="#9c3b22" opacity="0.6"/><circle cx="62" cy="40" r="4" fill="#9c3b22" opacity="0.6"/>`,
  grenade: `<defs>${sphere('g', '#9fc46b', '#4f7a2a', '#243b10')}${shadowF}</defs>
    <g filter="url(#ds)"><ellipse cx="50" cy="58" rx="28" ry="32" fill="url(#g)"/>
    <path d="M24 50 H76 M24 64 H76 M40 28 V88 M60 28 V88" stroke="#243b10" stroke-width="2.5" opacity="0.5"/>
    <rect x="40" y="18" width="20" height="12" rx="2" fill="#7a7f86"/><path d="M60 22 C74 18 80 30 70 36" stroke="#c9ced6" stroke-width="3.5" fill="none"/>
    <circle cx="70" cy="18" r="6" fill="none" stroke="#c9ced6" stroke-width="3"/></g>
    <ellipse cx="40" cy="44" rx="7" ry="4" fill="#fff" opacity="0.35"/>`,
  bowling: `<defs>${sphere('g', '#6f7cff', '#2b2f8f', '#0c0d33')}${shadowF}</defs>
    <circle filter="url(#ds)" cx="50" cy="50" r="38" fill="url(#g)"/>
    <circle cx="42" cy="36" r="5" fill="#070720"/><circle cx="56" cy="34" r="5" fill="#070720"/><circle cx="50" cy="48" r="5.5" fill="#070720"/>
    <ellipse cx="34" cy="30" rx="10" ry="5" fill="#fff" opacity="0.35" transform="rotate(-30 34 30)"/>`,
  dynamite: `<defs>${lin('g', '#ff5a4a', '#a3120a', false)}${shadowF}</defs>
    <g filter="url(#ds)" transform="rotate(-20 50 50)">
      <rect x="18" y="26" width="64" height="14" rx="7" fill="url(#g)"/><rect x="18" y="43" width="64" height="14" rx="7" fill="url(#g)"/><rect x="18" y="60" width="64" height="14" rx="7" fill="url(#g)"/>
      <rect x="40" y="22" width="10" height="56" fill="#3a2a1a"/><path d="M82 50 C92 46 92 36 96 30" stroke="#d9c49a" stroke-width="3" fill="none"/>
      <rect x="18" y="28" width="64" height="4" rx="2" fill="#fff" opacity="0.3"/></g>
    <circle cx="94" cy="22" r="5" fill="#ffd43b"/>`,
  rocket: `<defs>${lin('g', '#f2f4f7', '#9aa3ad')}${lin('n', '#ff6b5a', '#b3160b')}${shadowF}</defs>
    <g filter="url(#ds)"><path d="M14 38 L28 42 L28 58 L14 62 Z" fill="#b3160b"/>
    <rect x="24" y="40" width="50" height="20" rx="4" fill="url(#g)"/><path d="M74 40 C88 40 96 46 98 50 C96 54 88 60 74 60Z" fill="url(#n)"/>
    <path d="M30 40 L20 26 L40 40Z M30 60 L20 74 L40 60Z" fill="#e63946"/><circle cx="56" cy="50" r="5" fill="#4dabf7" stroke="#1c4f82" stroke-width="2"/>
    <rect x="24" y="41" width="50" height="4" fill="#fff" opacity="0.6"/></g>`,
  shotgun: `<defs>${lin('g', '#5a5f66', '#23262b')}${lin('w', '#b8743a', '#6b3d17')}${shadowF}</defs>
    <g filter="url(#ds)"><rect x="30" y="38" width="66" height="9" rx="2" fill="url(#g)"/><rect x="30" y="48" width="56" height="7" rx="2" fill="#2d3136"/>
    <rect x="50" y="54" width="22" height="7" rx="3" fill="url(#w)"/><path d="M6 44 L32 38 L36 58 L14 70 L4 62Z" fill="url(#w)"/><path d="M34 56 L40 66 L46 56" fill="none" stroke="#23262b" stroke-width="3"/></g>`,
  rifle: `<defs>${lin('g', '#4b5563', '#111827')}${shadowF}</defs>
    <g filter="url(#ds)"><rect x="24" y="38" width="52" height="14" rx="3" fill="url(#g)"/><rect x="74" y="42" width="24" height="5" fill="#111827"/>
    <path d="M44 52 L54 52 L50 76 L40 74Z" fill="#1f2937"/><path d="M60 52 L68 52 L70 64 L62 64Z" fill="#374151"/>
    <path d="M4 42 L26 38 L26 54 L10 62 L4 58Z" fill="#374151"/><rect x="36" y="30" width="24" height="7" rx="2" fill="#111827"/><rect x="24" y="39" width="52" height="3" fill="#9ca3af" opacity="0.5"/></g>`,
  bouncy: `<defs>${sphere('g', '#ffe3f1', '#ff4fa3', '#9c0057')}${shadowF}</defs>
    <circle filter="url(#ds)" cx="50" cy="50" r="30" fill="url(#g)"/><path d="M22 44 C40 56 62 56 78 42" stroke="#ffe14d" stroke-width="6" fill="none"/>
    <ellipse cx="40" cy="36" rx="9" ry="5" fill="#fff" opacity="0.5" transform="rotate(-30 40 36)"/>`,
  anvil: `<defs>${lin('g', '#8a929c', '#2e3338')}${shadowF}</defs>
    <g filter="url(#ds)"><path d="M8 30 L84 30 C90 30 96 34 96 38 L62 42 L62 56 L72 70 L72 80 L24 80 L24 70 L36 56 L36 42 L16 40 C10 38 8 34 8 30Z" fill="url(#g)"/>
    <rect x="8" y="30" width="80" height="4" fill="#d6dbe0" opacity="0.7"/></g>`,
  cluster: `<defs>${sphere('g', '#ffd9a0', '#ff8c1a', '#8a3b00')}${shadowF}</defs>
    <g filter="url(#ds)"><ellipse cx="50" cy="52" rx="30" ry="34" fill="url(#g)"/>
    <circle cx="40" cy="44" r="7" fill="#8a3b00" opacity="0.5"/><circle cx="60" cy="44" r="7" fill="#8a3b00" opacity="0.5"/><circle cx="50" cy="62" r="7" fill="#8a3b00" opacity="0.5"/>
    <rect x="42" y="12" width="16" height="10" rx="2" fill="#555"/></g><ellipse cx="38" cy="34" rx="8" ry="4" fill="#fff" opacity="0.4"/>`,
  bomblet: `<defs>${sphere('g', '#ffe0b0', '#ff7a00', '#7a2e00')}</defs><circle cx="50" cy="50" r="32" fill="url(#g)"/><ellipse cx="40" cy="38" rx="9" ry="5" fill="#fff" opacity="0.45"/>`,
  nuke: `<defs>${lin('g', '#fff27a', '#d9b300', false)}${lin('b', '#6b7280', '#374151')}${shadowF}</defs>
    <g filter="url(#ds)"><path d="M12 38 L26 44 L26 56 L12 62Z" fill="#374151"/><path d="M16 32 L30 44 L30 56 L16 68Z" fill="#4b5563"/>
    <path d="M26 36 L70 36 C88 36 98 44 98 50 C98 56 88 64 70 64 L26 64Z" fill="url(#g)"/>
    <circle cx="62" cy="50" r="9" fill="#111"/><path d="M62 50 L56 42 A10 10 0 0 1 68 42Z M62 50 L72 50 A10 10 0 0 1 66 58Z M62 50 L58 58 A10 10 0 0 1 52 50Z" fill="#ffe14d"/>
    <circle cx="62" cy="50" r="2" fill="#ffe14d"/><rect x="26" y="38" width="60" height="4" fill="#fff" opacity="0.5"/></g>`,
  blackhole: `<defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#000"/><stop offset="0.45" stop-color="#0b0020"/><stop offset="0.7" stop-color="#7b2cff"/><stop offset="0.85" stop-color="#ff5cf0" stop-opacity="0.8"/><stop offset="1" stop-color="#7b2cff" stop-opacity="0"/></radialGradient></defs>
    <circle cx="50" cy="50" r="46" fill="url(#g)"/><ellipse cx="50" cy="50" rx="44" ry="10" fill="none" stroke="#ffb3f7" stroke-width="3" opacity="0.8" transform="rotate(-25 50 50)"/>`,
  bullet: `<defs>${lin('g', '#ffe8a3', '#b8860b')}</defs><path d="M20 42 L66 42 C82 42 92 46 94 50 C92 54 82 58 66 58 L20 58Z" fill="url(#g)"/><rect x="14" y="42" width="10" height="16" fill="#8a6508"/>`,
  pellet: `<defs>${sphere('g', '#eeeeee', '#8c8c8c', '#333')}</defs><circle cx="50" cy="50" r="30" fill="url(#g)"/>`,
};

const PROPS = {
  crate: `<defs>${lin('g', '#e0a458', '#a8692b')}</defs>
    <rect x="2" y="2" width="96" height="96" rx="4" fill="#7a4a1c"/><rect x="8" y="8" width="84" height="84" fill="url(#g)"/>
    <path d="M8 8 L92 92 M92 8 L8 92" stroke="#7a4a1c" stroke-width="10"/><rect x="8" y="8" width="84" height="84" fill="none" stroke="#7a4a1c" stroke-width="6"/>
    <path d="M8 26 H92 M8 46 H92 M8 66 H92" stroke="#b97a3a" stroke-width="1.5" opacity="0.7"/>
    <circle cx="12" cy="12" r="3" fill="#3b2410"/><circle cx="88" cy="12" r="3" fill="#3b2410"/><circle cx="12" cy="88" r="3" fill="#3b2410"/><circle cx="88" cy="88" r="3" fill="#3b2410"/>
    <rect x="8" y="8" width="84" height="6" fill="#fff" opacity="0.18"/>`,
  barrel: `<defs>${lin('g', '#ff5a4a', '#8f0f06', false)}<linearGradient id="h" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0.35"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.35"/><stop offset="0.55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.4"/></linearGradient></defs>
    <rect x="14" y="4" width="72" height="92" rx="10" fill="#d62d20"/><rect x="14" y="4" width="72" height="92" rx="10" fill="url(#h)"/>
    <rect x="12" y="22" width="76" height="7" rx="3" fill="#6b0a04"/><rect x="12" y="71" width="76" height="7" rx="3" fill="#6b0a04"/>
    <path d="M50 36 L64 62 L36 62Z" fill="#ffd43b" stroke="#222" stroke-width="3" stroke-linejoin="round"/><rect x="48" y="44" width="4" height="10" fill="#222"/><circle cx="50" cy="58" r="2" fill="#222"/>
    <ellipse cx="50" cy="8" rx="34" ry="5" fill="#ff8a7f" opacity="0.6"/>`,
  steel: `<defs>${lin('g', '#b8c2cc', '#5b6670')}</defs><rect x="2" y="2" width="96" height="96" rx="6" fill="#3e464e"/><rect x="7" y="7" width="86" height="86" rx="4" fill="url(#g)"/>
    <circle cx="16" cy="16" r="4" fill="#3e464e"/><circle cx="84" cy="16" r="4" fill="#3e464e"/><circle cx="16" cy="84" r="4" fill="#3e464e"/><circle cx="84" cy="84" r="4" fill="#3e464e"/>
    <path d="M22 30 L78 30" stroke="#fff" stroke-width="3" opacity="0.4"/>`,
  tnt: `<defs>${lin('g', '#ff4d3d', '#a1130a')}</defs><rect x="4" y="10" width="92" height="84" rx="4" fill="url(#g)"/><rect x="4" y="38" width="92" height="28" fill="#f5f0e6"/>
    <text x="50" y="60" font-family="Arial Black,Arial" font-weight="900" font-size="22" text-anchor="middle" fill="#a1130a">TNT</text>
    <rect x="4" y="10" width="92" height="6" fill="#fff" opacity="0.25"/>`,
};

// Tiling textures for platform bodies (64x64)
const TILES = {
  meadow: { top: '#6ccf4f', a: '#8b5a2b', b: '#7a4d22', dot: '#a26d3a' },
  desert: { top: '#f2c46d', a: '#d9964e', b: '#c9843f', dot: '#eab069' },
  snow: { top: '#ffffff', a: '#7a8ba3', b: '#6b7c94', dot: '#9aabc2' },
  night: { top: '#5b6b8c', a: '#39415e', b: '#2f3650', dot: '#4a5478' },
  volcano: { top: '#ff6a2b', a: '#3a2426', b: '#2c1a1c', dot: '#5a3033' },
};
function tile(t, seed) {
  const R = rng(seed);
  let s = `<rect width="64" height="64" fill="${t.a}"/>`;
  s += `<path d="M0 32 H64 M32 0 V32 M0 0 H64 M16 32 V64 M48 32 V64" stroke="${t.b}" stroke-width="3"/>`;
  for (let i = 0; i < 8; i++) s += `<circle cx="${r1(R() * 64)}" cy="${r1(R() * 64)}" r="${r1(1 + R() * 2.2)}" fill="${t.dot}" opacity="0.8"/>`;
  return svg(64, 64, s);
}

/* ------------------------------------------------------------------ */
for (const [k, f] of Object.entries(BG)) out(`images/backgrounds/${k}.svg`, f());
for (const [k, v] of Object.entries(ICONS)) out(`images/ui/${k}.svg`, v);
out('images/ui/emblem.svg', EMBLEM);
for (const [k, v] of Object.entries(HATS)) out(`images/heroes/hat-${k}.svg`, svg(100, 100, v));
for (const [k, v] of Object.entries(WEAPONS)) out(`3d/weapons/${k}.svg`, svg(100, 100, v));
for (const [k, v] of Object.entries(PROPS)) out(`3d/props/${k}.svg`, svg(100, 100, v));
Object.entries(TILES).forEach(([k, t], i) => out(`3d/props/tile-${k}.svg`, tile(t, 100 + i)));
// Favicon
out('images/ui/favicon.svg', svg(64, 64, `<rect width="64" height="64" rx="14" fill="#2b1a5c"/><g stroke="#ffcf33" stroke-width="6" stroke-linecap="round" fill="none"><circle cx="32" cy="16" r="7" fill="#ffcf33" stroke="none"/><path d="M32 23 V42 L22 56 M32 42 L42 56 M32 29 L18 22 M32 29 L48 20"/></g>`));

console.log(`Generated ${count} assets in ${ROOT}`);
