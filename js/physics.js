/* ==========================================================================
   Last Survivor — 06 · physics.js
   Verlet ragdoll solver, circle-vs-world collision and ballistic prediction.
   ========================================================================== */
'use strict';

LS.Physics = (() => {
  const { circleRect } = LS.U;
  const G = () => LS.CONFIG.GRAVITY;

  // Joint indices
  const J = { HEAD: 0, NECK: 1, PELVIS: 2, ELB_B: 3, HAND_B: 4, ELB_F: 5, HAND_F: 6, KNEE_B: 7, FOOT_B: 8, KNEE_F: 9, FOOT_F: 10 };
  const RADII = [13, 5, 6, 5, 5, 5, 5, 5, 5, 5, 5];
  // [a, b, stiffness]  – lengths are taken from the rest pose
  const BONES = [
    [J.HEAD, J.NECK, 1], [J.NECK, J.PELVIS, 1],
    [J.NECK, J.ELB_B, 1], [J.ELB_B, J.HAND_B, 1],
    [J.NECK, J.ELB_F, 1], [J.ELB_F, J.HAND_F, 1],
    [J.PELVIS, J.KNEE_B, 1], [J.KNEE_B, J.FOOT_B, 1],
    [J.PELVIS, J.KNEE_F, 1], [J.KNEE_F, J.FOOT_F, 1],
  ];
  // soft "muscle" constraints that stop the body folding into itself
  const SOFT = [
    [J.HEAD, J.PELVIS, 0.25], [J.KNEE_B, J.KNEE_F, 0.05], [J.ELB_B, J.PELVIS, 0.04], [J.ELB_F, J.PELVIS, 0.04],
  ];
  // bones used for drawing / hit tests
  const LIMBS = BONES.slice(1).map((b) => [b[0], b[1]]);

  class Ragdoll {
    constructor(points) {
      this.p = points.map(([x, y], i) => ({ x, y, ox: x, oy: y, r: RADII[i] }));
      this.rest = BONES.map(([a, b]) => Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]));
      this.softRest = SOFT.map(([a, b]) => Math.hypot(points[a][0] - points[b][0], points[a][1] - points[b][1]));
      this.grounded = 0;
    }
    setPose(points, keepVelocity = false) {
      for (let i = 0; i < this.p.length; i++) {
        const q = this.p[i];
        const vx = q.x - q.ox, vy = q.y - q.oy;
        q.x = points[i][0]; q.y = points[i][1];
        if (keepVelocity) { q.ox = q.x - vx; q.oy = q.y - vy; } else { q.ox = q.x; q.oy = q.y; }
      }
    }
    impulse(i, vx, vy, dt) { const q = this.p[i]; q.ox -= vx * dt; q.oy -= vy * dt; }
    impulseAll(vx, vy, dt, falloffFrom = null) {
      for (let i = 0; i < this.p.length; i++) {
        let k = 1;
        if (falloffFrom !== null) k = i === falloffFrom ? 1 : 0.55;
        this.impulse(i, vx * k, vy * k, dt);
      }
    }
    velocity() {
      let s = 0;
      for (const q of this.p) s += Math.hypot(q.x - q.ox, q.y - q.oy);
      return s / this.p.length / LS.CONFIG.STEP;
    }
    step(dt, solids, extraForce) {
      const g = G() * dt * dt;
      for (const q of this.p) {
        let vx = (q.x - q.ox) * 0.995, vy = (q.y - q.oy) * 0.995;
        q.ox = q.x; q.oy = q.y;
        q.x += vx; q.y += vy + g;
        if (extraForce) { const f = extraForce(q); if (f) { q.x += f.x * dt * dt; q.y += f.y * dt * dt; } }
      }
      for (let it = 0; it < 6; it++) {
        for (let k = 0; k < BONES.length; k++) this.solve(BONES[k][0], BONES[k][1], this.rest[k], 1, false);
        for (let k = 0; k < SOFT.length; k++) this.solve(SOFT[k][0], SOFT[k][1], this.softRest[k], SOFT[k][2], true);
      }
      this.grounded = 0;
      for (const q of this.p) this.grounded += collidePoint(q, solids, 0.25, 0.35) ? 1 : 0;
    }
    solve(a, b, len, stiff, minOnly) {
      const A = this.p[a], B = this.p[b];
      const dx = B.x - A.x, dy = B.y - A.y;
      const d = Math.hypot(dx, dy) || 0.0001;
      if (minOnly && d > len * 0.8) return;
      const target = minOnly ? len * 0.8 : len;
      const diff = ((d - target) / d) * 0.5 * stiff;
      A.x += dx * diff; A.y += dy * diff;
      B.x -= dx * diff; B.y -= dy * diff;
    }
    bounds() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const q of this.p) { x0 = Math.min(x0, q.x - q.r); y0 = Math.min(y0, q.y - q.r); x1 = Math.max(x1, q.x + q.r); y1 = Math.max(y1, q.y + q.r); }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
  }

  // Pushes a verlet point out of solids, applies bounce & friction. Returns contact bool.
  function collidePoint(q, solids, bounce, friction) {
    let hit = false;
    for (const s of solids) {
      if (q.x + q.r < s.x || q.x - q.r > s.x + s.w || q.y + q.r < s.y || q.y - q.r > s.y + s.h) continue;
      const c = circleRect(q.x, q.y, q.r, s);
      if (!c) continue;
      hit = true;
      q.x += c.nx * c.depth; q.y += c.ny * c.depth;
      let vx = q.x - q.ox, vy = q.y - q.oy;
      const vn = vx * c.nx + vy * c.ny;
      if (vn < 0) {
        const tx = vx - vn * c.nx, ty = vy - vn * c.ny;
        vx = tx * (1 - friction) - vn * bounce * c.nx;
        vy = ty * (1 - friction) - vn * bounce * c.ny;
        q.ox = q.x - vx; q.oy = q.y - vy;
      }
    }
    return hit;
  }

  // Circle body with explicit velocity {x,y,vx,vy,r}. Returns {nx,ny,speed,solid} of the strongest contact.
  function collideBody(b, solids, bounce, friction) {
    let best = null;
    for (const s of solids) {
      if (b.x + b.r < s.x || b.x - b.r > s.x + s.w || b.y + b.r < s.y || b.y - b.r > s.y + s.h) continue;
      const c = circleRect(b.x, b.y, b.r, s);
      if (!c) continue;
      b.x += c.nx * c.depth; b.y += c.ny * c.depth;
      const vn = b.vx * c.nx + b.vy * c.ny;
      if (vn < 0) {
        const tx = b.vx - vn * c.nx, ty = b.vy - vn * c.ny;
        b.vx = tx * (1 - friction) - vn * bounce * c.nx;
        b.vy = ty * (1 - friction) - vn * bounce * c.ny;
        if (!best || -vn > best.speed) best = { nx: c.nx, ny: c.ny, speed: -vn, solid: s };
      }
    }
    return best;
  }

  // Ballistic prediction (stops at first solid contact). Used for the aim guide & AI.
  function predict(x, y, vx, vy, grav, solids, maxT = 3, dt = 1 / 60, r = 6) {
    const pts = [];
    const g = G() * grav;
    for (let t = 0; t < maxT; t += dt) {
      vy += g * dt; x += vx * dt; y += vy * dt;
      pts.push({ x, y, t });
      if (y > LS.CONFIG.DEATH_Y || x < -300 || x > LS.CONFIG.WORLD_W + 300) break;
      let blocked = false;
      for (const s of solids) if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) { blocked = true; break; }
      if (blocked) { pts.hit = true; break; }
    }
    return pts;
  }

  return { J, LIMBS, RADII, Ragdoll, collidePoint, collideBody, predict };
})();
