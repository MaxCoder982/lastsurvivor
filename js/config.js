/* ==========================================================================
   Last Survivor — 01 · config.js
   Global namespace, tuning constants and all static game data
   (weapons, heroes, themes, map templates).
   ========================================================================== */
'use strict';

window.LS = window.LS || {};

LS.CONFIG = {
  TITLE: 'Last Survivor',
  WORLD_W: 1600,
  WORLD_H: 900,
  GRAVITY: 1450,
  STEP: 1 / 120,            // fixed physics step
  MIN_SPEED: 380,
  MAX_SPEED: 1380,
  MAX_DRAG: 230,            // world units of slingshot pull for full power
  PLAYER_HP: 100,
  CARDS_PER_TURN: 3,
  DECK_SIZE: 8,
  DECK_MIN: 3,
  PIT_Y: 872,               // hazard surface
  DEATH_Y: 1020,            // anything below this is gone
  SAVE_KEY: 'last-survivor-save-v1',
};

LS.RARITY = {
  common: { label: 'Common', color: '#9aa7b8', glow: 'rgba(154,167,184,.55)' },
  rare:   { label: 'Rare',   color: '#3fa7ff', glow: 'rgba(63,167,255,.6)' },
  epic:   { label: 'Epic',   color: '#b45cff', glow: 'rgba(180,92,255,.6)' },
  mythic: { label: 'Mythic', color: '#ffb020', glow: 'rgba(255,176,32,.7)' },
};

/*
 * Weapon behaviours:
 *  solid     – physical object, damages on contact, bounces
 *  bouncy    – solid that keeps bouncing and may hit several times
 *  fuse      – bounces, explodes when its fuse runs out
 *  impact    – explodes on first contact
 *  spread    – fires a fan of pellets at once
 *  burst     – fires a sequence of bullets
 *  cluster   – splits into bomblets at the top of its arc
 *  blackhole – opens a singularity that drags everything in, then implodes
 */
LS.WEAPONS = {
  rock:     { name: 'Rock',         rarity: 'common', price: 0,    kind: 'solid',   size: 17, dmg: 14, knock: 0.55, bounce: 0.3,  grav: 1,    speed: 1,    spin: 6,  desc: 'A trusty rock. Simple and honest.' },
  brick:    { name: 'Brick',        rarity: 'common', price: 0,    kind: 'solid',   size: 19, dmg: 18, knock: 0.6,  bounce: 0.2,  grav: 1,    speed: 1,    spin: 9,  desc: 'Heavy, spinning, surprisingly rude.' },
  bouncy:   { name: 'Bouncy Ball',  rarity: 'common', price: 0,    kind: 'bouncy',  size: 15, dmg: 9,  knock: 0.45, bounce: 0.86, grav: 1,    speed: 1,    spin: 4,  hits: 4, desc: 'Bounces everywhere. Hits up to 4 times.' },
  grenade:  { name: 'Grenade',      rarity: 'common', price: 0,    kind: 'fuse',    size: 15, fuse: 2.1, bounce: 0.45, grav: 1, speed: 1, spin: 7, blast: { r: 125, dmg: 30, force: 900 }, desc: 'Bounces around, then goes boom.' },
  bowling:  { name: 'Bowling Ball', rarity: 'rare',   price: 0,    kind: 'solid',   size: 21, dmg: 24, knock: 1.0,  bounce: 0.12, grav: 1.1,  speed: 0.95, spin: 5,  desc: 'Massive knockback. Strike!' },
  dynamite: { name: 'Dynamite',     rarity: 'rare',   price: 0,    kind: 'impact',  size: 17, bounce: 0, grav: 1, speed: 1, spin: 8, blast: { r: 140, dmg: 32, force: 1000 }, desc: 'Explodes on contact.' },
  rocket:   { name: 'Rocket',       rarity: 'rare',   price: 0,    kind: 'impact',  size: 17, bounce: 0, grav: 0.32, speed: 1.08, spin: 0, align: true, trail: 'smoke', blast: { r: 120, dmg: 30, force: 950 }, desc: 'Flies flat and fast. Explodes on contact.' },
  shotgun:  { name: 'Shotgun',      rarity: 'rare',   price: 0,    kind: 'spread',  size: 6,  dmg: 7,  knock: 0.12, bounce: 0.2, grav: 0.22, speed: 1.55, spin: 0, count: 6, spreadAngle: 0.2, sub: 'pellet', desc: 'Six pellets in a wide fan.' },
  rifle:    { name: 'Assault Rifle',rarity: 'epic',   price: 600,  kind: 'burst',   size: 6,  dmg: 6,  knock: 0.08, bounce: 0,   grav: 0.08, speed: 2.0,  spin: 0, count: 8, interval: 0.075, sub: 'bullet', align: true, desc: 'An 8-round burst in a straight line.' },
  anvil:    { name: 'Anvil',        rarity: 'epic',   price: 700,  kind: 'solid',   size: 24, dmg: 38, knock: 1.25, bounce: 0.05, grav: 1.45, speed: 0.95, spin: 2, desc: 'Cartoon physics, very real pain.' },
  cluster:  { name: 'Cluster Bomb', rarity: 'epic',   price: 800,  kind: 'cluster', size: 17, bounce: 0, grav: 1, speed: 1, spin: 5, count: 5, blast: { r: 75, dmg: 15, force: 600 }, desc: 'Splits into 5 bomblets at the top of its arc.' },
  blackhole:{ name: 'Black Hole',   rarity: 'mythic', price: 1500, kind: 'blackhole', size: 18, bounce: 0, grav: 0.7, speed: 1, spin: 0, blast: { r: 170, dmg: 42, force: 1300 }, desc: 'Drags everything in, then collapses.' },
  nuke:     { name: 'Nuke',         rarity: 'mythic', price: 2200, kind: 'impact',  size: 20, bounce: 0, grav: 1, speed: 1, spin: 0, align: true, trail: 'fire', nuke: true, blast: { r: 330, dmg: 64, force: 1900 }, desc: 'The end of all arguments.' },
};
LS.WEAPON_ORDER = ['rock', 'brick', 'bouncy', 'grenade', 'bowling', 'dynamite', 'rocket', 'shotgun', 'rifle', 'anvil', 'cluster', 'blackhole', 'nuke'];
LS.STARTER_WEAPONS = ['rock', 'brick', 'bouncy', 'grenade', 'bowling', 'dynamite', 'rocket', 'shotgun'];

