/* ==========================================================================
   Last Survivor — 05 · input.js
   Keyboard + mouse/touch (pointer events). Tracks held keys and dispatches
   discrete events to whoever subscribed (menus, game).
   ========================================================================== */
'use strict';

LS.Input = (() => {
  const held = new Set();
  const listeners = { key: [], down: [], move: [], up: [] };
  const pointer = { x: 0, y: 0, down: false, id: null };
  let canvas = null;

  const on = (type, fn) => listeners[type].push(fn);
  const emit = (type, e) => { for (const fn of listeners[type]) if (fn(e) === true) break; };

  function init(cv) {
    canvas = cv;
    window.addEventListener('keydown', (e) => {
      LS.Audio.unlock();
      // stop the page from scrolling / tabbing away while playing
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && e.target === document.body) e.preventDefault();
      const first = !held.has(e.code);
      held.add(e.code);
      emit('key', { code: e.code, key: e.key, repeat: e.repeat || !first, original: e });
    });
    window.addEventListener('keyup', (e) => held.delete(e.code));
    window.addEventListener('blur', () => held.clear());

    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return { sx: e.clientX - r.left, sy: e.clientY - r.top };
    };
    canvas.addEventListener('pointerdown', (e) => {
      LS.Audio.unlock();
      if (pointer.down) return;
      pointer.down = true; pointer.id = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const p = pos(e); pointer.x = p.sx; pointer.y = p.sy;
      emit('down', { ...p, button: e.button });
      e.preventDefault();
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = pos(e); pointer.x = p.sx; pointer.y = p.sy;
      emit('move', p);
    });
    const up = (e) => {
      if (!pointer.down || e.pointerId !== pointer.id) return;
      pointer.down = false;
      const p = pos(e);
      emit('up', { ...p, cancelled: e.type === 'pointercancel' });
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerdown', () => LS.Audio.unlock(), { capture: true });
  }

  const isHeld = (...codes) => codes.some((c) => held.has(c));

  return { init, on, isHeld, pointer };
})();
