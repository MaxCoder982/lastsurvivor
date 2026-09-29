/* ==========================================================================
   Last Survivor — 10 · game.js
   Main loop, camera, turn manager, aiming (mouse + keyboard), enemy AI,
   rendering pipeline and boot sequence.
   ========================================================================== */
'use strict';

LS.Game = (() => {
  const U = LS.U, C = LS.CONFIG;
  const { clamp, lerp, rand, gauss, shuffle } = U;
  const { Fighter, Projectile } = LS.Entities;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, DPR = 1;

  const G = {
    mode: 'menu', paused: false, state: 'idle', turn: 'player',
    level: 1, world: null, fighters: [], player: null, enemy: null,
    projectiles: [], timers: [], bursts: [],
    hand: [], sel: 0, enemyDeck: [],
    aim: { angle: -0.72, power: 0.62 },
    drag: null, stateT: 0, flyT: 0, acc: 0, timeScale: 1, slowT: 0,
    cam: { scale: 1, ox: 0, oy: 0, fx: C.WORLD_W / 2, zoom: 1, left: 0, right: C.WORLD_W },
    holeActive: null, enemyPlan: null, result: null, dealt: 0,
  };

  /* ---------------- sizing & camera ---------------- */
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  }
  function updateCamera(dt) {
    const cam = G.cam;
    const base = Math.min(W / (C.WORLD_W + 40), H / (C.WORLD_H + 20));
    // gently follow the action while something is flying
    let fx = C.WORLD_W / 2, zoom = 1;
    const live = G.projectiles.filter((p) => !p.dead);
    if (G.state === 'flying' && live.length) {
      const px = live.reduce((s, p) => s + p.x, 0) / live.length;
      fx = lerp(C.WORLD_W / 2, clamp(px, 300, C.WORLD_W - 300), 0.18); zoom = 1.03;
    }
    if (G.state === 'over' && G.result) { fx = G.result.focusX; zoom = 1.18; }
    const k = 1 - Math.pow(0.08, dt);
    cam.fx = lerp(cam.fx, fx, k); cam.zoom = lerp(cam.zoom, zoom, k);
    cam.scale = base * cam.zoom;
    cam.ox = W / 2 - cam.fx * cam.scale;
    cam.oy = H / 2 - (C.WORLD_H / 2 + 20) * cam.scale + (cam.zoom - 1) * 260 * cam.scale;
    cam.left = -cam.ox / cam.scale; cam.right = (W - cam.ox) / cam.scale;
  }
  const toWorld = (sx, sy) => ({ x: (sx - G.cam.ox) / G.cam.scale, y: (sy - G.cam.oy) / G.cam.scale });

  /* ---------------- battle setup ---------------- */
  function enemyDeckFor(level) {
    const pool = ['rock', 'brick', 'bouncy', 'grenade'];
    if (level >= 3) pool.push('bowling', 'dynamite');
    if (level >= 5) pool.push('rocket', 'shotgun', 'rifle');
    if (level >= 8) pool.push('anvil', 'cluster');
    if (level >= 12) pool.push('blackhole');
    if (level >= 15) pool.push('nuke');
    return shuffle(pool).slice(0, C.DECK_SIZE);
  }

  function startBattle(level = U.save.level) {
    LS.Audio.unlock();
    G.level = level;
    G.world = new LS.World.World(level);
    const w = G.world;
    const heroP = LS.HEROES.find((h) => h.id === U.save.hero) || LS.HEROES[0];
    const others = LS.HEROES.filter((h) => h.id !== heroP.id);
    const heroE = others[(level * 5 + 3) % others.length];
    const gy = (x) => w.groundBelow(x, 0, 2000);
    G.player = new Fighter(heroP, w.spawn[0], gy(w.spawn[0]), 1, true, C.PLAYER_HP);
    G.enemy = new Fighter(heroE, w.spawn[1], gy(w.spawn[1]), -1, false, Math.min(240, 100 + (level - 1) * 9));
    G.fighters = [G.player, G.enemy];
    G.projectiles = []; G.timers = []; G.bursts = [];
    G.enemyDeck = enemyDeckFor(level);
    G.mode = 'battle'; G.paused = false; G.result = null; G.holeActive = null; G.dealt = 0;
    G.timeScale = 1; G.slowT = 0; G.drag = null;
    G.cam.fx = C.WORLD_W / 2; G.cam.zoom = 1.25;
    LS.UI.show('battle');
    LS.UI.hud(true);
    LS.UI.setupHud(G.player, G.enemy, level);
    LS.UI.cardsVisible(false);
    LS.UI.setTurn('Get ready', 'player');
    setState('intro');
    LS.Audio.startMusic('battle');
    LS.Audio.play('vs');
    LS.UI.banner('Level ' + level, heroP.name + '  vs  ' + heroE.name, 'gold');
  }

  function setState(s) { G.state = s; G.stateT = 0; }

  function drawHand(deck) {
    const d = deck.length >= 3 ? shuffle(deck).slice(0, 3) : [0, 1, 2].map(() => U.pick(deck));
    return d;
  }

  function beginTurn(who) {
    G.turn = who;
    G.projectiles = G.projectiles.filter((p) => !p.dead);
    if (who === 'player') {
      G.hand = drawHand(U.save.deck.length ? U.save.deck : LS.STARTER_WEAPONS);
      G.sel = 0;
      LS.UI.renderCards(G.hand, G.sel, pickCard);
      LS.UI.cardsVisible(true);
      LS.UI.setTurn('Your turn', 'player');
      G.player.hold = G.hand[G.sel];
      G.player.aim = { angle: G.aim.angle, power: G.aim.power };
      LS.Audio.play('turn');
      setState('aim');
    } else {
      LS.UI.cardsVisible(false);
      LS.UI.setTurn(G.enemy.hero.name + "'s turn", 'enemy');
      G.enemyPlan = planEnemy();
      G.enemy.hold = G.enemyPlan.key;
      G.enemy.aim = { angle: Math.PI + 0.6, power: 0 };
      setState('enemyAim');
    }
  }

  function pickCard(i) {
    if (G.state !== 'aim' || i < 0 || i >= G.hand.length) return;
    G.sel = i;
    LS.UI.selectCard(i);
    G.player.hold = G.hand[i];
    LS.Audio.play('select');
  }

  /* ---------------- throwing ---------------- */
  function fire(f, key, angle, power) {
    const w = LS.WEAPONS[key];
    const speed = lerp(C.MIN_SPEED, C.MAX_SPEED, power) * w.speed;
    const o = f.launchOrigin();
    f.aim = null; f.hold = null; f.throwT = 0;
    LS.UI.cardsVisible(false);
    if (w.kind === 'spread') {
      LS.Audio.play('shotgun');
      G.world.addShake(5);
      for (let i = 0; i < w.count; i++) {
        const a = angle + (i / (w.count - 1) - 0.5) * w.spreadAngle + rand(-0.02, 0.02);
        const s = speed * rand(0.92, 1.05);
        G.projectiles.push(new Projectile(key, o.x, o.y, Math.cos(a) * s, Math.sin(a) * s, f, { kind: 'bullet', sprite: w.sub, r: w.size }));
      }
      muzzle(o.x, o.y, angle);
    } else if (w.kind === 'burst') {
      G.bursts.push({ f, key, angle, speed, left: w.count, t: 0 });
    } else {
      LS.Audio.play('throw');
      G.projectiles.push(new Projectile(key, o.x, o.y, Math.cos(angle) * speed, Math.sin(angle) * speed, f));
    }
    setState('flying');
    G.flyT = 0;
  }
  function muzzle(x, y, a) {
    G.world.emit({ x: x + Math.cos(a) * 14, y: y + Math.sin(a) * 14, kind: 'fire', life: 0.08, size: 26, color: 'rgba(255,220,120,1)', add: true });
    G.world.light(x, y, 120, '255,220,140', 0.1);
  }
  function updateBursts(dt) {
    for (const b of G.bursts) {
      b.t -= dt;
      if (b.t > 0 || b.left <= 0) continue;
      const w = LS.WEAPONS[b.key];
      const o = b.f.launchOrigin();
      const a = b.angle + gauss() * 0.025;
      G.projectiles.push(new Projectile(b.key, o.x, o.y, Math.cos(a) * b.speed, Math.sin(a) * b.speed, b.f, { kind: 'bullet', sprite: w.sub, r: w.size }));
      LS.Audio.play('gun'); muzzle(o.x, o.y, a); G.world.addShake(1.5);
      b.f.throwT = 0.6;
      b.left--; b.t = w.interval;
    }
    G.bursts = G.bursts.filter((b) => b.left > 0);
  }

  /* ---------------- enemy AI ---------------- */
  function planEnemy() {
    const hand = drawHand(G.enemyDeck);
    // prefer heavy hitters, with some randomness
    const score = (k) => { const w = LS.WEAPONS[k]; return (w.blast ? w.blast.dmg : (w.dmg || 5) * (w.count || 1) * 0.8) * rand(0.7, 1.3); };
    const key = hand.slice().sort((a, b) => score(b) - score(a))[0];
    const w = LS.WEAPONS[key];
    const o = G.enemy.launchOrigin();
    const tgt = G.player.center();
    const solids = G.world.solids();
    let best = null;
    for (let deg = 4; deg <= 80; deg += 2.5) {
      const th = deg * Math.PI / 180;
      for (let p = 0.08; p <= 1.0001; p += 0.025) {
        const sp = lerp(C.MIN_SPEED, C.MAX_SPEED, p) * w.speed;
        const pts = LS.Physics.predict(o.x, o.y, -Math.cos(th) * sp, -Math.sin(th) * sp, w.grav, solids, 2.6, 1 / 60, Math.min(10, w.size));
        let md = Infinity;
        for (const q of pts) { const d = Math.hypot(q.x - tgt.x, q.y - tgt.y); if (d < md) md = d; }
        const sc = md + p * 6 + (w.kind === 'fuse' ? Math.abs(deg - 40) * 0.3 : 0);
        if (!best || sc < best.sc) best = { sc, th, p };
      }
    }
    const skill = clamp(0.3 + G.level * 0.06, 0.3, 0.9);
    const miss = 1 - skill;
    const th = best.th + gauss() * miss * 0.2;
    const p = clamp(best.p + gauss() * miss * 0.1, 0.05, 1);
    return { key, angle: Math.PI + th, power: p };
  }

  /* ---------------- damage / flow ---------------- */
  function dealDamage(f, amount, source, opts) {
    const d = f.damage(amount, G.world, opts);
    if (source === G.player && f === G.enemy) G.dealt += d;
    if (!f.alive) koCheck();
  }
  function koCheck() {
    if (G.state === 'over') return;
    const pDead = !G.player.alive, eDead = !G.enemy.alive;
    if (!pDead && !eDead) return;
    const win = eDead && !pDead;
    const loser = win ? G.enemy : G.player;
    const c = loser.center();
    G.result = { win, focusX: clamp(c.x, 400, C.WORLD_W - 400) };
    G.slowT = 1.3;
    LS.UI.cardsVisible(false);
    LS.UI.banner('K.O.!', win ? 'You are the last survivor' : 'You got knocked out', win ? 'gold' : 'pink');
    setState('over');
  }
  function settled() {
    if (G.projectiles.some((p) => !p.dead) || G.bursts.length || G.timers.length) return false;
    for (const f of G.fighters) {
      if (f.state === 'recover') return false;
      if (f.state === 'ragdoll') {
        if (f.alive) return false;
        if (f.body.velocity() > 60 && f.ragT < 3) return false;
      }
    }
    return true;
  }
  function finish() {
    const r = G.result;
    const s = U.save;
    let coins, stars = 0, reason;
    if (r.win) {
      const hpPct = G.player.hp / G.player.maxHp;
      stars = hpPct >= 0.7 ? 3 : hpPct >= 0.35 ? 2 : 1;
      coins = 60 + G.level * 12 + stars * 20;
      reason = G.enemy.fell ? 'your rival went for a swim!' : stars === 3 ? 'flawless survival!' : 'you outlasted your rival!';
      if (G.level === s.level) s.level++;
      s.wins++;
      LS.Audio.play('win');
      confetti();
      G.player.cheer = 99;
    } else {
      coins = 15 + Math.round(G.dealt / 4);
      reason = G.player.fell ? 'The pit got you.' : !G.enemy.alive ? 'Nobody survived that one.' : 'Your rival outlasted you.';
      s.losses++;
      LS.Audio.play('lose');
      if (G.enemy.alive) G.enemy.cheer = 99;
    }
    s.coins += coins;
    U.persist();
    LS.UI.showResult({ win: r.win, coins, stars, level: G.level, reason });
    setState('result');
  }
  function confetti() {
    const w = G.world;
    for (let i = 0; i < 120; i++) {
      w.emit({ x: rand(G.cam.left, G.cam.right), y: rand(-200, -20), vx: rand(-80, 80), vy: rand(60, 260), grav: 0.12, drag: 0.99, life: rand(2.5, 4.5), size: rand(8, 14), rot: rand(0, 6), vr: rand(-10, 10), color: U.pick(['#ffcf33', '#32e0c4', '#ff5a7a', '#7b5cff', '#ffffff']), kind: 'confetti' });
    }
  }

  /* ---------------- update ---------------- */
  function update(dt) {
    const w = G.world;
    G.stateT += dt;

    // continuous keyboard aiming
    if (G.state === 'aim' && !G.drag) {
      const I = LS.Input;
      let changed = false;
      if (I.isHeld('ArrowLeft', 'KeyA')) { G.aim.angle -= 1.3 * dt; changed = true; }
      if (I.isHeld('ArrowRight', 'KeyD')) { G.aim.angle += 1.3 * dt; changed = true; }
      if (I.isHeld('ArrowUp', 'KeyW')) { G.aim.power += 0.65 * dt; changed = true; }
      if (I.isHeld('ArrowDown', 'KeyS')) { G.aim.power -= 0.65 * dt; changed = true; }
      if (changed) { G.aim.angle = clamp(G.aim.angle, -1.52, 0.9); G.aim.power = clamp(G.aim.power, 0.05, 1); }
      G.player.aim = { angle: G.aim.angle, power: G.aim.power };
    }

    // fixed-step physics
    G.acc += dt;
    let steps = 0;
    while (G.acc >= C.STEP && steps < 10) {
      G.acc -= C.STEP; steps++;
      for (const f of G.fighters) {
        const hf = f.holeForce;
        f.physics(C.STEP, w, hf ? (q) => { const dx = hf.x - q.x, dy = hf.y - q.y, d = Math.hypot(dx, dy) || 1; return d < 30 ? { x: -q.x + hf.x, y: -q.y + hf.y } : { x: (dx / d) * hf.s, y: (dy / d) * hf.s - C.GRAVITY * 0.6 }; } : null);
      }
      for (const p of G.projectiles) if (!p.dead) p.update(C.STEP, G);
    }
    if (G.acc > C.STEP * 4) G.acc = 0;

    for (const f of G.fighters) f.update(dt, w);
    updateBursts(dt);
    for (const l of G.timers) l.t -= dt;
    const due = G.timers.filter((l) => l.t <= 0);
    G.timers = G.timers.filter((l) => l.t > 0);
    due.forEach((l) => l.fn());
    w.update(dt);

    // falling into the pit costs 30 HP; survivors drop back onto their tower
    for (const f of G.fighters) {
      if (!f.fell || f.respawnT !== 0 || G.state === 'over' || G.state === 'result') continue;
      const c = f.body.p[0];
      w.text(clamp(c.x, 150, C.WORLD_W - 150), C.PIT_Y - 130, 'SPLASHED!', '#9df3ff', 40);
      dealDamage(f, 30, f === G.player ? G.enemy : G.player);
      f.respawnT = f.alive ? 1.1 : -1;
    }
    for (const f of G.fighters) if (f.respawnT > 0 && (f.respawnT -= dt) <= 0) f.respawn();
    // safety net: check for a KO every frame
    if (G.state !== 'over' && G.state !== 'result' && (!G.player.alive || !G.enemy.alive)) koCheck();

    switch (G.state) {
      case 'intro':
        if (G.stateT > 1.7) beginTurn('player');
        break;
      case 'enemyAim': {
        const plan = G.enemyPlan, k = clamp(G.stateT / 1.0, 0, 1);
        G.enemy.aim = { angle: lerp(Math.PI + 0.6, plan.angle, U.easeInOut(k)), power: lerp(0, plan.power, U.easeOutCubic(k)) };
        if (G.stateT > 1.25) fire(G.enemy, plan.key, plan.angle, plan.power);
        break;
      }
      case 'flying':
        G.flyT += dt;
        if ((G.flyT > 0.6 && settled()) || G.flyT > 10) {
          G.projectiles.forEach((p) => (p.dead = true));
          for (const f of G.fighters) f.holeForce = null;
          if (G.turn === 'player') beginTurn('enemy'); else beginTurn('player');
        }
        break;
      case 'over':
        if (G.stateT > 2.6) finish();
        break;
    }
  }

  /* ---------------- rendering ---------------- */
  function render() {
    const w = G.world;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sh = w.shake;
    const sx = sh ? rand(-sh, sh) : 0, sy = sh ? rand(-sh, sh) : 0;
    ctx.save();
    ctx.translate(sx * 0.3, sy * 0.3);
    ctx.save(); ctx.translate(-12, -12);
    w.drawBackground(ctx, W + 24, H + 24);
    ctx.restore();
    ctx.restore();

    ctx.save();
    ctx.translate(G.cam.ox + sx, G.cam.oy + sy);
    ctx.scale(G.cam.scale, G.cam.scale);
    w.drawParticles(ctx, 'back');
    w.drawHazard(ctx, G.cam);
    w.drawTerrain(ctx);
    w.drawProps(ctx);
    const order = G.turn === 'player' ? [G.enemy, G.player] : [G.player, G.enemy];
    for (const f of order) f.draw(ctx, w);
    for (const p of G.projectiles) if (!p.dead) p.draw(ctx);
    w.drawParticles(ctx, 'front');
    w.drawLights(ctx);
    drawAim();
    w.drawTexts(ctx);
    ctx.restore();

    // screen-space post effects
    if (w.theme.fog) { ctx.fillStyle = w.theme.fog; ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.35 + w.theme.ambient})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (w.flash > 0) { ctx.fillStyle = `rgba(255,250,235,${Math.min(1, w.flash)})`; ctx.fillRect(0, 0, W, H); }
    if (G.slowT > 0) { ctx.fillStyle = `rgba(20,0,40,${Math.min(0.25, G.slowT * 0.2)})`; ctx.fillRect(0, 0, W, H); }
  }

  function drawAim() {
    if (G.state !== 'aim' || G.paused) return;
    const key = G.hand[G.sel];
    if (!key) return;
    const wpn = LS.WEAPONS[key];
    const o = G.player.launchOrigin();
    const sp = lerp(C.MIN_SPEED, C.MAX_SPEED, G.aim.power) * wpn.speed;
    const guide = U.save.settings.guide;
    const pts = LS.Physics.predict(o.x, o.y, Math.cos(G.aim.angle) * sp, Math.sin(G.aim.angle) * sp, wpn.grav, G.world.solids(), guide ? 0.62 : 0.16, 1 / 60, 5);
    ctx.save();
    for (let i = 2; i < pts.length; i += 3) {
      const a = 1 - i / pts.length;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + a * 0.6})`;
      ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 3 + a * 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(30,15,70,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // power arc around the thrower
    const c = G.player.center();
    ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.arc(c.x, c.y - 10, 70, -Math.PI * 0.95, -Math.PI * 0.05); ctx.stroke();
    const pc = G.aim.power < 0.5 ? '#32e0c4' : G.aim.power < 0.8 ? '#ffcf33' : '#ff5a7a';
    ctx.strokeStyle = pc;
    ctx.beginPath(); ctx.arc(c.x, c.y - 10, 70, -Math.PI * 0.95, -Math.PI * 0.95 + Math.PI * 0.9 * G.aim.power); ctx.stroke();
    // slingshot band while dragging
    if (G.drag && G.drag.cur) {
      const a = G.drag.start, b = G.drag.cur;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(a.x, a.y, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pc; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------------- input handlers ---------------- */
  function onKey(e) {
    const code = e.code;
    // global keys
    if (code === 'KeyM' && !e.repeat) { LS.Audio.toggleMute(); LS.UI.syncIcons(); LS.UI.toast(LS.Audio.isMuted() ? 'Sound off' : 'Sound on'); return; }
    if (code === 'KeyF' && !e.repeat && document.activeElement?.tagName !== 'INPUT') { U.toggleFullscreen(); return; }
    if (G.mode !== 'battle' || G.paused || LS.UI.screen() !== 'battle') { LS.UI.menuKey(e); return; }
    if ((code === 'Escape' || code === 'KeyP') && !e.repeat) { pause(); return; }
    if (G.state !== 'aim' || e.repeat) return;
    if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') { e.original.preventDefault(); fire(G.player, G.hand[G.sel], G.aim.angle, G.aim.power); return; }
    if (code === 'Digit1' || code === 'Numpad1') pickCard(0);
    if (code === 'Digit2' || code === 'Numpad2') pickCard(1);
    if (code === 'Digit3' || code === 'Numpad3') pickCard(2);
    if (code === 'KeyQ') pickCard((G.sel + G.hand.length - 1) % G.hand.length);
    if (code === 'KeyE' || code === 'Tab') { e.original.preventDefault(); pickCard((G.sel + 1) % G.hand.length); }
  }
  function onDown(e) {
    if (G.mode !== 'battle' || G.paused || G.state !== 'aim') return;
    const p = toWorld(e.sx, e.sy);
    G.drag = { start: p, cur: p };
    LS.Audio.play('pull');
  }
  function onMove(e) {
    if (!G.drag) return;
    const p = toWorld(e.sx, e.sy);
    G.drag.cur = p;
    const dx = G.drag.start.x - p.x, dy = G.drag.start.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len > 6) {
      G.aim.angle = clamp(Math.atan2(dy, dx), -Math.PI + 0.1, 1.2);
      G.aim.power = clamp(len / C.MAX_DRAG, 0.05, 1);
      G.player.aim = { angle: G.aim.angle, power: G.aim.power };
    }
  }
  function onUp(e) {
    if (!G.drag) return;
    const d = G.drag; G.drag = null;
    if (e.cancelled || G.state !== 'aim' || G.paused) return;
    const len = Math.hypot(d.start.x - d.cur.x, d.start.y - d.cur.y);
    if (len < 22) return; // treat as a tap/cancel
    fire(G.player, G.hand[G.sel], G.aim.angle, G.aim.power);
  }

  /* ---------------- pause / navigation ---------------- */
  function pause() {
    if (G.mode !== 'battle' || G.paused || G.state === 'result') return;
    G.paused = true; G.drag = null;
    LS.UI.show('pause');
  }
  function resume() {
    if (!G.paused) return;
    G.paused = false;
    LS.UI.show('battle', false);
  }
  function toMenu() {
    G.mode = 'menu'; G.paused = false;
    LS.UI.hud(false);
    LS.UI.show('main');
    LS.Audio.startMusic('menu');
  }

  /* ---------------- main loop ---------------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (G.mode !== 'battle') return;
    if (!G.paused) {
      if (G.slowT > 0) { G.slowT -= dt; G.timeScale = lerp(G.timeScale, 0.3, 0.2); } else G.timeScale = lerp(G.timeScale, 1, 0.1);
      update(dt * G.timeScale);
      LS.UI.updateHud(G);
    }
    updateCamera(dt);
    render();
  }

  /* ---------------- boot ---------------- */
  function boot() {
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    U.load();
    LS.Audio.setVolumes(U.save.settings.sfx, U.save.settings.music);
    LS.Input.init(canvas);
    LS.Input.on('key', onKey);
    LS.Input.on('down', onDown);
    LS.Input.on('move', onMove);
    LS.Input.on('up', onUp);
    LS.UI.init({
      startBattle: () => startBattle(U.save.level),
      restart: () => startBattle(G.level),
      next: () => startBattle(U.save.level),
      pause, resume, toMenu,
      inBattle: () => G.mode === 'battle',
    });
    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.all([LS.Assets.load((p) => LS.UI.setLoading(p)), fontsReady]).then(() => {
      LS.UI.setLoading(1);
      setTimeout(() => {
        LS.UI.show('main');
        LS.Audio.startMusic('menu');
      }, 250);
    });
    requestAnimationFrame(frame);
  }

  // hooks used by entities (projectiles / explosions receive G as "game")
  G.dealDamage = dealDamage;
  G.later = (delay, fn) => G.timers.push({ t: delay, fn });
  const api = {
    get state() { return G; },
    dealDamage,
    startBattle, pause, resume, toMenu,
  };
  boot();
  return api;
})();
