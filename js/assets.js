/* ==========================================================================
   Last Survivor — 03 · assets.js
   Image loader + rasterisation cache (SVG → bitmap canvas at a given size).
   ========================================================================== */
'use strict';

LS.Assets = (() => {
  const images = {};
  const cache = new Map();

  function load(onProgress) {
    const entries = Object.entries(LS.ASSET_LIST);
    let done = 0;
    return Promise.all(entries.map(([key, src]) => new Promise((resolve) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        images[key] = img.naturalWidth ? img : null;
        done++;
        if (onProgress) onProgress(done / entries.length);
        resolve();
      };
      img.src = src;
    })));
  }

  const get = (key) => images[key] || null;

  // Returns a canvas with the image rasterised at w×h (cached).
  function raster(key, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const id = key + '@' + w + 'x' + h;
    if (cache.has(id)) return cache.get(id);
    const img = images[key];
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    cache.set(id, c);
    return c;
  }

  // Rasterises an image to cover (w×h) like CSS background-size: cover
  function cover(key, w, h) {
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    const id = key + '#cover' + w + 'x' + h;
    if (cache.has(id)) return cache.get(id);
    const img = images[key];
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
    c.getContext('2d').drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    // keep the cache from growing unbounded while resizing the window
    if (cache.size > 160) cache.clear();
    cache.set(id, c);
    return c;
  }

  return { load, get, raster, cover };
})();
