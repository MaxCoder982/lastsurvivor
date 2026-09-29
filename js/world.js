/* ==========================================================================
   Last Survivor — 07 · world.js
   Arena: terrain, destructible props, hazard pit, particles, floating text,
   dynamic lights and all environment rendering.
   ========================================================================== */
'use strict';

LS.World = (() => {
  const { rand, clamp, pick } = LS.U;
  const C = LS.CONFIG;

  class World {
    constructor(level) {
      this.level = level;
      const themeKey = LS.THEME_ORDER[(level - 1) % LS.THEME_ORDER.length];
      this.themeKey = themeKey;
      this.theme = LS.THEMES[themeKey];
      const tpl = LS.MAPS[(level - 1 + Math.floor((level - 1) / LS.THEME_ORDER.length)) % LS.MAPS.length];
      this.terrain = tpl.terrain.map((r) => {
        const t = { x: r.x, y: r.y, w: r.w, h: r.h, terrain: true };
        if (t.y + t.h >= C.WORLD_H - 2) t.h = 1600 - t.y; // towers reach the abyss
        return t;
      });
      this.spawn = tpl.spawn.slice();
      this.props = tpl.props.map((p) => this.makeProp(p.t, p.x, p.y));
      this.particles = [];
      this.texts = [];
      this.lights = [];
      this.shake = 0;
      this.time = 0;
      this.flash = 0;
      this.pattern = null;
      this.decor = this.makeDecor();
    }

    makeProp(type, cx, bottom) {
      const d = LS.PROP_TYPES[type];
      return { type, x: cx - d.w / 2, y: bottom - d.h, w: d.w, h: d.h, hp: d.hp, vy: 0, def: d, dead: false, wob: 0, prop: true };
    }

    makeDecor() {
      // grass tufts / rocks / snow drifts on tower tops (purely visual)
      const out = [];
      const r = LS.U.seeded(this.level * 7 + 3);
      for (const t of this.terrain) {
        const n = Math.floor(t.w / 34);
        for (let i = 0; i < n; i++) out.push({ x: t.x + 8 + r() * (t.w - 16), y: t.y, s: 0.6 + r() * 0.8, k: Math.floor(r() * 3) });
      }
      return out;
    }

    solids() {
      const arr = this.terrain.slice();
      for (const p of this.props) if (!p.dead) arr.push(p);
      return arr;
    }

    groundBelow(x, y, maxDist = 160) {
      let best = null;
      for (const s of this.solids()) {
        if (x < s.x - 2 || x > s.x + s.w + 2) continue;
        if (s.y >= y - 30 && s.y - y < maxDist && (best === null || s.y < best)) best = s.y;
      }
      return best;
    }

    /* ---------------- particles ---------------- */
    emit(o) {
      const q = LS.U.save.settings.quality === 'low';
      if (q && this.particles.length > 220 && o.kind !== 'ring') return;
      if (this.particles.length > 700) this.particles.shift();
      this.particles.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, size: 6, grav: 0, drag: 0.98, rot: 0, vr: 0, color: '#fff', kind: 'dot', add: false, grow: 0 }, o, { max: o.life || 1 }));
    }
    burst(x, y, n, f) { const k = LS.U.save.settings.quality === 'low' ? 0.5 : 1; for (let i = 0; i < Math.ceil(n * k); i++) this.emit(f(i)); }
    text(x, y, str, color = '#fff', size = 34) { this.texts.push({ x, y, str, color, size, life: 1.4, max: 1.4, vy: -70 }); }
    light(x, y, r, color = '255,190,90', life = 0.35) { this.lights.push({ x, y, r, color, life, max: life }); }
    addShake(a) { if (LS.U.save.settings.shake) this.shake = Math.min(40, this.shake + a); }

    dust(x, y, n = 8) {
      this.burst(x, y, n, () => ({ x: x + rand(-10, 10), y, vx: rand(-90, 90), vy: rand(-80, -10), life: rand(0.4, 0.8), size: rand(5, 11), grow: 12, color: 'rgba(230,220,200,0.7)', kind: 'smoke', drag: 0.92 }));
    }
    splash(x) {
      const th = this.theme;
      LS.Audio.play('splash');
      this.burst(x, C.PIT_Y, 26, () => ({ x: x + rand(-18, 18), y: C.PIT_Y, vx: rand(-160, 160), vy: rand(-620, -200), grav: 1, life: rand(0.6, 1.1), size: rand(4, 9), color: th.pitKind === 'lava' ? pick(['#ffcc33', '#ff6a1a']) : th.pit[0], kind: 'dot' }));
      this.emit({ x, y: C.PIT_Y, kind: 'ring', life: 0.6, size: 20, grow: 200, color: 'rgba(255,255,255,0.8)', ring: 'flat' });
    }

    breakProp(p, byExplosion = false) {
      if (p.dead) return;
      p.dead = true;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      if (p.def.blast) return { explode: true, x: cx, y: cy, blast: p.def.blast };
      LS.Audio.play('crate');
      this.burst(cx, cy, 14, () => ({ x: cx + rand(-20, 20), y: cy + rand(-20, 20), vx: rand(-280, 280), vy: rand(-520, -120), grav: 1, life: rand(0.9, 1.6), size: rand(8, 18), rot: rand(0, 6), vr: rand(-12, 12), color: pick(['#c98a45', '#a8692b', '#7a4a1c']), kind: 'plank', drag: 0.995 }));
      this.dust(cx, p.y + p.h, 10);
      return byExplosion ? null : null;
    }

    damageProp(p, amount) {
      if (p.dead || p.hp === Infinity) { p.wob = 0.25; return null; }
      p.hp -= amount; p.wob = 0.3;
      if (p.hp <= 0) return this.breakProp(p);
      LS.Audio.play('thud', 0.6);
      return null;
    }

    update(dt) {
      this.time += dt;
      this.shake *= Math.pow(0.001, dt);
      if (this.shake < 0.2) this.shake = 0;
      this.flash = Math.max(0, this.flash - dt * 1.4);
      // props fall until supported
      for (const p of this.props) {
        if (p.dead) continue;
        p.wob = Math.max(0, p.wob - dt);
        p.vy += C.GRAVITY * dt;
        let ny = p.y + p.vy * dt, landed = false;
        for (const s of this.solids()) {
          if (s === p) continue;
          if (p.x + p.w <= s.x + 3 || p.x >= s.x + s.w - 3) continue;
          if (p.y + p.h <= s.y + 1 && ny + p.h >= s.y) { ny = s.y - p.h; landed = true; }
        }
        if (landed) { if (p.vy > 400) { LS.Audio.play('thud', 0.5); this.dust(p.x + p.w / 2, ny + p.h, 6); } p.vy = 0; }
        p.y = ny;
        if (p.y > C.PIT_Y && !p.splashed) { p.splashed = true; this.splash(p.x + p.w / 2); }
        if (p.y > C.DEATH_Y + 200) p.dead = true;
      }
      // particles
      for (const q of this.particles) {
        q.life -= dt;
        q.vy += C.GRAVITY * q.grav * dt;
        q.vx *= Math.pow(q.drag, dt * 60); q.vy *= Math.pow(q.drag, dt * 60);
        q.x += q.vx * dt; q.y += q.vy * dt;
        q.rot += q.vr * dt; q.size += q.grow * dt;
        if (q.kind === 'plank' || q.kind === 'confetti' || q.kind === 'debris') {
          if (q.y > C.PIT_Y + 20) q.life = Math.min(q.life, 0.1);
          for (const s of this.terrain) if (q.x > s.x && q.x < s.x + s.w && q.y > s.y && q.y < s.y + 20) { q.y = s.y; q.vy *= -0.3; q.vx *= 0.6; q.vr *= 0.5; }
        }
      }
      this.particles = this.particles.filter((q) => q.life > 0);
      for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.96; }
      this.texts = this.texts.filter((t) => t.life > 0);
      for (const l of this.lights) l.life -= dt;
      this.lights = this.lights.filter((l) => l.life > 0);
    }

    /* ---------------- rendering ---------------- */
    drawBackground(ctx, w, h) {
      const bg = LS.Assets.cover('bg-' + this.theme.bg, w, h);
      if (bg) ctx.drawImage(bg, 0, 0);
      else { ctx.fillStyle = '#6fb7ff'; ctx.fillRect(0, 0, w, h); }
    }

    drawHazard(ctx, cam) {
      const th = this.theme, t = this.time;
      const x0 = cam.left - 50, x1 = cam.right + 50;
      const g = ctx.createLinearGradient(0, C.PIT_Y, 0, C.PIT_Y + 300);
      g.addColorStop(0, th.pit[0]); g.addColorStop(1, th.pit[1]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, 1600);
      for (let x = x0; x <= x1; x += 20) ctx.lineTo(x, C.PIT_Y + Math.sin(x * 0.02 + t * 2) * 5 + Math.sin(x * 0.051 - t * 1.3) * 3);
      ctx.lineTo(x1, 1600); ctx.closePath(); ctx.fill();
      // surface highlight
      ctx.strokeStyle = th.pitKind === 'lava' ? 'rgba(255,240,160,0.9)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      for (let x = x0; x <= x1; x += 20) { const y = C.PIT_Y + Math.sin(x * 0.02 + t * 2) * 5 + Math.sin(x * 0.051 - t * 1.3) * 3; x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      ctx.stroke();
      if (th.pitKind === 'lava') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const lg = ctx.createLinearGradient(0, C.PIT_Y - 120, 0, C.PIT_Y);
        lg.addColorStop(0, 'rgba(255,90,20,0)'); lg.addColorStop(1, 'rgba(255,120,30,0.35)');
        ctx.fillStyle = lg; ctx.fillRect(x0, C.PIT_Y - 120, x1 - x0, 120);
        ctx.restore();
        if (Math.random() < 0.15) this.emit({ x: rand(x0, x1), y: C.PIT_Y, vx: rand(-20, 20), vy: rand(-240, -120), grav: 0.5, life: rand(0.6, 1.2), size: rand(2, 5), color: '#ffcc33', add: true });
      }
    }

    drawTerrain(ctx) {
      const th = this.theme;
      if (!this.pattern) {
        const tile = LS.Assets.raster('tile-' + this.themeKey, 64, 64);
        this.pattern = tile ? ctx.createPattern(tile, 'repeat') : th.edge;
      }
      for (const t of this.terrain) {
        const h = Math.min(t.h, 1600);
        // soft drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(t.x + 10, t.y + 12, t.w, h);
        // body texture
        ctx.fillStyle = this.pattern;
        ctx.fillRect(t.x, t.y, t.w, h);
        // ambient occlusion / depth shading
        const g = ctx.createLinearGradient(0, t.y, 0, t.y + Math.min(h, 360));
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)');
        ctx.fillStyle = g; ctx.fillRect(t.x, t.y, t.w, h);
        const sg = ctx.createLinearGradient(t.x, 0, t.x + t.w, 0);
        sg.addColorStop(0, 'rgba(255,255,255,0.10)'); sg.addColorStop(0.15, 'rgba(255,255,255,0)'); sg.addColorStop(0.85, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = sg; ctx.fillRect(t.x, t.y, t.w, h);
        // top cap
        const capH = t.h < 60 ? 12 : 18;
        ctx.fillStyle = th.topDark;
        roundRect(ctx, t.x - 6, t.y - 4, t.w + 12, capH + 6, 8); ctx.fill();
        ctx.fillStyle = th.top;
        roundRect(ctx, t.x - 6, t.y - 6, t.w + 12, capH, 8); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(t.x, t.y - 4, t.w, 3);
        // outline
        ctx.strokeStyle = th.edge; ctx.lineWidth = 3;
        ctx.strokeRect(t.x, t.y + capH - 6, t.w, h);
      }
      // decor
      for (const d of this.decor) {
        ctx.save(); ctx.translate(d.x, d.y - 4); ctx.scale(d.s, d.s);
        if (this.themeKey === 'meadow') {
          ctx.fillStyle = '#4caf3a';
          ctx.beginPath(); ctx.moveTo(-8, 0); ctx.quadraticCurveTo(-6, -14, -2, -18); ctx.quadraticCurveTo(-2, -8, 0, 0);
          ctx.moveTo(0, 0); ctx.quadraticCurveTo(3, -16, 8, -20); ctx.quadraticCurveTo(5, -8, 7, 0); ctx.fill();
          if (d.k === 0) { ctx.fillStyle = '#fff36b'; ctx.beginPath(); ctx.arc(8, -20, 3, 0, 7); ctx.fill(); }
        } else if (this.themeKey === 'snow') {
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, 0, 14, 6, 0, Math.PI, 0); ctx.fill();
        } else if (this.themeKey === 'desert' && d.k === 0) {
          ctx.fillStyle = '#4f8f3a'; roundRect(ctx, -3, -24, 7, 24, 3); ctx.fill(); roundRect(ctx, -10, -16, 5, 10, 2); ctx.fill(); roundRect(ctx, 5, -19, 5, 9, 2); ctx.fill();
        } else if (this.themeKey === 'volcano' && d.k === 0) {
          ctx.fillStyle = '#2a1416'; ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-3, -12); ctx.lineTo(7, -8); ctx.lineTo(10, 0); ctx.fill();
          ctx.fillStyle = '#ff7a33'; ctx.fillRect(-2, -6, 4, 2);
        } else if (this.themeKey === 'night' && d.k === 0) {
          ctx.fillStyle = '#39415e'; ctx.fillRect(-8, -14, 16, 14); ctx.fillStyle = '#8fe3ff'; ctx.fillRect(-5, -11, 4, 4);
        }
        ctx.restore();
      }
    }

    drawProps(ctx) {
      for (const p of this.props) {
        if (p.dead) continue;
        const img = LS.Assets.raster('prop-' + p.def.sprite, p.w * 2, p.h * 2);
        ctx.save();
        const wob = p.wob > 0 ? Math.sin(p.wob * 60) * p.wob * 0.25 : 0;
        ctx.translate(p.x + p.w / 2, p.y + p.h);
        ctx.rotate(wob);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(4, 0, p.w * 0.55, 5, 0, 0, 7); ctx.fill();
        if (img) ctx.drawImage(img, -p.w / 2, -p.h, p.w, p.h);
        if (p.def.hp !== Infinity && p.hp < p.def.hp && p.hp > 0) {
          // cracks
          ctx.strokeStyle = 'rgba(40,20,5,0.8)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-p.w * 0.3, -p.h * 0.8); ctx.lineTo(-p.w * 0.05, -p.h * 0.55); ctx.lineTo(-p.w * 0.2, -p.h * 0.3); ctx.moveTo(-p.w * 0.05, -p.h * 0.55); ctx.lineTo(p.w * 0.25, -p.h * 0.6); ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawParticles(ctx, layer) {
      for (const q of this.particles) {
        const front = q.kind !== 'smoke';
        if ((layer === 'back') === front) continue;
        const a = clamp(q.life / q.max, 0, 1);
        ctx.save();
        if (q.add) ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = q.kind === 'smoke' ? a * 0.8 : Math.min(1, a * 1.5);
        ctx.fillStyle = q.color;
        switch (q.kind) {
          case 'smoke':
          case 'dot':
            ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(0.5, q.size), 0, Math.PI * 2); ctx.fill(); break;
          case 'fire': {
            const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.size);
            g.addColorStop(0, 'rgba(255,255,220,1)'); g.addColorStop(0.35, q.color); g.addColorStop(1, 'rgba(255,60,0,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill(); break;
          }
          case 'plank': case 'debris': case 'confetti':
            ctx.translate(q.x, q.y); ctx.rotate(q.rot);
            if (q.kind === 'confetti') ctx.fillRect(-q.size / 2, -q.size / 4, q.size, q.size / 2);
            else ctx.fillRect(-q.size / 2, -q.size / 5, q.size, q.size / 2.5);
            break;
          case 'spark':
            ctx.strokeStyle = q.color; ctx.lineWidth = q.size; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * 0.03, q.y - q.vy * 0.03); ctx.stroke(); break;
          case 'star':
            ctx.translate(q.x, q.y); ctx.rotate(q.rot); star(ctx, q.size); ctx.fill(); break;
          case 'ring':
            ctx.strokeStyle = q.color; ctx.lineWidth = Math.max(1, 10 * a);
            ctx.beginPath();
            if (q.ring === 'flat') ctx.ellipse(q.x, q.y, q.size, q.size * 0.18, 0, 0, Math.PI * 2);
            else ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
            ctx.stroke(); break;
        }
        ctx.restore();
      }
    }

    drawLights(ctx) {
      if (!this.lights.length) return;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const l of this.lights) {
        const a = l.life / l.max;
        const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r);
        g.addColorStop(0, `rgba(${l.color},${0.55 * a})`); g.addColorStop(1, `rgba(${l.color},0)`);
        ctx.fillStyle = g; ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      ctx.restore();
    }

    drawTexts(ctx) {
      for (const t of this.texts) {
        const a = clamp(t.life / t.max * 2, 0, 1);
        const pop = t.max - t.life < 0.15 ? LS.U.easeOutBack((t.max - t.life) / 0.15) : 1;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(t.x, t.y); ctx.scale(pop, pop);
        ctx.font = `${t.size}px Bungee, Impact, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,10,40,0.9)'; ctx.lineJoin = 'round';
        ctx.strokeText(t.str, 0, 0);
        ctx.fillStyle = t.color; ctx.fillText(t.str, 0, 0);
        ctx.restore();
      }
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function star(ctx, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath();
  }

  return { World, roundRect };
})();
