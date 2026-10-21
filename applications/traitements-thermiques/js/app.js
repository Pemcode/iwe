/* Laboratoire des traitements thermiques : assemblage de la page (traitement choisi, réglages, temps,
   échelle, jauges, explications, banque, thème, adresse). */
(function () {
  'use strict';
  const T = window.TTH || {};
  const $ = s => document.querySelector(s);
  if (!T.Moteur || !T.Echelles || !T.Cycle || !T.TRAITEMENTS || !T.ALLIAGES) {
    const p = document.createElement('p'); p.className = 'sans-js'; p.textContent = 'Le laboratoire n’a pas pu se charger : un fichier manque.';
    document.body.prepend(p);
    return;
  }
  const O = T.Outils, M = T.Moteur, E = T.Echelles;
  const { ALLIAGES, SOURCES } = T.ALLIAGES;
  const { TRAITEMENTS, A_VENIR, COURS, GLOSSAIRE, SIGLES } = T.TRAITEMENTS;
  const VIGNETTES = T.VIGNETTES || {};
  const html = document.documentElement;
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
  const paysage = window.matchMedia('(min-width: 1000px) and (min-height: 600px) and (orientation: landscape)');
  const stockage = {
    lire(c) { try { return window.localStorage.getItem('traitements-thermiques-' + c); } catch (e) { return null; } },
    ecrire(c, v) { try { window.localStorage.setItem('traitements-thermiques-' + c, v); } catch (e) { /* navigation privée */ } }
  };
  const nbsp = s => String(s).replace(/(\d) (°C|h|min|s|j|MPa|HV|µm|mm|nm|%|MS\/m|ml)/g, '$1 $2');
  const remplacer = (s, ev) => nbsp(s.replace('{T}', Math.round(ev.T) + ' °C').replace('{t}', O.duree(ev.t)));

  const etat = {
    tr: null, A: null, p: {}, traj: null, finDefaut: null, u: 0, lecture: false, vitesse: 1,
    z: 2, zCible: 2, point: null, mode: 'microscope', niveau: Number(stockage.lire('niveau')) === 2 ? 2 : 1,
    superposer: '', memo: {}, couleurs: null, series: {}, exemple: null, dernierEvt: null
  };

  /* ——— Couleurs du thème, lues dans les variables CSS ——— */
  function couleurs() {
    const cs = getComputedStyle(html), v = n => cs.getPropertyValue(n).trim();
    etat.couleurs = { papier: v('--paper'), papier2: v('--paper-2'), carte: v('--card'), encre: v('--ink'), terne: v('--muted'), ligne: v('--line'),
      sig: v('--sig'), tau: v('--tau'), eps: v('--eps'), gam: v('--gam'), frc: v('--frc'), mat: v('--mat'), bronze: v('--weld') };
  }

  /* ——— Choix du traitement ——— */
  function charger(id, garder) {
    const tr = TRAITEMENTS.find(t => t.id === id) || TRAITEMENTS[0];
    const change = !etat.tr || etat.tr.id !== tr.id;
    etat.tr = tr; etat.A = ALLIAGES[tr.alliage];
    if (change || !garder) {
      etat.p = {};
      for (const r of tr.reglages) etat.p[r.id] = r.defaut;
      etat.memo = {}; etat.u = 0; etat.exemple = null;
    }
    stockage.ecrire('dernier', tr.id);
    if (location.hash.slice(1) !== tr.id) history.replaceState(null, '', '#' + tr.id);
    const vg = VIGNETTES[tr.id], mini = $('#choix-vignette');
    mini.hidden = !vg;
    if (vg) { mini.src = vg.fichier; mini.style.objectPosition = vg.cadrage; }
    $('#choix-titre').textContent = tr.titre;
    $('#choix-alliage').textContent = ALLIAGES[tr.alliage].nom + ' · ' + tr.sousTitre;
    document.title = tr.titre + ' · Traitements thermiques · Révisions IWE';
    const defaut = {};
    for (const r of tr.reglages) defaut[r.id] = r.defaut;
    const trajDefaut = M.simuler(tr, etat.A, defaut);
    etat.finDefaut = trajDefaut;
    construireEchelles(); construireReglages(); construireJauges(); construireSuperposer();
    calculer(true);
    marquerBanque();
  }

  function calculer(nouveau) {
    const tr = etat.tr;
    etat.traj = M.simuler(tr, etat.A, etat.p);
    etat.series = {};
    const pts = etat.traj.points;
    if (!pts.find(p => p.id === etat.point)) etat.point = pts[0].id;
    construirePoints();
    construireSavoir();
    majEchelles();
    if (nouveau) etat.u = 0;
    regleCycle();
    rendre();
  }

  const noeudActif = () => etat.traj.points.find(p => p.id === etat.point).noeud;

  /* ——— Cycle ——— */
  const cycle = new T.Cycle.Cycle($('#cycle'), u => { arreter(); allerA(u); });

  function regleCycle() {
    const tr = etat.tr, traj = etat.traj;
    const n = noeudActif();
    let serie = null;
    if (etat.superposer) {
      const cle = etat.superposer + ':' + n;
      serie = etat.series[cle] || (etat.series[cle] = M.serie(traj, n, etat.superposer));
    }
    cycle.regler(traj, {
      points: traj.points, pointActif: etat.point, serie, reperes: tr.reperes(etat.A), bande: tr.bande,
      titreEvt: ev => remplacer((tr.evenements[ev.id] || [ev.id])[0], ev)
    });
    const leg = $('#cycle-legende'); leg.textContent = '';
    const ajout = (cls, txt) => { const s = document.createElement('span'); const i = document.createElement('i'); if (cls) i.className = cls; s.append(i, txt); leg.append(s); };
    traj.points.forEach((p, i) => ajout(i ? 'tirets' : '', p.nom));
    ajout('four', 'four ou milieu');
    if (tr.bande) ajout('zone', nbsp(tr.bande[2] + ' (' + tr.bande[0] + '–' + tr.bande[1] + ' °C)'));
    if (etat.superposer) ajout('serie', tr.proprietes.find(p => p.cle === etat.superposer).nom);
  }

  function allerA(u) { etat.u = O.clamp(u, 0, 1); compris(); rendre(); }
  function compris() {
    const a = $('#astuce');
    if (a && !a.hidden) { a.hidden = true; stockage.ecrire('astuce', 'vue'); }
  }

  /* ——— Rendu d'un instant ——— */
  function rendre() {
    const traj = etat.traj, tr = etat.tr;
    const st = M.etat(traj, etat.u);
    etat.st = st;
    const n = noeudActif();
    const fam = traj.famille;
    const props = fam.proprietes(st.noeuds[n], traj.A);
    etat.props = props;
    // Curseur du cycle.
    cycle.etatCourant = st;
    cycle.options.valeurSerie = etat.superposer ? props[etat.superposer] : null;
    cycle.placer(etat.u);
    const g = traj.segments[st.seg];
    const svg = $('#cycle');
    svg.setAttribute('aria-valuenow', Math.round(etat.u * 100));
    const Tp = traj.points.map(p => p.nom.toLowerCase() + ' ' + Math.round(st.T[p.noeud]) + ' °C').join(', ');
    svg.setAttribute('aria-valuetext', `${g.nom}, ${O.duree(st.t)} depuis le début, ${Tp}`);
    $('#lecture-valeurs').innerHTML = '';
    const lv = $('#lecture-valeurs');
    lv.append(document.createTextNode(nbsp('t = ' + O.duree(st.t) + ' · ')));
    traj.points.forEach((p, i) => {
      if (i) lv.append(document.createTextNode(' · '));
      const b = document.createElement('b'); b.textContent = nbsp(Math.round(st.T[p.noeud]) + ' °C');
      lv.append(document.createTextNode(p.nom + ' '), b);
    });
    // Commentaire de l'étape et dernier événement franchi.
    const tseg = st.t - g.debut;
    $('#etape-nom').innerHTML = '';
    $('#etape-nom').append(document.createTextNode(g.nom + ' '));
    const sm = document.createElement('small'); sm.textContent = nbsp(O.duree(Math.max(0, tseg)) + ' / ' + O.duree(g.duree)); $('#etape-nom').append(sm);
    const txt = tr.etapes[g.id];
    $('#etape-texte').textContent = txt ? nbsp(txt[etat.niveau - 1]) : '';
    const evts = traj.evenements.filter(e => e.noeud === n && e.u <= etat.u + 1e-9);
    const dernier = evts.at(-1);
    const evEl = $('#evenement');
    const cleEvt = dernier ? dernier.id : '';
    if (cleEvt !== etat.dernierEvt) {
      etat.dernierEvt = cleEvt;
      const t2 = dernier && tr.evenements[dernier.id];
      evEl.textContent = t2 ? remplacer(t2[etat.niveau - 1], dernier) : '';
    }
    majJauges(st, props);
    dessinerToile();
  }

  /* ——— Échelles et toile ——— */
  const toile = $('#toile'), ctx = toile.getContext('2d');
  function scene() { return E.SCENES[etat.A.famille]; }

  function construireEchelles() {
    const box = $('#echelles'); box.textContent = '';
    scene().echelles.forEach((ech, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.i = i;
      b.innerHTML = '<span class="pastille" aria-hidden="true"></span><span class="libelle"></span>';
      b.querySelector('.pastille').textContent = i + 1;
      b.querySelector('.libelle').textContent = ech.court;
      b.title = ech.nom;
      b.setAttribute('aria-label', ech.nom);
      b.addEventListener('click', () => viser(i));
      b.addEventListener('keydown', ev => {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') { ev.preventDefault(); viser(Math.min(4, Math.round(etat.zCible) + 1), true); }
        if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') { ev.preventDefault(); viser(Math.max(0, Math.round(etat.zCible) - 1), true); }
      });
      box.append(b);
    });
    majEchelles();
  }

  function majEchelles() {
    const i = Math.round(etat.zCible);
    document.querySelectorAll('#echelles button').forEach(b => {
      const actif = Number(b.dataset.i) === i;
      b.setAttribute('aria-checked', actif); b.tabIndex = actif ? 0 : -1;
    });
    const ech = scene().echelles[i];
    $('#modes').hidden = !['macro', 'micro'].includes(ech.id);
    $('#echelle-nom').textContent = ech.nom;
    const ch = etat.traj && W ? largeurVue(i) : ech.champ({ p: etat.p });
    $('#echelle-champ').textContent = nbsp('champ ≈ ' + O.nombre(ch, ch < 10 ? 1 : 0) + ' ' + ech.unite);
  }

  let animZoom = null;
  function viser(i, focus) {
    etat.zCible = O.clamp(i, 0, 4);
    majEchelles();
    if (focus) document.querySelector(`#echelles button[data-i="${etat.zCible}"]`).focus();
    if (reduit.matches) { etat.z = etat.zCible; dessinerToile(); return; }
    const debut = performance.now(), z0 = etat.z, dist = Math.abs(etat.zCible - z0);
    const duree = 380 + 260 * Math.min(dist, 3);
    cancelAnimationFrame(animZoom);
    const pas = now => {
      const t = O.clamp((now - debut) / duree, 0, 1);
      etat.z = z0 + (etat.zCible - z0) * O.lisse(t);
      dessinerToile();
      if (t < 1) animZoom = requestAnimationFrame(pas);
    };
    animZoom = requestAnimationFrame(pas);
  }

  let W = 0, H = 0, dpr = 1;
  function dimensionner() {
    const r = toile.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(10, r.width); H = Math.max(10, r.height);
    toile.width = Math.round(W * dpr); toile.height = Math.round(H * dpr);
  }

  /** Largeur réellement visible (unités de l'échelle i) une fois le cadrage appliqué. */
  function largeurVue(i) {
    const ech = scene().echelles[i], traj = etat.traj;
    return W / Math.min(W / ech.champ(traj), ech.hauteur ? H / ech.hauteur(traj) : Infinity);
  }

  function contexteScene(i, Z, focus) {
    const traj = etat.traj, st = etat.st, n = noeudActif();
    const ech = scene().echelles[i];
    const champ = ech.champ(traj);
    const k = Math.min(W / champ, ech.hauteur ? H / ech.hauteur(traj) : Infinity) * Z;
    const Tpts = {};
    for (const p of traj.points) Tpts[p.id] = st.T[p.noeud];
    if (!Tpts.surface) Tpts.surface = st.T[traj.geo.n - 1];
    if (!Tpts.coeur) Tpts.coeur = st.T[0];
    const propsNoeuds = st.noeuds.map(s => traj.famille.proprietes(s, traj.A));
    return {
      k, champ, focus,
      e: {
        traj, etat: st, s: st.noeuds[n], noeuds: st.noeuds, props: etat.props, propsNoeuds, T: st.T[n], Tpts,
        point: etat.point, mode: etat.mode, c: etat.couleurs, memo: etat.memo, temps: performance.now() / 1000,
        px: 1 / k, vue: { w: W / k, h: H / k }
      }
    };
  }

  function dessinerScene(i, Z, focus) {
    const { k, e } = contexteScene(i, Z, focus);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-focus[0], -focus[1]);
    scene()[scene().echelles[i].id](ctx, e);
    ctx.restore();
    return e;
  }

  function dessinerToile() {
    if (!etat.traj || !etat.st) return;
    if (!etat.couleurs) couleurs();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const z = O.clamp(etat.z, 0, 4), i = Math.floor(z + 1e-9), f = z - i;
    const S = scene();
    let e;
    if (f < 0.002 || i >= 4) {
      e = dessinerScene(Math.min(i, 4), 1, [0, 0]);
    } else {
      // Transition : on plonge dans le cadre orange de l'échelle i, puis l'échelle i + 1 apparaît.
      const c = contexteScene(i, 1, [0, 0]);
      const loupe = S.loupe(i, c.e);
      const ratio = Math.min(largeurVue(i) / largeurVue(i + 1), 7);
      const Z = Math.pow(ratio, f), g = O.lisse(f);
      dessinerScene(i, Z, [loupe[0] * g, loupe[1] * g]);
      const a = O.lisse((f - 0.25) / 0.75);
      if (a > 0) {
        const lw = O.lerp(W * 0.12, W, g), lh = O.lerp(H * 0.12, H, g);
        ctx.save(); ctx.beginPath(); ctx.rect((W - lw) / 2, (H - lh) / 2, lw, lh); ctx.clip();
        ctx.globalAlpha = a;
        e = dessinerScene(i + 1, 1, [0, 0]);
        ctx.restore();
      }
    }
    // Barre d'échelle de l'échelle dominante, en bas à gauche.
    const iDom = f < 0.5 ? i : Math.min(4, i + 1);
    const ech = S.echelles[iDom], largeur = largeurVue(iDom);
    const b = E.barreEchelle(largeur, ech.unite), Lpx = b.L / largeur * W;
    ctx.save();
    ctx.font = '12px "Atkinson Hyperlegible", system-ui, sans-serif';
    const tw = ctx.measureText(nbsp(b.txt)).width, lb = Math.max(Lpx, tw) + 16;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(8, H - 40, lb, 32);
    ctx.fillStyle = '#17212B'; ctx.fillRect(16, H - 17, Lpx, 4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(nbsp(b.txt), 16, H - 23);
    ctx.restore();
    majLegende(iDom, e);
    toile.setAttribute('aria-label', description(iDom));
  }

  function description(i) {
    const ech = scene().echelles[i], p = etat.props, s = etat.st.noeuds[noeudActif()];
    const pt = etat.traj.points.length > 1 ? ', ' + etat.traj.points.find(x => x.id === etat.point).nom.toLowerCase() : '';
    let d = '';
    const pc = v => Math.round(v * 100) + ' %';
    switch (etat.A.famille) {
      case 'acier': d = Object.entries(p.phases).filter(([, v]) => v > 0.01).map(([k, v]) => ({ A: 'austénite', F: 'ferrite', P: s.gl > 0.5 ? 'perlite globulisée' : 'perlite', B: 'bainite', M: s.P > 0 ? 'martensite revenue' : 'martensite', Mf: E.fraiche(s) > 0.5 * v ? 'martensite fraîche' : 'martensite fraîche revenue' }[k] + ' ' + pc(v))).join(', ') + ', grain ' + Math.round(p.grain) + ' µm' + (s.seg > 0.01 ? ', ségrégation du manganèse ' + Math.round(s.seg * 100) + ' %' : ''); break;
      case 'cuivre': d = 'recristallisé ' + pc(p.X) + ', grain ' + Math.round(p.grain) + ' µm'; break;
      case 'aluminium': d = 'soluté en solution ' + pc(p.cs) + ', amas ' + pc(p.gc) + ', précipités β″ ' + pc(p.gb) + ', Mg₂Si grossier ' + pc(p.gq); break;
      case 'soudure': d = 'contrainte résiduelle ' + Math.round(p.sigma) + ' MPa, dureté de ZAT ' + Math.round(p.HVz) + ' HV'; break;
    }
    return `${ech.nom}${pt} : ${d}. Vue schématique.`;
  }

  /* ——— Légende sous la toile ——— */
  /** Pastille de légende : la couleur et le motif dessinés dans la vue (lamelles, aiguilles, globules…). */
  const NS = 'http://www.w3.org/2000/svg';
  const luminances = new Map();
  function luminance(c) {
    if (!luminances.has(c)) { const t = document.createElement('i'); t.style.color = c; document.body.append(t); const m = getComputedStyle(t).color.match(/\d+/g).map(Number); t.remove(); luminances.set(c, 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]); }
    return luminances.get(c);
  }
  function pastille(couleur, motif = 'uni', fond = '#ece8de') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 18 12'); svg.setAttribute('class', 'pastille'); svg.setAttribute('aria-hidden', 'true');
    svg.dataset.couleur = couleur; svg.dataset.motif = motif;
    const el = (n, a) => { const x = document.createElementNS(NS, n); for (const k in a) x.setAttribute(k, a[k]); svg.append(x); return x; };
    const clair = luminance(couleur) > 140;
    const contraste = clair ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.8)';
    const plein = ['uni', 'lamelles', 'aiguilles', 'gerbes', 'glissement', 'macles'].includes(motif);
    el('rect', { x: 0, y: 0, width: 18, height: 12, fill: plein ? couleur : fond });
    const traits = (lignes, trait, ep) => { for (const [x1, y1, x2, y2] of lignes) el('line', { x1, y1, x2, y2, stroke: trait, 'stroke-width': ep, 'stroke-linecap': 'round' }); };
    const ronds = (liste, r, c) => { for (const [cx, cy] of liste) el('circle', { cx, cy, r, fill: c }); };
    switch (motif) {
      case 'lamelles': traits([[-2, 10, 6, -2], [2, 14, 12, -2], [7, 14, 17, -2], [12, 14, 20, 2]], contraste, 1.1); break;
      case 'aiguilles': traits([[2, 3, 9, 9], [8, 2, 15, 8], [3, 10, 12, 4], [10, 11, 16, 6], [4, 6, 8, 2]], contraste, 1); break;
      case 'gerbes': traits([[2, 3, 8, 3], [3, 6, 10, 6], [2, 9, 9, 9], [10, 2, 16, 2], [11, 5, 17, 5], [10, 8, 16, 8], [11, 11, 16, 11]], contraste, 1); break;
      case 'glissement': traits([[0, 4, 6, 0], [0, 9, 12, 1], [4, 12, 17, 3], [10, 12, 18, 7]], contraste, .7); break;
      case 'macles': traits([[3, 12, 10, 0], [7, 12, 14, 0]], contraste, 1.1); break;
      case 'ilots': el('ellipse', { cx: 5.5, cy: 4.5, rx: 3.6, ry: 2, fill: couleur, stroke: 'rgba(0,0,0,.5)', 'stroke-width': .7, transform: 'rotate(-20 5.5 4.5)' }); el('ellipse', { cx: 12.5, cy: 8, rx: 3.4, ry: 1.9, fill: couleur, stroke: 'rgba(0,0,0,.5)', 'stroke-width': .7, transform: 'rotate(25 12.5 8)' }); break;
      case 'points': ronds([[3, 3], [8, 2.5], [14, 3.5], [5, 8], [11, 7], [15.5, 9.5], [2.5, 10.5], [8.5, 10.5]], 1.25, couleur); break;
      case 'fins': ronds([[2, 2], [5, 4], [8, 2], [11, 3], [14, 2], [16, 5], [3, 7], [6, 9], [9, 6], [12, 8], [15, 10], [2, 11], [9, 10.5], [13, 5.5]], 0.6, couleur); break;
      case 'grains': ronds([[4.5, 4], [12, 3.5], [8.5, 9]], 2.2, couleur); break;
      case 'inclusion': el('ellipse', { cx: 9, cy: 6, rx: 6.5, ry: 1.6, fill: couleur }); break;
      case 'bande': el('rect', { x: 0, y: 3.5, width: 18, height: 5, fill: couleur, opacity: .85 }); break;
      case 'dendrite': traits([[9, 12, 9, 1], [9, 9, 5, 6], [9, 9, 13, 6], [9, 5.5, 6, 3], [9, 5.5, 12, 3]], couleur, 1.2); break;
      case 'lignes': traits([[0, 3, 18, 3], [0, 6.5, 18, 6.5], [0, 10, 18, 10]], couleur, 1); break;
      case 'tirets': traits([[2, 3, 5, 2], [8, 4, 11, 3], [13, 2, 16, 1], [3, 8, 6, 7], [9, 10, 12, 9], [14, 8, 17, 7]], couleur, 1.1); break;
      case 'reseau': el('path', { d: 'M0 4 L5 3 L8 7 L4 12 M5 3 L10 0 M8 7 L14 6 L18 9 M14 6 L15 0 M14 6 L12 12', fill: 'none', stroke: couleur, 'stroke-width': .9 }); break;
      case 'joints': el('path', { d: 'M0 7 L6 5 L10 9 L18 6 M6 5 L7 0 M10 9 L9 12', fill: 'none', stroke: couleur, 'stroke-width': 1.8 }); break;
      case 'atome': el('circle', { cx: 9, cy: 6, r: 4.5, fill: couleur, stroke: 'rgba(0,0,0,.45)', 'stroke-width': .8 }); break;
    }
    el('rect', { x: .5, y: .5, width: 17, height: 11, fill: 'none', stroke: 'rgba(0,0,0,.3)', 'stroke-width': 1, rx: 2 });
    return svg;
  }

  function majLegende(i, e) {
    const P = E.PHASES, MI = E.MICRO, id = scene().echelles[i].id, fam = etat.A.famille, micro = etat.mode === 'microscope';
    const s = etat.st.noeuds[noeudActif()];
    let items = [], note = '';
    if (fam === 'acier' || fam === 'soudure') {
      if (id === 'micro' || id === 'macro') {
        if (id === 'micro') {
          const zat = fam === 'soudure';
          const f = zat ? { A: 0, F: 0.04, P: 0, B: 1, M: 1 } : { A: s.fA, F: s.fF, P: s.fP, B: s.fB, M: s.fM + s.fMf - E.fraiche(s), Mf: E.fraiche(s) };
          const revenu = s.P > 0, globul = !zat && s.gl > 0.5;
          const liste = micro
            ? [['A', MI.aust, 'austénite (à chaud : vue reconstituée)', 'uni'], ['F', MI.ferrite, 'ferrite (claire)', 'uni'],
               ['P', globul ? '#2a2420' : MI.perlite, globul ? 'perlite globulisée (globules de cémentite)' : 'perlite (sombre, lamelles)', globul ? 'points' : 'lamelles', MI.ferrite],
               ['B', MI.bainite, 'bainite (en gerbes)', 'gerbes'], ['M', revenu ? MI.martRev : MI.mart, revenu ? 'martensite revenue (foncée par l’attaque)' : 'martensite (aiguilles)', 'aiguilles'],
               ['Mf', '#f6f3ec', 'martensite fraîche (îlots clairs, non revenus)', 'ilots', MI.martRev]]
            : [['A', P.A, 'austénite γ', 'uni'], ['F', P.F, 'ferrite α', 'uni'], ['P', globul ? P.C : P.P, globul ? 'perlite globulisée' : 'perlite', globul ? 'points' : 'lamelles', P.F],
               ['B', P.B, 'bainite', 'gerbes'], ['M', revenu ? P.Mr : P.M, revenu ? 'martensite revenue' : 'martensite', 'aiguilles'], ['Mf', P.Mf, 'martensite fraîche', 'ilots', P.Mr]];
          items = liste.filter(([k]) => f[k] > 0.01).map(([, ...x]) => x);
          if (zat && s.mart) items.push([micro ? '#f7f5ef' : P.Mf, 'martensite fraîche (au-dessus d’Ac1)', 'ilots', micro ? MI.martRev : P.Mr]);
          if (!zat && s.gl > 0.03 && s.gl <= 0.5 && s.fP > 0.01) items.push([micro ? '#2a2420' : P.C, 'premiers globules de cémentite', 'points', micro ? MI.lamelle : P.P]);
          if (!zat && s.seg > 0.004) items.push([micro ? '#7a6a58' : P.seg, 'bords de dendrites enrichis en manganèse', 'bande', micro ? MI.ferrite : P.F]);
          if (!zat && etat.A.dissolution && s.aust && s.dissol < 0.97) items.push([micro ? '#2a2420' : P.C, 'carbures alliés non dissous', 'grains', micro ? MI.martRev : P.Mr]);
          if (!zat) items.push([micro ? MI.incl : '#555', 'inclusions de MnS', 'inclusion', micro ? MI.ferrite : P.F]);
        }
        else {
          items = fam === 'soudure' ? [[micro ? '#a99e8c' : '#c8b48e', 'métal fondu'], [micro ? '#5b5247' : P.M, 'ZAT (plus foncée = plus dure)'], [micro ? '#cfcac0' : P.F, 'métal de base']] : [[micro ? '#d8d4cb' : P.F, 'doux'], [micro ? '#4a4540' : '#1e4fa8', 'dur (filiation en HV)']];
          if (fam === 'acier' && s.seg > 0.004 && etat.traj.geo.forme === 'plaque') items.push([micro ? '#3f3428' : P.seg, 'dendrites de solidification (ségrégation)', 'dendrite', micro ? '#d8d4cb' : P.F]);
        }
      } else if (id === 'met') {
        // Seulement ce qui est présent : une ferrite-perlite recuite n'a ni lattes ni carbures de revenu.
        const CA = etat.A.carburesAllies, acier = fam === 'acier';
        const lattes = acier ? s.fM + s.fB + s.fMf > 0.01 : true, revenu = acier ? s.P >= 9000 && s.fM + s.fB > 0.01 : s.P > 0;
        if (lattes) items.push(['#5c544a', 'lattes de martensite ou de bainite (joints)', 'lignes', '#d7d2c8']);
        if (revenu) items.push(['#1c1815', 'carbures de revenu', 'tirets', '#d7d2c8']);
        if (acier && s.fP > 0.01) items.push(s.gl > 0.03 ? ['#2a2420', 'cémentite : lamelles qui se fragmentent en globules', 'points', '#e7e2d6'] : ['#3d342c', 'cémentite de la perlite (lamelles)', 'lamelles']);
        if (acier && CA && s.P >= CA.P - 1500) items.push(['#151210', etat.A.raSecondaire ? 'carbures alliés MC et M₂C (quelques nm)' : 'carbures M₂₃C₆ et carbonitrures MX', 'fins', '#d7d2c8']);
        if (acier && E.fraiche(s) > 0.01) items.push(['#d7d2c8', 'martensite fraîche (sans carbures)', 'uni']);
        if (acier && s.fF > 0.01) items.push(['#6f665c', 'ferrite (peu de dislocations)', 'reseau', '#ece8e0']);
        if (acier && s.fA > 0.05) items.push(['#bfe3d9', 'austénite', 'uni']);
        note = 'Les dislocations apparaissent comme un fin enchevêtrement sombre.';
      }
      else if (id === 'maille') {
        items = [['#8f98a3', 'atome de fer', 'atome', etat.couleurs.carte], ['#1b1b1b', 'atome de carbone', 'atome', etat.couleurs.carte]];
        if (fam === 'soudure') items = [['#8f98a3', 'atome de fer', 'atome', etat.couleurs.carte], ['#e8e8e8', 'hydrogène (1 atome par ml/100 g)', 'atome', etat.couleurs.carte]];
        if (e && e.legendeMaille === 'M') note = 'Maille quadratique de la martensite : allongement c/a exagéré dix fois.';
        if (e && e.legendeMaille === 'A') note = 'Maille cubique à faces centrées de l’austénite : le carbone loge dans les sites octaédriques.';
        if (Math.abs(s.sig || 0) > 20) note += (note ? ' ' : '') + 'Déformation élastique due à la contrainte résiduelle exagérée deux cents fois.';
      } else if (id === 'oeil') { items = [['#ffb347', 'incandescence à chaud']]; if (fam === 'soudure') items.push([etat.couleurs.sig, 'contrainte résiduelle (plus rouge = plus forte)']); if (fam === 'acier') note = 'Une bande polie montre la teinte de revenu.'; }
    } else if (fam === 'cuivre') {
      if (id === 'micro') {
        if (s.X < 0.99) items.push([micro ? '#d79a6c' : P.Cu, s.eps > 0.01 ? 'grains écrouis et bandes de glissement' : 'grains recuits', s.eps > 0.01 ? 'glissement' : 'uni']);
        if (s.X > 0.01) items.push([micro ? MI.cuRx : P.CuRx, 'grains recristallisés (avec macles)', 'macles']);
        items.push(s.h2 > 0.05 ? [P.pore, 'cavités de vapeur d’eau (anciens Cu₂O)', 'points', micro ? MI.cuRx : P.CuRx] : [micro ? '#3b4a63' : P.ox, 'inclusions de Cu₂O', 'grains', micro ? MI.cuRx : P.CuRx]);
      }
      else if (id === 'met') { items = [['#6b5f52', 'zone écrouie (cellules de dislocations)', 'reseau', '#e3dacd'], ['#f1ebe1', 'grain recristallisé', 'uni']]; }
      else if (id === 'maille') { items = [['#c8794a', 'atome de cuivre', 'atome', etat.couleurs.carte]]; note = 'Rangées d’atomes vues de profil. Le symbole ⊥ rouge marque le cœur d’une dislocation coin (un demi-plan d’atomes en plus) ; les cercles pointillés sont des lacunes.'; }
      else if (id === 'macro') note = 'Le grain n’est visible à l’œil nu qu’au-delà d’environ 50 µm.';
    } else if (fam === 'aluminium') {
      if (id === 'micro') {
        const fondAl = micro ? '#e6e9ec' : P.Al;
        items = [[fondAl, 'grains d’aluminium', 'uni'], [micro ? '#80878f' : P.Fe, 'intermétalliques au fer', 'grains', fondAl]];
        if (s.gq > 0.01) items.push([micro ? '#202226' : P.Mg2Si, 'Mg₂Si grossier', 'points', fondAl]);
        if (s.brule) items.push(['#2b2b2b', 'joints et rosettes de fusion (brûlure)', 'joints', fondAl]);
        note = 'Les précipités durcissants (quelques nm) sont invisibles ici : passe au MET.';
      }
      else if (id === 'met') {
        const sur = s.sur > 0.25;
        if (s.gc > 0.01) items.push([P.amas, 'amas de solutés', 'fins', '#eef1f4']);
        if (s.gb > 0.003) items.push(sur ? [P.bp, 'bâtonnets β′ (sur-revenu)', 'tirets', '#eef1f4'] : [P.b2, 'aiguilles β″', 'tirets', '#eef1f4']);
        items.push(['#9aa3ad', 'dispersoïdes au Mn', 'grains', '#eef1f4']);
        if (s.gb > 0.05) note = 'Le long du joint, une zone sans précipités apparaît.';
      }
      else if (id === 'maille') { items = [['#b6c2cf', 'aluminium', 'atome', etat.couleurs.carte], ['#8e5bc4', 'magnésium', 'atome', etat.couleurs.carte], ['#d4a017', 'silicium', 'atome', etat.couleurs.carte]]; note = 'Nombre de solutés exagéré pour la lisibilité ; les cercles pointillés sont des lacunes figées par la trempe.'; }
    }
    // La légende ne se reconstruit que si son contenu change (elle est appelée à chaque image).
    const cle = JSON.stringify(items) + note;
    if (cle === etat.legende) return;
    etat.legende = cle;
    const ul = $('#legende'); ul.textContent = '';
    for (const [c, t, motif, fond] of items) { const li = document.createElement('li'); li.append(pastille(c, motif, fond), t); ul.append(li); }
    $('#mention').textContent = (note ? note + ' ' : '') + 'Vue schématique calculée par le modèle : ce n’est pas une micrographie.';
  }

  /* ——— Groupes radio : tabulation itinérante, flèches pour changer de choix ——— */
  function radios(groupe) {
    const boutons = [...groupe.querySelectorAll('[role="radio"]')];
    boutons.forEach(b => { b.tabIndex = b.getAttribute('aria-checked') === 'true' ? 0 : -1; });
    if (groupe.dataset.radios) return;
    groupe.dataset.radios = '1';
    groupe.addEventListener('keydown', ev => {
      const liste = [...groupe.querySelectorAll('[role="radio"]')];
      const i = liste.indexOf(document.activeElement);
      if (i < 0) return;
      const pas = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
      if (!pas) return;
      ev.preventDefault();
      const suivant = liste[(i + pas + liste.length) % liste.length];
      suivant.click(); suivant.focus();
    });
  }

  /* ——— Points observés et rendu ——— */
  function construirePoints() {
    const box = $('#points'); box.textContent = '';
    const pts = etat.traj.points;
    box.hidden = pts.length < 2;
    for (const p of pts) {
      const b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', p.id === etat.point); b.textContent = p.nom;
      b.addEventListener('click', () => {
        const avaitFocus = box.contains(document.activeElement);
        etat.point = p.id; construirePoints(); regleCycle(); rendre();
        if (avaitFocus) box.querySelector('[aria-checked="true"]').focus();
      });
      box.append(b);
    }
    radios(box);
  }
  document.querySelectorAll('#modes button').forEach(b => b.addEventListener('click', () => {
    etat.mode = b.dataset.mode;
    document.querySelectorAll('#modes button').forEach(x => x.setAttribute('aria-checked', x === b));
    radios($('#modes'));
    dessinerToile();
  }));
  radios($('#modes'));

  /* ——— Jauges des propriétés ——— */
  function construireJauges() {
    const box = $('#jauges'); box.textContent = '';
    for (const p of etat.tr.proprietes) {
      const d = document.createElement('div'); d.className = 'jauge'; d.dataset.cle = p.cle;
      d.innerHTML = '<div class="jauge-tete"><span class="jauge-nom"></span><output class="jauge-val"></output></div><div class="jauge-barre"><span class="jauge-rempli"></span><i class="mk mk-ref"></i><i class="mk mk-init"></i><i class="mk mk-fin"></i></div><div class="jauge-pied"></div>';
      d.querySelector('.jauge-nom').textContent = p.nom + (p.approx ? ' ≈' : '');
      if (p.signe) d.querySelector('.jauge-barre').insertAdjacentHTML('afterbegin', '<i class="zero"></i>');
      if (p.cle === 'sigma') d.querySelector('.jauge-rempli').classList.add('force');
      if (p.inverse) d.classList.add('inverse');
      box.append(d);
    }
  }

  function position(p, v) {
    if (!Number.isFinite(v)) return 0;
    if (p.log) return O.clamp(Math.log(v / p.min) / Math.log(p.max / p.min), 0, 1);
    return O.clamp((v - p.min) / (p.max - p.min), 0, 1);
  }

  function texteValeur(p, v) {
    if (p.qualitatif) {
      const mots = p.mots || ['très faible', 'faible', 'moyenne', 'bonne', 'excellente'];
      return mots[O.clamp(Math.floor(v / (100 / mots.length)), 0, mots.length - 1)];
    }
    if (p.vide && !(v >= 0)) return p.vide;
    let s = O.nombre(v, p.dec) + (p.unite ? ' ' + p.unite : '');
    if (p.cle === 'conductivite') s += ' (' + O.nombre(v / 58 * 100, 0) + ' % IACS)';
    if (p.cle === 'grain') s += ' (G ' + O.nombre(O.indiceG(v), 1) + ')';
    if (p.signe) s = (v >= 0 ? '+' : '') + s + (Math.abs(v) < 5 ? '' : v > 0 ? ' traction' : ' compression');
    return nbsp(s);
  }

  function majJauges(st, props) {
    const traj = etat.traj, n = noeudActif(), fam = traj.famille;
    const init = fam.proprietes(traj.echantillons[0].noeuds[n], traj.A);
    const fin = fam.proprietes(traj.echantillons.at(-1).noeuds[n], traj.A);
    const ptDef = etat.finDefaut.points.find(p => p.id === etat.point) || etat.finDefaut.points[0];
    const ref = fam.proprietes(etat.finDefaut.echantillons.at(-1).noeuds[ptDef.noeud], traj.A);
    const s = st.noeuds[n], Tn = st.T[n];
    const chaud = etat.A.famille === 'acier' ? s.fA > 0.05 && Tn > 150 : Tn > 120;
    for (const d of document.querySelectorAll('#jauges .jauge')) {
      const p = etat.tr.proprietes.find(x => x.cle === d.dataset.cle);
      const v = props[p.cle];
      d.querySelector('.jauge-val').textContent = texteValeur(p, v);
      const r = d.querySelector('.jauge-rempli');
      if (p.signe) { const x = position(p, v), z = position(p, 0); r.style.left = Math.min(x, z) * 100 + '%'; r.style.width = Math.abs(x - z) * 100 + '%'; }
      else { r.style.left = '0'; r.style.width = position(p, v) * 100 + '%'; }
      d.querySelector('.mk-init').style.left = position(p, init[p.cle]) * 100 + '%';
      d.querySelector('.mk-fin').style.left = position(p, fin[p.cle]) * 100 + '%';
      d.querySelector('.mk-ref').style.left = position(p, ref[p.cle]) * 100 + '%';
      d.classList.toggle('instable', chaud && !['sigma', 'grain', 'H', 'seg', 'ecartMs', 'risque'].includes(p.cle));
      const pied = d.querySelector('.jauge-pied');
      if (p.limites && !pied.childElementCount) {
        pied.classList.add('avec-limites');
        for (const [lim, txt] of p.limites) { const x = position(p, lim) * 100; const i = document.createElement('i'); i.className = 'limite'; i.style.left = x + '%'; d.querySelector('.jauge-barre').append(i); const sp = document.createElement('span'); sp.className = 'limite-texte'; sp.style.left = x + '%'; sp.textContent = txt; pied.append(sp); }
      }
    }
    // Répartition : phases de l'acier, solutés de l'aluminium, recristallisation du cuivre.
    const box = $('#repartition');
    const P = E.PHASES;
    let titre = '', parts = [];
    if (etat.A.famille === 'acier') { titre = 'Constituants'; parts = [['Austénite γ', s.fA, P.A], ['Ferrite α', s.fF, P.F], [s.gl > 0.5 ? 'Perlite globulisée' : 'Perlite', s.fP, P.P], ['Bainite', s.fB, P.B], [s.P > 0 ? 'Martensite revenue' : 'Martensite', s.fM + s.fMf - E.fraiche(s), s.P > 0 ? P.Mr : P.M], ['Martensite fraîche', E.fraiche(s), P.Mf]]; }
    if (etat.A.famille === 'aluminium') { titre = 'Où sont le magnésium et le silicium ?'; parts = [['en solution solide', s.cs, '#b6c2cf'], ['amas', s.gc, P.amas], ['précipités β″/β′', s.gb, P.b2], ['Mg₂Si grossier', s.gq, P.Mg2Si]]; }
    if (etat.A.famille === 'cuivre') { titre = 'Recristallisation'; parts = [['recristallisé', s.X, P.CuRx], ['écroui', 1 - s.X, P.Cu]]; }
    box.textContent = '';
    if (chaud) { const a = document.createElement('p'); a.className = 'alerte-chaud'; a.textContent = etat.A.famille === 'acier' ? 'À chaud, l’austénite n’est pas figée : les jauges hachurées décrivent la structure comme si on la figeait instantanément.' : 'Pièce chaude : valeurs de la structure présente, une fois ramenée à 20 °C.'; box.append(a); }
    if (parts.length) {
      const t = document.createElement('p'); t.className = 'repartition-titre'; t.textContent = titre;
      const barre = document.createElement('div'); barre.className = 'repartition-barre'; barre.setAttribute('role', 'img');
      const leg = document.createElement('ul'); leg.className = 'repartition-legende';
      const tot = parts.reduce((a, [, v]) => a + Math.max(0, v), 0) || 1;
      const lab = [];
      for (const [nom, v, c] of parts) {
        const f = Math.max(0, v) / tot;
        if (f < 0.003) continue;
        const sp = document.createElement('span'); sp.style.width = f * 100 + '%'; sp.style.background = c; barre.append(sp);
        const li = document.createElement('li'); const i = document.createElement('i'); i.style.background = c; li.append(i, nbsp(nom + ' ' + O.nombre(f * 100, f < 0.1 ? 1 : 0) + ' %')); leg.append(li);
        lab.push(nom + ' ' + Math.round(f * 100) + ' %');
      }
      barre.setAttribute('aria-label', titre + ' : ' + lab.join(', '));
      box.append(t, barre, leg);
    }
  }

  /* ——— Réglages ——— */
  function construireReglages() {
    const tr = etat.tr, form = $('#reglages'); form.textContent = '';
    const ex = $('#exemples'); ex.textContent = '';
    for (const x of tr.exemples) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = x.nom; b.setAttribute('aria-pressed', etat.exemple === x.nom);
      b.addEventListener('click', () => {
        Object.assign(etat.p, x.valeurs); etat.exemple = x.nom;
        construireReglages(); calculerApres(0, true);
      });
      ex.append(b);
    }
    for (const r of tr.reglages) {
      const d = document.createElement('div'); d.className = 'reglage'; d.dataset.id = r.id;
      if (r.si) d.hidden = !etat.p[r.si];
      const id = 'r-' + r.id;
      if (r.choix) {
        const nom = document.createElement('span'); nom.className = 'nom'; nom.id = id + '-nom'; nom.textContent = r.nom; d.append(nom);
        const g = document.createElement('div'); g.className = 'choixs'; g.setAttribute('role', 'group'); g.setAttribute('aria-labelledby', id + '-nom');
        for (const [val, lib] of r.choix) {
          const b = document.createElement('button'); b.type = 'button'; b.textContent = lib; b.setAttribute('aria-pressed', etat.p[r.id] === val);
          b.addEventListener('click', () => { etat.p[r.id] = val; etat.exemple = null; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); alertes(d, r); marquerExemples(); calculerApres(0); });
          g.append(b);
        }
        d.append(g);
      } else if (r.bascule) {
        const l = document.createElement('label'); l.className = 'bascule';
        const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!etat.p[r.id]; c.id = id;
        c.addEventListener('change', () => { etat.p[r.id] = c.checked; etat.exemple = null; form.querySelectorAll('.reglage').forEach(x => { const rr = tr.reglages.find(q => q.id === x.dataset.id); if (rr.si) x.hidden = !etat.p[rr.si]; }); marquerExemples(); calculerApres(0); });
        l.append(c, document.createTextNode(r.nom)); d.append(l);
      } else {
        const l = document.createElement('label'); l.htmlFor = id;
        const o = document.createElement('output'); o.htmlFor = id;
        const f = r.facteur || 1;
        const aff = v => nbsp(O.nombre(v * f, (r.pas * f) % 1 ? 2 : 0).replace(/,00$/, '').replace(/(,\d)0$/, '$1') + ' ' + r.unite);
        o.textContent = aff(etat.p[r.id]);
        l.append(document.createTextNode(r.nom), o);
        const i = document.createElement('input'); i.type = 'range'; i.id = id; i.min = r.min; i.max = r.max; i.step = r.pas; i.value = etat.p[r.id];
        i.addEventListener('input', () => { etat.p[r.id] = Number(i.value); etat.exemple = null; o.textContent = aff(etat.p[r.id]); alertes(d, r); marquerExemples(); calculerApres(140); });
        d.append(l, i);
      }
      const a = document.createElement('p'); a.className = 'alerte'; a.hidden = true; d.append(a);
      alertes(d, r);
      form.append(d);
    }
  }

  function marquerExemples() { document.querySelectorAll('#exemples button').forEach(b => b.setAttribute('aria-pressed', b.textContent === etat.exemple)); }

  function alertes(d, r) {
    const a = d.querySelector('.alerte'), v = etat.p[r.id];
    const m = (r.alertes || []).find(x => (x.egal != null ? v === x.egal : (x.min == null || v >= x.min) && (x.max == null || v <= x.max)));
    a.hidden = !m; a.textContent = m ? nbsp(m.texte) : '';
  }

  let minuterie = null;
  function calculerApres(delai, debut) {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => {
      const u = etat.u;
      calculer(false);
      etat.u = debut ? 0 : u;
      rendre();
    }, delai);
  }

  /* ——— Superposition d'une propriété sur le cycle ——— */
  function construireSuperposer() {
    const s = $('#superposer'); s.textContent = '';
    const o0 = document.createElement('option'); o0.value = ''; o0.textContent = 'aucune propriété'; s.append(o0);
    for (const p of etat.tr.proprietes) { if (p.qualitatif) continue; const o = document.createElement('option'); o.value = p.cle; o.textContent = p.nom; s.append(o); }
    etat.superposer = '';
  }
  $('#superposer').addEventListener('change', ev => { etat.superposer = ev.target.value; regleCycle(); rendre(); });

  /* ——— En savoir plus ——— */
  function lienCours(c) {
    const fiche = COURS[c.cours];
    if (!fiche) return null;
    const meta = document.querySelector('meta[name="wiki-racine"]');
    const href = meta ? meta.content + encodeURI(fiche.url) : '../../' + encodeURI(fiche.fichier).replace(/'/g, '%27');
    return href + '#' + c.ancre;
  }

  const MODELES = {
    acier: 'Conduction thermique dans la barre (surface et cœur) avec des coefficients d’échange typiques de l’eau, de l’huile et de l’air. Austénitisation entre Ac1 et Ac3, croissance du grain d² − d₀² = K·t. Décomposition de l’austénite par additivité sur des courbes en C calées sur la bande Jominy de l’EN 10083-3 ; martensite selon Koistinen-Marburger. Dureté des constituants par les formules de Maynier, revenu par le paramètre de Hollomon-Jaffe. Contraintes : modèle à fibres (sections planes) avec plasticité, plasticité de transformation et relaxation par fluage. Globulisation de la cémentite sous Ac1 (loi d’Avrami), homogénéisation des ségrégations par diffusion (amplitude ∝ exp(−4π²·D·t/λ²)), carbures alliés et austénite résiduelle conditionnée des aciers à outils. Limites : composition médiane, ségrégation décrite par une seule amplitude, contraintes axiales seulement, Ac1 et Ac3 indépendants de la vitesse de chauffe.',
    cuivre: 'Restauration des défauts ponctuels (relaxation activée thermiquement), recristallisation par la loi d’Avrami avec un écrouissage critique, croissance normale du grain. Dureté par Hall-Petch et durcissement des dislocations (Taylor), conductivité par la règle de Matthiessen. Limites : pas de texture, pas de croissance anormale, oxydation et maladie de l’hydrogène traitées comme des indices.',
    aluminium: 'Dissolution de Mg₂Si vers la solubilité d’équilibre, précipitation grossière pendant une trempe lente (courbe en C), amas de solutés aidés par les lacunes de trempe, précipitation de β″ calée sur des courbes de vieillissement publiées par un producteur (écart ≈ 8 MPa), coalescence en r³ ∝ t. Durcissement par cisaillement puis contournement d’Orowan, conductivité par la règle de Matthiessen. Limites : composition médiane, structure granulaire fixe, contraintes de trempe non calculées.',
    soudure: 'Contrainte résiduelle initiale égale à la limite d’élasticité, écrêtée par la limite d’élasticité à chaud (EN 1993-1-2), puis relaxée par fluage (loi de Norton calée sur les taux de détensionnement usuels des aciers C-Mn). Revenu de la ZAT par le paramètre de Hollomon-Jaffe, effusion de l’hydrogène par diffusion à travers l’épaisseur (temps caractéristique e²/(π²·D)). Risque de fissuration à froid : indice qualitatif qui croît avec l’hydrogène, la dureté de la ZAT et la contrainte. Limites : contrainte uniforme au joint, pas de géométrie, pas de fissuration au réchauffage.'
  };

  function construireSavoir() {
    const tr = etat.tr, A = ALLIAGES[tr.alliage], v = $('#volet-savoir');
    v.textContent = '';
    const h3 = t => { const h = document.createElement('h3'); h.textContent = t; v.append(h); };
    const p = (t, cls) => { const x = document.createElement('p'); x.textContent = nbsp(t); if (cls) x.className = cls; v.append(x); return x; };
    h3('Le but'); p(tr.but);
    const im = document.createElement('div'); im.className = 'encadre image';
    im.innerHTML = '<p><b>Image à retenir</b></p><p></p>'; im.lastChild.textContent = tr.image; v.append(im);
    const vg = VIGNETTES[tr.id];
    if (vg) {
      const fig = document.createElement('figure'); fig.className = 'vignette';
      const img = document.createElement('img');
      img.src = vg.fichier; img.width = vg.largeur; img.height = vg.hauteur; img.alt = vg.alt; img.loading = 'lazy'; img.decoding = 'async';
      const cap = document.createElement('figcaption');
      cap.append(document.createTextNode(nbsp(vg.legende) + ' '), credit(vg));
      fig.append(img, cap); v.append(fig);
    }
    h3('L’alliage'); p(A.nom + ' (' + A.numero + ') : ' + A.description); p(A.compositionTexte);
    h3('Étape par étape');
    const ul = document.createElement('ul');
    for (const g of etat.traj.segments) { const li = document.createElement('li'); const b = document.createElement('b'); b.textContent = g.nom + ' : '; li.append(b, nbsp((tr.etapes[g.id] || [''])[0])); ul.append(li); }
    v.append(ul);
    h3('Pièges');
    for (const t of tr.pieges) { const d = document.createElement('div'); d.className = 'encadre piege'; d.textContent = '⚠️ ' + nbsp(t); v.append(d); }
    h3('Côté métier');
    for (const t of tr.metier) { const d = document.createElement('div'); d.className = 'encadre metier'; d.textContent = '🔥 ' + nbsp(t); v.append(d); }
    h3('Pour réviser');
    const ul2 = document.createElement('ul'); ul2.className = 'reviser';
    for (const c of tr.reviser) {
      const href = lienCours(c); if (!href) continue;
      const li = document.createElement('li'); const a = document.createElement('a'); a.href = href; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = c.titre; li.append(a, document.createTextNode(' — ' + COURS[c.cours].titre)); ul2.append(li);
    }
    v.append(ul2);
    h3('Sigles et symboles');
    const dl = document.createElement('dl'); dl.className = 'sigles';
    for (const k of SIGLES[tr.id] || []) { const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = nbsp(GLOSSAIRE[k]); dl.append(dt, dd); }
    v.append(dl);
    h3('Le modèle'); p(MODELES[A.famille], 'modele');
    h3('Code couleur');
    const cc = document.createElement('p'); cc.className = 'code-couleur';
    for (const [c, t] of [['--frc', 'cycle thermique, contraintes (actions)'], ['--mat', 'réglages et repères'], ['--eps', 'propriétés (effets)'], ['--weld', 'encadrés métier']]) { const s = document.createElement('span'); s.style.setProperty('--c', `var(${c})`); s.textContent = t; cc.append(s); }
    v.append(cc);
    h3('Références');
    const ul3 = document.createElement('ul'); ul3.className = 'references';
    for (const k of A.sources) { const li = document.createElement('li'); li.textContent = SOURCES[k]; ul3.append(li); }
    v.append(ul3);
  }

  /* ——— Onglets ——— */
  const onglets = [...document.querySelectorAll('.onglets [role="tab"]')];
  function ouvrirOnglet(b, focus) {
    onglets.forEach(x => { const actif = x === b; x.setAttribute('aria-selected', actif); x.tabIndex = actif ? 0 : -1; document.getElementById(x.getAttribute('aria-controls')).hidden = !actif; });
    if (focus) b.focus();
  }
  onglets.forEach((b, i) => {
    b.addEventListener('click', () => ouvrirOnglet(b));
    b.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowRight') { ev.preventDefault(); ouvrirOnglet(onglets[(i + 1) % onglets.length], true); }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); ouvrirOnglet(onglets[(i + onglets.length - 1) % onglets.length], true); }
    });
  });

  /* ——— Lecture ——— */
  let horloge = null, tPrec = 0;
  function lancer() {
    compris();
    if (etat.u >= 0.999) etat.u = 0;
    etat.lecture = true; $('#lecture').setAttribute('aria-pressed', 'true'); $('#lecture-libelle').textContent = 'Pause';
    tPrec = performance.now();
    const pas = now => {
      if (!etat.lecture) return;
      const dt = (now - tPrec) / 1000; tPrec = now;
      etat.u = Math.min(1, etat.u + dt / 30 * etat.vitesse);
      rendre();
      if (etat.u >= 1) { arreter(); return; }
      horloge = requestAnimationFrame(pas);
    };
    horloge = requestAnimationFrame(pas);
  }
  function arreter() {
    etat.lecture = false; cancelAnimationFrame(horloge);
    $('#lecture').setAttribute('aria-pressed', 'false'); $('#lecture-libelle').textContent = 'Lecture';
  }
  $('#lecture').addEventListener('click', () => (etat.lecture ? arreter() : lancer()));
  $('#vitesse').addEventListener('change', ev => { etat.vitesse = Number(ev.target.value); });
  $('#debut').addEventListener('click', () => { arreter(); allerA(0); });
  $('#fin').addEventListener('click', () => { arreter(); allerA(1); });
  function sautEtape(sens) {
    arreter();
    const s = etat.traj.segments;
    if (sens > 0) { const g = s.find(x => x.u0 > etat.u + 1e-6); allerA(g ? g.u0 + 1e-6 : 1); }
    else { const g = [...s].reverse().find(x => x.u0 < etat.u - 1e-3); allerA(g ? g.u0 + 1e-6 : 0); }
  }
  $('#etape-prec').addEventListener('click', () => sautEtape(-1));
  $('#etape-suiv').addEventListener('click', () => sautEtape(1));
  $('#cycle').addEventListener('keydown', ev => {
    const pas = ev.shiftKey ? 0.05 : 0.005;
    const k = { ArrowRight: pas, ArrowUp: pas, ArrowLeft: -pas, ArrowDown: -pas }[ev.key];
    if (k) { ev.preventDefault(); arreter(); allerA(etat.u + k); }
    else if (ev.key === 'PageDown') { ev.preventDefault(); sautEtape(1); }
    else if (ev.key === 'PageUp') { ev.preventDefault(); sautEtape(-1); }
    else if (ev.key === 'Home') { ev.preventDefault(); arreter(); allerA(0); }
    else if (ev.key === 'End') { ev.preventDefault(); arreter(); allerA(1); }
  });

  /* ——— Zoom ——— */
  $('#zoom-plus').addEventListener('click', () => viser(Math.round(etat.zCible) + 1));
  $('#zoom-moins').addEventListener('click', () => viser(Math.round(etat.zCible) - 1));
  toile.addEventListener('click', ev => { viser(Math.round(etat.zCible) + (ev.shiftKey ? -1 : 1)); });
  let molette = 0;
  toile.addEventListener('wheel', ev => {
    if (!paysage.matches) return;
    ev.preventDefault();
    const now = performance.now();
    if (now - molette < 350) return;
    molette = now;
    viser(Math.round(etat.zCible) + (ev.deltaY > 0 ? -1 : 1));
  }, { passive: false });
  document.addEventListener('keydown', ev => {
    const cible = ev.target;
    if (cible.closest && cible.closest('input, select, textarea, dialog[open]')) return;
    if (ev.key === ' ' && !cible.closest('button')) { ev.preventDefault(); etat.lecture ? arreter() : lancer(); }
    if (ev.key === '+' || ev.key === '=') viser(Math.round(etat.zCible) + 1);
    if (ev.key === '-' || ev.key === '_') viser(Math.round(etat.zCible) - 1);
  });

  /* ——— Niveaux, thème ——— */
  function majNiveau() {
    document.querySelectorAll('.niveaux button').forEach(b => b.setAttribute('aria-checked', Number(b.dataset.niveau) === etat.niveau));
    radios(document.querySelector('.niveaux'));
    etat.dernierEvt = null;
    if (etat.traj) rendre();
  }
  document.querySelectorAll('.niveaux button').forEach(b => b.addEventListener('click', () => { etat.niveau = Number(b.dataset.niveau); stockage.ecrire('niveau', etat.niveau); majNiveau(); }));
  $('#bouton-theme').addEventListener('click', () => {
    const sombre = html.dataset.theme ? html.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.dataset.theme = sombre ? 'light' : 'dark';
    stockage.ecrire('theme', html.dataset.theme);
    couleurs(); regleCycle(); rendre();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { couleurs(); rendre(); });

  /* ——— Banque et aide ——— */
  const banque = $('#banque'), aide = $('#aide');
  let filtre = '';
  function construireBanque() {
    const familles = [...new Set(TRAITEMENTS.map(t => t.famille))];
    const f = $('#filtres'); f.textContent = '';
    for (const nom of ['', ...familles]) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = nom || 'Toutes'; b.setAttribute('aria-pressed', filtre === nom);
      b.addEventListener('click', () => { filtre = nom; construireBanque(); });
      f.append(b);
    }
    const c = $('#cartes'); c.textContent = '';
    for (const t of TRAITEMENTS.filter(x => !filtre || x.famille === filtre)) {
      const art = document.createElement('article'); art.className = 'carte'; art.dataset.id = t.id;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'carte-choix';
      b.innerHTML = '<span class="carte-image"></span><span class="carte-texte"><strong></strong><small></small><span class="meca"></span></span>';
      const vg = VIGNETTES[t.id];
      if (vg) {
        const img = document.createElement('img');
        img.src = vg.fichier; img.width = vg.largeur; img.height = vg.hauteur; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
        img.style.objectPosition = vg.cadrage;
        b.querySelector('.carte-image').append(img);
      } else b.querySelector('.carte-image').remove();
      b.querySelector('strong').textContent = t.titre;
      b.querySelector('small').textContent = ALLIAGES[t.alliage].nom + ' · ' + t.sousTitre;
      b.querySelector('.meca').textContent = t.mecanismes.join(' · ');
      b.addEventListener('click', () => { banque.close(); arreter(); charger(t.id); });
      art.append(b);
      if (vg) { const p = document.createElement('p'); p.className = 'carte-credit'; p.append(credit(vg, true)); art.append(p); }
      c.append(art);
    }
    marquerBanque();
    const l = $('#liste-a-venir'); l.textContent = '';
    for (const x of A_VENIR.filter(x => !filtre || x.famille === filtre)) { const li = document.createElement('li'); li.textContent = x.titre + ' — ' + x.alliage; l.append(li); }
    $('#nb-a-venir').textContent = '(' + A_VENIR.length + ')';
  }
  function marquerBanque() {
    document.querySelectorAll('#cartes .carte').forEach(a => {
      const actuel = !!etat.tr && a.dataset.id === etat.tr.id;
      a.classList.toggle('actuelle', actuel);
      a.querySelector('.carte-choix').setAttribute('aria-current', actuel);
    });
  }

  /** Crédit d'une photographie : auteur (lien vers la notice), licence (lien) et modifications. */
  function credit(vg, court) {
    const sp = document.createElement('span'); sp.className = 'credit';
    const lien = (txt, href) => { const a = document.createElement('a'); a.href = href; a.textContent = txt; a.target = '_blank'; a.rel = 'noopener'; return a; };
    sp.append(document.createTextNode('Photo : '), lien(vg.auteur, vg.source), document.createTextNode(', '));
    sp.append(vg.licenceUrl ? lien(vg.licence, vg.licenceUrl) : document.createTextNode(vg.licence));
    sp.append(document.createTextNode(court ? ', Wikimedia Commons' : ', via Wikimedia Commons.'));
    return sp;
  }
  let retourFocus = null;
  function ouvrir(d, depuis) { retourFocus = depuis; if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); }
  for (const d of [banque, aide]) {
    d.addEventListener('close', () => { if (retourFocus) retourFocus.focus(); });
    d.querySelector('[data-fermer]').addEventListener('click', () => d.close());
    d.addEventListener('click', ev => { if (ev.target === d) d.close(); });
  }
  $('#choisir').addEventListener('click', ev => { construireBanque(); ouvrir(banque, ev.currentTarget); });
  $('#bouton-aide').addEventListener('click', ev => ouvrir(aide, ev.currentTarget));

  /* ——— Démarrage ——— */
  new ResizeObserver(() => { dimensionner(); dessinerToile(); }).observe($('#toile-cadre'));
  let redim = null;
  new ResizeObserver(() => { clearTimeout(redim); redim = setTimeout(() => { if (etat.traj) { cycle.dessiner(); rendre(); } }, 60); }).observe($('#cycle'));
  window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (TRAITEMENTS.some(t => t.id === id) && id !== etat.tr.id) { arreter(); charger(id); } });

  couleurs();
  dimensionner();
  majNiveau();
  $('#astuce').hidden = stockage.lire('astuce') === 'vue';
  const depart = location.hash.slice(1) || stockage.lire('dernier');
  charger(TRAITEMENTS.some(t => t.id === depart) ? depart : TRAITEMENTS[0].id);
  window.labo = {
    pret: true, etat,
    aller: u => { arreter(); allerA(u); },
    echelle: i => { etat.z = etat.zCible = i; majEchelles(); dessinerToile(); },
    charger: id => charger(id),
    regler: (valeurs) => { Object.assign(etat.p, valeurs); construireReglages(); calculer(false); }
  };
})();
