/* Outils numériques communs au moteur et aux vues. Aucune dépendance au DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTH = Object.assign(root.TTH || {}, { Outils: api });
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const R = 8.314;          // constante des gaz parfaits, J/(mol·K)
  const K0 = 273.15;        // 0 °C en kelvins
  const SIGMA_SB = 5.67e-8; // constante de Stefan-Boltzmann, W/(m²·K⁴)

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const lisse = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /** Interpolation linéaire dans une table [[x, y], …] triée par x croissant, valeurs extrêmes prolongées. */
  function table(points, x) {
    if (x <= points[0][0]) return points[0][1];
    const n = points.length;
    if (x >= points[n - 1][0]) return points[n - 1][1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (points[m][0] <= x) lo = m; else hi = m; }
    const [x0, y0] = points[lo], [x1, y1] = points[hi];
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }

  /** Facteur d'Arrhenius relatif : vaut 1 à la température de référence (°C). */
  function arrhenius(Q, T, Tref) { return Math.exp(-Q / R * (1 / (T + K0) - 1 / (Tref + K0))); }

  /* Coefficients de réduction de l'acier au carbone à chaud (EN 1993-1-2, tableau 3.1) :
     ky = limite d'élasticité effective (2 %), kp = limite de proportionnalité. */
  const EC3 = [
    [20, 1, 1, 1], [100, 1, 1, 1], [200, 1, 0.807, 0.9], [300, 1, 0.613, 0.8], [400, 1, 0.42, 0.7],
    [500, 0.78, 0.36, 0.6], [600, 0.47, 0.18, 0.31], [700, 0.23, 0.075, 0.13], [800, 0.11, 0.05, 0.09],
    [900, 0.06, 0.0375, 0.0675], [1000, 0.04, 0.025, 0.045], [1100, 0.02, 0.0125, 0.0225], [1200, 0, 0, 0]
  ];
  const colonne = j => EC3.map(r => [r[0], r[j]]);
  const KY = colonne(1), KP = colonne(2);
  const kY = T => table(KY, T), kP = T => table(KP, T);
  /* Module d'Young élastique réel de l'acier (ordre de grandeur) : le kE de l'EN 1993-1-2 est une pente
     effective pour le calcul au feu, qui inclut le fluage, et ne convient pas aux contraintes résiduelles. */
  const E_VRAI = [[20, 1], [200, 0.93], [400, 0.86], [600, 0.76], [800, 0.66], [1000, 0.55], [1200, 0.45]];
  const kE = T => table(E_VRAI, T);
  /** Limite d'élasticité à chaud retenue pour la relaxation : moyenne des coefficients kp et ky. */
  const kRe = T => Math.max(0.01, (kY(T) + kP(T)) / 2);

  /**
   * Courbe en C d'une transformation diffusive : temps (s) pour atteindre 1 % à température constante.
   * t(T) = A·exp(Q/RT)/(Te − T)^m : infini à l'équilibre Te, lent à basse température (diffusion),
   * minimum (« nez ») en Tn pour un temps tn ; m et A s'en déduisent.
   */
  function courbeC({ Te, Tn, tn, Q }) {
    const TnK = Tn + K0;
    const m = Q * (Te - Tn) / (R * TnK * TnK);
    const lnA = Math.log(tn) + m * Math.log(Te - Tn) - Q / (R * TnK);
    return function (T) {
      if (T >= Te - 0.5) return Infinity;
      return Math.exp(lnA + Q / (R * (T + K0)) - m * Math.log(Te - T));
    };
  }

  /** Avrami avec additivité : fait progresser une fraction X (0→1) pendant dt, temps de 1 % t1, exposant n. */
  function avrami(X, t1, n, dt) {
    if (!isFinite(t1) || dt <= 0) return X;
    const b = -Math.log(0.99) / Math.pow(t1, n);
    const x = Math.min(X, 0.999999);
    const tEq = Math.pow(-Math.log(1 - x) / b, 1 / n);
    return 1 - Math.exp(-b * Math.pow(tEq + dt, n));
  }

  /** Relaxation par fluage (loi de Norton dσ/dt = −E·A·σⁿ), intégrée exactement sur dt. */
  function relaxer(sigma, E, A, n, dt) {
    const s = Math.abs(sigma);
    if (s < 1e-3 || A <= 0 || dt <= 0) return sigma;
    const v = Math.pow(s, 1 - n) + (n - 1) * E * A * dt;
    return Math.sign(sigma) * Math.pow(v, 1 / (1 - n));
  }

  /** Coefficient d'échange (W/m²·K) d'une surface à Ts plongée dans un milieu à Tm. */
  function echange(milieu, Ts, Tm, emissivite = 0.8) {
    const a = Ts + K0, b = Tm + K0;
    const rayonnement = emissivite * SIGMA_SB * (a * a + b * b) * (a + b);
    switch (milieu) {
      // Eau agitée (sévérité de Grossmann H ≈ 1,5–2) : caléfaction brève, ébullition nucléée maximale vers 480 °C.
      case 'eau': return 800 + 5500 * Math.exp(-Math.pow((Ts - 480) / 230, 2));
      // Huile de trempe agitée (H ≈ 0,6) : ébullition de 700 à 350 °C environ, convection lente au-dessous de 300 °C.
      case 'huile': return 300 + 2000 * Math.exp(-Math.pow((Ts - 520) / 190, 2));
      // Bain de sel fondu (trempes étagées) : pas d'ébullition, convection forcée régulière.
      case 'sel': return 2200 + rayonnement;
      case 'air': return 10 + rayonnement;
      case 'four': return 25 + rayonnement;
      default: return 10 + rayonnement;
    }
  }

  /** Générateur pseudo-aléatoire reproductible (mulberry32). */
  function alea(graine) {
    let a = graine >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Dureté Vickers → résistance à la traction des aciers (ordre de grandeur, d'après les tables de l'EN ISO 18265). */
  const RM_HV = [[80, 255], [100, 320], [150, 480], [200, 640], [250, 800], [300, 965], [350, 1125], [400, 1290], [450, 1455], [500, 1630], [550, 1810], [600, 1980], [650, 2180]];
  const rmAcier = HV => table(RM_HV, HV);

  /** Indice de grosseur de grain G (ISO 643) à partir du diamètre moyen en µm : d ≈ 254·2^(−G/2) µm. */
  const indiceG = d => -2 * Math.log2(d / 254);

  /** Durée lisible en français : « 45 s », « 12 min », « 2 h 30 », « 3 j ». */
  function duree(s) {
    if (s < 60) return Math.round(s) + ' s';
    if (s < 3600) return Math.round(s / 60) + ' min';
    if (s < 86400 * 2) {
      const mn = Math.round(s / 60), h = Math.floor(mn / 60), m = mn - 60 * h;
      return m && h < 10 ? h + ' h ' + String(m).padStart(2, '0') : Math.round(s / 3600) + ' h';
    }
    return Math.round(s / 86400) + ' j';
  }

  /** Nombre à la française : virgule décimale, espace fine insécable pour les milliers. */
  function nombre(x, decimales = 0) {
    if (!isFinite(x)) return '—';
    const s = Math.abs(x).toFixed(decimales).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + s.join(',');
  }

  return { R, K0, clamp, lerp, lisse, table, arrhenius, kY, kP, kE, kRe, courbeC, avrami, relaxer, echange, alea, rmAcier, indiceG, duree, nombre };
});