LS.HEROES = [
  { id: 'rookie',     name: 'Rookie',      color: '#2d9cff', hat: 'cap',        price: 0 },
  { id: 'scarlet',    name: 'Scarlet',     color: '#ff4d5e', hat: 'bandana',    price: 150 },
  { id: 'partypal',   name: 'Party Pal',   color: '#ff5ca8', hat: 'party',      price: 250 },
  { id: 'commando',   name: 'Commando',    color: '#6b8e23', hat: 'helmet',     price: 300 },
  { id: 'shadow',     name: 'Shadow',      color: '#2a2a33', hat: 'ninja',      price: 400 },
  { id: 'drifter',    name: 'Drifter',     color: '#c27c3a', hat: 'cowboy',     price: 450 },
  { id: 'cook',       name: 'Boom Chef',   color: '#f1f1f1', hat: 'chef',       price: 500 },
  { id: 'arcanist',   name: 'Arcanist',    color: '#6a4bd8', hat: 'wizard',     price: 650 },
  { id: 'corsair',    name: 'Corsair',     color: '#3b3b46', hat: 'pirate',     price: 650 },
  { id: 'volt',       name: 'DJ Volt',     color: '#00c2a8', hat: 'headphones', price: 750 },
  { id: 'jarl',       name: 'Jarl',        color: '#9aa4ad', hat: 'viking',     price: 850 },
  { id: 'dapper',     name: 'Dapper',      color: '#484852', hat: 'tophat',     price: 900 },
  { id: 'imp',        name: 'Imp',         color: '#d62828', hat: 'horns',      price: 1100 },
  { id: 'starwalker', name: 'Starwalker',  color: '#e8eef5', hat: 'astronaut',  price: 1300 },
  { id: 'seraph',     name: 'Seraph',      color: '#fff1b8', hat: 'halo',       price: 1600 },
  { id: 'monarch',    name: 'Monarch',     color: '#ffc21a', hat: 'crown',      price: 2500 },
];

LS.THEMES = {
  meadow:  { name: 'Green Meadow', bg: 'meadow',  top: '#6ccf4f', topDark: '#3f9a32', edge: '#4a2e14', pit: ['#2e8bff', '#155bbf'], pitKind: 'water', ambient: 0,    fog: 'rgba(255,255,255,0)' },
  desert:  { name: 'Sunset Mesa',  bg: 'desert',  top: '#f2c46d', topDark: '#c9923f', edge: '#6b3a16', pit: ['#d9a15a', '#9c5f25'], pitKind: 'sand',  ambient: 0.05, fog: 'rgba(255,160,100,.08)' },
  snow:    { name: 'Frost Peaks',  bg: 'snow',    top: '#ffffff', topDark: '#c9d8ea', edge: '#3d4a5e', pit: ['#8fd4ff', '#3a7fc2'], pitKind: 'water', ambient: 0,    fog: 'rgba(230,240,255,.10)' },
  night:   { name: 'Neon Rooftops',bg: 'night',   top: '#7c8cb3', topDark: '#4e5a7d', edge: '#151a30', pit: ['#2b2f6b', '#10123a'], pitKind: 'void',  ambient: 0.25, fog: 'rgba(40,20,90,.12)' },
  volcano: { name: 'Magma Core',   bg: 'volcano', top: '#ff7a33', topDark: '#b8401a', edge: '#1a0a0c', pit: ['#ffcc33', '#ff3b1a'], pitKind: 'lava',  ambient: 0.18, fog: 'rgba(255,80,20,.08)' },
};
LS.THEME_ORDER = ['meadow', 'desert', 'snow', 'night', 'volcano'];

