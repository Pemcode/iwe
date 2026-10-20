/* Modèle de la carte : familles, voisins, recherche et liens vers les cours. Aucune dépendance au DOM. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Graphe = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Couleur = famille IWE (cinq emplacements validés de la palette) ; la matière exacte est portée par le texte.
  const FAMILLES = [
    { id: 'materiaux', nom: 'Matériaux', slot: 1, matieres: ['metallurgie', 'inox', 'fontes', 'crmo'] },
    { id: 'procedes', nom: 'Procédés', slot: 2, matieres: ['electrode-enrobee', 'arc-submerge', 'brasage'] },
    { id: 'calcul', nom: 'Calcul des structures', slot: 3, matieres: ['rdm'] },
    { id: 'essais', nom: 'Essais et contrôle', slot: 4, matieres: ['essais'] },
    { id: 'comportement', nom: 'Comportement en service', slot: 5, matieres: ['fatigue', 'rupture', 'fluage'] }
  ];
  const AUTRES = { id: 'autres', nom: 'Autres matières', slot: 6, matieres: [] };
  const TYPES = { n: 'Notion', s: 'Sigle', o: 'Norme', d: 'Désignation' };
  const GREC = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', θ: 'theta', λ: 'lambda', μ: 'mu', µ: 'mu',
    ν: 'nu', π: 'pi', ρ: 'rho', σ: 'sigma', τ: 'tau', φ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega' };
  const SITE = 'https://pemcode.github.io/iwe/';

  function normaliser(texte) {
    return String(texte || '')
      .replace(/[œŒ]/g, 'oe').replace(/[æÆ]/g, 'ae')
      .toLowerCase()
      .replace(/[αβγδεθλμµνπρστφχψω]/g, c => GREC[c])
      .normalize('NFD').replace(/\p{M}/gu, '')
      .replace(/[’'`´]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function familleDe(matiereId) {
    return FAMILLES.find(f => f.matieres.includes(matiereId)) || AUTRES;
  }

  function construire(data) {
    const matieres = data.matieres.map((m, i) => ({ ...m, index: i, famille: familleDe(m.id) }));
    const notions = data.notions.map((n, i) => {
      const dominante = n.m.length ? matieres[n.m[0][0]] : null;
      const famille = dominante ? dominante.famille : AUTRES;
      const formes = [n.l, ...n.a].map(normaliser).filter(Boolean);
      return { ...n, i, dominante, famille, formes, mots: formes.map(f => f.split(' ')), priorite: n.p * (n.k === 'o' || n.k === 'd' ? 0.45 : 1) };
    });
    const voisins = notions.map(() => []);
    data.liens.forEach(([a, b, s, nb, def, faible, preuves]) => {
      voisins[a].push({ j: b, s, n: nb, def: Boolean(def & 1) || Boolean(def & 2), faible: Boolean(faible), preuves });
      voisins[b].push({ j: a, s, n: nb, def: Boolean(def & 1) || Boolean(def & 2), faible: Boolean(faible), preuves });
    });
    voisins.forEach(liste => liste.sort((x, y) => y.s - x.s || notions[x.j].l.localeCompare(notions[y.j].l, 'fr')));
    let min = [Infinity, Infinity], max = [-Infinity, -Infinity];
    notions.forEach(n => { for (let d = 0; d < 2; d++) { min[d] = Math.min(min[d], n.x[d]); max[d] = Math.max(max[d], n.x[d]); } });
    const continents = data.continents.map((c, k) => {
      const membres = notions.filter(n => n.c === k);
      const xs = membres.map(n => n.x[0]).sort((a, b) => a - b), ys = membres.map(n => n.x[1]).sort((a, b) => a - b);
      const quantile = (t, q) => t.length ? t[Math.min(t.length - 1, Math.floor(q * t.length))] : 0;
      return { ...c, k, famille: c.m != null ? matieres[c.m].famille : AUTRES, membres: membres.map(n => n.i),
        centre: [quantile(xs, 0.5), quantile(ys, 0.5)],
        boite: [quantile(xs, 0.04), quantile(ys, 0.04), quantile(xs, 0.96), quantile(ys, 0.96)],
        formes: [normaliser(c.nom)] };
    });
    const ordre = notions.map(n => n.i).sort((a, b) => notions[b].priorite - notions[a].priorite);
    const pmax = notions.reduce((m, n) => Math.max(m, n.priorite), 1e-9);
    const parMatiere = matieres.map(() => 0);
    notions.forEach(n => { if (n.dominante) parMatiere[n.dominante.index] += 1; });
    return { data, matieres, notions, voisins, continents, ordre, pmax, parMatiere, boite: [min[0], min[1], max[0], max[1]],
      cours: data.cours, familles: [...FAMILLES, AUTRES].filter(f => matieres.some(m => m.famille === f)) };
  }

  function distance(a, b, max) {
    // Levenshtein borné : au-delà de `max`, inutile de continuer.
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      let best = i;
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        best = Math.min(best, cur[j]);
      }
      if (best > max) return max + 1;
      prev = cur;
    }
    return prev[b.length];
  }

  function noter(formes, mots, q) {
    let note = 0;
    formes.forEach((f, idx) => {
      const principal = idx === 0 ? 1 : 0.92;
      if (f === q) note = Math.max(note, 100 * principal);
      else if (f.startsWith(q)) note = Math.max(note, (80 - Math.min(10, f.length - q.length) * 0.5) * principal);
      else if (mots[idx].some(m => m.startsWith(q))) note = Math.max(note, 62 * principal);
      else if (f.includes(q)) note = Math.max(note, 45 * principal);
    });
    return note;
  }

  function chercher(modele, requete, limite = 8) {
    const q = normaliser(requete);
    if (!q) return [];
    const resultats = [];
    modele.notions.forEach(n => {
      const note = noter(n.formes, n.mots, q);
      if (note) resultats.push({ type: 'notion', i: n.i, note: note + Math.log1p(n.p) * 2, libelle: n.l });
    });
    modele.continents.forEach(c => {
      if (c.formes[0].includes(q)) resultats.push({ type: 'continent', k: c.k, note: 40, libelle: c.nom });
    });
    if (resultats.length < 3 && q.length >= 4) {
      // Faute de frappe : « ferite » retrouve « ferrite ».
      const tolerance = q.length >= 7 ? 2 : 1;
      modele.notions.forEach(n => {
        if (resultats.some(r => r.i === n.i)) return;
        const d = Math.min(...n.mots.flat().map(m => distance(q, m.slice(0, q.length + 1), tolerance)),
          ...n.formes.map(f => distance(q, f, tolerance)));
        if (d <= tolerance) resultats.push({ type: 'notion', i: n.i, note: 30 - d * 8 + Math.log1p(n.p), libelle: n.l, approche: true });
      });
    }
    return resultats.sort((a, b) => b.note - a.note || a.libelle.localeCompare(b.libelle, 'fr')).slice(0, limite);
  }

  function cheminEncode(chemin) {
    return chemin.split('/').map(encodeURIComponent).join('/');
  }

  /* Lien vers une section de cours selon l'endroit où la carte est ouverte :
     depot = dossier applications/ du dépôt (sources locales) ; wiki = publiée dans le site ; sinon le site en ligne. */
  function lienCours(cours, ancre, env) {
    const suffixe = ancre ? '#' + encodeURIComponent(ancre) : '';
    if (env.mode === 'depot' && cours.fichier) return env.racine + cheminEncode(cours.fichier) + suffixe;
    if (!cours.url) return null;
    if (env.mode === 'wiki') return env.racine + cheminEncode(cours.url) + suffixe;
    return SITE + cheminEncode(cours.url) + suffixe;
  }

  function environnement(location, meta) {
    if (/\/applications\/carte-notions\//.test(location.pathname)) return { mode: 'depot', racine: '../../' };
    if (meta.application) return { mode: 'wiki', racine: meta.racine || '../' };
    return { mode: 'en-ligne', racine: SITE };
  }

  function visible(n, filtres) {
    if (n.dominante && filtres.matieresMasquees.has(n.dominante.id)) return false;
    if (filtres.typesMasques.has(n.k)) return false;
    if (filtres.carrefours && !n.h) return false;
    return true;
  }

  return { FAMILLES, AUTRES, TYPES, normaliser, familleDe, construire, chercher, lienCours, environnement, visible, distance };
});
