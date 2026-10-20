/* Les cinq échelles d'observation : œil, coupe attaquée, microscope optique, microscope électronique, maille.
   Chaque scène dessine en unités physiques (mm, µm ou nm), origine au centre du champ ; l'appli fixe la transformation.
   Les vues sont schématiques : elles traduisent l'état calculé par le modèle, ce ne sont pas des micrographies. */
(function (root, factory) {
  const node = typeof module === 'object' && module.exports;
  const O = node ? require('./outils.js') : root.TTH.Outils;
  const G = node ? require('./geometrie.js') : root.TTH.Geometrie;
  const api = factory(O, G);
  if (node) module.exports = api;
  else root.TTH = Object.assign(root.TTH || {}, { Echelles: api });
})(typeof globalThis !== 'undefined' ? globalThis : this, function (O, G) {
  'use strict';
  const { clamp, alea, lisse, lerp } = O;

  /* ——— Couleurs fixes des constituants (légende commune) ——— */
  const PHASES = {
    A: '#3cb7aa', F: '#efe4c8', P: '#8b5a2b', B: '#7b5ea7', M: '#2f6fd1', Mr: '#7aa4e6', C: '#2a2622',
    Al: '#c9d3df', Fe: '#7d8691', Mg2Si: '#5b3f8c', amas: '#e3b21c', b2: '#c2410c', bp: '#7c2d12',
    Cu: '#c0683a', CuRx: '#f2cfa6', pore: '#1d1d1d', ox: '#335c8a', Mf: '#173a8a', seg: '#c2185b'
  };
  /* Aspect « micrographie » après attaque chimique (champ clair). */
  const MICRO = {
    fond: '#ece8de', joint: '#3a3833', ferrite: '#f1eee6', perlite: '#4f453c', lamelle: '#a39885',
    mart: '#b9a98f', aiguille: '#6c5a45', bainite: '#6b6155', aust: '#bccdd4', incl: '#6d6f73', martRev: '#8f7d66', cuRx: '#f0cfae'
  };

  /* ——— Petits outils de dessin ——— */
  function trace(ctx, poly) {
    ctx.beginPath(); ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
    ctx.closePath();
  }
  function remplir(ctx, poly, c) { trace(ctx, poly); ctx.fillStyle = c; ctx.fill(); }
  function rayonPoly(poly, cx, cy) { let R = 0; for (const p of poly) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cy)); return R; }

  function hachures(ctx, poly, angle, pas, c, lw) {
    const [cx, cy] = G.centre(poly), R = rayonPoly(poly, cx, cy);
    if (R / pas > 400) pas = R / 400;
    ctx.save(); trace(ctx, poly); ctx.clip();
    const ux = Math.cos(angle), uy = Math.sin(angle), nx = -uy, ny = ux;
    ctx.beginPath();
    for (let s = -R; s <= R; s += pas) { const x = cx + nx * s, y = cy + ny * s; ctx.moveTo(x - ux * R, y - uy * R); ctx.lineTo(x + ux * R, y + uy * R); }
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); ctx.restore();
  }

  function aiguilles(ctx, poly, r, n, L, angles, c, lw) {
    const [cx, cy] = G.centre(poly), R = rayonPoly(poly, cx, cy);
    ctx.save(); trace(ctx, poly); ctx.clip();
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = angles[k % angles.length] + (r() - 0.5) * 0.12;
      const x = cx + (r() * 2 - 1) * R, y = cy + (r() * 2 - 1) * R, l = L * (0.5 + r());
      ctx.moveTo(x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2); ctx.lineTo(x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2);
    }
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
  }

  function points(ctx, poly, r, n, ray, c) {
    const [cx, cy] = G.centre(poly), R = rayonPoly(poly, cx, cy);
    ctx.save(); trace(ctx, poly); ctx.clip();
    ctx.beginPath();
    for (let k = 0; k < n; k++) { const x = cx + (r() * 2 - 1) * R, y = cy + (r() * 2 - 1) * R, q = ray * (0.6 + 0.8 * r()); ctx.moveTo(x + q, y); ctx.arc(x, y, q, 0, 2 * Math.PI); }
    ctx.fillStyle = c; ctx.fill(); ctx.restore();
  }

  function enchevetrement(ctx, poly, r, n, L, c, lw) {
    const [cx, cy] = G.centre(poly), R = rayonPoly(poly, cx, cy);
    ctx.save(); trace(ctx, poly); ctx.clip();
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      let x = cx + (r() * 2 - 1) * R, y = cy + (r() * 2 - 1) * R, a = r() * Math.PI * 2;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) { a += (r() - 0.5) * 1.6; x += Math.cos(a) * L / 4; y += Math.sin(a) * L / 4; ctx.lineTo(x, y); }
    }
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.stroke(); ctx.restore();
  }

  /** Couleur d'incandescence de l'acier chauffé (rouge sombre vers 550 °C, jaune vers 1100 °C), ou null. */
  const CHAUFFE = [[520, [90, 10, 5], 0], [600, [130, 20, 10], 0.32], [700, [175, 30, 15], 0.52], [800, [215, 50, 20], 0.68],
    [900, [240, 90, 30], 0.78], [1000, [255, 140, 40], 0.85], [1100, [255, 190, 80], 0.9], [1250, [255, 235, 180], 0.95]];
  function incandescence(T, seuil = 520) {
    if (T < Math.max(seuil, 520)) return null;
    let i = 0;
    while (i < CHAUFFE.length - 2 && T > CHAUFFE[i + 1][0]) i++;
    const [t0, c0, a0] = CHAUFFE[i], [t1, c1, a1] = CHAUFFE[i + 1];
    const f = clamp((T - t0) / (t1 - t0), 0, 1);
    const c = c0.map((v, k) => Math.round(lerp(v, c1[k], f)));
    return { couleur: 'rgb(' + c.join(',') + ')', alpha: lerp(a0, a1, f) };
  }

  /** Teintes de revenu d'une surface d'acier polie (film d'oxyde) selon la température de revenu. */
  const TEINTES = [[150, '#c9c6c0'], [200, '#e3d39b'], [230, '#d9b56a'], [250, '#b98a4a'], [270, '#8a4f7a'], [290, '#3f4f9e'], [320, '#5f7fb0'], [360, '#8b9399'], [450, '#7b7f84']];
  function teinteRevenu(T) {
    if (T < 160) return null;
    let c = TEINTES[0][1];
    for (const [t, col] of TEINTES) if (T >= t) c = col;
    return c;
  }

  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function melange(a, b, t) {
    const x = hexRgb(a), y = hexRgb(b);
    return '#' + x.map((v, i) => Math.round(lerp(v, y[i], clamp(t, 0, 1))).toString(16).padStart(2, '0')).join('');
  }
  const teinteGrain = (base, o, amp = 0.16) => melange(base, o > 0.5 ? '#ffffff' : '#000000', Math.abs(o - 0.5) * 2 * amp);

  /** Voronoï mémorisé : un même jeu de germes redonne les mêmes cellules sans recalcul. */
  function cellules(memo, cle, pts, demi) {
    if (!memo[cle]) memo[cle] = G.voronoi(pts, -demi, -demi, demi, demi);
    return memo[cle];
  }
  function semisMemo(memo, cle, graine, n, demi) {
    if (!memo[cle]) memo[cle] = G.semis(graine, n, 2 * demi, 2 * demi, -demi, -demi);
    return memo[cle];
  }
  /** Germes actifs pour une taille de grain d (diamètre équivalent), avec quantification pour limiter les recalculs. */
  function actifs(tous, aire, d) {
    let n = Math.round(aire / (Math.PI * d * d / 4));
    n = clamp(n, 1, tous.length);
    const q = n > 60 ? Math.round(n / Math.ceil(n * 0.03)) * Math.ceil(n * 0.03) : n;
    return clamp(q, 1, tous.length);
  }

  /* ——— Briques communes à plusieurs familles ——— */

  /** Barre cylindrique vue de côté, avec sa face d'extrémité. */
  function barre(ctx, x0, x1, R, base, e) {
    const g = ctx.createLinearGradient(0, -R, 0, R);
    g.addColorStop(0, melange(base, '#ffffff', 0.35)); g.addColorStop(0.35, base); g.addColorStop(1, melange(base, '#000000', 0.45));
    ctx.fillStyle = g; ctx.fillRect(x0, -R, x1 - x0, 2 * R);
    ctx.beginPath(); ctx.ellipse(x1, 0, R * 0.32, R, 0, 0, 2 * Math.PI);
    ctx.fillStyle = melange(base, '#000000', 0.15); ctx.fill();
    ctx.lineWidth = e.px * 1.2; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.stroke();
  }

  function lueur(ctx, chemin, T, seuil) {
    const g = incandescence(T, seuil);
    if (!g) return;
    ctx.save(); chemin(); ctx.clip();
    ctx.globalAlpha = g.alpha; ctx.fillStyle = g.couleur; ctx.fillRect(-1e5, -1e5, 2e5, 2e5);
    ctx.restore();
  }

  function bulles(ctx, x0, x1, R, e, intensite) {
    if (intensite <= 0) return;
    const r = alea(Math.floor(e.temps * 6) + 7);
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.strokeStyle = 'rgba(160,190,220,.8)'; ctx.lineWidth = e.px;
    for (let k = 0; k < 60 * intensite; k++) {
      const x = lerp(x0, x1, r()), y = (r() < 0.5 ? -1 : 1) * (R + r() * R * 0.5), q = R * 0.04 * (0.5 + r());
      ctx.beginPath(); ctx.arc(x, y, q, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  /** Marqueur de la zone observée à l'échelle suivante. */
  function repere(ctx, x, y, taille, e) {
    const t = Math.max(taille, 14 * e.px);
    ctx.save();
    ctx.lineWidth = 2 * e.px; ctx.strokeStyle = e.c.frc; ctx.setLineDash([5 * e.px, 3 * e.px]);
    ctx.strokeRect(x - t / 2, y - t / 2, t, t);
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x - t, y); ctx.lineTo(x - t / 2, y); ctx.moveTo(x + t / 2, y); ctx.lineTo(x + t, y);
    ctx.moveTo(x, y - t); ctx.lineTo(x, y - t / 2); ctx.moveTo(x, y + t / 2); ctx.lineTo(x, y + t); ctx.stroke();
    ctx.restore();
  }

  function texte(ctx, s, x, y, e, opts = {}) {
    ctx.save();
    ctx.font = `${opts.gras ? '700 ' : ''}${(opts.taille || 12) * e.px}px "Atkinson Hyperlegible", system-ui, sans-serif`;
    ctx.textAlign = opts.align || 'center'; ctx.textBaseline = opts.base || 'middle';
    if (opts.halo) { ctx.lineWidth = 3 * e.px; ctx.strokeStyle = opts.halo; ctx.strokeText(s, x, y); }
    ctx.fillStyle = opts.couleur || e.c.encre; ctx.fillText(s, x, y);
    ctx.restore();
  }

  /** Réseau cristallin en projection : positions des atomes (nm) d'un réseau carré centré de paramètre a. */
  function reseau(a, demiL, demiH, centre = true, cOverA = 1) {
    const out = [], c = a * cOverA;
    for (let j = Math.floor(-demiH / c) - 1; j <= Math.ceil(demiH / c) + 1; j++) {
      for (let i = Math.floor(-demiL / a) - 1; i <= Math.ceil(demiL / a) + 1; i++) {
        out.push({ x: i * a, y: j * c, i, j, type: 'coin' });
        if (centre) out.push({ x: (i + 0.5) * a, y: (j + 0.5) * c, i, j, type: 'centre' });
      }
    }
    return out;
  }

  function atomes(ctx, liste, e, rayon, couleur, bord) {
    ctx.save(); ctx.fillStyle = couleur; ctx.strokeStyle = bord; ctx.lineWidth = e.px;
    for (const p of liste) {
      const g = ctx.createRadialGradient(p.x - rayon * 0.35, p.y - rayon * 0.35, rayon * 0.1, p.x, p.y, rayon);
      g.addColorStop(0, melange(couleur, '#ffffff', 0.55)); g.addColorStop(1, couleur);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, rayon, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  /** Agitation thermique : déplacement pseudo-aléatoire, d'amplitude croissante avec √T. */
  function agiter(liste, T, e, amp = 0.012) {
    const k = amp * Math.sqrt((T + 273) / 293);
    const t = e.temps;
    return liste.map((p, n) => Object.assign({}, p, {
      x: p.x + k * Math.sin(t * 7.1 + n * 1.7) * Math.cos(n * 0.37),
      y: p.y + k * Math.cos(t * 6.3 + n * 2.3) * Math.sin(n * 0.61)
    }));
  }

  function fondChamp(ctx, e, couleur) { ctx.fillStyle = couleur; ctx.fillRect(-e.vue.w, -e.vue.h, 2 * e.vue.w, 2 * e.vue.h); }

  /* ——— Microstructures de l'acier (micro et MET), partagées avec la ZAT des assemblages soudés ——— */

  /** Grain austénitique en cours de transformation : anneaux depuis le joint (ferrite, perlite, bainite), cœur martensitique. */
  function grainTransforme(ctx, poly, s, k, e, opts) {
    const micro = e.mode === 'microscope';
    const r = alea(1000 + k * 7919);
    const A = G.aire(poly);
    const o = (k * 0.6180339) % 1;
    const tot = s.fF + s.fP + s.fB + s.fM + (s.fMf || 0) + s.fA || 1;
    const fr = { F: s.fF / tot, P: s.fP / tot, B: s.fB / tot };
    let reste = poly, cumul = 0;
    const anneaux = [];
    for (const ph of ['F', 'P', 'B']) {
      if (fr[ph] < 0.004) continue;
      cumul += fr[ph];
      const d = G.retraitPourFraction(poly, 1 - cumul);
      const interieur = d > 0 ? G.retrait(poly, d) : poly;
      anneaux.push([ph, reste, interieur]);
      reste = interieur;
      if (!reste) break;
    }
    // Fond du grain (le dernier intérieur sera recouvert par la martensite ou l'austénite).
    const P = s.P || 0;
    const revenu = clamp((P - 9000) / 9000, 0, 1);
    remplir(ctx, poly, micro ? MICRO.aust : PHASES.A);
    for (const [ph, ext, int] of anneaux) {
      ctx.save(); trace(ctx, ext);
      if (int) { ctx.moveTo(int[0][0], int[0][1]); for (let i = int.length - 1; i >= 0; i--) ctx.lineTo(int[i][0], int[i][1]); ctx.closePath(); }
      ctx.clip('evenodd');
      if (ph === 'F') { ctx.fillStyle = micro ? MICRO.ferrite : PHASES.F; ctx.fillRect(-1e4, -1e4, 2e4, 2e4); }
      if (ph === 'P') {
        const gl = clamp(s.gl || 0, 0, 1);
        ctx.fillStyle = micro ? melange(MICRO.perlite, MICRO.ferrite, 0.75 * gl) : melange(PHASES.P, PHASES.F, 0.55 * gl); ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
        if (gl < 0.97) { ctx.globalAlpha = 1 - gl; hachures(ctx, ext, o * Math.PI, opts.lamelle, micro ? MICRO.lamelle : melange(PHASES.P, '#ffffff', 0.45), Math.max(e.px, opts.lamelle * 0.3)); ctx.globalAlpha = 1; }
        if (gl > 0.03) globules(ctx, ext, r, Math.round(A * fr.P / (opts.lamelle * opts.lamelle) * 0.9 * gl), opts.lamelle * 0.38, micro ? '#2a2420' : PHASES.C);
      }
      if (ph === 'B') {
        ctx.fillStyle = micro ? melange(MICRO.bainite, MICRO.martRev, revenu * 0.35) : PHASES.B; ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
        aiguilles(ctx, ext, r, Math.round(A / (opts.aiguille * opts.aiguille) * 2.2), opts.aiguille * 1.4, [o * Math.PI, o * Math.PI + 0.12], micro ? '#3b332b' : melange(PHASES.B, '#000000', 0.35), Math.max(e.px, opts.aiguille * 0.1));
      }
      ctx.restore();
    }
    if (reste) {
      const fMt = s.fM + (s.fMf || 0);
      const mRel = fMt / Math.max(1e-6, fMt + s.fA);
      if (fMt > 0.004) {
        const fond = micro ? melange(MICRO.mart, MICRO.martRev, revenu) : melange(PHASES.M, PHASES.Mr, revenu);
        ctx.save(); trace(ctx, reste); ctx.clip();
        ctx.globalAlpha = clamp(mRel * 1.4, 0, 1); ctx.fillStyle = fond; ctx.fillRect(-1e4, -1e4, 2e4, 2e4);
        ctx.restore();
        // Martensite revenue : l'attaque la fonce et efface en partie le contraste des aiguilles.
        const n = Math.round(A / (opts.aiguille * opts.aiguille) * 6 * mRel * (1 - 0.45 * revenu));
        const angles = [o * Math.PI, o * Math.PI + Math.PI / 3, o * Math.PI - Math.PI / 3];
        const trait = micro ? melange(MICRO.aiguille, fond, 0.4 * revenu) : melange(PHASES.M, '#0b2a63', 0.5 + 0.3 * revenu);
        aiguilles(ctx, reste, r, n, Math.sqrt(A) * 0.45, angles, trait, Math.max(e.px, opts.aiguille * 0.14));
      }
      ilotsFrais(ctx, reste, s, k, e, opts, micro);
    }
    return reste;
  }

  /** Domaine vu au MET pour une phase donnée de l'acier. */
  function domaineMET(ctx, poly, ph, s, r, e, ang) {
    const frais = ph === 'Mf';
    if (frais) ph = 'M';
    const P = frais ? (s.Pf || 0) : (s.P || 0);
    const fond = { M: '#d7d2c8', B: '#cdc6b8', P: '#e7e2d6', F: '#ece8e0', A: '#bfe3d9' }[ph] || '#e5e1d8';
    remplir(ctx, poly, fond);
    const A = G.aire(poly), [cx, cy] = G.centre(poly);
    if (ph === 'P') {
      const gl = clamp(s.gl || 0, 0, 1);
      if (gl < 0.97) { ctx.save(); ctx.globalAlpha = 1 - gl; hachures(ctx, poly, ang, 0.22, '#3d342c', 0.07); ctx.restore(); }
      // Globulisation : les lamelles se fragmentent puis s'arrondissent.
      if (gl > 0.03) { ctx.save(); ctx.globalAlpha = Math.min(1, gl * 1.4); points(ctx, poly, r, Math.round(A * 40 * gl), lerp(0.03, 0.07, gl), '#2a2420'); ctx.restore(); }
      return;
    }
    if (ph === 'F') { enchevetrement(ctx, poly, r, Math.round(A * 2), 0.25, 'rgba(60,55,50,.55)', e.px); return; }
    if (ph === 'A') {
      if (s.fA > 0.5) hachures(ctx, poly, ang + 1.0, 0.9, 'rgba(60,90,80,.35)', e.px);
      return;
    }
    // Lattes de martensite ou de bainite.
    const largeur = ph === 'M' ? 0.2 : 0.28;
    const disparition = clamp((P - 18500) / 2500, 0, 1);
    ctx.save(); ctx.globalAlpha = 1 - 0.7 * disparition;
    hachures(ctx, poly, ang, largeur, '#5c544a', 1.1 * e.px);
    ctx.restore();
    const dislocs = ph === 'M' ? clamp(1 - (P - 9000) / 10000, 0.12, 1) : clamp(0.6 - (P - 9000) / 14000, 0.1, 0.6);
    enchevetrement(ctx, poly, r, Math.round(A * 70 * dislocs), 0.08, 'rgba(40,36,32,.45)', 0.8 * e.px);
    if (ph === 'B') aiguilles(ctx, poly, r, Math.round(A * 18), 0.16, [ang], '#1f1b18', 0.022);
    if (s.fA > 0.005 && s.fA < 0.3 && ph === 'M') {
      // Films d'austénite résiduelle entre les lattes.
      ctx.save(); trace(ctx, poly); ctx.clip();
      hachures(ctx, poly, ang, largeur * 2, 'rgba(255,255,255,.85)', Math.max(1.5 * e.px, s.fA * 0.12));
      ctx.restore();
    }
    // Carbures de revenu selon le stade.
    if (P >= 9000 && P < 11000) aiguilles(ctx, poly, r, Math.round(A * 160 * clamp((P - 9000) / 1500, 0.2, 1)), 0.05, [ang + Math.PI / 4, ang - Math.PI / 4], '#2b2622', 1.2 * e.px);
    else if (P >= 11000 && P < 14000) aiguilles(ctx, poly, r, Math.round(A * 45), 0.14, [ang], '#1e1a17', Math.max(2 * e.px, 0.015));
    else if (P >= 14000) {
      const g = clamp((P - 14000) / 6000, 0, 1);
      points(ctx, poly, r, Math.round(A * lerp(55, 14, g)), lerp(0.012, 0.035, g), '#1c1815');
    }
    // Carbures alliés : nanométriques et très nombreux (MC, M₂C) ou, pour un acier à 9 % Cr, M₂₃C₆ plus gros et MX fins.
    const CA = e.traj.A.carburesAllies;
    if (CA && !frais && P >= CA.P - 1500) {
      const g = clamp((P - CA.P + 1500) / 2500, 0, 1);
      if (!e.traj.A.raSecondaire) points(ctx, poly, r, Math.round(A * 22 * g), 0.028, '#151210');
      points(ctx, poly, r, Math.round(A * 420 * g), Math.max(0.8 * e.px, 0.0045), '#151210');
    }
    void cx; void cy;
  }

  /* ——— Famille « acier » : barre ou plaque, trempée, revenue, recuite, normalisée, homogénéisée ——— */

  /** Demi-dimension de la pièce (mm) : rayon d'une barre ou demi-épaisseur d'une plaque. */
  function piece(traj) {
    if (traj.geo) return { R: traj.geo.L * 1000, plaque: traj.geo.forme === 'plaque' };
    const p = traj.p || {};
    return { R: (p.D || p.e || 40) / 2, plaque: !p.D && !!p.e };
  }

  /** Champ du microscope optique (µm) : élargi quand le grain devient grossier, pour en voir plusieurs à la fois. */
  const CHAMPS = [160, 200, 250, 320, 400, 500, 640, 800];
  function champMicro(traj) {
    if (!traj.echantillons) return CHAMPS[0];
    if (!traj._champMicro) {
      let d = 0;
      for (const ech of traj.echantillons) for (const pt of traj.points) { const s = ech.noeuds[pt.noeud]; d = Math.max(d, s.dG || 0, s.dA || 0); }
      traj._champMicro = CHAMPS.find(c => c >= 1.7 * d) || CHAMPS[CHAMPS.length - 1];
    }
    return traj._champMicro;
  }

  /** Structure finale surtout diffusive (ferrite et perlite) : on la dessine en mosaïque de grains de ferrite et de colonies de perlite. */
  function diffusif(e) {
    const traj = e.traj, pt = traj.points.find(p => p.id === e.point) || traj.points[0];
    traj._diffusif = traj._diffusif || {};
    if (traj._diffusif[pt.noeud] == null) { const f = traj.echantillons[traj.echantillons.length - 1].noeuds[pt.noeud]; traj._diffusif[pt.noeud] = f.fF + f.fP >= 0.5; }
    return traj._diffusif[pt.noeud];
  }

  /** Ségrégation interdendritique : cellules de taille 2λ dont les bords sont enrichis en manganèse. */
  function reseauSegregation(e, demi) {
    const lambda = (e.traj.p.lambda || (e.traj.A.segregation || {}).lambda || 100);
    const cle = 'seg' + lambda + ':' + demi;
    if (!e.memo[cle]) {
      const n = clamp(Math.round(4 * demi * demi / (Math.PI * lambda * lambda / 4)), 2, 600);
      const pts = G.semis(61, n, 2 * demi, 2 * demi, -demi, -demi);
      e.memo[cle] = { pts, cell: G.voronoi(pts, -demi, -demi, demi, demi), lambda };
    }
    return e.memo[cle];
  }
  /** Enrichissement en manganèse (0 à 1) au point (x, y) : maximal sur les bords des cellules dendritiques. */
  function enrichissement(res, x, y) {
    let a = Infinity, b = Infinity, pa = null, pb = null;
    for (const p of res.pts) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < a) { b = a; pb = pa; a = d; pa = p; } else if (d < b) { b = d; pb = p; }
    }
    if (!pb) return 0;
    const dist = (b - a) / (2 * Math.hypot(pa.x - pb.x, pa.y - pb.y));
    return clamp(1 - dist / (0.25 * res.lambda), 0, 1);
  }

  /** Globules de cémentite (globulisation) ou carbures non dissous : petits disques sombres. */
  function globules(ctx, poly, r, n, rayon, couleur) {
    if (n < 1) return;
    points(ctx, poly, r, Math.min(n, 4000), rayon, couleur);
  }

  /** Colonie de perlite : lamelles qui s'effacent au profit de globules quand la cémentite globulise. */
  function perlite(ctx, poly, s, k, e, opts, micro) {
    const gl = clamp(s.gl || 0, 0, 1), r = alea(5000 + k * 7919), o = (k * 0.6180339) % 1;
    remplir(ctx, poly, micro ? melange(MICRO.perlite, MICRO.ferrite, 0.85 * gl) : melange(PHASES.P, PHASES.F, 0.6 * gl));
    if (gl < 0.97) {
      ctx.save(); ctx.globalAlpha = 1 - gl;
      hachures(ctx, poly, o * Math.PI, opts.lamelle, micro ? MICRO.lamelle : melange(PHASES.P, '#ffffff', 0.45), Math.max(e.px, opts.lamelle * 0.3));
      ctx.restore();
    }
    if (gl > 0.03) {
      ctx.save(); ctx.globalAlpha = Math.min(1, gl * 1.5);
      globules(ctx, poly, r, Math.round(G.aire(poly) / (opts.lamelle * opts.lamelle) * 0.9 * gl), opts.lamelle * 0.38, micro ? '#2a2420' : PHASES.C);
      ctx.restore();
    }
  }

  /** Part de la martensite fraîche qui n'est pas encore revenue (le revenu suivant l'efface entre ≈ 350 et 500 °C). */
  function fraiche(s) { return (s.fMf || 0) * (s.Pf > 0 ? clamp(1 - (s.Pf - 10000) / 5000, 0, 1) : 1); }

  /** Îlots de martensite fraîche (née d'une austénite résiduelle ou intercritique après un revenu) : clairs après attaque. */
  function ilotsFrais(ctx, poly, s, k, e, opts, micro) {
    const fr = fraiche(s);
    if (!(fr > 0.004)) return;
    const r = alea(7000 + k * 104729);
    ctx.save(); trace(ctx, poly); ctx.clip();
    ctx.fillStyle = micro ? '#f6f3ec' : PHASES.Mf; ctx.strokeStyle = micro ? 'rgba(60,50,40,.55)' : 'rgba(0,0,0,.35)'; ctx.lineWidth = e.px;
    const n = Math.max(1, Math.round(G.aire(poly) / (opts.aiguille * opts.aiguille) * fr * 3));
    const [cx, cy] = G.centre(poly), R = rayonPoly(poly, cx, cy);
    for (let j = 0; j < Math.min(n, 600); j++) {
      const x = cx + (r() * 2 - 1) * R, y = cy + (r() * 2 - 1) * R, a = r() * Math.PI, l = opts.aiguille * (0.45 + 0.6 * r());
      ctx.beginPath(); ctx.ellipse(x, y, l, l * 0.45, a, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  const acier = {
    echelles: [
      { id: 'oeil', nom: 'À l’œil', court: 'Œil', unite: 'mm', champ: () => 180, hauteur: tr => 2 * piece(tr).R + 44 },
      { id: 'macro', nom: 'Coupe attaquée', court: 'Macro', unite: 'mm', champ: tr => Math.max(14, 2 * piece(tr).R * 1.45), hauteur: tr => 2 * piece(tr).R * 1.22 },
      { id: 'micro', nom: 'Microscope optique', court: 'Micro', unite: 'µm', champ: tr => champMicro(tr) },
      { id: 'met', nom: 'Microscope électronique', court: 'MET', unite: 'µm', champ: () => 2.4 },
      { id: 'maille', nom: 'Maille cristalline', court: 'Maille', unite: 'nm', champ: () => 3.4, hauteur: () => 1.5 }
    ],

    /** Position (unités de l'échelle i) du centre du champ de l'échelle i + 1. */
    loupe(i, e) {
      const { R, plaque } = piece(e.traj);
      if (i === 0) return [40, 0];
      if (i === 1) return e.point === 'coeur' ? [0, 0] : plaque ? [0, -R * 0.93] : [R * 0.93, 0];
      return [0, 0];
    },

    oeil(ctx, e) {
      const { R, plaque } = piece(e.traj), x0 = -80, x1 = 60, q = 18;
      fondChamp(ctx, e, e.c.papier);
      const s = e.s, Ts = e.Tpts.surface;
      let base = '#8d939a';
      if (s.Tmax > 700) base = melange(base, '#3d3a37', clamp((s.Tmax - 700) / 300, 0.3, 0.7));
      ctx.save();
      let contour;
      if (plaque) {
        // Plaque vue en perspective cavalière : dessus, chant droit, puis face avant.
        ctx.beginPath(); ctx.moveTo(x0, -R); ctx.lineTo(x1, -R); ctx.lineTo(x1 + q, -R - q); ctx.lineTo(x0 + q, -R - q); ctx.closePath();
        ctx.fillStyle = melange(base, '#ffffff', 0.25); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x1, -R); ctx.lineTo(x1 + q, -R - q); ctx.lineTo(x1 + q, R - q); ctx.lineTo(x1, R); ctx.closePath();
        ctx.fillStyle = melange(base, '#000000', 0.25); ctx.fill();
        const g = ctx.createLinearGradient(0, -R, 0, R);
        g.addColorStop(0, melange(base, '#ffffff', 0.15)); g.addColorStop(1, melange(base, '#000000', 0.3));
        ctx.fillStyle = g; ctx.fillRect(x0, -R, x1 - x0, 2 * R);
        ctx.lineWidth = e.px * 1.2; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.strokeRect(x0, -R, x1 - x0, 2 * R);
        contour = () => { ctx.beginPath(); ctx.moveTo(x0, -R); ctx.lineTo(x0 + q, -R - q); ctx.lineTo(x1 + q, -R - q); ctx.lineTo(x1 + q, R - q); ctx.lineTo(x1, R); ctx.lineTo(x0, R); ctx.closePath(); };
      } else {
        barre(ctx, x0, x1, R, base, e);
        contour = () => { ctx.beginPath(); ctx.rect(x0, -R, x1 - x0, 2 * R); ctx.ellipse(x1, 0, R * 0.32, R, 0, 0, 2 * Math.PI); };
      }
      // Bande polie : on y lit la teinte de revenu.
      const teinte = s.P > 0 && e.T < 120 ? teinteRevenu(s.vRev || 0) : null;
      if (teinte) {
        const g = ctx.createLinearGradient(0, -R, 0, R);
        g.addColorStop(0, melange(teinte, '#ffffff', 0.3)); g.addColorStop(0.4, teinte); g.addColorStop(1, melange(teinte, '#000000', 0.35));
        ctx.fillStyle = g; ctx.fillRect(x0 + 10, -R, 35, 2 * R);
      }
      lueur(ctx, contour, Ts, 480);
      const seg = e.traj.segments[e.etat.seg];
      if (seg.etape === 'trempe' && (seg.milieu === 'eau' || seg.milieu === 'huile')) bulles(ctx, x0, x1, R, e, clamp((Ts - 100) / 500, 0, 1));
      ctx.restore();
      repere(ctx, 40, 0, Math.max(R * 1.6, 12), e);
    },

    macro(ctx, e) {
      const { R, plaque } = piece(e.traj), X = Math.max(R * 1.32, e.vue.w * 0.46);
      fondChamp(ctx, e, e.c.papier);
      const n = e.noeuds.length, s = e.s;
      const hv = e.propsNoeuds.map(p => p.HV);
      const micro = e.mode === 'microscope';
      const couleur = i => { const t = clamp((hv[i] - 180) / 500, 0, 1); return micro ? melange('#d8d4cb', '#4a4540', t) : melange('#efe4c8', '#1e4fa8', t); };
      // Bandes (plaque) ou anneaux (barre) colorés selon la dureté locale.
      const chemin = plaque ? () => { ctx.beginPath(); ctx.rect(-X, -R, 2 * X, 2 * R); } : () => { ctx.beginPath(); ctx.arc(0, 0, R, 0, 2 * Math.PI); };
      for (let i = n - 1; i >= 0; i--) {
        const r = Math.min(R, R * (i + 0.5) / (n - 1));
        ctx.fillStyle = couleur(i);
        if (plaque) ctx.fillRect(-X, -r, 2 * X, 2 * r);
        else { ctx.beginPath(); ctx.arc(0, 0, r, 0, 2 * Math.PI); ctx.fill(); }
      }
      // Ségrégation dendritique révélée par l'attaque (pièce moulée) : zone basaltique près des faces, équiaxe au centre.
      if (s.seg > 0.004 && plaque) {
        const cle = 'dendrites' + R.toFixed(2);
        if (!e.memo[cle]) {
          const r = alea(53), traits = [], pas = Math.max(R / 8, 1), prof = R * 0.4;
          for (const sens of [-1, 1]) for (let x = -X + pas * 0.4; x < X; x += pas * (0.8 + 0.4 * r())) {
            const L = prof * (0.75 + 0.5 * r()), a = (r() - 0.5) * 0.25;
            const xa = x, ya = sens * R, xb = x + Math.sin(a) * L, yb = sens * (R - Math.cos(a) * L);
            traits.push([xa, ya, xb, yb]);
            for (let t = 0.15; t < 0.95; t += 0.16) {
              const xm = lerp(xa, xb, t), ym = lerp(ya, yb, t), l = pas * 0.3 * (1 - 0.5 * t);
              traits.push([xm, ym, xm - l, ym - sens * l * 0.7], [xm, ym, xm + l, ym - sens * l * 0.7]);
            }
          }
          for (let k = 0; k < Math.round(X * R * 2 / (pas * pas) * 0.5); k++) {
            const x = (r() * 2 - 1) * X, y = (r() * 2 - 1) * (R - prof), a = r() * Math.PI, l = pas * (0.25 + 0.2 * r());
            for (let b = 0; b < 4; b++) { const c = a + b * Math.PI / 2; traits.push([x, y, x + Math.cos(c) * l, y + Math.sin(c) * l]); }
          }
          e.memo[cle] = traits;
        }
        ctx.save(); chemin(); ctx.clip();
        ctx.globalAlpha = clamp(s.seg / 0.3, 0, 1) * 0.7;
        ctx.strokeStyle = micro ? '#3f3428' : PHASES.seg; ctx.lineWidth = Math.max(e.px * 1.2, R * 0.012); ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [a, b, c, d] of e.memo[cle]) { ctx.moveTo(a, b); ctx.lineTo(c, d); }
        ctx.stroke(); ctx.restore();
      }
      chemin(); ctx.lineWidth = 1.5 * e.px; ctx.strokeStyle = e.c.encre; ctx.stroke();
      lueur(ctx, chemin, e.Tpts.surface, 480);
      // Filiation de dureté de la surface vers le cœur.
      const nb = 5;
      for (let k = 0; k < nb; k++) {
        const f = 1 - (k + 0.5) / nb * 0.98, i = Math.round(f * (n - 1)), t = R * 0.05;
        const [x, y] = plaque ? [-X * 0.45, -R * f] : [-R * f, 0];
        ctx.beginPath(); ctx.moveTo(x - t, y); ctx.lineTo(x, y - t); ctx.lineTo(x + t, y); ctx.lineTo(x, y + t); ctx.closePath();
        ctx.fillStyle = e.c.encre; ctx.fill();
        if (plaque) texte(ctx, Math.round(hv[i]) + '', x + R * 0.1, y, e, { taille: 11, gras: true, halo: e.c.papier, align: 'left' });
        else texte(ctx, Math.round(hv[i]) + '', x, -R * 0.16, e, { taille: 11, gras: true, halo: e.c.papier });
      }
      if (plaque) texte(ctx, 'HV10', -X * 0.45 - R * 0.1, -R * 0.902, e, { taille: 11, couleur: e.c.encre, halo: e.c.papier, align: 'right' });
      else texte(ctx, 'HV10', R * 0.02, -R * 0.16, e, { taille: 11, couleur: e.c.encre, halo: e.c.papier, align: 'left' });
      const [lx, ly] = this.loupe(1, e);
      repere(ctx, lx, ly, champMicro(e.traj) / 1000, e);
    },

    micro(ctx, e) {
      const s = e.s, A = e.traj.A, champ = champMicro(e.traj), demi = champ / 2, aireCh = champ * champ, micro = e.mode === 'microscope';
      fondChamp(ctx, e, micro ? MICRO.fond : PHASES.F);
      const f = Math.sqrt(champ / 160);
      const opts = { lamelle: 0.9 * f, aiguille: 1.6 * f };
      const seg = s.seg > 0.004 || (s.seg0 > 0.004) ? reseauSegregation(e, demi) : null;
      const biais = seg ? 1.4 * clamp((s.seg || 0) / 0.3, 0, 1) : 0;
      let joints = [];
      if (!s.aust || diffusif(e)) {
        // Mosaïque de grains de ferrite et de colonies de perlite (taille : grain ferritique).
        const tous = semisMemo(e.memo, 'fp' + demi, 11, 2000, demi);
        const nC = actifs(tous, aireCh, s.dA || s.dG || 15);
        const cell = cellules(e.memo, 'fpv' + nC + ':' + demi, tous.slice(0, nC), demi);
        let ordre;
        if (!s.aust) {
          // Structure de départ : la perlite d'abord (zones enrichies en manganèse si ségrégation), puis la ferrite.
          const fP0 = s.fP0 != null ? s.fP0 : A.initial.fP;
          const cleO = 'ordre0:' + nC + ':' + demi + ':' + biais.toFixed(2);
          if (!e.memo[cleO]) {
            const score = tous.slice(0, nC).map((p, k) => ({ k, v: p.o - (seg ? biais * enrichissement(seg, p.x, p.y) : 0) }));
            score.sort((a, b) => a.v - b.v);
            const nP = Math.round(fP0 * nC), type = new Map(score.map((x, i) => [x.k, i < nP ? 'P' : 'F']));
            // Austénitisation : la perlite se transforme d'abord, puis la ferrite.
            const aus = [...score.slice(0, nP), ...score.slice(nP).sort((a, b) => tous[a.k].s - tous[b.k].s)];
            e.memo[cleO] = { type, rangA: new Map(aus.map((x, i) => [x.k, i / nC])) };
          }
          const { type, rangA } = e.memo[cleO];
          cell.forEach((poly, k) => {
            if (poly.length < 3) return;
            if (rangA.get(k) < s.fA) remplir(ctx, poly, micro ? MICRO.aust : PHASES.A);
            else if (type.get(k) === 'P') perlite(ctx, poly, s, k, e, opts, micro);
            else {
              remplir(ctx, poly, micro ? teinteGrain(MICRO.ferrite, tous[k].s, 0.05) : PHASES.F);
              // Acier allié recuit : carbures globulaires dispersés aussi dans la ferrite.
              if (s.gl > 0.5 && A.durete) globules(ctx, poly, alea(900 + k), Math.round(G.aire(poly) / (opts.lamelle * opts.lamelle) * 0.12 * s.gl), opts.lamelle * 0.33, micro ? '#2a2420' : PHASES.C);
            }
          });
          joints = cell;
        } else {
          // Transformation au refroidissement : grains d'austénite, puis ferrite qui germe sur leurs joints et perlite au centre.
          const gam = semisMemo(e.memo, 'gamma' + demi, 23, 2000, demi);
          const nG = actifs(gam, aireCh, s.dG);
          const cellG = cellules(e.memo, 'gv' + nG + ':' + demi, gam.slice(0, nG), demi);
          if (s.fA > 0.004) {
            cellG.forEach(poly => { if (poly.length >= 3) remplir(ctx, poly, micro ? MICRO.aust : PHASES.A); });
            ctx.lineWidth = 1.4 * e.px; ctx.strokeStyle = micro ? MICRO.joint : 'rgba(20,20,20,.6)';
            cellG.forEach(poly => { if (poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
          }
          const cleO = 'ordre:' + nC + ':' + nG + ':' + demi + ':' + biais.toFixed(2);
          if (!e.memo[cleO]) {
            const g = gam.slice(0, nG), demiG = Math.max(1, s.dG / 2);
            const score = tous.slice(0, nC).map((p, k) => {
              let a = Infinity, b = Infinity, pa = null, pb = null;
              for (const q of g) { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < a) { b = a; pb = pa; a = d; pa = q; } else if (d < b) { b = d; pb = q; } }
              const dist = pb ? (b - a) / (2 * Math.hypot(pa.x - pb.x, pa.y - pb.y)) : 0;
              // Ferrite d'abord près des joints de l'austénite ; le manganèse ségrégé retarde la ferrite (perlite en bandes).
              return { k, v: dist / demiG + 0.25 * p.o + (seg ? biais * enrichissement(seg, p.x, p.y) : 0) };
            });
            score.sort((x, y) => x.v - y.v);
            e.memo[cleO] = new Map(score.map((x, i) => [x.k, i / nC]));
          }
          const rang = e.memo[cleO];
          const bornes = [['F', s.fF], ['P', s.fP], ['B', s.fB], ['M', s.fM + s.fMf]];
          cell.forEach((poly, k) => {
            if (poly.length < 3) return;
            let x = rang.get(k), ph = null;
            for (const [nom, fr] of bornes) { if (x < fr) { ph = nom; break; } x -= fr; }
            if (!ph) return;  // encore austénitique
            if (ph === 'F') remplir(ctx, poly, micro ? teinteGrain(MICRO.ferrite, tous[k].s, 0.05) : PHASES.F);
            else if (ph === 'P') perlite(ctx, poly, s, k, e, opts, micro);
            else grainTransforme(ctx, poly, ph === 'B' ? { fF: 0, fP: 0, fB: 1, fM: 0, fA: 0, P: s.P } : { fF: 0, fP: 0, fB: 0, fM: 1, fMf: 0, fA: 0, P: s.P }, k, e, opts);
            joints.push(poly);
          });
        }
      } else {
        // Trempe : grains d'austénite qui se transforment depuis leurs joints (ferrite, perlite, bainite) jusqu'au cœur (martensite).
        const tous = semisMemo(e.memo, 'gamma' + demi, 23, 2000, demi);
        const n = actifs(tous, aireCh, s.dG);
        const cell = cellules(e.memo, 'gv' + n + ':' + demi, tous.slice(0, n), demi);
        cell.forEach((poly, k) => { if (poly.length >= 3) grainTransforme(ctx, poly, s, k, e, opts); });
        joints = cell;
      }
      // Bords des cellules dendritiques enrichis en manganèse (voile coloré, d'autant plus net que la ségrégation est forte).
      if (seg && s.seg > 0.004) {
        ctx.save();
        ctx.globalAlpha = clamp(s.seg / 0.3, 0, 1) * (micro ? 0.22 : 0.38);
        ctx.strokeStyle = micro ? '#4a3a2a' : PHASES.seg; ctx.lineWidth = seg.lambda * 0.3; ctx.lineJoin = 'round';
        seg.cell.forEach(poly => { if (poly && poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
        ctx.restore();
      }
      ctx.lineWidth = 1.3 * e.px; ctx.strokeStyle = micro ? MICRO.joint : 'rgba(20,20,20,.65)';
      joints.forEach(poly => { if (poly && poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
      // Carbures alliés non dissous à l'austénitisation (aciers à outils).
      if (A.dissolution && s.aust && s.dissol < 0.97) {
        ctx.save(); ctx.globalAlpha = 0.85;
        globules(ctx, [[-demi, -demi], [demi, -demi], [demi, demi], [-demi, demi]], alea(313), Math.round(aireCh / 9 * (1 - s.dissol)), 0.45 * f, micro ? '#2a2420' : PHASES.C);
        ctx.restore();
      }
      // Inclusions de sulfure de manganèse, allongées dans le sens du laminage.
      const r = alea(91);
      ctx.fillStyle = micro ? MICRO.incl : '#555';
      for (let k = 0; k < Math.min(60, Math.round(9 * aireCh / 25600)); k++) { ctx.beginPath(); ctx.ellipse((r() * 2 - 1) * demi, (r() * 2 - 1) * demi, (2 + r() * 4) * f, (0.45 + r() * 0.3) * f, 0, 0, 2 * Math.PI); ctx.fill(); }
      repere(ctx, 0, 0, 2.4, e);
    },

    met(ctx, e) {
      const s = e.s, demi = 1.4;
      fondChamp(ctx, e, '#e3dfd6');
      const pts = semisMemo(e.memo, 'met', 5, 9, demi);
      const cell = cellules(e.memo, 'metv', pts, demi);
      const phases = s.aust ? [['M', s.fM], ['Mf', s.fMf], ['B', s.fB], ['P', s.fP], ['F', s.fF], ['A', s.fA]] : [['P', s.fP], ['F', s.fF], ['A', s.fA]];
      const attrib = G.repartir(cell.length, phases);
      cell.forEach((poly, k) => { if (poly.length >= 3) domaineMET(ctx, poly, attrib[k] || 'A', s, alea(300 + k), e, pts[k].o * Math.PI); });
      ctx.lineWidth = 2 * e.px; ctx.strokeStyle = 'rgba(30,26,22,.75)';
      cell.forEach(poly => { if (poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
      repere(ctx, 0, 0, 0.05, e);
    },

    maille(ctx, e) {
      const s = e.s, T = e.T;
      fondChamp(ctx, e, e.c.carte);
      const dom = [['A', s.fA], ['M', s.fM], ['Mf', s.fMf || 0], ['B', s.fB], ['F', s.fF + s.fP]].sort((a, b) => b[1] - a[1])[0][0];
      const demiL = e.vue.w / 2 + 0.3, demiH = e.vue.h / 2 + 0.3;
      let fer, carbone = [], legende;
      const revenu = dom === 'Mf' ? clamp(((s.Pf || 0) - 9000) / 6000, 0, 1) : clamp((s.P - 9000) / 6000, 0, 1);
      if (dom === 'A') {
        fer = reseau(0.36, demiL, demiH, true);
        const r = alea(17);
        for (const p of fer) if (p.type === 'coin' && r() < 0.05) carbone.push({ x: p.x + 0.18, y: p.y });
        legende = 'A';
      } else if (dom === 'M' || dom === 'Mf') {
        const ca = 1 + 10 * 0.045 * e.traj.A.composition.C * (1 - revenu);
        fer = reseau(0.287, demiL, demiH, true, ca);
        const r = alea(19);
        for (const p of fer) if (p.type === 'coin' && r() < 0.12 * (1 - revenu)) carbone.push({ x: p.x, y: p.y + 0.287 * ca / 2 });
        legende = 'M';
      } else {
        fer = reseau(0.287, demiL, demiH, true);
        legende = dom;
      }
      // Carbure (ou cémentite de perlite) : îlot ordonné plus sombre.
      const ilot = (dom === 'F' && s.fP > 0.1) || (dom !== 'A' && revenu > 0.2) || dom === 'B';
      let ilotC = [];
      if (ilot) {
        const R = dom === 'F' ? 0.55 : 0.25 + 0.35 * revenu;
        fer = fer.filter(p => Math.hypot(p.x - 0.55, p.y - 0.15) > R);
        const r = alea(23);
        for (let a = 0; a < 2 * Math.PI; a += 0.9) for (let q = 0.12; q < R; q += 0.17) ilotC.push({ x: 0.55 + Math.cos(a + q) * q, y: 0.15 + Math.sin(a + q) * q, sombre: r() < 0.35 });
      }
      // Contrainte résiduelle : déformation élastique exagérée ×200.
      const eps = clamp((s.sig || 0) / 210000 * 200, -0.25, 0.25);
      const def = p => ({ x: p.x * (1 + eps), y: p.y * (1 - 0.3 * eps), type: p.type });
      fer = agiter(fer.map(def), T, e);
      carbone = agiter(carbone.map(def), T, e, 0.006);
      ilotC = ilotC.map(def);
      atomes(ctx, fer, e, 0.07, '#8f98a3', 'rgba(0,0,0,.35)');
      if (ilotC.length) { atomes(ctx, ilotC.filter(p => !p.sombre), e, 0.07, '#5b6066', 'rgba(0,0,0,.4)'); atomes(ctx, ilotC.filter(p => p.sombre), e, 0.035, '#1b1b1b', 'rgba(0,0,0,.5)'); }
      atomes(ctx, carbone, e, 0.035, '#1b1b1b', 'rgba(0,0,0,.5)');
      e.legendeMaille = legende;
    }
  };

  /* ——— Famille « soudure » : assemblage bout à bout et sa ZAT ——— */
  const soudure = {
    echelles: [
      { id: 'oeil', nom: 'À l’œil', court: 'Œil', unite: 'mm', champ: () => 360, hauteur: tr => tr.p.e * 2 + 120 },
      { id: 'macro', nom: 'Macrographie du joint', court: 'Macro', unite: 'mm', champ: tr => tr.p.e * 3.2, hauteur: tr => tr.p.e * 1.3 },
      { id: 'micro', nom: 'Microscope optique (ZAT)', court: 'Micro', unite: 'µm', champ: () => 200 },
      { id: 'met', nom: 'Microscope électronique', court: 'MET', unite: 'µm', champ: () => 2.4 },
      { id: 'maille', nom: 'Maille cristalline', court: 'Maille', unite: 'nm', champ: () => 3.2, hauteur: () => 1.5 }
    ],
    loupe(i, e) {
      const ep = e.traj.p.e;
      if (i === 0) return [0, 0];
      if (i === 1) return [ep * 0.36, e.point === 'surface' ? -ep * 0.38 : 0];
      return [0, 0];
    },
    oeil(ctx, e) {
      const ep = e.traj.p.e, L = 150, prof = 60;
      fondChamp(ctx, e, e.c.papier);
      const s = e.s;
      ctx.save();
      for (const sens of [-1, 1]) {
        const x0 = sens < 0 ? -L : 0, x1 = sens < 0 ? 0 : L;
        // Dessus de la tôle (vue oblique) puis chant.
        ctx.beginPath(); ctx.moveTo(x0, -ep / 2); ctx.lineTo(x1, -ep / 2); ctx.lineTo(x1 + prof * 0.5, -ep / 2 - prof * 0.5); ctx.lineTo(x0 + prof * 0.5, -ep / 2 - prof * 0.5); ctx.closePath();
        ctx.fillStyle = '#9aa1a8'; ctx.fill();
        ctx.fillStyle = '#6f767d'; ctx.fillRect(x0, -ep / 2, x1 - x0, ep);
      }
      // Cordon de soudure et coloration selon la contrainte résiduelle.
      ctx.beginPath(); ctx.moveTo(-ep * 0.35, -ep / 2); ctx.lineTo(-ep * 0.35 + prof * 0.5, -ep / 2 - prof * 0.5); ctx.lineTo(ep * 0.35 + prof * 0.5, -ep / 2 - prof * 0.5); ctx.lineTo(ep * 0.35, -ep / 2); ctx.closePath();
      ctx.fillStyle = '#7b7368'; ctx.fill();
      const f = clamp(s.sig / e.traj.A.Re, 0, 1);
      ctx.globalAlpha = 0.65 * f; ctx.fillStyle = e.c.sig;
      ctx.beginPath(); ctx.moveTo(-ep * 1.4, -ep / 2); ctx.lineTo(-ep * 1.4 + prof * 0.5, -ep / 2 - prof * 0.5); ctx.lineTo(ep * 1.4 + prof * 0.5, -ep / 2 - prof * 0.5); ctx.lineTo(ep * 1.4, -ep / 2); ctx.closePath(); ctx.fill();
      ctx.fillRect(-ep * 1.4, -ep / 2, ep * 2.8, ep);
      ctx.globalAlpha = 1;
      lueur(ctx, () => { ctx.beginPath(); ctx.rect(-L, -ep / 2 - prof * 0.5, 2 * L + prof * 0.5, ep + prof * 0.5); }, e.Tpts.surface, 480);
      // Thermocouples.
      ctx.strokeStyle = e.c.frc; ctx.lineWidth = 1.5 * e.px;
      for (const x of [-40, 30]) { ctx.beginPath(); ctx.moveTo(x, -ep / 2 - 10); ctx.bezierCurveTo(x + 10, -ep - 30, x - 20, -ep - 50, x, -ep - 75); ctx.stroke(); }
      ctx.restore();
      repere(ctx, 0, 0, ep * 1.2, e);
    },
    macro(ctx, e) {
      const ep = e.traj.p.e, s = e.s, pr = e.props;
      fondChamp(ctx, e, e.c.papier);
      const micro = e.mode === 'microscope';
      const tole = micro ? '#cfcac0' : PHASES.F;
      ctx.fillStyle = tole; ctx.fillRect(-ep * 1.6, -ep / 2, ep * 3.2, ep);
      // ZAT puis métal fondu en V à 60°.
      const haut = ep * 0.62, bas = ep * 0.08;
      const V = [[-haut, -ep / 2], [haut, -ep / 2], [bas, ep / 2], [-bas, ep / 2]];
      const zat = [[-haut - ep * 0.12, -ep / 2], [haut + ep * 0.12, -ep / 2], [bas + ep * 0.12, ep / 2], [-bas - ep * 0.12, ep / 2]];
      const t = clamp((pr.HVz - 165) / 255, 0, 1);
      remplir(ctx, zat, micro ? melange('#b9b1a3', '#5b5247', t) : melange(PHASES.F, PHASES.M, t));
      remplir(ctx, V, micro ? '#a99e8c' : '#c8b48e');
      // Passes successives.
      ctx.strokeStyle = micro ? 'rgba(60,50,40,.55)' : 'rgba(80,60,30,.5)'; ctx.lineWidth = 1 * e.px;
      const nb = Math.max(3, Math.round(ep / 8));
      for (let k = 1; k < nb; k++) {
        const y = ep / 2 - k * ep / nb, w = lerp(bas, haut, k / nb);
        ctx.beginPath(); ctx.moveTo(-w, y); ctx.quadraticCurveTo(0, y - ep / nb * 0.9, w, y); ctx.stroke();
      }
      ctx.strokeStyle = e.c.encre; ctx.lineWidth = 1.2 * e.px; ctx.strokeRect(-ep * 1.6, -ep / 2, ep * 3.2, ep);
      lueur(ctx, () => { ctx.beginPath(); ctx.rect(-ep * 1.6, -ep / 2, ep * 3.2, ep); }, e.Tpts.surface, 480);
      // Filiation de dureté à mi-épaisseur : métal de base, ZAT, métal fondu.
      const vals = [[-ep * 1.2, e.traj.A.HVmb], [-ep * 0.5, pr.HVz], [0, Math.max(200, 0.8 * pr.HVz)], [ep * 0.5, pr.HVz], [ep * 1.2, e.traj.A.HVmb]];
      for (const [x, v] of vals) {
        const q = ep * 0.04;
        ctx.beginPath(); ctx.moveTo(x - q, 0); ctx.lineTo(x, -q); ctx.lineTo(x + q, 0); ctx.lineTo(x, q); ctx.closePath(); ctx.fillStyle = e.c.encre; ctx.fill();
        const coul = v > 380 ? e.c.sig : v > 320 ? e.c.frc : e.c.encre;
        texte(ctx, Math.round(v) + '', x, ep * 0.16, e, { taille: 11, gras: true, couleur: coul, halo: e.c.papier });
      }
      const [lx, ly] = this.loupe(1, e);
      repere(ctx, lx, ly, 0.2, e);
      void s;
    },
    micro(ctx, e) {
      const s = e.s, demi = 100, micro = e.mode === 'microscope';
      fondChamp(ctx, e, micro ? MICRO.fond : PHASES.F);
      const tous = semisMemo(e.memo, 'zat', 41, 40, demi);
      const cell = cellules(e.memo, 'zatv', tous, demi);
      const fM = clamp((s.Hz0 - 250) / 170, 0.1, 0.9);
      const etat = { fF: 0.04, fP: 0, fB: 1 - fM - 0.04, fM, fA: 0, P: s.P > 0 ? Math.max(9000, s.P) : 0, aust: 1 };
      cell.forEach((poly, k) => { if (poly.length >= 3) grainTransforme(ctx, poly, etat, k, e, { lamelle: 1, aiguille: 2.6 }); });
      ctx.lineWidth = 1.6 * e.px; ctx.strokeStyle = micro ? MICRO.joint : 'rgba(20,20,20,.7)';
      cell.forEach(poly => { if (poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
      if (s.mart) {
        // Îlots de martensite fraîche formés après un passage au-dessus d'Ac1.
        const r = alea(77); ctx.fillStyle = micro ? '#f7f5ef' : PHASES.M;
        cell.forEach(poly => { if (poly.length < 3) return; for (let k = 0; k < 3; k++) { const v = poly[Math.floor(r() * poly.length)]; ctx.beginPath(); ctx.arc(v[0], v[1], 2 + r() * 2.5, 0, 2 * Math.PI); ctx.fill(); } });
      }
      repere(ctx, 0, 0, 2.4, e);
    },
    met(ctx, e) {
      const s = e.s, demi = 1.4;
      fondChamp(ctx, e, '#e3dfd6');
      const pts = semisMemo(e.memo, 'met', 6, 7, demi);
      const cell = cellules(e.memo, 'metv', pts, demi);
      const fM = clamp((s.Hz0 - 250) / 170, 0.1, 0.9);
      const etat = { P: s.P > 0 ? Math.max(9000, s.P) : 0, fA: 0 };
      const attrib = G.repartir(cell.length, [['M', fM], ['B', 1 - fM]]);
      cell.forEach((poly, k) => { if (poly.length >= 3) domaineMET(ctx, poly, attrib[k], etat, alea(400 + k), e, pts[k].o * Math.PI); });
      ctx.lineWidth = 2 * e.px; ctx.strokeStyle = 'rgba(30,26,22,.75)';
      cell.forEach(poly => { if (poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
      repere(ctx, 0, 0, 0.05, e);
    },
    maille(ctx, e) {
      const s = e.s;
      fondChamp(ctx, e, e.c.carte);
      const demiL = e.vue.w / 2 + 0.3, demiH = e.vue.h / 2 + 0.3;
      const eps = clamp(s.sig / 210000 * 200, -0.25, 0.25);
      let fer = reseau(0.287, demiL, demiH, true).map(p => ({ x: p.x * (1 + eps), y: p.y * (1 - 0.3 * eps), type: p.type }));
      fer = agiter(fer, e.T, e);
      atomes(ctx, fer, e, 0.07, '#8f98a3', 'rgba(0,0,0,.35)');
      // Hydrogène diffusible en sites interstitiels : un atome dessiné par ml/100 g.
      const r = alea(29), H = [];
      for (let k = 0; k < Math.round(s.H); k++) H.push({ x: (r() * 2 - 1) * e.vue.w * 0.4, y: (r() * 2 - 1) * e.vue.h * 0.4 });
      atomes(ctx, agiter(H, e.T, e, 0.05), e, 0.03, '#e8e8e8', 'rgba(0,0,0,.6)');
    }
  };

  /* ——— Famille « cuivre » : écrouissage, restauration, recristallisation ——— */
  function germesRx(memo, r, d0, drx, demi) {
    const cle = 'rx' + r.toFixed(3);
    if (memo[cle]) return memo[cle];
    const sx = 1 / (1 - r), sy = 1 - r;
    // Grains déformés : cellules d'un semis équiaxe, étirées comme par le laminage.
    const n0 = Math.max(4, Math.round(4 * demi * demi / (Math.PI * d0 * d0 / 4)));
    const brut = G.semis(31, n0, 2 * demi / sx, 2 * demi / sy, -demi / sx, -demi / sy);
    const vieux = G.voronoi(brut, -demi / sx, -demi / sy, demi / sx, demi / sy).map(p => p.map(([x, y]) => [x * sx, y * sy]));
    // Germes de recristallisation, de préférence près des anciens joints.
    const nrx = clamp(Math.round(4 * demi * demi / (Math.PI * drx * drx / 4)), 3, 1400);
    const rnd = alea(37), germes = [];
    while (germes.length < nrx) {
      const poly = vieux[Math.floor(rnd() * vieux.length)];
      if (!poly || poly.length < 3) continue;
      const i = Math.floor(rnd() * poly.length), a = poly[i], b = poly[(i + 1) % poly.length], t = rnd();
      const [cx, cy] = G.centre(poly), u = rnd() * 0.35;
      const x = lerp(a[0], b[0], t) * (1 - u) + cx * u, y = lerp(a[1], b[1], t) * (1 - u) + cy * u;
      if (Math.abs(x) <= demi && Math.abs(y) <= demi) germes.push({ x, y, rang: rnd(), o: rnd(), s: rnd() });
    }
    germes.sort((p, q) => p.rang - q.rang);
    // Les quantiles sont tirés sur [0, 2·demi]² : les germes y sont décalés de demi.
    const decales = germes.map(g => ({ x: g.x + demi, y: g.y + demi }));
    const q2 = G.quantilesCouverture(decales, 2 * demi, 2 * demi, 41);
    memo[cle] = { vieux, germes, quant: q2, brut, sx, sy };
    return memo[cle];
  }

  const cuivre = {
    echelles: [
      { id: 'oeil', nom: 'À l’œil', court: 'Œil', unite: 'mm', champ: () => 160, hauteur: () => 50 },
      { id: 'macro', nom: 'Surface attaquée', court: 'Macro', unite: 'mm', champ: () => 6 },
      { id: 'micro', nom: 'Microscope optique', court: 'Micro', unite: 'µm', champ: () => 300 },
      { id: 'met', nom: 'Microscope électronique', court: 'MET', unite: 'µm', champ: () => 2.4 },
      { id: 'maille', nom: 'Maille cristalline', court: 'Maille', unite: 'nm', champ: () => 3.6, hauteur: () => 1.6 }
    ],
    loupe(i) { return i === 0 ? [20, 0] : [0, 0]; },
    oeil(ctx, e) {
      fondChamp(ctx, e, e.c.papier);
      const s = e.s;
      let base = '#c27a4a';
      if (s.ox > 0) base = melange(base, s.ox < 0.4 ? '#b5523b' : s.ox < 1 ? '#5b3a5e' : '#2e2422', clamp(s.ox, 0, 1) * 0.85);
      ctx.save();
      const g = ctx.createLinearGradient(0, -25, 0, 25);
      g.addColorStop(0, melange(base, '#ffffff', 0.35)); g.addColorStop(0.5, base); g.addColorStop(1, melange(base, '#000000', 0.35));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-70, -12); ctx.lineTo(70, -18); ctx.lineTo(78, 10); ctx.lineTo(-62, 16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = e.px; ctx.stroke();
      if (s.h2 > 0.2) { const r = alea(5); ctx.fillStyle = 'rgba(40,20,10,.55)'; for (let k = 0; k < 40 * s.h2; k++) { ctx.beginPath(); ctx.arc(-60 + r() * 130, -10 + r() * 22, 0.6 + r() * 1.2, 0, 2 * Math.PI); ctx.fill(); } }
      lueur(ctx, () => { ctx.beginPath(); ctx.moveTo(-70, -12); ctx.lineTo(70, -18); ctx.lineTo(78, 10); ctx.lineTo(-62, 16); ctx.closePath(); }, e.Tpts.coeur, 520);
      ctx.restore();
      repere(ctx, 20, 0, 12, e);
    },
    macro(ctx, e) {
      const s = e.s, pr = e.props, demi = 3, micro = e.mode === 'microscope';
      fondChamp(ctx, e, micro ? '#c98a5f' : PHASES.Cu);
      const d = pr.grain / 1000;
      if (d > 0.05) {
        const tous = semisMemo(e.memo, 'macro', 51, 5000, demi);
        const n = actifs(tous, 4 * demi * demi, d);
        const cell = cellules(e.memo, 'macrov' + n, tous.slice(0, n), demi);
        cell.forEach((poly, k) => { if (poly.length >= 3) remplir(ctx, poly, teinteGrain(micro ? '#c98a5f' : PHASES.CuRx, tous[k].o, 0.22)); });
        ctx.strokeStyle = 'rgba(60,30,15,.35)'; ctx.lineWidth = 0.6 * e.px;
        cell.forEach(poly => { if (poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
      } else {
        const r = alea(3); ctx.fillStyle = 'rgba(80,40,20,.10)';
        for (let k = 0; k < 900; k++) ctx.fillRect((r() * 2 - 1) * demi, (r() * 2 - 1) * demi, 0.02, 0.02);
      }
      lueur(ctx, () => { ctx.beginPath(); ctx.rect(-demi, -demi, 2 * demi, 2 * demi); }, e.Tpts.coeur, 520);
      repere(ctx, 0, 0, 0.3, e);
      void s;
    },
    micro(ctx, e) {
      const s = e.s, p = e.traj.p, demi = 150, micro = e.mode === 'microscope';
      const base = micro ? '#d79a6c' : PHASES.Cu;
      fondChamp(ctx, e, base);
      const A = e.traj.A;
      const R = germesRx(e.memo, clamp(p.r, 0, 0.8), A.d0, s.drx, demi);
      const def = clamp(s.eps / 1.6, 0, 1);
      // Grains écrouis et leurs bandes de glissement.
      R.vieux.forEach((poly, k) => {
        if (poly.length < 3) return;
        remplir(ctx, poly, teinteGrain(base, R.brut[k].o, 0.2));
        if (def > 0.01) {
          ctx.save(); ctx.globalAlpha = 0.25 + 0.5 * def * (1 - 0.6 * s.Y);
          const a = Math.atan(Math.tan(R.brut[k].s * Math.PI) * R.sy / R.sx);
          hachures(ctx, poly, a, lerp(8, 3, def), micro ? '#7a4a2e' : melange(PHASES.Cu, '#000000', 0.35), e.px);
          ctx.restore();
        }
      });
      ctx.strokeStyle = micro ? '#5a3320' : 'rgba(40,20,10,.7)'; ctx.lineWidth = 1.8 * e.px;
      R.vieux.forEach(poly => { if (poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
      // Grains recristallisés : cellules des germes, limitées au rayon atteint (Johnson-Mehl).
      if (s.X > 0.002) {
        let germes = R.germes, rayon = G.rayonPourFraction(R.quant, s.X) * (s.X > 0.985 ? 10 : 1);
        if (s.X > 0.98 && s.dR > s.drx * 1.05) {
          const n = actifs(R.germes, 4 * demi * demi, s.dR);
          germes = R.germes.slice(0, n);
        }
        const cle = 'rxv' + p.r.toFixed(3) + ':' + germes.length;
        const cell = cellules(e.memo, cle, germes, demi);
        const neuf = micro ? MICRO.cuRx : PHASES.CuRx;
        cell.forEach((poly, k) => {
          if (poly.length < 3) return;
          const g = germes[k];
          const complet = s.X > 0.985;
          ctx.save(); if (!complet) { ctx.beginPath(); ctx.arc(g.x, g.y, rayon, 0, 2 * Math.PI); ctx.clip(); }
          remplir(ctx, poly, teinteGrain(neuf, g.o, 0.25));
          if (g.s < 0.65) {
            // Macle de recuit : bande à bords parallèles traversant le grain.
            const [cx, cy] = G.centre(poly), a = g.o * Math.PI, w = Math.sqrt(G.aire(poly)) * 0.12;
            const bande = G.couper(G.couper(poly, Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2) * cx + Math.sin(a + Math.PI / 2) * cy + w), -Math.cos(a + Math.PI / 2), -Math.sin(a + Math.PI / 2), -(Math.cos(a + Math.PI / 2) * cx + Math.sin(a + Math.PI / 2) * cy) + w);
            if (bande.length >= 3) remplir(ctx, bande, teinteGrain(neuf, 1 - g.o, 0.25));
          }
          trace(ctx, poly); ctx.strokeStyle = micro ? '#6a3c22' : 'rgba(40,20,10,.75)'; ctx.lineWidth = 1.5 * e.px; ctx.stroke();
          ctx.restore();
        });
      }
      // Inclusions d'oxyde Cu2O, ou cavités de vapeur d'eau sous hydrogène.
      const r = alea(61);
      for (let k = 0; k < 40; k++) {
        const x = (r() * 2 - 1) * demi, y = (r() * 2 - 1) * demi;
        ctx.beginPath(); ctx.arc(x, y, s.h2 > 0.05 ? 1.2 + 2.5 * s.h2 : 0.9, 0, 2 * Math.PI);
        ctx.fillStyle = s.h2 > 0.05 ? PHASES.pore : (micro ? '#3b4a63' : PHASES.ox); ctx.fill();
      }
      repere(ctx, 0, 0, 3, e);
    },
    met(ctx, e) {
      const s = e.s, demi = 1.4;
      fondChamp(ctx, e, '#e8e1d6');
      const pts = semisMemo(e.memo, 'met', 8, 24, demi);
      const cell = cellules(e.memo, 'metv', pts, demi);
      const attrib = G.repartir(cell.length, [['rx', s.X], ['def', 1 - s.X]]);
      const densite = clamp(s.eps / 1.2, 0.05, 1) * (1 - 0.35 * s.Y);
      cell.forEach((poly, k) => {
        if (poly.length < 3) return;
        const r = alea(500 + k);
        if (attrib[k] === 'rx') {
          remplir(ctx, poly, '#f1ebe1');
          if (pts[k].s < 0.7) { const a = pts[k].o * Math.PI; hachures(ctx, poly, a, 5, 'rgba(70,60,50,.7)', 1.5 * e.px); }
          enchevetrement(ctx, poly, r, 3, 0.2, 'rgba(60,50,40,.5)', e.px);
        } else {
          remplir(ctx, poly, '#e3dacd');
          // Parois de cellules de dislocations : denses quand le métal est écroui, nettes après restauration.
          const nette = s.Y > 0.3;
          ctx.save(); trace(ctx, poly); ctx.clip();
          const [qx, qy] = G.centre(poly);
          const sous = e.memo['sous' + k] || (e.memo['sous' + k] = G.voronoi(G.semis(600 + k, 10, 1.2, 1.2, qx - 0.6, qy - 0.6), qx - 0.6, qy - 0.6, qx + 0.6, qy + 0.6));
          for (const sp of sous) {
            if (sp.length < 3) continue;
            if (nette) { trace(ctx, sp); ctx.strokeStyle = 'rgba(50,40,30,.65)'; ctx.lineWidth = 1.4 * e.px; ctx.stroke(); }
            else for (let i = 0; i < sp.length; i++) { const a = sp[i], b = sp[(i + 1) % sp.length]; enchevetrement(ctx, [a, b, [b[0] + 0.03, b[1] + 0.03], [a[0] + 0.03, a[1] + 0.03]], r, Math.round(10 * densite), 0.05, 'rgba(45,35,25,.55)', 0.8 * e.px); }
          }
          ctx.restore();
          enchevetrement(ctx, poly, r, Math.round(G.aire(poly) * 90 * densite), 0.07, 'rgba(45,35,25,.45)', 0.7 * e.px);
        }
      });
      ctx.lineWidth = 2 * e.px; ctx.strokeStyle = 'rgba(40,30,20,.8)';
      cell.forEach(poly => { if (poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
      repere(ctx, 0, 0, 0.05, e);
    },
    maille(ctx, e) {
      const s = e.s;
      fondChamp(ctx, e, e.c.carte);
      const demiL = e.vue.w / 2 + 0.3, demiH = e.vue.h / 2 + 0.3, b = 0.255, nu = 0.34;
      const f = (1 - s.X) * clamp(s.eps / 0.3, 0, 1);
      let at = reseau(b, demiL, demiH, false).map(p => {
        // Dislocation coin au centre : champ de déplacement élastique isotrope (coupure le long de x < 0).
        const x = p.x, y = p.y - 0.09, r2 = x * x + y * y + 1e-4, th = Math.atan2(y, x);
        const ux = b / (2 * Math.PI) * (th + x * y / (2 * (1 - nu) * r2));
        const uy = -b / (2 * Math.PI) * ((1 - 2 * nu) / (4 * (1 - nu)) * Math.log(r2) + (x * x - y * y) / (4 * (1 - nu) * r2));
        return { x: p.x + f * ux, y: p.y + f * uy, type: p.type };
      });
      const r = alea(71), nLac = Math.round(6 * s.cv * (1 - s.X));
      const lac = [];
      const vis = at.map((p, i) => [p, i]).filter(([p]) => Math.abs(p.x) < e.vue.w / 2 - 0.1 && Math.abs(p.y) < e.vue.h / 2 - 0.1 && Math.hypot(p.x, p.y) > 0.4).map(([, i]) => i);
      for (let k = 0; k < nLac; k++) lac.push(vis[Math.floor(r() * vis.length)]);
      const vides = at.filter((_, i) => lac.includes(i));
      at = agiter(at.filter((_, i) => !lac.includes(i)), e.T, e);
      atomes(ctx, at, e, 0.085, '#c8794a', 'rgba(0,0,0,.35)');
      ctx.save(); ctx.setLineDash([3 * e.px, 3 * e.px]); ctx.strokeStyle = e.c.terne; ctx.lineWidth = e.px;
      for (const v of vides) { ctx.beginPath(); ctx.arc(v.x, v.y, 0.085, 0, 2 * Math.PI); ctx.stroke(); }
      ctx.restore();
      if (f > 0.05) { ctx.save(); ctx.strokeStyle = e.c.sig; ctx.lineWidth = 2 * e.px; ctx.beginPath(); ctx.moveTo(-0.12, 0.09); ctx.lineTo(0.12, 0.09); ctx.moveTo(0, 0.09); ctx.lineTo(0, -0.15); ctx.stroke(); ctx.restore(); }
    }
  };

  /* ——— Famille « aluminium » : solution solide, amas, β″ ——— */
  const aluminium = {
    echelles: [
      { id: 'oeil', nom: 'À l’œil', court: 'Œil', unite: 'mm', champ: () => 200, hauteur: tr => tr.p.e + 50 },
      { id: 'macro', nom: 'Coupe de la plaque', court: 'Macro', unite: 'mm', champ: tr => Math.max(12, tr.p.e * 2.2), hauteur: tr => tr.p.e * 1.3 },
      { id: 'micro', nom: 'Microscope optique', court: 'Micro', unite: 'µm', champ: () => 250 },
      { id: 'met', nom: 'Microscope électronique', court: 'MET', unite: 'nm', champ: () => 200 },
      { id: 'maille', nom: 'Maille cristalline', court: 'Maille', unite: 'nm', champ: () => 3.6, hauteur: () => 1.6 }
    ],
    loupe(i, e) {
      const ep = e.traj.p.e;
      if (i === 0) return [0, 0];
      if (i === 1) return [0, e.point === 'surface' ? -ep / 2 * 0.9 : 0];
      return [0, 0];
    },
    oeil(ctx, e) {
      fondChamp(ctx, e, e.c.papier);
      const s = e.s, ep = Math.max(4, e.traj.p.e);
      ctx.save();
      const g = ctx.createLinearGradient(0, -40, 0, 40);
      g.addColorStop(0, '#eef2f6'); g.addColorStop(0.5, '#b8c1cb'); g.addColorStop(1, '#7f8994');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(-85, -ep / 2); ctx.lineTo(70, -ep / 2); ctx.lineTo(90, -ep / 2 - 30); ctx.lineTo(-65, -ep / 2 - 30); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8f99a4'; ctx.fillRect(-85, -ep / 2, 155, ep);
      ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = e.px; ctx.strokeRect(-85, -ep / 2, 155, ep);
      if (s.brule) { const r = alea(9); ctx.fillStyle = 'rgba(60,60,60,.6)'; for (let k = 0; k < 50; k++) { ctx.beginPath(); ctx.arc(-80 + r() * 160, -ep / 2 - r() * 28, 0.8 + r() * 1.5, 0, 2 * Math.PI); ctx.fill(); } }
      lueur(ctx, () => { ctx.beginPath(); ctx.rect(-85, -ep / 2 - 30, 175, ep + 30); }, e.Tpts.surface, 560);
      const seg = e.traj.segments[e.etat.seg];
      if (seg.etape === 'trempe' && seg.milieu === 'eau') bulles(ctx, -85, 70, ep / 2 + 4, e, clamp((e.Tpts.surface - 100) / 400, 0, 1));
      ctx.restore();
      repere(ctx, 0, 0, Math.max(ep * 1.4, 10), e);
    },
    macro(ctx, e) {
      const ep = e.traj.p.e, larg = Math.max(12, ep * 2.2) * 0.9;
      fondChamp(ctx, e, e.c.papier);
      const n = e.noeuds.length, micro = e.mode === 'microscope';
      for (let i = n - 1; i >= 0; i--) {
        const y = ep / 2 * (i + 0.5) / (n - 1);
        const t = clamp((e.propsNoeuds[i].HV - 35) / 85, 0, 1);
        ctx.fillStyle = micro ? melange('#dde2e7', '#7d8792', t) : melange(PHASES.Al, '#c2410c', t * 0.8);
        ctx.fillRect(-larg / 2, -Math.min(ep / 2, y), larg, 2 * Math.min(ep / 2, y));
      }
      ctx.strokeStyle = e.c.encre; ctx.lineWidth = 1.2 * e.px; ctx.strokeRect(-larg / 2, -ep / 2, larg, ep);
      lueur(ctx, () => { ctx.beginPath(); ctx.rect(-larg / 2, -ep / 2, larg, ep); }, e.Tpts.surface, 560);
      const [lx, ly] = this.loupe(1, e);
      repere(ctx, lx, ly, 0.25, e);
    },
    micro(ctx, e) {
      const s = e.s, demi = 125, micro = e.mode === 'microscope';
      fondChamp(ctx, e, micro ? '#e6e9ec' : PHASES.Al);
      const tous = semisMemo(e.memo, 'al', 71, 30, demi);
      const cell = cellules(e.memo, 'alv', tous, demi);
      cell.forEach((poly, k) => { if (poly.length >= 3) remplir(ctx, poly, teinteGrain(micro ? '#e6e9ec' : PHASES.Al, tous[k].o, 0.06)); });
      ctx.strokeStyle = s.brule ? '#1d1d1d' : (micro ? 'rgba(70,75,82,.7)' : 'rgba(40,50,60,.6)'); ctx.lineWidth = (s.brule ? 5 : 1.3) * e.px;
      cell.forEach(poly => { if (poly.length >= 3) { trace(ctx, poly); ctx.stroke(); } });
      const r = alea(81);
      // Intermétalliques au fer, alignés en chapelets dans le sens de filage.
      ctx.fillStyle = micro ? '#80878f' : PHASES.Fe;
      for (let k = 0; k < 14; k++) { const y = (r() * 2 - 1) * demi, x0 = (r() * 2 - 1) * demi; for (let j = 0; j < 4; j++) { ctx.beginPath(); ctx.ellipse(x0 + j * (8 + r() * 6), y + (r() - 0.5) * 2, 1.2 + r() * 2.5, 0.6 + r() * 0.8, 0, 0, 2 * Math.PI); ctx.fill(); } }
      // Mg2Si grossier : il disparaît pendant la mise en solution.
      ctx.fillStyle = micro ? '#202226' : PHASES.Mg2Si;
      const n = Math.round(160 * s.gq);
      for (let k = 0; k < n; k++) { ctx.beginPath(); ctx.arc((r() * 2 - 1) * demi, (r() * 2 - 1) * demi, 0.8 + r() * 1.6, 0, 2 * Math.PI); ctx.fill(); }
      if (s.brule) {
        // Rosettes de fusion naissante aux points triples.
        ctx.fillStyle = '#2b2b2b';
        cell.forEach(poly => { if (poly.length >= 3) for (let k = 0; k < poly.length; k += 2) { ctx.beginPath(); ctx.arc(poly[k][0], poly[k][1], 2.4, 0, 2 * Math.PI); ctx.fill(); } });
      }
      repere(ctx, 0, 0, 2.4, e);
    },
    met(ctx, e) {
      const s = e.s, demi = 100;
      fondChamp(ctx, e, '#e9ecef');
      const r = alea(91);
      // Joint de grain avec sa zone dénudée en précipités.
      const pfz = s.gb > 0.05 ? 14 : 0;
      ctx.save(); ctx.strokeStyle = 'rgba(40,45,52,.85)'; ctx.lineWidth = 2.5 * e.px; ctx.beginPath(); ctx.moveTo(-demi, demi * 0.55); ctx.lineTo(demi, -demi * 0.25); ctx.stroke(); ctx.restore();
      const dansPFZ = (x, y) => {
        const d = Math.abs((-0.4) * x - y + demi * 0.15) / Math.hypot(0.4, 1);
        return d < pfz;
      };
      // Dispersoïdes au manganèse (fixes).
      ctx.fillStyle = '#9aa3ad';
      for (const [x, y, a, b] of [[-55, -40, 18, 9], [48, 52, 22, 10], [70, -60, 12, 12]]) { ctx.beginPath(); ctx.ellipse(x, y, a, b, 0.4, 0, 2 * Math.PI); ctx.fill(); }
      // Amas de solutés : petits points.
      const nC = Math.round(900 * s.gc);
      ctx.fillStyle = PHASES.amas;
      for (let k = 0; k < nC; k++) { const x = (r() * 2 - 1) * demi, y = (r() * 2 - 1) * demi; if (!dansPFZ(x, y)) { ctx.beginPath(); ctx.arc(x, y, 0.8, 0, 2 * Math.PI); ctx.fill(); } }
      // β″ puis β′ : aiguilles selon les trois directions <100>, vues en bout (points) ou de profil (traits).
      if (s.gb > 0.003) {
        const rb = s.rb, sur = clamp(s.sur || 0, 0, 1);
        const L = Math.min(60, 7 * rb), l = Math.max(1.1, rb * (0.45 + 0.35 * sur));
        const nb = clamp(Math.round(s.gb * 1800 / Math.pow(rb / 2.75, 2)), 0, 1200);
        const coul = melange(PHASES.b2, PHASES.bp, sur);
        for (let k = 0; k < nb; k++) {
          const x = (r() * 2 - 1) * demi, y = (r() * 2 - 1) * demi, o = k % 3;
          if (dansPFZ(x, y)) continue;
          ctx.fillStyle = coul;
          if (o === 0) { ctx.beginPath(); ctx.arc(x, y, l * 0.8, 0, 2 * Math.PI); ctx.fill(); }
          else if (o === 1) ctx.fillRect(x - L / 2, y - l / 2, L, l);
          else ctx.fillRect(x - l / 2, y - L / 2, l, L);
        }
      }
      if (s.gq > 0.15) { ctx.fillStyle = 'rgba(40,30,60,.85)'; ctx.beginPath(); ctx.moveTo(-demi, demi * 0.9); ctx.lineTo(-demi * 0.2, demi * 0.6); ctx.lineTo(-demi * 0.1, demi * 0.75); ctx.lineTo(-demi, demi); ctx.closePath(); ctx.fill(); }
      repere(ctx, 0, 0, 3, e);
    },
    maille(ctx, e) {
      const s = e.s;
      fondChamp(ctx, e, e.c.carte);
      const demiL = e.vue.w / 2 + 0.3, demiH = e.vue.h / 2 + 0.3;
      let at = reseau(0.405, demiL, demiH, true);
      const r = alea(13);
      // Solutés en solution solide (nombre exagéré pour la lisibilité), amas, puis îlot ordonné β″.
      at.forEach(p => { p.el = 'Al'; });
      const visibles = at.filter(p => Math.abs(p.x) < e.vue.w / 2 - 0.1 && Math.abs(p.y) < e.vue.h / 2 - 0.1);
      const nSol = Math.round(16 * s.cs), nAmas = Math.round(12 * s.gc);
      for (let k = 0; k < nSol; k++) { const p = visibles[Math.floor(r() * visibles.length)]; p.el = r() < 0.55 ? 'Mg' : 'Si'; }
      if (nAmas) { const c = at[Math.floor(at.length * 0.3)]; at.filter(p => Math.hypot(p.x - c.x, p.y - c.y) < 0.45).slice(0, nAmas).forEach((p, i) => { p.el = i % 2 ? 'Mg' : 'Si'; }); }
      if (s.gb > 0.05) {
        const R = clamp(0.25 + s.rb * 0.08, 0.3, 0.75);
        at.filter(p => Math.abs(p.x - 0.35) < R * 1.6 && Math.abs(p.y + 0.1) < R * 0.5).forEach(p => { p.el = ((Math.round(p.x / 0.2025) + Math.round(p.y / 0.2025)) % 3 === 0) ? 'Si' : 'Mg'; });
      }
      if (s.gq > 0.5 && s.gb < 0.05) {
        // Mg2Si d'équilibre : réseau propre, sans continuité avec l'aluminium (interface incohérente).
        at = at.filter(p => !(p.x < -0.2 && p.y < 0.1));
        const bloc = [];
        for (let i = -6; i < 6; i++) for (let j = -6; j < 6; j++) {
          const x = -0.75 + i * 0.32 * Math.cos(0.5) - j * 0.32 * Math.sin(0.5), y = -0.4 + i * 0.32 * Math.sin(0.5) + j * 0.32 * Math.cos(0.5);
          if (x < -0.22 && y < 0.08) bloc.push({ x, y, el: (i + j) % 3 ? 'Mg' : 'Si' });
        }
        at = at.concat(bloc);
      }
      const lac = Math.round(5 * s.cv), vides = [];
      for (let k = 0; k < lac; k++) { const v = visibles[Math.floor(r() * visibles.length)]; if (v.el === 'Al' && !vides.includes(v)) vides.push(v); }
      at = agiter(at.filter(p => !vides.includes(p)), e.T, e);
      ctx.save(); ctx.setLineDash([3 * e.px, 3 * e.px]); ctx.strokeStyle = e.c.terne; ctx.lineWidth = e.px;
      for (const v of vides) { ctx.beginPath(); ctx.arc(v.x, v.y, 0.085, 0, 2 * Math.PI); ctx.stroke(); }
      ctx.restore();
      atomes(ctx, at.filter(p => p.el === 'Al'), e, 0.085, '#b6c2cf', 'rgba(0,0,0,.3)');
      atomes(ctx, at.filter(p => p.el === 'Mg'), e, 0.095, '#8e5bc4', 'rgba(0,0,0,.4)');
      atomes(ctx, at.filter(p => p.el === 'Si'), e, 0.07, '#d4a017', 'rgba(0,0,0,.4)');
    }
  };

  const SCENES = { acier, soudure, cuivre, aluminium };

  /** Longueur « ronde » de la barre d'échelle (1, 2 ou 5 × 10ⁿ) et son libellé dans l'unité de l'échelle. */
  function barreEchelle(champ, unite) {
    const cible = champ * 0.18, p = Math.pow(10, Math.floor(Math.log10(cible)));
    const m = cible / p >= 5 ? 5 : cible / p >= 2 ? 2 : 1;
    const L = m * p;
    const txt = (L < 1 ? O.nombre(L, L < 0.1 ? 2 : 1) : O.nombre(L)) + ' ' + unite;
    return { L, txt };
  }

  return { SCENES, PHASES, MICRO, fraiche, barreEchelle, incandescence, teinteRevenu, melange };
});
