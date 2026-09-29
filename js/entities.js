/* ==========================================================================
   Last Survivor — 08 · entities.js
   Fighter (animated stickman ⇄ ragdoll), projectiles for every weapon kind,
   explosions and damage resolution.
   ========================================================================== */
'use strict';

LS.Entities = (() => {
  const { clamp, lerp, rand, pick, segDist, easeInOut, easeOutCubic } = LS.U;
  const { J, LIMBS, Ragdoll, collideBody } = LS.Physics;
  const C = LS.CONFIG;
  const UPPER = 22, LOWER = 22, TORSO = 40, NECK = 16;

  // 2-bone IK: shoulder S → target T, returns [elbow, hand]
  function ik(sx, sy, tx, ty, bend) {
    let dx = tx - sx, dy = ty - sy;
    let d = Math.hypot(dx, dy);
    const max = UPPER + LOWER - 0.5;
    if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    if (d < 4) d = 4;
    const base = Math.atan2(dy, dx);
    const a = Math.acos(clamp((UPPER * UPPER + d * d - LOWER * LOWER) / (2 * UPPER * d), -1, 1));
    const ang = base + a * bend;
    const ex = sx + Math.cos(ang) * UPPER, ey = sy + Math.sin(ang) * UPPER;
    const hx = ex + Math.cos(Math.atan2(sy + dy - ey, sx + dx - ex)) * LOWER;
    const hy = ey + Math.sin(Math.atan2(sy + dy - ey, sx + dx - ex)) * LOWER;
    return [[ex, ey], [hx, hy]];
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  /* ====================================================================== */
  class Fighter {
    constructor(hero, x, groundY, dir, isPlayer, maxHp) {
      this.hero = hero;
      this.color = hero.color;
      this.dark = shade(hero.color, -0.35);
      this.outline = shade(hero.color, -0.72);
      const n = parseInt(hero.color.slice(1), 16);
      this.face = ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 80 ? '#f2f2f2' : '#1b1b24';
      this.root = { x, y: groundY };
      this.dir = dir;
      this.isPlayer = isPlayer;
      this.maxHp = maxHp; this.hp = maxHp; this.shownHp = maxHp;
      this.state = 'stand';
      this.t = rand(0, 5);
      this.aim = null;          // {angle, power} while aiming
      this.hold = null;         // weapon key shown in hand
      this.throwT = 1;          // 0..1 swing after release
      this.hurtT = 0;
      this.ragT = 0; this.calmT = 0;
      this.recoverFrom = null; this.recoverT = 0;
      this.blink = 0;
      this.fell = false; this.falls = 0; this.respawnT = 0;
      this.home = { x, y: groundY };
      this.cheer = 0;
      this.body = new Ragdoll(this.pose());
    }
    get alive() { return this.hp > 0; }
    get busy() { return this.state === 'ragdoll' || this.state === 'recover'; }
    point(i) { return this.body.p[i]; }
    center() { const p = this.body.p[J.NECK], q = this.body.p[J.PELVIS]; return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; }
    handPos() {
      const p = this.body.p[J.NECK];
      return { x: p.x + this.dir * 16, y: p.y - 8 };
    }
    launchOrigin() { return { x: this.root.x + this.dir * 18, y: this.root.y - 96 }; }

    pose() {
      const d = this.dir, t = this.t, R = this.root;
      const breath = Math.sin(t * 2.4) * 1.6;
      let lean = 2;
      if (this.aim) lean = -3 - this.aim.power * 4;
      if (this.throwT < 1) lean = lerp(-7, 8, easeOutCubic(this.throwT));
      if (this.cheer > 0) lean = 0;
      const pelvis = [R.x - d * 1, R.y - 42 + breath * 0.3];
      const neck = [pelvis[0] + d * lean, pelvis[1] - TORSO + breath * 0.2];
      const nlen = Math.hypot(neck[0] - pelvis[0], neck[1] - pelvis[1]);
      neck[0] = pelvis[0] + (neck[0] - pelvis[0]) * TORSO / nlen; neck[1] = pelvis[1] + (neck[1] - pelvis[1]) * TORSO / nlen;
      const head = [neck[0] + d * lean * 0.3, neck[1] - NECK];
      // legs
      const stance = this.aim ? 17 : 13;
      const [kb, fb] = ik(pelvis[0], pelvis[1], R.x - d * stance, R.y - 5, d > 0 ? -1 : 1);
      const [kf, ff] = ik(pelvis[0], pelvis[1], R.x + d * stance, R.y - 5, d > 0 ? -1 : 1);
      // arms
      let hb, hf, bendB = d > 0 ? 1 : -1, bendF = d > 0 ? 1 : -1;
      if (this.cheer > 0) {
        const w = Math.sin(t * 14) * 6;
        hb = [neck[0] - 18, neck[1] - 36 + w]; hf = [neck[0] + 18, neck[1] - 36 - w];
        bendB = -1; bendF = 1;
      } else if (this.aim) {
        const ux = Math.cos(this.aim.angle), uy = Math.sin(this.aim.angle);
        const pull = 22 + this.aim.power * 20;
        hb = [neck[0] - ux * pull, neck[1] - uy * pull + 4];
        hf = [neck[0] + ux * 40, neck[1] + uy * 40];
        bendB = d > 0 ? -1 : 1;
      } else if (this.throwT < 1) {
        // overhand swing: from behind the head, over the top, to forward-down
        const e = easeOutCubic(this.throwT);
        const ang = d > 0 ? lerp(-Math.PI + 0.7, 0.45, e) : lerp(Math.PI * 2 - 0.7, Math.PI - 0.45, e);
        hb = [neck[0] + Math.cos(ang) * 40, neck[1] + Math.sin(ang) * 40];
        hf = [neck[0] - d * 20, neck[1] + 34];
      } else {
        const sway = Math.sin(t * 2.4) * 2;
        hb = [neck[0] - d * 14, neck[1] + 40 + sway]; hf = [neck[0] + d * 16, neck[1] + 40 - sway];
      }
      const [eb, hb2] = ik(neck[0], neck[1], hb[0], hb[1], bendB);
      const [ef, hf2] = ik(neck[0], neck[1], hf[0], hf[1], bendF);
      return [head, neck, pelvis, eb, hb2, ef, hf2, kb, fb, kf, ff];
    }

    // drop back in from the sky above the home tower after a fall into the pit
    respawn() {
      this.fell = false; this.respawnT = 0;
      this.root.x = this.home.x; this.root.y = this.home.y - 420;
      this.aim = null; this.hold = null;
      this.body.setPose(this.pose(), false);
      this.state = 'ragdoll'; this.ragT = 0; this.calmT = 0;
    }

    toRagdoll() {
      if (this.state === 'ragdoll') { this.ragT = Math.min(this.ragT, 0.2); return; }
      this.state = 'ragdoll'; this.ragT = 0; this.calmT = 0; this.aim = null; this.hold = null;
    }

    hit(vx, vy, power, jointIdx) {
      this.toRagdoll();
      const dt = C.STEP;
      for (let i = 0; i < this.body.p.length; i++) {
        const k = i === jointIdx ? 1.4 : 0.75;
        this.body.impulse(i, vx * power * 0.45 * k, (vy * power * 0.3 - 170 * power) * k, dt);
      }
    }

    damage(amount, world, opts = {}) {
      if (!this.alive) return 0;
      amount = Math.max(1, Math.round(amount));
      this.hp = Math.max(0, this.hp - amount);
      this.hurtT = 0.9;
      const c = this.center();
      const big = amount >= 30;
      world.text(c.x + rand(-20, 20), c.y - 70, '-' + amount, big ? '#ffcf33' : '#ff5a6e', big ? 46 : 36);
      if (opts.headshot) { world.text(c.x, c.y - 120, 'HEADSHOT!', '#ffffff', 30); LS.Audio.play('headshot'); }
      else if (big) world.text(c.x, c.y - 120, pick(['CRUSHED!', 'BRUTAL!', 'WRECKED!', 'OUCH!']), '#9df3ff', 28);
      LS.Audio.play('pain');
      if (!this.alive) { this.toRagdoll(); LS.Audio.play('ko'); }
      return amount;
    }

    hitTest(x, y, r) {
      const p = this.body.p;
      const h = p[J.HEAD];
      if (Math.hypot(x - h.x, y - h.y) < r + h.r) return { joint: J.HEAD, head: true };
      let best = null;
      for (const [a, b] of LIMBS) {
        const s = segDist(x, y, p[a].x, p[a].y, p[b].x, p[b].y);
        if (s.d < r + 6 && (!best || s.d < best.d)) best = { d: s.d, joint: s.t < 0.5 ? a : b };
      }
      return best ? { joint: best.joint, head: false } : null;
    }

    update(dt, world) {
      this.t += dt;
      this.hurtT = Math.max(0, this.hurtT - dt);
      this.cheer = Math.max(0, this.cheer - dt);
      this.shownHp = lerp(this.shownHp, this.hp, 1 - Math.pow(0.02, dt));
      this.blink -= dt; if (this.blink < -3.5) this.blink = 0.12;
      if (this.throwT < 1) this.throwT = Math.min(1, this.throwT + dt * 3.2);

      if (this.state === 'stand') {
        const g = world.groundBelow(this.root.x, this.root.y, 20);
        if (g === null) { this.toRagdoll(); return; }
        this.root.y = g;
        this.body.setPose(this.pose(), false);
      } else if (this.state === 'recover') {
        this.recoverT += dt / 0.45;
        const k = easeInOut(Math.min(1, this.recoverT));
        const target = this.pose();
        const from = this.recoverFrom;
        this.body.setPose(target.map((q, i) => [lerp(from[i][0], q[0], k), lerp(from[i][1], q[1], k)]), false);
        if (this.recoverT >= 1) this.state = 'stand';
      }
    }

    // Called at the fixed physics rate
    physics(dt, world, extraForce) {
      if (this.state !== 'ragdoll') return;
      this.ragT += dt;
      if (this.body.p[J.PELVIS].y > C.DEATH_Y + 300) return; // sunk: stop simulating
      this.body.step(dt, world.solids(), extraForce);
      const pel = this.body.p[J.PELVIS];
      if (!this.fell && pel.y > C.PIT_Y + 6) {
        this.fell = true; this.falls++;
        world.splash(pel.x);
        LS.Audio.play('fall');
      }
      if (!this.alive || this.fell) return;
      const v = this.body.velocity();
      this.calmT = v < 45 ? this.calmT + dt : 0;
      if ((this.calmT > 0.35 && this.ragT > 0.6) || (this.ragT > 3.2 && v < 160)) {
        const g = world.groundBelow(pel.x, pel.y, 110);
        if (g !== null) {
          this.state = 'recover'; this.recoverT = 0;
          this.recoverFrom = this.body.p.map((q) => [q.x, q.y]);
          // stand where the body landed, but on solid footing
          const support = world.solids().filter((s) => pel.x >= s.x - 2 && pel.x <= s.x + s.w + 2 && Math.abs(s.y - g) < 1)[0];
          this.root.x = support ? clamp(pel.x, support.x + 14, support.x + support.w - 14) : pel.x;
          this.root.y = g;
          world.dust(this.root.x, g, 6);
        }
      }
    }

    /* ---------------- drawing ---------------- */
    draw(ctx, world) {
      const p = this.body.p;
      const pel = p[J.PELVIS];
      // ground shadow
      const g = world.groundBelow(pel.x, pel.y, 260);
      if (g !== null) {
        const h = clamp(1 - (g - pel.y - 40) / 220, 0.2, 1);
        ctx.fillStyle = `rgba(0,0,0,${0.28 * h})`;
        ctx.beginPath(); ctx.ellipse(pel.x, g - 2, 30 * h, 6 * h, 0, 0, Math.PI * 2); ctx.fill();
      }
      const line = (a, b, w, col) => { ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); ctx.stroke(); };
      const limb = (a, b, c, col) => {
        ctx.strokeStyle = col; ctx.lineWidth = 11;
        ctx.beginPath(); ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); ctx.lineTo(p[c].x, p[c].y); ctx.stroke();
      };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const flash = this.hurtT > 0.6 && Math.floor(this.hurtT * 20) % 2 === 0;
      const main = flash ? '#ffffff' : this.color, back = flash ? '#dddddd' : this.dark;
      // outlines first
      ctx.strokeStyle = this.outline; ctx.lineWidth = 16;
      for (const [a, b] of LIMBS) { ctx.beginPath(); ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); ctx.stroke(); }
      // back limbs
      limb(J.NECK, J.ELB_B, J.HAND_B, back);
      limb(J.PELVIS, J.KNEE_B, J.FOOT_B, back);
      // torso
      line(J.NECK, J.PELVIS, 13, main);
      // front limbs
      limb(J.PELVIS, J.KNEE_F, J.FOOT_F, main);
      // weapon in hand
      if (this.hold && this.alive) {
        const w = LS.WEAPONS[this.hold], hand = p[J.HAND_B];
        const img = LS.Assets.raster('w-' + this.hold, 96, 96);
        if (img) {
          const s = Math.max(26, w.size * 2.2);
          ctx.save(); ctx.translate(hand.x, hand.y);
          if (this.dir < 0) ctx.scale(-1, 1);
          ctx.rotate(Math.sin(this.t * 3) * 0.08);
          ctx.drawImage(img, -s / 2, -s / 2, s, s); ctx.restore();
        }
      }
      limb(J.NECK, J.ELB_F, J.HAND_F, main);
      // highlight stroke on torso (fake 3D rim light)
      ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(p[J.NECK].x - 3, p[J.NECK].y + 2); ctx.lineTo(p[J.PELVIS].x - 3, p[J.PELVIS].y - 2); ctx.stroke();
      this.drawHead(ctx, main);
    }

    drawHead(ctx, main) {
      const p = this.body.p, h = p[J.HEAD], n = p[J.NECK];
      const ang = Math.atan2(h.y - n.y, h.x - n.x) + Math.PI / 2;
      const d = this.state === 'stand' || this.state === 'recover' ? this.dir : (p[J.HAND_F].x > p[J.HAND_B].x ? 1 : -1) * 1 || this.dir;
      ctx.save();
      ctx.translate(h.x, h.y); ctx.rotate(ang);
      // head sphere with shading
      ctx.fillStyle = this.outline; ctx.beginPath(); ctx.arc(0, 0, 15.5, 0, Math.PI * 2); ctx.fill();
      const g = ctx.createRadialGradient(-4, -5, 2, 0, 0, 15);
      g.addColorStop(0, shade(this.hero.color, 0.45)); g.addColorStop(0.6, main); g.addColorStop(1, this.dark);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
      // face
      const face = this.face;
      ctx.fillStyle = face; ctx.strokeStyle = face; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
      const ex = 4 * d;
      if (!this.alive) {
        for (const ox of [-4, 5]) { ctx.beginPath(); ctx.moveTo(ex + ox - 2.5, -4.5); ctx.lineTo(ex + ox + 2.5, 0.5); ctx.moveTo(ex + ox + 2.5, -4.5); ctx.lineTo(ex + ox - 2.5, 0.5); ctx.stroke(); }
        ctx.beginPath(); ctx.arc(ex, 6, 3, 0, Math.PI * 2); ctx.stroke();
      } else if (this.hurtT > 0 || this.state === 'ragdoll') {
        ctx.beginPath(); ctx.moveTo(ex - 7, -5); ctx.lineTo(ex - 3, -2); ctx.lineTo(ex - 7, 1);
        ctx.moveTo(ex + 7, -5); ctx.lineTo(ex + 3, -2); ctx.lineTo(ex + 7, 1); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(ex, 6, 3, 3.6, 0, 0, Math.PI * 2); ctx.fill();
      } else {
        const bl = this.blink > 0 ? 0.6 : 2.6;
        ctx.beginPath(); ctx.ellipse(ex - 3.5, -2, 2, bl, 0, 0, Math.PI * 2); ctx.ellipse(ex + 4.5, -2, 2, bl, 0, 0, Math.PI * 2); ctx.fill();
        if (this.aim) { ctx.beginPath(); ctx.moveTo(ex - 7, -7.5); ctx.lineTo(ex - 1, -5.5); ctx.moveTo(ex + 8, -7.5); ctx.lineTo(ex + 2, -5.5); ctx.stroke(); }
        ctx.beginPath();
        if (this.cheer > 0) { ctx.arc(ex + 0.5, 3.5, 4, 0, Math.PI); ctx.fill(); }
        else ctx.arc(ex + 0.5, 3, 3.5, 0.3, Math.PI - 0.3); ctx.stroke();
      }
      // gloss
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-5, -7, 4, 2.4, -0.6, 0, Math.PI * 2); ctx.fill();
      // hat
      const hat = LS.Assets.raster('hat-' + this.hero.hat, 118, 118);
      if (hat) {
        const s = 13 / 22, size = 100 * s;
        if (d < 0) ctx.scale(-1, 1);
        ctx.drawImage(hat, -50 * s, -70 * s, size, size);
      }
      ctx.restore();
    }
  }

  /* ====================================================================== */
  class Projectile {
    constructor(key, x, y, vx, vy, owner, opts = {}) {
      this.key = key;
      this.w = LS.WEAPONS[key] || LS.WEAPONS.rock;
      this.kind = opts.kind || this.w.kind;
      this.sprite = opts.sprite || key;
      this.x = x; this.y = y; this.vx = vx; this.vy = vy;
      this.r = opts.r || this.w.size;
      this.grav = opts.grav !== undefined ? opts.grav : this.w.grav;
      this.dmg = opts.dmg !== undefined ? opts.dmg : this.w.dmg;
      this.blast = opts.blast || this.w.blast;
      this.owner = owner;
      this.age = 0; this.rot = Math.atan2(vy, vx); this.rest = 0;
      this.fuse = this.w.fuse || 0;
      this.hitsLeft = this.w.hits || 1;
      this.cool = new Map();
      this.dead = false; this.split = false;
      this.hole = null; // black-hole state
      this.trailT = 0;
      this.leftOwner = false;
    }

    update(dt, game) {
      const world = game.world;
      this.age += dt;
      if (this.hole) return this.updateHole(dt, game);
      this.vy += C.GRAVITY * this.grav * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      const speed = Math.hypot(this.vx, this.vy);
      if (this.w.align || this.kind === 'bullet') this.rot = Math.atan2(this.vy, this.vx);
      else this.rot += (this.w.spin || 3) * dt * Math.sign(this.vx || 1) * clamp(speed / 600, 0.2, 1.5);

      // trails
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.02;
        if (this.w.trail === 'smoke' || this.w.trail === 'fire') {
          world.emit({ x: this.x - this.vx * 0.02, y: this.y - this.vy * 0.02, vx: rand(-20, 20), vy: rand(-20, 20), life: 0.7, size: 6, grow: 18, color: 'rgba(200,200,210,0.6)', kind: 'smoke', drag: 0.95 });
          world.emit({ x: this.x - this.vx * 0.015, y: this.y - this.vy * 0.015, life: 0.18, size: 12, color: 'rgba(255,170,40,1)', kind: 'fire', add: true });
        } else if (this.kind === 'fuse' || this.kind === 'cluster') {
          world.emit({ x: this.x + rand(-3, 3), y: this.y - this.r, vx: rand(-60, 60), vy: rand(-120, -20), life: 0.25, size: 2, color: '#ffd84d', kind: 'spark', add: true });
        } else if (this.kind === 'blackhole') {
          world.emit({ x: this.x, y: this.y, life: 0.35, size: 10, color: 'rgba(170,90,255,0.8)', kind: 'dot', add: true, grow: -20 });
        } else if (this.kind === 'bullet') {
          world.emit({ x: this.x, y: this.y, vx: this.vx * 0.3, vy: this.vy * 0.3, life: 0.06, size: 3, color: '#fff3b0', kind: 'spark', add: true });
        }
      }
      if (this.kind === 'fuse') {
        this.fuse -= dt;
        if (Math.floor(this.fuse * 8) !== Math.floor((this.fuse + dt) * 8)) LS.Audio.play('fuse');
        if (this.fuse <= 0) return this.detonate(game);
      }
      if (this.kind === 'cluster' && !this.split && this.vy > 40 && this.age > 0.25) return this.splitCluster(game);
      if (this.kind === 'blackhole' && this.age > 1.7) return this.openHole(game);

      // fighters
      for (const f of game.fighters) {
        if (f === this.owner && !this.leftOwner) continue;
        if ((this.cool.get(f) || 0) > this.age) continue;
        const h = f.hitTest(this.x, this.y, this.r);
        if (!h) continue;
        if (this.onFighter(f, h, speed, game)) return;
      }
      if (this.owner && !this.leftOwner) {
        const c = this.owner.center();
        if (Math.hypot(this.x - c.x, this.y - c.y) > 90 || this.age > 0.4) this.leftOwner = true;
      }

      // world
      const bounce = this.kind === 'bullet' ? 0 : this.w.bounce;
      const hit = collideBody(this, world.solids(), bounce, this.kind === 'bouncy' ? 0.02 : 0.25);
      if (hit) this.onSolid(hit, game);

      // pit / bounds
      if (this.y > C.PIT_Y + 4 && !this.splashed) {
        this.splashed = true;
        world.splash(this.x);
        this.dead = true;
      }
      if (this.x < -400 || this.x > C.WORLD_W + 400 || this.age > 9) this.dead = true;
      if ((this.kind === 'solid' || this.kind === 'bouncy') && speed < 40) {
        this.rest += dt; if (this.rest > 0.5) this.dead = true;
      } else this.rest = 0;
    }

    onFighter(f, h, speed, game) {
      const world = game.world;
      const sf = clamp(speed / 900, 0.6, 1.35);
      if (this.kind === 'impact' || this.kind === 'cluster' || this.kind === 'blackhole') {
        if (this.kind === 'blackhole') { this.openHole(game); return true; }
        this.detonate(game, f); return true;
      }
      if (this.kind === 'fuse') {
        f.hit(this.vx * 0.2, this.vy * 0.2, 0.6, h.joint);
        game.dealDamage(f, 5, this.owner);
        this.vx *= -0.4; this.vy *= -0.3;
        this.cool.set(f, this.age + 0.4);
        return false;
      }
      // physical hit
      const mult = h.head ? 1.5 : 1;
      const dmg = this.dmg * sf * mult;
      const knock = this.w.knock || 0.4;
      f.hit(this.vx, this.vy, knock, h.joint);
      game.dealDamage(f, dmg, this.owner, { headshot: h.head && this.kind !== 'bullet' });
      LS.Audio.play('hit', sf);
      world.addShake(4 + knock * 8);
      world.burst(this.x, this.y, 10, () => ({ x: this.x, y: this.y, vx: rand(-300, 300), vy: rand(-300, 200), life: rand(0.2, 0.45), size: rand(2, 4), color: pick(['#fff', '#ffe066', '#ffb347']), kind: 'spark', add: true }));
      world.emit({ x: this.x, y: this.y, kind: 'star', life: 0.4, size: 22, vr: 6, color: '#fff6b0', add: true });
      world.emit({ x: this.x, y: this.y, kind: 'ring', life: 0.3, size: 8, grow: 160, color: 'rgba(255,255,255,0.9)' });
      if (this.kind === 'bullet') { this.dead = true; return true; }
      this.hitsLeft--;
      this.cool.set(f, this.age + 0.35);
      this.vx *= -0.35; this.vy = -Math.abs(this.vy) * 0.4 - 120;
      if (this.hitsLeft <= 0) this.dmg = 0;
      return false;
    }

    onSolid(hit, game) {
      const world = game.world;
      if (this.kind === 'impact' || this.kind === 'cluster') return this.detonate(game);
      if (this.kind === 'blackhole') return this.openHole(game);
      const s = hit.solid;
      if (this.kind === 'bullet') {
        world.burst(this.x, this.y, 5, () => ({ x: this.x, y: this.y, vx: rand(-200, 200), vy: rand(-250, 0), life: 0.25, size: 2, color: '#ffe8a3', kind: 'spark', add: true }));
        if (s.prop) this.propHit(s, 6, game);
        this.dead = true; return;
      }
      if (hit.speed > 120) {
        LS.Audio.play(this.kind === 'bouncy' ? 'bounce' : 'thud', clamp(hit.speed / 900, 0.2, 1));
        if (hit.speed > 300) world.dust(this.x, this.y + this.r * 0.5, 5);
        if (s.prop && this.kind !== 'fuse') this.propHit(s, (this.dmg || 10) * clamp(hit.speed / 700, 0.3, 1.5), game);
        else if (s.prop && hit.speed > 400) this.propHit(s, 4, game);
      }
    }

    propHit(p, amount, game) {
      const res = game.world.damageProp(p, amount);
      if (res && res.explode) game.later(0.05, () => explode(game, res.x, res.y, res.blast, this.owner));
    }

    detonate(game) {
      if (this.dead) return;
      this.dead = true;
      explode(game, this.x, this.y, this.blast, this.owner, { nuke: this.w.nuke });
    }

    splitCluster(game) {
      this.split = true; this.dead = true;
      const n = this.w.count;
      LS.Audio.play('gun');
      game.world.burst(this.x, this.y, 12, () => ({ x: this.x, y: this.y, vx: rand(-200, 200), vy: rand(-200, 200), life: 0.3, size: 3, color: '#ffb347', kind: 'spark', add: true }));
      for (let i = 0; i < n; i++) {
        const spread = (i - (n - 1) / 2) * 90;
        game.projectiles.push(new Projectile('cluster', this.x, this.y, this.vx * 0.9 + spread, this.vy * 0.3 - rand(40, 160), this.owner, { kind: 'impact', sprite: 'bomblet', r: 9, grav: 1, blast: this.w.blast }));
      }
    }

    openHole(game) {
      if (this.hole) return;
      this.hole = { t: 0, dur: 1.9 };
      this.vx = this.vy = 0;
      LS.Audio.play('blackhole');
      game.world.addShake(6);
    }

    updateHole(dt, game) {
      const H = this.hole, world = game.world;
      H.t += dt;
      const strength = 5200 * Math.min(1, H.t / 0.4);
      // swirl particles
      for (let i = 0; i < 3; i++) {
        const a = rand(0, Math.PI * 2), r = rand(90, 190);
        world.emit({ x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 2 + -Math.sin(a) * 180, vy: -Math.sin(a) * r * 2 + Math.cos(a) * 180, life: 0.45, size: rand(2, 4), color: pick(['#b98cff', '#ff8cf0', '#ffffff']), kind: 'dot', add: true, drag: 1 });
      }
      for (const f of game.fighters) {
        const c = f.center();
        const d = Math.hypot(c.x - this.x, c.y - this.y);
        if (d < 420) {
          f.toRagdoll(); f.ragT = 0;
          f.holeForce = { x: this.x, y: this.y, s: strength * (1 - d / 480) };
        }
      }
      game.holeActive = this;
      if (H.t >= H.dur) {
        for (const f of game.fighters) f.holeForce = null;
        game.holeActive = null;
        this.dead = true;
        explode(game, this.x, this.y, this.blast, this.owner, { implode: true });
      }
    }

    draw(ctx) {
      if (this.hole) {
        const H = this.hole, k = Math.min(1, H.t / 0.3) * (H.t > H.dur - 0.2 ? (H.dur - H.t) / 0.2 : 1);
        const r = 60 * k + Math.sin(H.t * 30) * 3;
        ctx.save();
        const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r * 2.4);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.35, 'rgba(10,0,30,1)'); g.addColorStop(0.45, 'rgba(160,80,255,0.9)'); g.addColorStop(0.6, 'rgba(255,120,240,0.35)'); g.addColorStop(1, 'rgba(120,60,255,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, r * 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,200,255,0.8)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(this.x, this.y, r * 1.6, r * 0.4, H.t * 3, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        return;
      }
      const size = this.kind === 'bullet' ? 18 : this.r * 2.4;
      const img = LS.Assets.raster('w-' + this.sprite, 96, 96);
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rot);
      if (img) ctx.drawImage(img, -size / 2, -size / 2, size, size);
      else { ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(0, 0, this.r, 0, 7); ctx.fill(); }
      if (this.kind === 'fuse' && this.fuse < 0.8 && Math.floor(this.fuse * 12) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,60,60,0.55)'; ctx.beginPath(); ctx.arc(0, 0, this.r * 1.2, 0, 7); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ====================================================================== */
  function explode(game, x, y, blast, source, opts = {}) {
    const world = game.world;
    const size = blast.r / 130;
    if (opts.nuke) {
      LS.Audio.play('nuke');
      world.flash = 1; world.addShake(40);
      for (let i = 0; i < 70; i++) {
        const t = i / 70;
        world.emit({ x: x + rand(-30, 30), y: y - t * 360, vx: rand(-30, 30), vy: -rand(40, 160), life: rand(1.6, 3), size: rand(30, 60) * (t > 0.7 ? 1.8 : 1), grow: 30, color: t > 0.7 ? 'rgba(90,70,70,0.9)' : 'rgba(120,100,95,0.8)', kind: 'smoke', drag: 0.97 });
        world.emit({ x: x + rand(-40, 40), y: y - t * 360, vx: rand(-60, 60), vy: -rand(60, 200), life: rand(0.7, 1.6), size: rand(30, 70), color: pick(['rgba(255,160,40,1)', 'rgba(255,90,20,1)', 'rgba(255,220,120,1)']), kind: 'fire', add: true, drag: 0.97 });
      }
      for (let i = 0; i < 40; i++) {
        const a = rand(0, Math.PI * 2);
        world.emit({ x: x + Math.cos(a) * 360, y: y - 360 + Math.sin(a) * 90, vx: Math.cos(a) * 260, vy: Math.sin(a) * 50, life: rand(1.5, 2.6), size: rand(40, 70), grow: 20, color: 'rgba(110,90,90,0.8)', kind: 'smoke', drag: 0.96 });
      }
      world.emit({ x, y, kind: 'ring', life: 1.1, size: 40, grow: 900, color: 'rgba(255,255,255,0.9)' });
      world.light(x, y, 900, '255,220,160', 1.6);
    } else if (opts.implode) {
      LS.Audio.play('explosion', size);
      world.emit({ x, y, kind: 'ring', life: 0.5, size: blast.r * 1.4, grow: -blast.r * 2.4, color: 'rgba(210,140,255,0.9)' });
      world.burst(x, y, 40, () => { const a = rand(0, Math.PI * 2), s = rand(200, 700); return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(0.4, 0.9), size: rand(2, 5), color: pick(['#d0a0ff', '#ff9cf5', '#fff']), kind: 'spark', add: true }; });
      world.light(x, y, blast.r * 2.2, '190,120,255', 0.6);
      world.addShake(18);
    } else {
      LS.Audio.play('explosion', size);
      world.addShake(10 + size * 14);
    }
    if (!opts.implode) {
      const n = Math.round(18 * size + 8);
      world.burst(x, y, n, () => { const a = rand(0, Math.PI * 2), s = rand(40, 260) * size; return { x: x + Math.cos(a) * 10, y: y + Math.sin(a) * 10, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: rand(0.35, 0.7), size: rand(22, 44) * Math.sqrt(size), color: pick(['rgba(255,190,60,1)', 'rgba(255,120,30,1)', 'rgba(255,230,140,1)']), kind: 'fire', add: true, drag: 0.9 }; });
      world.burst(x, y, n, () => { const a = rand(0, Math.PI * 2), s = rand(30, 200) * size; return { x: x + rand(-20, 20), y: y + rand(-20, 20), vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, life: rand(0.9, 1.8), size: rand(16, 30) * Math.sqrt(size), grow: 26, color: pick(['rgba(70,65,70,0.75)', 'rgba(110,105,110,0.7)', 'rgba(50,45,50,0.8)']), kind: 'smoke', drag: 0.94 }; });
      world.burst(x, y, 22, () => { const a = rand(0, Math.PI * 2), s = rand(300, 900); return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, grav: 0.6, life: rand(0.3, 0.8), size: rand(2, 4), color: pick(['#fff5c0', '#ffcf33', '#ff8a3d']), kind: 'spark', add: true, drag: 0.96 }; });
      world.burst(x, y, 8, () => ({ x, y, vx: rand(-400, 400), vy: rand(-700, -200), grav: 1, life: rand(0.8, 1.5), size: rand(5, 10), rot: rand(0, 6), vr: rand(-15, 15), color: world.theme.topDark, kind: 'debris' }));
      world.emit({ x, y, kind: 'ring', life: 0.35, size: 10, grow: blast.r * 3.2, color: 'rgba(255,255,255,0.85)' });
      world.emit({ x, y, kind: 'fire', life: 0.18, size: blast.r * 0.9, color: 'rgba(255,255,220,1)', add: true });
      world.light(x, y, blast.r * 3, '255,190,90', 0.5);
    }

    // fighters
    for (const f of game.fighters) {
      let dmin = Infinity;
      for (const q of f.body.p) dmin = Math.min(dmin, Math.hypot(q.x - x, q.y - y));
      if (dmin > blast.r) continue;
      const k = 1 - dmin / blast.r;
      f.toRagdoll();
      for (const q of f.body.p) {
        const dx = q.x - x, dy = q.y - y, d = Math.hypot(dx, dy) || 1;
        const kk = clamp(1 - d / (blast.r * 1.3), 0.15, 1);
        f.body.impulse(f.body.p.indexOf(q), (dx / d) * blast.force * 0.55 * kk, ((dy / d) * blast.force * 0.5 - blast.force * 0.28) * kk, C.STEP);
      }
      game.dealDamage(f, blast.dmg * (0.35 + 0.65 * k), source);
    }
    // props (chain reactions)
    for (const p of world.props) {
      if (p.dead) continue;
      const cx = clamp(x, p.x, p.x + p.w), cy = clamp(y, p.y, p.y + p.h);
      const d = Math.hypot(cx - x, cy - y);
      if (d > blast.r) continue;
      const res = world.damageProp(p, blast.dmg * 1.5 * (1 - d / blast.r) + 12);
      if (res && res.explode) game.later(0.12 + rand(0, 0.08), () => explode(game, res.x, res.y, res.blast, source));
    }
    // shove loose projectiles
    for (const pr of game.projectiles) {
      if (pr.dead || pr.hole) continue;
      const dx = pr.x - x, dy = pr.y - y, d = Math.hypot(dx, dy) || 1;
      if (d < blast.r) { pr.vx += (dx / d) * blast.force * 0.6; pr.vy += (dy / d) * blast.force * 0.6 - 200; }
    }
  }

  return { Fighter, Projectile, explode, shade };
})();
