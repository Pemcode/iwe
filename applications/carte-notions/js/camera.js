/* Caméra de la carte : passage monde ↔ écran, zoom autour d'un point, cadrage, vol animé. Aucune dépendance au DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Camera = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Une caméra : centre (x, y) en coordonnées monde, k pixels par unité monde.
  function ecran(cam, wx, wy, W, H) {
    return [W / 2 + (wx - cam.x) * cam.k, H / 2 + (wy - cam.y) * cam.k];
  }

  function monde(cam, sx, sy, W, H) {
    return [cam.x + (sx - W / 2) / cam.k, cam.y + (sy - H / 2) / cam.k];
  }

  function borner(k, kmin, kmax) {
    return Math.min(kmax, Math.max(kmin, k));
  }

  /* Zoom de facteur f en gardant fixe le point d'écran (sx, sy) : ce qui est sous le curseur y reste. */
  function zoomer(cam, f, sx, sy, W, H, kmin, kmax) {
    const k = borner(cam.k * f, kmin, kmax);
    const [wx, wy] = monde(cam, sx, sy, W, H);
    return { x: wx - (sx - W / 2) / k, y: wy - (sy - H / 2) / k, k };
  }

  function deplacer(cam, dx, dy) {
    return { x: cam.x - dx / cam.k, y: cam.y - dy / cam.k, k: cam.k };
  }

  /* Cadre la boîte monde [x0, y0, x1, y1] dans le rectangle d'écran visible {x, y, w, h}
     (la zone non couverte par la barre et la fiche), avec une marge en pixels. */
  function cadrer(boite, zone, W, H, marge, kmin, kmax) {
    const bw = Math.max(boite[2] - boite[0], 1e-6), bh = Math.max(boite[3] - boite[1], 1e-6);
    const k = borner(Math.min((zone.w - 2 * marge) / bw, (zone.h - 2 * marge) / bh), kmin, kmax);
    const cx = (boite[0] + boite[2]) / 2, cy = (boite[1] + boite[3]) / 2;
    const zx = zone.x + zone.w / 2, zy = zone.y + zone.h / 2;
    return { x: cx - (zx - W / 2) / k, y: cy - (zy - H / 2) / k, k };
  }

  function adoucir(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* Vol de a vers b : le zoom s'interpole en échelle logarithmique et recule à mi-parcours
     quand les deux points sont loin, pour garder le repère sous les yeux. */
  function voler(a, b, t, W, H) {
    if (t <= 0) return { x: a.x, y: a.y, k: a.k };
    if (t >= 1) return { x: b.x, y: b.y, k: b.k };
    const e = adoucir(t);
    const distancePx = Math.hypot(b.x - a.x, b.y - a.y) * Math.min(a.k, b.k);
    const recul = Math.min(1.2, Math.max(0, Math.log(distancePx / Math.max(W, H, 1) + 1)));
    const lk = Math.log(a.k) + (Math.log(b.k) - Math.log(a.k)) * e - recul * Math.sin(Math.PI * e);
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, k: Math.exp(lk) };
  }

  return { ecran, monde, borner, zoomer, deplacer, cadrer, adoucir, voler };
});
