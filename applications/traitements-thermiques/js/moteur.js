/* Moteur : conduction thermique dans la pièce, intégration des mécanismes le long du cycle,
   trajectoire précalculée et lecture interpolée à n'importe quel instant du curseur. */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const O = node ? require('./outils.js') : root.TTH.Outils;
  const M = node ? require('./mecanismes.js') : root.TTH.Mecanismes;
  const api = factory(O, M);
  if (node) module.exports = api;
  else root.TTH = Object.assign(root.TTH || {}, { Moteur: api });
})(typeof globalThis !== 'undefined' ? globalThis : this, function (O, M) {
  'use strict';
  const { echange, clamp } = O;

  /** Conduction 1D implicite (cylindre plein ou plaque symétrique), nœud 0 au centre, dernier nœud en surface. */
  class Thermique {
    constructor(forme, L, n, mat) {
      this.n = n; this.k = mat.k; this.rhoC = mat.rhoC; this.emissivite = mat.emissivite || 0.8;
      const dx = L / (n - 1);
      this.V = new Float64Array(n); this.Af = new Float64Array(n); // Af[i] : face entre i et i+1
      for (let i = 0; i < n; i++) {
        const xl = Math.max(0, (i - 0.5) * dx), xr = Math.min(L, (i + 0.5) * dx);
        this.V[i] = forme === 'cylindre' ? (xr * xr - xl * xl) / 2 : xr - xl;
        this.Af[i] = forme === 'cylindre' ? (i + 0.5) * dx : 1;
      }
      this.As = forme === 'cylindre' ? L : 1;
      this.dx = dx;
      const total = this.V.reduce((a, b) => a + b, 0);
      this.poids = Array.from(this.V, v => v / total);
      this.a = new Float64Array(n); this.b = new Float64Array(n); this.c = new Float64Array(n); this.d = new Float64Array(n);
    }

    pas(T, Tenv, milieu, dt) {
      const { n, a, b, c, d, V, Af, k, rhoC, dx } = this;
      const h = echange(milieu, T[n - 1], Tenv, this.emissivite);
      for (let i = 0; i < n; i++) {
        const Ci = rhoC * V[i] / dt;
        const Kg = i > 0 ? k * Af[i - 1] / dx : 0, Kd = i < n - 1 ? k * Af[i] / dx : 0;
        a[i] = -Kg; c[i] = -Kd; b[i] = Ci + Kg + Kd; d[i] = Ci * T[i];
        if (i === n - 1) { b[i] += h * this.As; d[i] += h * this.As * Tenv; }
      }
      // Algorithme de Thomas.
      const cp = new Float64Array(n), dp = new Float64Array(n), out = new Float64Array(n);
      cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
      for (let i = 1; i < n; i++) {
        const m = b[i] - a[i] * cp[i - 1];
        cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
      }
      out[n - 1] = dp[n - 1];
      for (let i = n - 2; i >= 0; i--) out[i] = dp[i] - cp[i] * out[i + 1];
      return out;
    }
  }

  const max = arr => { let m = -Infinity; for (const v of arr) if (v > m) m = v; return m; };
  const min = arr => { let m = Infinity; for (const v of arr) if (v < m) m = v; return m; };

  function termine(seg, tseg, T, Tenv) {
    if (seg.duree != null && tseg >= seg.duree - 1e-9) return true;
    if (seg.dureeMax != null && tseg >= seg.dureeMax) return true;
    const j = seg.jusqua;
    if (!j) return seg.duree == null;
    if (j.coeurAtteint != null) return min(T) >= j.coeurAtteint && (seg.rampeFin == null || tseg >= seg.rampeFin);
    if (j.toutSous != null) return max(T) <= j.toutSous;
    return false;
  }

  /** Simule un traitement : renvoie la trajectoire complète, ses segments et ses événements. */
  function simuler(tr, A, p) {
    const fam = M[A.famille];
    const geo = tr.geometrie(p, A);
    const th = new Thermique(geo.forme, geo.L, geo.n, A.thermique);
    let T = new Float64Array(geo.n).fill(tr.temperatureInitiale ? tr.temperatureInitiale(p) : 20);
    const noeuds = Array.from({ length: geo.n }, () => fam.init(A, p, tr));
    const observes = new Set(tr.points(geo).map(pt => pt.noeud));
    const echantillons = [], evenements = [], segments = [];
    const vus = new Set();
    let t = 0;
    const ctx = { t: 0, p, geometrie: geo, revenu: false, segment: null, signal: null };
    const copie = () => noeuds.map(s => Object.assign({}, s));
    const noter = (si, tseg, Tenv) => echantillons.push({ t, seg: si, tseg, T: Float64Array.from(T), Tenv, noeuds: copie() });

    const programme = tr.programme(p, A, geo);
    programme.forEach((seg, si) => {
      const debut = t;
      ctx.segment = seg; ctx.revenu = !!seg.revenu;
      let tseg = 0, dt = seg.dt0 || 0.5, garde = 0;
      const env = typeof seg.env === 'function' ? seg.env : () => seg.env;
      noter(si, 0, env(0));
      while (!termine(seg, tseg, T, env(tseg)) && garde++ < 6000) {
        // Pas croissant au fil du segment : les cinétiques rapides du début restent bien résolues.
        dt = Math.min(dt, seg.dtMax || 900, Math.max(seg.dtMin || 0.02, 0.06 * tseg + 0.05));
        if (seg.duree != null) dt = Math.min(dt, seg.duree - tseg);
        if (seg.rampeFin != null && tseg < seg.rampeFin) dt = Math.min(dt, Math.max(1, (seg.rampeFin - tseg) / 4));
        if (seg.dureeMax != null) dt = Math.min(dt, seg.dureeMax - tseg);
        const Tenv = env(tseg + dt);
        const Tn = th.pas(T, Tenv, seg.milieu, dt);
        let dTmax = 0;
        for (let i = 0; i < geo.n; i++) dTmax = Math.max(dTmax, Math.abs(Tn[i] - T[i]));
        if (dTmax > (seg.dTmax || 6) && dt > 0.004) { dt /= 2; continue; }
        ctx.t = t;
        for (let i = 0; i < geo.n; i++) {
          ctx.signal = id => {
            const cle = i + ':' + id;
            if (!observes.has(i) || vus.has(cle)) return;
            vus.add(cle);
            evenements.push({ id, noeud: i, t: t + dt, seg: si, T: Tn[i] });
          };
          fam.pas(noeuds[i], T[i], Tn[i], dt, A, ctx);
        }
        if (fam.global && geo.contraintes) fam.global(noeuds, Tn, A, ctx, dt, th.poids);
        T = Tn; t += dt; tseg += dt;
        noter(si, tseg, Tenv);
        if (dTmax < (seg.dTmax || 6) / 3) dt *= 1.5;
      }
      segments.push(Object.assign({}, seg, { debut, fin: t, duree: t - debut, env: undefined }));
    });

    const traj = { tr, A, p, geo, segments, echantillons, evenements, duree: t, famille: fam, points: tr.points(geo) };
    cartographier(traj);
    return traj;
  }

  /* ——— Temps visuel : chaque étape reçoit une largeur qui croît avec le logarithme de sa durée ——— */

  function poidsSegment(D) { return 1 + 0.55 * Math.log10(1 + D / 60); }

  function cartographier(traj) {
    const segs = traj.segments;
    const total = segs.reduce((s, g) => s + poidsSegment(g.duree), 0);
    let u = 0;
    for (const g of segs) {
      g.u0 = u; u += poidsSegment(g.duree) / total; g.u1 = u;
      g.echelle = g.carte || (g.etape === 'chauffage' && !g.jusqua ? 'lin' : 'log');
    }
    for (const e of traj.echantillons) e.u = uDe(traj, e.seg, e.tseg);
    for (const e of traj.evenements) e.u = uDe(traj, e.seg, e.t - segs[e.seg].debut);
  }

  function uDe(traj, si, tseg) {
    const g = traj.segments[si];
    if (g.duree <= 0) return g.u0;
    const x = clamp(tseg / g.duree, 0, 1);
    const y = g.echelle === 'log' ? Math.log(1 + x * 40) / Math.log(41) : x;
    return g.u0 + (g.u1 - g.u0) * y;
  }

  /** Inverse : instant réel (s, depuis le début du segment) correspondant à une abscisse visuelle u. */
  function tsegDe(traj, si, u) {
    const g = traj.segments[si];
    const y = clamp((u - g.u0) / Math.max(1e-12, g.u1 - g.u0), 0, 1);
    const x = g.echelle === 'log' ? (Math.pow(41, y) - 1) / 40 : y;
    return x * g.duree;
  }

  function segmentDe(traj, u) {
    const s = traj.segments;
    for (let i = 0; i < s.length; i++) if (u <= s[i].u1 + 1e-12) return i;
    return s.length - 1;
  }

  /** État interpolé à l'abscisse visuelle u ∈ [0, 1]. */
  function etat(traj, u) {
    const E = traj.echantillons;
    u = clamp(u, 0, 1);
    let lo = 0, hi = E.length - 1;
    if (u <= E[0].u) hi = 0;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (E[m].u <= u) lo = m; else hi = m; }
    const a = E[lo], b = E[hi];
    const w = b.u > a.u ? clamp((u - a.u) / (b.u - a.u), 0, 1) : 0;
    const T = Array.from(a.T, (v, i) => v + (b.T[i] - v) * w);
    const noeuds = a.noeuds.map((s, i) => {
      const r = {}, s2 = b.noeuds[i];
      for (const k in s) r[k] = s[k] + (s2[k] - s[k]) * w;
      return r;
    });
    return { u, t: a.t + (b.t - a.t) * w, seg: w < 0.5 ? a.seg : b.seg, T, Tenv: a.Tenv + (b.Tenv - a.Tenv) * w, noeuds };
  }

  /** Propriétés d'un nœud le long de toute la trajectoire (pour les courbes superposées au cycle). */
  function serie(traj, noeud, cle) {
    const fam = traj.famille;
    return traj.echantillons.map(e => {
      const v = fam.proprietes(e.noeuds[noeud], traj.A)[cle];
      return [e.u, v];
    });
  }

  return { Thermique, simuler, etat, serie, uDe, tsegDe, segmentDe };
});
