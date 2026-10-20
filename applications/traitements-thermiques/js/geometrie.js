/* Géométrie procédurale des microstructures : semis de germes, cellules de Voronoï, retraits de polygones.
   Tout est reproductible : une même graine redonne exactement les mêmes grains. Aucune dépendance au DOM. */
(function (root, factory) {
  const O = (typeof module === 'object' && module.exports) ? require('./outils.js') : root.TTH.Outils;
  const api = factory(O);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTH = Object.assign(root.TTH || {}, { Geometrie: api });
})(typeof globalThis !== 'undefined' ? globalThis : this, function (O) {
  'use strict';

  /** Germes répartis sur une grille perturbée (grains plus réguliers qu'un tirage purement aléatoire),
      chacun avec un rang aléatoire : les n premiers rangs forment un semis moins dense, emboîté. */
  function semis(graine, n, w, h, x0 = 0, y0 = 0) {
    const r = O.alea(graine);
    const pas = Math.sqrt(w * h / n);
    const nx = Math.max(1, Math.round(w / pas)), ny = Math.max(1, Math.round(h / pas));
    const pts = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      pts.push({ x: x0 + (i + 0.08 + 0.84 * r()) * w / nx, y: y0 + (j + 0.08 + 0.84 * r()) * h / ny, rang: r(), o: r(), s: r() });
    }
    pts.sort((a, b) => a.rang - b.rang);
    return pts;
  }

  /** Coupe un polygone convexe par le demi-plan a·x + b·y ≤ c. */
  function couper(poly, a, b, c) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const fp = a * p[0] + b * p[1] - c, fq = a * q[0] + b * q[1] - c;
      if (fp <= 0) out.push(p);
      if ((fp < 0 && fq > 0) || (fp > 0 && fq < 0)) {
        const t = fp / (fp - fq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return out;
  }

  /** Cellules de Voronoï des points, bornées au rectangle [x0, x1] × [y0, y1]. */
  function voronoi(pts, x0, y0, x1, y1) {
    const n = pts.length;
    if (!n) return [];
    const pas = Math.sqrt((x1 - x0) * (y1 - y0) / n) || 1;
    const cases = new Map();
    const cle = (i, j) => i * 73856093 ^ j * 19349663;
    pts.forEach((p, k) => {
      const c = cle(Math.floor(p.x / pas), Math.floor(p.y / pas));
      if (!cases.has(c)) cases.set(c, []);
      cases.get(c).push(k);
    });
    return pts.map((p, k) => {
      let poly = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
      const ci = Math.floor(p.x / pas), cj = Math.floor(p.y / pas);
      for (let anneau = 1; anneau <= 6; anneau++) {
        const voisins = [];
        for (let i = ci - anneau; i <= ci + anneau; i++) for (let j = cj - anneau; j <= cj + anneau; j++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== anneau && anneau > 1) continue;
          const l = cases.get(cle(i, j)); if (l) voisins.push(...l);
        }
        for (const m of voisins) {
          if (m === k) continue;
          const q = pts[m];
          const a = q.x - p.x, b = q.y - p.y;
          poly = couper(poly, a, b, (q.x * q.x - p.x * p.x + q.y * q.y - p.y * p.y) / 2);
          if (poly.length < 3) break;
        }
        // Arrêt dès que plus aucun germe de l'anneau suivant ne peut couper la cellule.
        let rmax = 0;
        for (const v of poly) rmax = Math.max(rmax, Math.hypot(v[0] - p.x, v[1] - p.y));
        if (2 * rmax < anneau * pas) break;
      }
      return poly;
    });
  }

  function aire(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(s) / 2;
  }

  function centre(poly) {
    let x = 0, y = 0;
    for (const p of poly) { x += p[0]; y += p[1]; }
    return [x / poly.length, y / poly.length];
  }

  /** Retrait vers l'intérieur d'un polygone convexe d'une distance d (null si la cellule disparaît). */
  function retrait(poly, d) {
    if (d <= 0) return poly;
    const n = poly.length;
    let s = 0;
    for (let i = 0; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; s += p[0] * q[1] - q[0] * p[1]; }
    const sens = s > 0 ? 1 : -1;
    let res = poly;
    for (let i = 0; i < n && res.length >= 3; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      const ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey);
      if (L < 1e-9) continue;
      // Normale extérieure, puis demi-plan intérieur décalé de d.
      const nx = sens * ey / L, ny = -sens * ex / L;
      res = couper(res, nx, ny, nx * p[0] + ny * p[1] - d);
    }
    return res.length >= 3 ? res : null;
  }

  /** Distance de retrait qui laisse à l'intérieur la fraction f de l'aire (recherche par dichotomie). */
  function retraitPourFraction(poly, f) {
    if (f >= 1) return 0;
    const A = aire(poly);
    let lo = 0, hi = Math.sqrt(A);
    for (let k = 0; k < 18; k++) {
      const m = (lo + hi) / 2, p = retrait(poly, m);
      if (p && aire(p) > f * A) lo = m; else hi = m;
    }
    return lo;
  }

  /** Distances au germe le plus proche de points tirés au hasard, triées : leur quantile q donne le rayon
      qui couvre la fraction q du plan (croissance de Johnson-Mehl à germination instantanée). */
  function quantilesCouverture(germes, w, h, graine, n = 1500) {
    const r = O.alea(graine), d = [];
    for (let k = 0; k < n; k++) {
      const x = r() * w, y = r() * h;
      let m = Infinity;
      for (const g of germes) { const dd = (g.x - x) ** 2 + (g.y - y) ** 2; if (dd < m) m = dd; }
      d.push(Math.sqrt(m));
    }
    return d.sort((a, b) => a - b);
  }

  const rayonPourFraction = (quantiles, X) => X <= 0 ? 0 : quantiles[Math.min(quantiles.length - 1, Math.floor(X * (quantiles.length - 1)))];

  /** Répartit des domaines entre phases selon leurs fractions (plus forts restes), dans l'ordre des domaines. */
  function repartir(nb, fractions) {
    const tot = fractions.reduce((s, [, f]) => s + Math.max(0, f), 0) || 1;
    const parts = fractions.map(([k, f]) => ({ k, x: Math.max(0, f) / tot * nb }));
    parts.forEach(p => { p.n = Math.floor(p.x); p.reste = p.x - p.n; });
    let manque = nb - parts.reduce((s, p) => s + p.n, 0);
    [...parts].sort((a, b) => b.reste - a.reste).forEach(p => { if (manque > 0) { p.n++; manque--; } });
    const out = [];
    for (const p of parts) for (let i = 0; i < p.n; i++) out.push(p.k);
    return out;
  }

  return { semis, couper, voronoi, aire, centre, retrait, retraitPourFraction, quantilesCouverture, rayonPourFraction, repartir };
});