/*
 * Map templates. Terrain rects are {x,y,w,h}. Props: {t:type, x, y(bottom)}.
 * Player always spawns on the left tower, enemy on the right one.
 */
LS.MAPS = [
  { // Classic valley
    terrain: [ { x: 110, y: 600, w: 310, h: 400 }, { x: 1180, y: 600, w: 310, h: 400 }, { x: 560, y: 790, w: 480, h: 300 } ],
    spawn: [300, 1300],
    props: [ { t: 'crate', x: 740, y: 790 }, { t: 'crate', x: 800, y: 790 }, { t: 'crate', x: 770, y: 730 }, { t: 'barrel', x: 900, y: 790 } ],
  },
  { // Great wall
    terrain: [ { x: 100, y: 620, w: 320, h: 400 }, { x: 1180, y: 620, w: 320, h: 400 }, { x: 745, y: 470, w: 110, h: 600 } ],
    spawn: [300, 1300],
    props: [ { t: 'crate', x: 770, y: 470 }, { t: 'crate', x: 830, y: 470 }, { t: 'barrel', x: 392, y: 620 } ],
  },
  { // Uneven towers + floating island
    terrain: [ { x: 120, y: 520, w: 280, h: 500 }, { x: 1190, y: 660, w: 300, h: 400 }, { x: 650, y: 560, w: 300, h: 44 } ],
    spawn: [290, 1310],
    props: [ { t: 'barrel', x: 700, y: 560 }, { t: 'tnt', x: 800, y: 560 }, { t: 'barrel', x: 900, y: 560 } ],
  },
  { // Crate fortress
    terrain: [ { x: 90, y: 640, w: 330, h: 400 }, { x: 1180, y: 580, w: 330, h: 450 }, { x: 610, y: 760, w: 380, h: 300 } ],
    spawn: [290, 1310],
    props: [ { t: 'steel', x: 1212, y: 580 }, { t: 'crate', x: 640, y: 760 }, { t: 'crate', x: 700, y: 760 }, { t: 'crate', x: 760, y: 760 }, { t: 'crate', x: 670, y: 700 }, { t: 'crate', x: 730, y: 700 }, { t: 'crate', x: 700, y: 640 }, { t: 'tnt', x: 900, y: 760 } ],
  },
  { // Sky bridge
    terrain: [ { x: 120, y: 610, w: 290, h: 420 }, { x: 1190, y: 610, w: 290, h: 420 }, { x: 520, y: 420, w: 160, h: 36 }, { x: 920, y: 420, w: 160, h: 36 } ],
    spawn: [300, 1300],
    props: [ { t: 'barrel', x: 600, y: 420 }, { t: 'barrel', x: 1000, y: 420 }, { t: 'crate', x: 790, y: 900 } ],
  },
];

LS.PROP_TYPES = {
  crate:  { w: 58, h: 58, hp: 30, sprite: 'crate' },
  barrel: { w: 44, h: 60, hp: 1,  sprite: 'barrel', blast: { r: 115, dmg: 22, force: 820 } },
  tnt:    { w: 54, h: 50, hp: 1,  sprite: 'tnt',    blast: { r: 150, dmg: 30, force: 1050 } },
  steel:  { w: 56, h: 56, hp: Infinity, sprite: 'steel' },
};

// Asset manifest (relative to index.html)
LS.ASSET_LIST = (() => {
  const list = {};
  LS.THEME_ORDER.forEach((t) => (list['bg-' + t] = 'assets/images/backgrounds/' + t + '.svg'));
  list['bg-menu'] = 'assets/images/backgrounds/menu.svg';
  LS.THEME_ORDER.forEach((t) => (list['tile-' + t] = 'assets/3d/props/tile-' + t + '.svg'));
  ['crate', 'barrel', 'steel', 'tnt'].forEach((p) => (list['prop-' + p] = 'assets/3d/props/' + p + '.svg'));
  LS.WEAPON_ORDER.concat(['bullet', 'pellet', 'bomblet']).forEach((w) => (list['w-' + w] = 'assets/3d/weapons/' + w + '.svg'));
  LS.HEROES.forEach((h) => (list['hat-' + h.hat] = 'assets/images/heroes/hat-' + h.hat + '.svg'));
  ['coin', 'heart', 'skull', 'star', 'trophy'].forEach((i) => (list['ui-' + i] = 'assets/images/ui/' + i + '.svg'));
  return list;
})();
