/* Graphique du cycle thermique T(t) : étapes, repères, courbes surface/cœur, curseur de temps déplaçable,
   propriété superposée sur un second axe. Le temps est « visuel » : chaque étape a sa propre échelle. */
(function (root, factory) {
  const O = root.TTH.Outils;
  root.TTH.Cycle = factory(O);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (O) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const el = (nom, attrs, parent) => {
    const n = document.createElementNS(NS, nom);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const largeurTexte = (s, taille) => s.length * taille * 0.56;

  class Cycle {
    constructor(svg, rappel) {
      this.svg = svg; this.rappel = rappel; this.u = 0;
      this.glisse = false;
      svg.addEventListener('pointerdown', ev => {
        if (ev.target.closest && ev.target.closest('.evt')) return;
        this.glisse = true; svg.setPointerCapture(ev.pointerId); this.versPointeur(ev);
      });
      svg.addEventListener('pointermove', ev => { if (this.glisse) this.versPointeur(ev); });
      const fin = ev => { this.glisse = false; try { svg.releasePointerCapture(ev.pointerId); } catch (e) { /* déjà relâché */ } };
      svg.addEventListener('pointerup', fin); svg.addEventListener('pointercancel', fin);
    }

    versPointeur(ev) {
      const r = this.svg.getBoundingClientRect();
      const x = (ev.clientX - r.left) * (this.W / r.width);
      this.rappel(O.clamp((x - this.m.g) / (this.W - this.m.g - this.m.d), 0, 1));
    }

    /** traj : trajectoire ; points : [{id, nom, noeud}] ; serie : [[u, v]] ou null ; reperes : [{T, nom}]. */
    regler(traj, options) {
      this.traj = traj; this.options = options; this.etatCourant = null; this.dessiner();
    }

    dessiner() {
      const svg = this.svg, traj = this.traj;
      if (!traj) return;
      const W = Math.max(280, svg.clientWidth || 600), H = Math.max(150, svg.clientHeight || 200);
      this.W = W; this.H = H;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.textContent = '';
      const { points, serie, reperes, bande, pointActif } = this.options;
      const petit = W < 520;
      const m = this.m = { g: petit ? 36 : 44, d: serie ? (petit ? 40 : 48) : 12, h: 26, b: 22 };
      const X = u => m.g + u * (W - m.g - m.d);
      let Tmax = 0;
      for (const e of traj.echantillons) for (const t of e.T) if (t > Tmax) Tmax = t;
      Tmax = Math.max(200, Math.ceil((Tmax + 30) / 100) * 100);
      const Y = T => H - m.b - (T / Tmax) * (H - m.h - m.b);
      this.X = X; this.Y = Y;

      const fond = el('g', { class: 'c-fond' }, svg);
      // Étapes : bandes alternées, nom en haut si la place le permet, durée en bas.
      traj.segments.forEach((g, i) => {
        const x0 = X(g.u0), x1 = X(g.u1), w = x1 - x0;
        el('rect', { x: x0, y: m.h, width: w, height: H - m.h - m.b, class: 'c-bande c-' + g.etape + (i % 2 ? ' c-impair' : '') }, fond);
        const noms = [g.nom, g.nom.split(/[ ’']/)[0]];
        const nom = noms.find(n => largeurTexte(n, 11) < w - 6);
        if (nom) el('text', { x: (x0 + x1) / 2, y: m.h - 9, class: 'c-etape', 'text-anchor': 'middle' }, fond).textContent = nom;
        const d = O.duree(g.duree);
        if (largeurTexte(d, 10) < w - 4) el('text', { x: (x0 + x1) / 2, y: H - 6, class: 'c-duree', 'text-anchor': 'middle' }, fond).textContent = d;
        if (i > 0) {
          const y = H - m.b;
          el('path', { d: `M${x0 - 4} ${y + 5} l5 -10 M${x0 - 1} ${y + 5} l5 -10`, class: 'c-coupure' }, fond);
        }
      });
      // Bande de température recommandée (ex. TTAS).
      if (bande) {
        el('rect', { x: m.g, y: Y(bande[1]), width: W - m.g - m.d, height: Y(bande[0]) - Y(bande[1]), class: 'c-zone' }, fond);
      }
      // Axe des températures.
      const axe = el('g', { class: 'c-axe' }, svg);
      const pas = Tmax > 900 ? 200 : 100;
      for (let T = 0; T <= Tmax; T += pas) {
        el('line', { x1: m.g, x2: W - m.d, y1: Y(T), y2: Y(T), class: 'c-grille' }, axe);
        el('text', { x: m.g - 5, y: Y(T) + 4, 'text-anchor': 'end', class: 'c-gradu' }, axe).textContent = T;
      }
      el('text', { x: 4, y: m.h - 9, class: 'c-unite' }, axe).textContent = '°C';
      // Repères de transformation.
      let dernier = null;
      for (const r of [...(reperes || [])].sort((a, b) => b.T - a.T)) {
        if (r.T > Tmax) continue;
        el('line', { x1: m.g, x2: W - m.d, y1: Y(r.T), y2: Y(r.T), class: 'c-repere' }, axe);
        let x = W - m.d - 4;
        if (dernier && Math.abs(Y(r.T) - dernier.y) < 12) x = dernier.x - largeurTexte(dernier.nom, 10) - 10;
        const t = el('text', { x, y: Y(r.T) - 3, 'text-anchor': 'end', class: 'c-repere-nom' }, axe);
        t.textContent = r.nom;
        dernier = { x, y: Y(r.T), nom: r.nom };
      }
      // Propriété superposée (axe de droite).
      if (serie && serie.length) {
        let lo = Infinity, hi = -Infinity;
        for (const [, v] of serie) { if (v < lo) lo = v; if (v > hi) hi = v; }
        if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
        const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
        const Yp = v => H - m.b - (v - lo) / (hi - lo) * (H - m.h - m.b);
        this.Yp = Yp;
        const g = el('g', { class: 'c-serie' }, svg);
        el('path', { d: serie.map(([u, v], i) => (i ? 'L' : 'M') + X(u).toFixed(1) + ' ' + Yp(v).toFixed(1)).join(''), class: 'c-serie-ligne' }, g);
        for (const v of [lo + pad, (lo + hi) / 2, hi - pad]) {
          el('text', { x: W - m.d + 4, y: Yp(v) + 4, class: 'c-gradu c-gradu-serie' }, g).textContent = O.nombre(v, Math.abs(hi - lo) < 10 ? 1 : 0);
        }
      } else this.Yp = null;
      // Courbes : consigne du four (pointillés), puis chaque point observé.
      const courbes = el('g', { class: 'c-courbes' }, svg);
      const E = traj.echantillons;
      const pasE = Math.max(1, Math.floor(E.length / 900));
      const chemin = f => { let d = ''; for (let i = 0; i < E.length; i += pasE) d += (d ? 'L' : 'M') + X(E[i].u).toFixed(1) + ' ' + Y(f(E[i])).toFixed(1); const l = E.at(-1); return d + 'L' + X(l.u).toFixed(1) + ' ' + Y(f(l)).toFixed(1); };
      el('path', { d: chemin(e => e.Tenv), class: 'c-four' }, courbes);
      points.forEach((p, i) => {
        el('path', { d: chemin(e => e.T[p.noeud]), class: 'c-T' + (i ? ' c-T2' : '') + (p.id === pointActif ? ' c-actif' : '') }, courbes);
      });
      // Événements du point observé : losanges cliquables.
      const evts = el('g', { class: 'c-evts' }, svg);
      const actif = points.find(p => p.id === pointActif) || points[0];
      for (const ev of traj.evenements.filter(e => e.noeud === actif.noeud)) {
        const x = X(ev.u), y = m.h + 1;
        const g = el('g', { class: 'evt', tabindex: '-1', 'data-u': ev.u }, evts);
        el('path', { d: `M${x} ${y - 5} l5 5 l-5 5 l-5 -5 z`, class: 'c-evt' }, g);
        el('title', {}, g).textContent = (this.options.titreEvt && this.options.titreEvt(ev)) || ev.id;
        g.addEventListener('click', () => this.rappel(ev.u));
      }
      // Curseur.
      this.gCurseur = el('g', { class: 'c-curseur' }, svg);
      this.placer(this.u);
    }

    placer(u) {
      this.u = u;
      if (!this.gCurseur || !this.traj) return;
      const g = this.gCurseur, X = this.X, Y = this.Y, m = this.m;
      g.textContent = '';
      const x = X(u);
      el('line', { x1: x, x2: x, y1: m.h - 2, y2: this.H - m.b, class: 'c-curseur-ligne' }, g);
      const st = this.etatCourant;
      if (st) {
        this.options.points.forEach((p, i) => {
          el('circle', { cx: x, cy: Y(st.T[p.noeud]), r: i ? 3.5 : 4.5, class: 'c-point' + (i ? ' c-point2' : '') }, g);
        });
        if (this.Yp && this.options.valeurSerie != null) el('circle', { cx: x, cy: this.Yp(this.options.valeurSerie), r: 3.5, class: 'c-point-serie' }, g);
      }
      el('circle', { cx: x, cy: m.h - 2, r: 6.5, class: 'c-poignee' }, g);
    }
  }

  return { Cycle };
});
