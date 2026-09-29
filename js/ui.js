/* ==========================================================================
   Last Survivor — 09 · ui.js
   DOM menus (main, heroes, arsenal, settings, help, pause, result), HUD,
   banners, hero previews and keyboard/mouse menu navigation.
   ========================================================================== */
'use strict';

LS.UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const U = LS.U;
  let api = null;
  let current = 'loading';
  const stack = [];
  let previewHero = null, previewT = 0;

  /* ---------------- hero rendering helpers ---------------- */
  const stubWorld = (gy) => ({ groundBelow: () => gy });

  function drawHeroInto(canvas, hero, opts = {}) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = opts.scale || H / 150;
    const f = opts.fighter || new LS.Entities.Fighter(hero, 0, 0, 1, true, 100);
    if (opts.t !== undefined) { f.t = opts.t; f.cheer = opts.cheer || 0; f.hold = opts.hold || null; f.aim = opts.aim || null; f.body.setPose(f.pose()); }
    ctx.save();
    ctx.translate(W / 2, H - (opts.foot || 18));
    ctx.scale(s, s);
    f.draw(ctx, stubWorld(0));
    ctx.restore();
    return f;
  }

  // Returns a canvas (not a data URL: canvases with SVGs are tainted under file://)
  function heroHead(hero, flip) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#4a3aa6'); g.addColorStop(1, '#1d1550');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 96, 96);
    const f = new LS.Entities.Fighter(hero, 0, 0, flip ? -1 : 1, true, 100);
    const h = f.body.p[0];
    ctx.translate(48, 60); ctx.scale(2.3, 2.3); ctx.translate(-h.x, -h.y);
    f.drawHead(ctx, hero.color);
    return c;
  }

  /* ---------------- screens ---------------- */
  const MENU_SCREENS = ['main', 'heroes', 'arsenal', 'settings', 'help'];

  function show(id, push = true) {
    if (push && current && current !== id && current !== 'loading') stack.push(current);
    $$('.screen').forEach((s) => s.classList.remove('active'));
    const el = $('#screen-' + id);
    if (el) el.classList.add('active');
    current = id;
    const inMenus = MENU_SCREENS.includes(id) && !api.inBattle();
    $('#menu-bg').classList.toggle('off', !inMenus);
    $('#app').classList.toggle('battle', api.inBattle());
    if (id === 'main') { refreshMain(); stack.length = 0; }
    if (id === 'heroes') buildHeroes();
    if (id === 'arsenal') buildArsenal();
    if (id === 'settings') syncSettings();
    refreshCoins();
    // focus first control for keyboard players
    requestAnimationFrame(() => {
      const first = el && $$('.btn-play, .btn, .card, input', el).find((b) => b.offsetParent !== null);
      if (first && document.activeElement && !el.contains(document.activeElement)) first.focus({ preventScroll: true });
    });
  }
  function back() {
    LS.Audio.play('click');
    if (current === 'pause') return api.resume();
    if (current === 'result') return;
    const prev = stack.pop();
    if (prev) show(prev, false);
    else if (!api.inBattle()) show('main', false);
  }
  const screen = () => current;

  /* ---------------- main ---------------- */
  function refreshCoins() { $$('.coin-val').forEach((e) => (e.textContent = U.save.coins)); }
  function refreshMain() {
    const s = U.save;
    $('#play-level').textContent = 'Level ' + s.level;
    $('#wins-val').textContent = s.wins;
    previewHero = LS.HEROES.find((h) => h.id === s.hero) || LS.HEROES[0];
    $('#menu-hero-name').textContent = previewHero.name;
  }
  function previewLoop(ts) {
    requestAnimationFrame(previewLoop);
    if (current !== 'main' || !previewHero) return;
    previewT = ts / 1000;
    const c = $('#menu-hero');
    const cycle = previewT % 6;
    const aim = cycle > 3.2 && cycle < 4.6 ? { angle: -0.75, power: Math.min(1, (cycle - 3.2) / 1.2) } : null;
    const cheer = cycle > 1.2 && cycle < 2.4 ? 1 : 0;
    drawHeroInto(c, previewHero, { t: previewT, aim, hold: aim ? 'grenade' : null, cheer, scale: 2.7, foot: 40 });
  }

  /* ---------------- heroes ---------------- */
  function buildHeroes() {
    const grid = $('#hero-grid');
    grid.innerHTML = '';
    const s = U.save;
    LS.HEROES.forEach((h) => {
      const owned = s.heroes.includes(h.id), sel = s.hero === h.id;
      const card = document.createElement('button');
      card.className = 'card' + (sel ? ' selected' : '') + (owned ? '' : ' locked');
      const cv = document.createElement('canvas'); cv.width = 240; cv.height = 260;
      drawHeroInto(cv, h, { t: 0.5, scale: 1.55, foot: 20 });
      card.appendChild(cv);
      card.insertAdjacentHTML('beforeend', `<div class="name">${h.name}</div>` +
        (sel ? '<div class="tag sel">Selected</div>' : owned ? '<div class="tag own">Select</div>' :
          `<div class="tag buy ${s.coins < h.price ? 'poor' : ''}"><img src="assets/images/ui/coin.svg" alt="">${h.price}</div>`) +
        (owned ? '' : '<img class="lock" src="assets/images/ui/lock.svg" alt="">'));
      card.addEventListener('click', () => {
        if (owned) { s.hero = h.id; LS.Audio.play('select'); }
        else if (s.coins >= h.price) { s.coins -= h.price; s.heroes.push(h.id); s.hero = h.id; LS.Audio.play('buy'); toast(h.name + ' unlocked!'); }
        else { LS.Audio.play('denied'); toast('Not enough coins — win more battles!'); return; }
        U.persist(); buildHeroes(); refreshCoins();
        const again = $$('#hero-grid .card')[LS.HEROES.indexOf(h)]; if (again) again.focus({ preventScroll: true });
      });
      grid.appendChild(card);
    });
  }

  /* ---------------- arsenal ---------------- */
  function buildArsenal() {
    const grid = $('#weapon-grid');
    grid.innerHTML = '';
    const s = U.save;
    $('#deck-count').textContent = s.deck.length + ' / ' + LS.CONFIG.DECK_SIZE;
    LS.WEAPON_ORDER.forEach((k, idx) => {
      const w = LS.WEAPONS[k], rar = LS.RARITY[w.rarity];
      const owned = s.weapons.includes(k), inDeck = s.deck.includes(k);
      const card = document.createElement('button');
      card.className = 'card' + (inDeck ? ' in-deck' : '') + (owned ? '' : ' locked');
      card.style.setProperty('--r', rar.color);
      const dmg = w.blast ? `Blast ${w.blast.dmg}` : w.count ? `${w.count}× ${w.dmg}` : `Hit ${w.dmg}`;
      card.innerHTML = `<span class="rar" style="background:${rar.color}">${rar.label}</span>
        <img class="wimg" src="assets/3d/weapons/${k}.svg" alt="">
        <div class="name">${w.name}</div><div class="meta">${w.desc}</div><div class="stat">${dmg}</div>` +
        (owned ? (inDeck ? '<div class="tag sel">In deck</div>' : '<div class="tag own">Add to deck</div>')
          : `<div class="tag buy ${s.coins < w.price ? 'poor' : ''}"><img src="assets/images/ui/coin.svg" alt="">${w.price}</div><img class="lock" src="assets/images/ui/lock.svg" alt="">`);
      card.addEventListener('click', () => {
        if (!owned) {
          if (s.coins < w.price) { LS.Audio.play('denied'); toast('Not enough coins!'); return; }
          s.coins -= w.price; s.weapons.push(k); LS.Audio.play('buy'); toast(w.name + ' unlocked!');
          if (s.deck.length < LS.CONFIG.DECK_SIZE) s.deck.push(k);
          else toast(w.name + ' unlocked! Remove a card from your deck to equip it.');
        } else if (inDeck) {
          if (s.deck.length <= LS.CONFIG.DECK_MIN) { LS.Audio.play('denied'); toast('Your deck needs at least ' + LS.CONFIG.DECK_MIN + ' weapons'); return; }
          s.deck = s.deck.filter((x) => x !== k); LS.Audio.play('click');
        } else {
          if (s.deck.length >= LS.CONFIG.DECK_SIZE) { LS.Audio.play('denied'); toast('Deck is full (8). Remove a weapon first.'); return; }
          s.deck.push(k); LS.Audio.play('select');
        }
        U.persist(); buildArsenal(); refreshCoins();
        const again = $$('#weapon-grid .card')[idx]; if (again) again.focus({ preventScroll: true });
      });
      grid.appendChild(card);
    });
  }

  /* ---------------- settings ---------------- */
  function paintRange(el) { el.style.setProperty('--v', el.value * 100 + '%'); }
  function syncSettings() {
    const st = U.save.settings;
    $('#set-sfx').value = st.sfx; $('#set-music').value = st.music;
    paintRange($('#set-sfx')); paintRange($('#set-music'));
    $('#set-shake').checked = st.shake; $('#set-guide').checked = st.guide; $('#set-quality').checked = st.quality === 'high';
  }
  function bindSettings() {
    const st = () => U.save.settings;
    const apply = () => { LS.Audio.setVolumes(st().sfx, st().music); U.persist(); };
    $('#set-sfx').addEventListener('input', (e) => { st().sfx = +e.target.value; paintRange(e.target); apply(); });
    $('#set-sfx').addEventListener('change', () => LS.Audio.play('hit', 0.6));
    $('#set-music').addEventListener('input', (e) => { st().music = +e.target.value; paintRange(e.target); apply(); });
    $('#set-shake').addEventListener('change', (e) => { st().shake = e.target.checked; apply(); LS.Audio.play('click'); });
    $('#set-guide').addEventListener('change', (e) => { st().guide = e.target.checked; apply(); LS.Audio.play('click'); });
    $('#set-quality').addEventListener('change', (e) => { st().quality = e.target.checked ? 'high' : 'low'; apply(); LS.Audio.play('click'); });
    apply();
  }

  /* ---------------- HUD ---------------- */
  function setupHud(player, enemy, level) {
    $('#hud-p-name').textContent = player.hero.name + ' (You)';
    $('#hud-e-name').textContent = enemy.hero.name;
    $('#hud-p-avatar').replaceChildren(heroHead(player.hero));
    $('#hud-e-avatar').replaceChildren(heroHead(enemy.hero, true));
    $('#hud-level').textContent = 'Level ' + level + ' · ' + LS.THEMES[LS.THEME_ORDER[(level - 1) % 5]].name;
    $('#pause-level').textContent = 'Level ' + level;
  }
  function hpBar(prefix, f) {
    const pct = Math.max(0, f.hp / f.maxHp) * 100, lag = Math.max(0, f.shownHp / f.maxHp) * 100;
    const fill = $('#hud-' + prefix + '-hp');
    fill.style.width = pct + '%';
    fill.classList.toggle('mid', pct <= 60 && pct > 30);
    fill.classList.toggle('low', pct <= 30);
    $('#hud-' + prefix + '-lag').style.width = lag + '%';
    $('#hud-' + prefix + '-num').textContent = Math.ceil(f.hp) + ' / ' + f.maxHp;
  }
  function updateHud(game) {
    hpBar('p', game.player); hpBar('e', game.enemy);
    const yours = game.turn === 'player';
    $('.fighter-card.left').classList.toggle('active', yours);
    $('.fighter-card.right').classList.toggle('active', !yours);
    const aim = game.aim;
    $('#aim-angle').textContent = Math.round(-aim.angle * 180 / Math.PI) + '°';
    $('#aim-power').style.width = Math.round(aim.power * 100) + '%';
    $('#hud').classList.toggle('hud-off', game.state !== 'aim');
  }
  function setTurn(text, who) {
    const el = $('#hud-turn');
    el.textContent = text;
    el.className = 'hud-turn ' + (who === 'player' ? 'you' : 'them');
  }
  function renderCards(keys, sel, onPick) {
    const wrap = $('#cards');
    wrap.innerHTML = '';
    keys.forEach((k, i) => {
      const w = LS.WEAPONS[k], rar = LS.RARITY[w.rarity];
      const b = document.createElement('button');
      b.className = 'card-w' + (i === sel ? ' sel' : '');
      b.style.setProperty('--r', rar.color); b.style.setProperty('--g', rar.glow);
      b.title = w.name + ' — ' + w.desc;
      b.innerHTML = `<span class="key">${i + 1}</span><img src="assets/3d/weapons/${k}.svg" alt=""><span class="cw-name">${w.name}</span>`;
      b.addEventListener('pointerdown', (e) => e.stopPropagation());
      b.addEventListener('click', () => { onPick(i); b.blur(); });
      b.tabIndex = -1;
      wrap.appendChild(b);
    });
  }
  function selectCard(i) { $$('#cards .card-w').forEach((c, j) => c.classList.toggle('sel', i === j)); }
  function cardsVisible(v) { $('#cards').classList.toggle('away', !v); }
  function hud(v) { $('#hud').classList.toggle('hidden', !v); }

  let bannerTimer = 0;
  function banner(main, sub = '', cls = '') {
    const b = $('#banner');
    b.querySelector('.banner-main').textContent = main;
    b.querySelector('.banner-main').className = 'banner-main ' + cls;
    b.querySelector('.banner-sub').textContent = sub;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), 1600);
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function showResult(r) {
    const m = $('#screen-result .modal');
    m.classList.toggle('win', r.win); m.classList.toggle('lose', !r.win);
    $('#result-icon').src = 'assets/images/ui/' + (r.win ? 'trophy' : 'skull') + '.svg';
    $('#result-title').textContent = r.win ? 'Last One Standing!' : 'Eliminated!';
    $('#result-sub').textContent = r.win ? `Level ${r.level} cleared — ${r.reason}` : `${r.reason} Try a different deck or angle.`;
    $('#result-stars').innerHTML = r.win ? [1, 2, 3].map((i) => `<img src="assets/images/ui/star.svg" class="${i <= r.stars ? '' : 'off'}" alt="">`).join('') : '';
    $('#result-reward span').textContent = '+' + r.coins;
    $('#result-reward').style.display = r.coins ? '' : 'none';
    $('#result-next').style.display = r.win ? '' : 'none';
    $('#result-retry').textContent = r.win ? 'Replay' : 'Try again';
    show('result', false);
  }

  function setLoading(p) {
    $('#load-fill').style.width = Math.round(p * 100) + '%';
    $('#load-text').textContent = p < 1 ? `Loading arena… ${Math.round(p * 100)}%` : 'Ready!';
  }

  function syncIcons() {
    $$('[data-action=sound] img').forEach((i) => (i.src = 'assets/images/ui/' + (LS.Audio.isMuted() ? 'sound-off' : 'sound-on') + '.svg'));
    $$('[data-action=fullscreen] img').forEach((i) => (i.src = 'assets/images/ui/' + (U.isFullscreen() ? 'fullscreen-exit' : 'fullscreen') + '.svg'));
  }

  /* ---------------- keyboard navigation in menus ---------------- */
  function focusables() {
    const el = $('#screen-' + current);
    if (!el) return [];
    return $$('button, input', el).filter((b) => b.offsetParent !== null && !b.disabled && getComputedStyle(b).visibility !== 'hidden');
  }
  function spatial(dir) {
    const list = focusables();
    if (!list.length) return;
    const a = document.activeElement;
    if (!list.includes(a)) { list[0].focus(); return; }
    const r0 = a.getBoundingClientRect(), cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
    let best = null, bestScore = Infinity;
    for (const b of list) {
      if (b === a) continue;
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const dx = x - cx, dy = y - cy;
      const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
      const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
      if (along <= 4) continue;
      const score = along + across * 2.2;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    if (best) { best.focus(); best.scrollIntoView({ block: 'nearest' }); LS.Audio.play('hover'); }
  }
  function menuKey(e) {
    if (current === 'loading') return false;
    const inMenu = current !== 'battle';
    if (!inMenu) return false;
    const a = document.activeElement;
    const isRange = a && a.type === 'range';
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    if (map[e.code] && !(isRange && (e.code === 'ArrowLeft' || e.code === 'ArrowRight'))) { e.original.preventDefault(); spatial(map[e.code]); return true; }
    if (e.code === 'Escape' || e.code === 'Backspace') { e.original.preventDefault(); if (!e.repeat) back(); return true; }
    if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && (!a || a === document.body)) {
      e.original.preventDefault();
      const f = focusables()[0]; if (f && !e.repeat) f.click();
      return true;
    }
    if (e.code === 'KeyP' && current === 'pause' && !e.repeat) { api.resume(); return true; }
    return false;
  }

  /* ---------------- init ---------------- */
  function init(gameApi) {
    api = gameApi;
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-action]');
      if (!b) return;
      const act = b.dataset.action;
      if (act !== 'back') LS.Audio.play('click');
      switch (act) {
        case 'play': api.startBattle(); break;
        case 'heroes': case 'arsenal': case 'settings': case 'help': show(act); break;
        case 'back': back(); break;
        case 'pause': api.pause(); break;
        case 'resume': api.resume(); break;
        case 'restart': api.restart(); break;
        case 'next': api.next(); break;
        case 'menu': api.toMenu(); break;
        case 'sound': LS.Audio.toggleMute(); syncIcons(); break;
        case 'fullscreen': U.toggleFullscreen(); break;
        case 'reset':
          if (confirm('Reset all progress, coins, heroes and weapons?')) { U.reset(); LS.Audio.setVolumes(U.save.settings.sfx, U.save.settings.music); syncSettings(); refreshCoins(); toast('Progress reset'); }
          break;
      }
    });
    document.addEventListener('mouseover', (e) => { const b = e.target.closest('.btn, .card, .icon-btn'); if (b && !b.contains(e.relatedTarget)) LS.Audio.play('hover'); });
    document.addEventListener('fullscreenchange', syncIcons);
    document.addEventListener('webkitfullscreenchange', syncIcons);
    bindSettings();
    requestAnimationFrame(previewLoop);
  }

  return {
    init, show, back, screen, setLoading, refreshCoins, refreshMain, syncIcons,
    setupHud, updateHud, setTurn, renderCards, selectCard, cardsVisible, hud, banner, toast, showResult, menuKey,
    setScreen: (id) => { current = id; },
  };
})();
