/* Carte des notions : assemblage de la page (état, caméra, fiche, recherche, légende, thème, adresse). */
(function () {
  'use strict';
  const G = window.Graphe, C = window.Camera, R = window.Rendu2D;
  const $ = s => document.querySelector(s);
  const html = document.documentElement;
  const reduit = window.matchMedia('(prefers-reduced-motion: reduce)');
  // Toutes les pages du site partagent la même origine : clés préfixées, et stockage peut-être indisponible.
  const stockage = {
    lire(cle) { try { return window.localStorage.getItem('carte-notions-' + cle); } catch (e) { return null; } },
    ecrire(cle, valeur) { try { window.localStorage.setItem('carte-notions-' + cle, valeur); } catch (e) { /* navigation privée */ } }
  };

  const data = window.CARTE_NOTIONS;
  if (!data || !G || !C || !R) {
    $('#scene').insertAdjacentHTML('beforeend', '<p class="sans-js">Données de la carte absentes : lance <code>generer_carte.py</code>.</p>');
    return;
  }

  const modele = G.construire(data);
  const meta = document.querySelector('meta[name="wiki-racine"], meta[name="carte-racine"]');
  const env = G.environnement(window.location, { application: Boolean(document.querySelector('meta[name="wiki-application"]')), racine: meta && meta.content });
  const toile = $('#toile');
  const fiche = $('#fiche');
  const rendu = new R.Rendu2D(toile, modele);
  const mini = new R.MiniCarte($('#minicarte'), modele);
  const etat = {
    cam: { x: 0, y: 0, k: 1 }, kAjuste: 1, selection: null, survol: null, apercu: null, temps: 0, depuis: 0, enVol: false,
    filtres: { matieresMasquees: new Set(), typesMasques: new Set(), carrefours: false }
  };
  let vol = null, demande = false, legendeOuverte = window.innerWidth >= 1100 && window.innerHeight >= 700;

  /* ——— Caméra ——— */
  function zoneVisible() {
    const W = rendu.W, H = rendu.H;
    const origine = toile.getBoundingClientRect();
    const haut = $('.barre').getBoundingClientRect().bottom - origine.top;
    const zone = { x: 0, y: haut, w: W, h: H - haut };
    const legende = $('#legende');
    if (legende.getClientRects().length) {
      // Légende ouverte sur le côté (grand écran) : la carte se cadre à sa droite.
      const l = legende.getBoundingClientRect();
      if (l.width < W * 0.45) { zone.x = l.right - origine.left + 8; zone.w = W - zone.x; }
    }
    if (!fiche.hidden) {
      const f = fiche.getBoundingClientRect();
      if (f.width >= W * 0.9) zone.h = Math.max(140, f.top - origine.top - haut);
      else zone.w = Math.max(160, f.left - origine.left - zone.x);
    }
    return zone;
  }

  function bornes() { return [etat.kAjuste * 0.45, etat.kAjuste * 16]; }

  function vueEnsemble() {
    const [kmin, kmax] = bornes();
    return C.cadrer(modele.boite, zoneVisible(), rendu.W, rendu.H, 28, kmin, kmax);
  }

  function demander() {
    if (!demande) { demande = true; window.requestAnimationFrame(image); }
  }

  // Panneaux posés sur la carte : aucune étiquette ne doit se cacher dessous.
  const panneaux = ['#marque', '.recherche', '.outils', '#legende', '#fiche', '.navigation-carte', '#accueil'].map(s => $(s));
  function obstacles() {
    const origine = toile.getBoundingClientRect();
    return panneaux.filter(p => p && p.getClientRects().length).map(p => {
      const r = p.getBoundingClientRect();
      return [r.left - origine.left - 4, r.top - origine.top - 4, r.right - origine.left + 4, r.bottom - origine.top + 4];
    });
  }

  function image(t) {
    demande = false;
    etat.temps = t - etat.depuis;
    etat.obstacles = obstacles();
    if (vol) {
      const p = (t - vol.debut) / vol.duree;
      etat.cam = C.voler(vol.de, vol.vers, p, rendu.W, rendu.H);
      if (p >= 1) { vol = null; etat.enVol = false; }
    }
    rendu.dessiner(etat);
    mini.dessiner(etat.cam, rendu.W, rendu.H, rendu);
    // La notion choisie pulse quelques secondes, puis la carte se repose (rendu à la demande).
    if (vol || (etat.selection != null && etat.temps < 4800 && !reduit.matches)) demander();
  }

  function allerA(cam, duree = 650) {
    if (reduit.matches || duree <= 0) {
      vol = null; etat.enVol = false; etat.cam = cam;
    } else {
      vol = { de: { ...etat.cam }, vers: cam, debut: performance.now(), duree };
      etat.enVol = true;
    }
    demander();
  }

  function interrompreVol() {
    if (vol) { vol = null; etat.enVol = false; }
  }

  /* ——— Sélection et fiche ——— */
  function selectionner(i, options = {}) {
    if (i == null) return fermer();
    const n = modele.notions[i];
    etat.selection = i;
    etat.apercu = null;
    etat.depuis = performance.now();
    remplirFiche(n);
    fiche.hidden = false;
    html.classList.add('fiche-ouverte');
    remplacerAdresse('#notion=' + encodeURIComponent(n.id));
    masquerAccueil();
    $('#annonce').textContent = `${n.l} : ${modele.voisins[i].length} notions liées.`;
    // Cadrage : la notion au centre de la partie libre de l'écran, assez près pour que ses voisines proches
    // s'écartent ; les voisines lointaines (au-delà des trois quarts) ne dictent pas le zoom.
    const zone = zoneVisible();
    const ecarts = modele.voisins[i].slice(0, 12).map(v => modele.notions[v.j].x)
      .map(p => [Math.abs(p[0] - n.x[0]), Math.abs(p[1] - n.x[1])]).sort((a, b) => Math.max(...a) - Math.max(...b));
    const proches = ecarts.slice(0, Math.max(1, Math.ceil(ecarts.length * 0.75)));
    const ex = Math.max(1e-3, ...proches.map(e => e[0])), ey = Math.max(1e-3, ...proches.map(e => e[1]));
    const k = C.borner(Math.min((zone.w / 2 - 70) / ex, (zone.h / 2 - 50) / ey), etat.kAjuste * 2, etat.kAjuste * 9);
    const cam = { k, x: n.x[0] - (zone.x + zone.w / 2 - rendu.W / 2) / k, y: n.x[1] - (zone.y + zone.h / 2 - rendu.H / 2) / k };
    allerA(cam, options.duree ?? 700);
    if (options.focus) $('#fiche-titre').focus({ preventScroll: true });
  }

  function fermer() {
    if (etat.selection == null && fiche.hidden) return;
    etat.selection = null;
    fiche.hidden = true;
    html.classList.remove('fiche-ouverte');
    remplacerAdresse(window.location.pathname + window.location.search);
    demander();
  }

  function remplacerAdresse(adresse) {
    try { window.history.replaceState(null, '', adresse); } catch (e) { /* file:// sur certains navigateurs */ }
  }

  function el(balise, attributs = {}, ...enfants) {
    const noeud = document.createElement(balise);
    for (const [cle, valeur] of Object.entries(attributs)) {
      if (valeur == null || valeur === false) continue;
      if (cle === 'classe') noeud.className = valeur;
      else if (cle === 'couleur') noeud.style.setProperty('--c', valeur);
      else if (cle === 'style') noeud.style.cssText += ';' + valeur;
      else if (cle.startsWith('on')) noeud.addEventListener(cle.slice(2), valeur);
      else noeud.setAttribute(cle, valeur === true ? '' : valeur);
    }
    for (const enfant of enfants.flat()) if (enfant != null) noeud.append(enfant);
    return noeud;
  }

  const varFamille = famille => `var(--fam-${famille ? famille.slot : 6})`;
  const pastille = (famille, carrefour) => el('span', { classe: 'pastille' + (carrefour ? ' carrefour' : ''), couleur: varFamille(famille), 'aria-hidden': 'true' });
  const fleche = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = '<path d="M7 17 17 7M9 7h8v8"/>';
    return svg;
  };
  const pluriel = (n, mot) => `${n.toLocaleString('fr-FR')} ${mot}${n > 1 ? 's' : ''}`;

  function plusOuMoins(liste, visibles, libelle) {
    // Les premiers éléments d'abord ; le reste derrière un bouton, pour garder la fiche lisible.
    if (liste.children.length <= visibles) return null;
    [...liste.children].slice(visibles).forEach(e => { e.hidden = true; });
    const bouton = el('button', { type: 'button', classe: 'lien-discret plus' }, libelle(liste.children.length - visibles));
    bouton.addEventListener('click', () => { [...liste.children].forEach(e => { e.hidden = false; }); bouton.remove(); });
    return bouton;
  }

  function remplirFiche(n) {
    $('#fiche-type').replaceChildren(pastille(n.famille, n.h), `${G.TYPES[n.k]} · ${n.famille.nom}`);
    $('#fiche-titre').textContent = n.l;
    $('#fiche-titre').setAttribute('tabindex', '-1');
    const alias = n.a.filter(a => a && a !== n.l);
    $('#fiche-alias').textContent = alias.length ? 'Aussi : ' + alias.join(' · ') : '';
    const corps = $('#fiche-corps');
    corps.replaceChildren();

    if (n.m.length) {
      const total = n.m.reduce((s, [, c]) => s + c, 0) || 1;
      const section = el('section', {},
        el('h3', {}, 'Présente dans ', el('span', { classe: 'compte' }, `· ${pluriel(n.f, 'passage')}`)),
        el('div', { classe: 'repartition', 'aria-hidden': 'true' },
          n.m.map(([m, c]) => { const s = el('span', { couleur: varFamille(modele.matieres[m].famille), title: modele.matieres[m].titre }); s.style.flexGrow = String(Math.max(c, total * 0.02)); return s; })),
        el('ul', { classe: 'matieres-fiche' }, n.m.map(([m, c]) => el('li', {}, pastille(modele.matieres[m].famille), el('span', {}, modele.matieres[m].titre), el('span', { classe: 'nb' }, String(c))))));
      if (n.h) section.append(el('p', { classe: 'note-carrefour' }, `Carrefour : cette notion relie ${n.m.filter(([, c]) => c >= 2).length} matières. Un bon point d'appui pour faire des ponts entre les cours.`));
      corps.append(section);
    }

    const definitions = el('div', {});
    n.d.forEach(([texte, ci]) => {
      const cours = modele.cours[ci];
      definitions.append(el('blockquote', { classe: 'definition', couleur: varFamille(modele.matieres[cours.m].famille) },
        el('p', {}, texte), el('cite', {}, '— ' + cours.titre)));
    });
    const sectionDef = el('section', {}, el('h3', {}, n.d.length > 1 ? 'Définitions' : 'Définition'));
    if (n.d.length) {
      sectionDef.append(definitions);
      const plus = plusOuMoins(definitions, 2, k => `Voir ${k === 1 ? "l'autre définition" : `les ${k} autres définitions`}`);
      if (plus) sectionDef.append(plus);
    } else {
      sectionDef.append(el('p', { classe: 'sans-definition' }, 'Pas de définition dans les glossaires : ouvre une des sections ci-dessous.'));
    }
    corps.append(sectionDef);

    const voisins = modele.voisins[n.i];
    if (voisins.length) {
      const max = voisins[0].s || 1;
      const liste = el('ol', { classe: 'voisins' });
      voisins.forEach(v => {
        const autre = modele.notions[v.j];
        const raisons = [];
        if (v.def) raisons.push('cité dans une définition');
        if (v.n) raisons.push(pluriel(v.n, 'passage') + ' en commun');
        if (v.faible) raisons.push('mêmes sections');
        if (!raisons.length) raisons.push('mêmes sections');
        const aller = el('button', { type: 'button', classe: 'voisin-aller', 'data-i': v.j },
          pastille(autre.famille, autre.h), el('span', { classe: 'nom' }, autre.l), el('span', { classe: 'raison' }, raisons.join(' · ')),
          el('span', { classe: 'force', 'aria-hidden': 'true' }, el('i', { couleur: varFamille(autre.famille), style: `width:${Math.max(6, Math.round(100 * v.s / max))}%` })));
        aller.addEventListener('click', e => selectionner(v.j, { focus: e.detail === 0 }));
        aller.addEventListener('mouseenter', () => { etat.apercu = v.j; demander(); });
        aller.addEventListener('mouseleave', () => { etat.apercu = null; demander(); });
        const item = el('li', { classe: 'voisin' }, aller);
        const preuve = v.preuves && v.preuves[0];
        if (preuve) {
          const cours = modele.cours[preuve[0]];
          const section = cours.s[preuve[1]];
          const href = G.lienCours(cours, section[0], env);
          if (href) {
            const titre = `Lire « ${n.l} » et « ${autre.l} » ensemble : ${cours.titre}, ${section[1]}`;
            item.append(el('a', { classe: 'voisin-lire', href, target: '_blank', rel: 'noopener', title: titre, 'aria-label': titre }, fleche()));
          }
        }
        liste.append(item);
      });
      const section = el('section', {}, el('h3', {}, 'Souvent citée avec ', el('span', { classe: 'compte' }, `· ${voisins.length}`)), liste);
      const plus = plusOuMoins(liste, 10, k => `Voir ${k === 1 ? "l'autre notion liée" : `les ${k} autres notions liées`}`);
      if (plus) section.append(plus);
      corps.append(section);
    }

    if (n.r.length) {
      const liste = el('ul', { classe: 'reviser' });
      n.r.forEach(([ci, si]) => {
        const cours = modele.cours[ci];
        const [ancre, titre] = cours.s[si];
        const href = G.lienCours(cours, ancre, env);
        liste.append(el('li', {}, href
          ? el('a', { href, target: '_blank', rel: 'noopener' }, el('span', { classe: 'section' }, titre), el('small', {}, cours.titre), fleche())
          : el('span', { classe: 'hors-ligne' }, `${titre} — ${cours.titre} (pas encore en ligne)`)));
      });
      corps.append(el('section', {}, el('h3', {}, 'Où réviser'), liste));
    }

    corps.append(el('p', { classe: 'fiche-note' },
      'Un lien signifie « souvent évoquées ensemble dans les cours », ou « l’une figure dans la définition de l’autre » : ni « est un », ni « cause ».'));
    corps.scrollTop = 0;
  }

  /* ——— Recherche ——— */
  const champ = $('#recherche');
  const suggestions = $('#suggestions');
  let resultats = [], actif = -1;

  function afficherSuggestions() {
    resultats = G.chercher(modele, champ.value, 8);
    actif = resultats.length ? 0 : -1;
    suggestions.replaceChildren();
    if (!champ.value.trim()) return fermerSuggestions();
    if (!resultats.length) {
      suggestions.append(el('li', { classe: 'vide', role: 'option', 'aria-disabled': 'true' }, 'Aucune notion trouvée. Essaie un synonyme ou un sigle.'));
    }
    resultats.forEach((r, k) => {
      let contenu;
      if (r.type === 'notion') {
        const n = modele.notions[r.i];
        const contexte = [n.dominante ? n.dominante.titre : n.famille.nom, r.approche ? 'orthographe proche' : null].filter(Boolean).join(' · ');
        contenu = [pastille(n.famille, n.h), el('span', { classe: 'nom' }, n.l, el('small', {}, contexte)), el('span', { classe: 'type' }, G.TYPES[n.k])];
      } else {
        const c = modele.continents[r.k];
        contenu = [el('span', { classe: 'pastille ile', couleur: varFamille(c.famille), 'aria-hidden': 'true' }), el('span', { classe: 'nom' }, c.nom, el('small', {}, pluriel(c.taille, 'notion'))), el('span', { classe: 'type' }, 'Île')];
      }
      const li = el('li', { role: 'option', id: 'suggestion-' + k, 'aria-selected': k === actif ? 'true' : 'false' }, contenu);
      li.addEventListener('mousedown', e => e.preventDefault());
      li.addEventListener('click', () => choisir(k));
      suggestions.append(li);
    });
    suggestions.hidden = false;
    champ.setAttribute('aria-expanded', 'true');
    marquerActif();
  }

  function marquerActif() {
    [...suggestions.querySelectorAll('[id^="suggestion-"]')].forEach((li, k) => li.setAttribute('aria-selected', k === actif ? 'true' : 'false'));
    if (actif >= 0) {
      champ.setAttribute('aria-activedescendant', 'suggestion-' + actif);
      const li = $('#suggestion-' + actif);
      if (li) li.scrollIntoView({ block: 'nearest' });
    } else champ.removeAttribute('aria-activedescendant');
    const r = resultats[actif];
    etat.apercu = r && r.type === 'notion' ? r.i : null;
    demander();
  }

  function fermerSuggestions() {
    suggestions.hidden = true;
    champ.setAttribute('aria-expanded', 'false');
    champ.removeAttribute('aria-activedescendant');
    if (etat.apercu != null) { etat.apercu = null; demander(); }
  }

  function choisir(k) {
    const r = resultats[k];
    if (!r) return;
    champ.value = '';
    fermerSuggestions();
    if (r.type === 'notion') selectionner(r.i, { focus: true });
    else {
      fermer();
      const [kmin, kmax] = bornes();
      allerA(C.cadrer(modele.continents[r.k].boite, zoneVisible(), rendu.W, rendu.H, 40, kmin, kmax));
      toile.focus({ preventScroll: true });
    }
  }

  champ.addEventListener('input', afficherSuggestions);
  champ.addEventListener('focus', () => { if (champ.value.trim()) afficherSuggestions(); });
  champ.addEventListener('blur', () => window.setTimeout(fermerSuggestions, 120));
  champ.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!resultats.length) return;
      e.preventDefault();
      actif = (actif + (e.key === 'ArrowDown' ? 1 : -1) + resultats.length) % resultats.length;
      marquerActif();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choisir(actif >= 0 ? actif : 0);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      if (!suggestions.hidden) fermerSuggestions(); else { champ.value = ''; champ.blur(); toile.focus({ preventScroll: true }); }
    }
  });

  /* ——— Légende et filtres ——— */
  function construireLegende() {
    const conteneur = $('#familles');
    conteneur.replaceChildren();
    modele.familles.forEach(famille => {
      const matieres = modele.matieres.filter(m => m.famille === famille);
      const boutons = matieres.map(m => {
        const bouton = el('button', { type: 'button', classe: 'puce', 'data-matiere': m.id, 'aria-pressed': 'true', title: `Afficher ou masquer : ${m.titre}` },
          el('span', {}, m.titre), el('span', { classe: 'nb' }, String(modele.parMatiere[m.index])));
        bouton.addEventListener('click', () => basculerMatieres([m.id]));
        return bouton;
      });
      const nom = el('button', { type: 'button', classe: 'famille-nom lien-discret', title: `Afficher ou masquer toute la famille ${famille.nom}` }, pastille(famille), famille.nom);
      nom.style.textDecoration = 'none';
      nom.addEventListener('click', () => basculerMatieres(matieres.map(m => m.id)));
      conteneur.append(el('div', { classe: 'famille' }, nom, el('div', { classe: 'matieres' }, boutons)));
    });
    const types = $('#types');
    types.replaceChildren(...[['s', 'Sigles'], ['o', 'Normes'], ['d', 'Désignations']].map(([k, libelle]) => {
      const nombre = modele.notions.filter(n => n.k === k).length;
      const bouton = el('button', { type: 'button', classe: 'puce', 'data-type': k, 'aria-pressed': 'true' }, libelle, el('span', { classe: 'nb' }, String(nombre)));
      bouton.addEventListener('click', () => {
        const masques = etat.filtres.typesMasques;
        if (masques.has(k)) masques.delete(k); else masques.add(k);
        bouton.setAttribute('aria-pressed', masques.has(k) ? 'false' : 'true');
        demander();
      });
      return bouton;
    }));
    const pied = $('#legende-pied');
    pied.replaceChildren(`${pluriel(modele.notions.length, 'notion')} · ${pluriel(data.liens.length, 'lien')} · ${data.cours.length} cours`);
    if (data.mode === 'local') pied.append(el('br'), el('span', { classe: 'badge-local' }, 'Aperçu local : comprend des cours pas encore publiés'));
  }

  function basculerMatieres(ids) {
    const masquees = etat.filtres.matieresMasquees;
    const toutesMasquees = ids.every(id => masquees.has(id));
    ids.forEach(id => { if (toutesMasquees) masquees.delete(id); else masquees.add(id); });
    document.querySelectorAll('#legende [data-matiere]').forEach(b => b.setAttribute('aria-pressed', masquees.has(b.dataset.matiere) ? 'false' : 'true'));
    demander();
  }

  $('#tout-afficher').addEventListener('click', () => {
    etat.filtres.matieresMasquees.clear();
    etat.filtres.typesMasques.clear();
    etat.filtres.carrefours = false;
    document.querySelectorAll('#legende [aria-pressed]').forEach(b => b.setAttribute('aria-pressed', b.hasAttribute('data-carrefours') ? 'false' : 'true'));
    demander();
  });
  $('#legende [data-carrefours]').addEventListener('click', e => {
    etat.filtres.carrefours = !etat.filtres.carrefours;
    e.currentTarget.setAttribute('aria-pressed', String(etat.filtres.carrefours));
    demander();
  });

  function majLegende() {
    const legende = $('#legende');
    legende.classList.toggle('ouverte', legendeOuverte);
    legende.classList.toggle('fermee', !legendeOuverte);
    $('#bouton-filtres').setAttribute('aria-expanded', String(legendeOuverte));
  }
  $('#bouton-filtres').addEventListener('click', () => { legendeOuverte = !legendeOuverte; majLegende(); });

  /* ——— Thème, aide, accueil ——— */
  function appliquerTheme(nom) {
    html.dataset.theme = nom;
    stockage.ecrire('theme', nom);
    const suivant = nom === 'nuit' ? 'Passer au thème papier' : 'Passer au thème nuit';
    $('#bouton-theme').title = suivant;
    $('#theme-libelle').textContent = suivant;
    rendu.theme();
    mini.preparer(rendu);
    demander();
  }
  $('#bouton-theme').addEventListener('click', () => appliquerTheme(html.dataset.theme === 'nuit' ? 'papier' : 'nuit'));

  $('#aide-source').textContent = `Les liens sont calculés à partir de ${data.passages.toLocaleString('fr-FR')} passages de ${data.cours.length} cours du wiki. `
    + 'Deux notions sont liées quand elles apparaissent ensemble plus souvent que le hasard ne le voudrait (dans un même passage, ou plus faiblement dans une même section), '
    + 'ou quand la définition de l’une, dans un glossaire, cite l’autre. Chaque lien renvoie aux sections qui le justifient.';
  $('#bouton-aide').addEventListener('click', () => $('#aide').showModal());

  const accueil = $('#accueil');
  function masquerAccueil() {
    if (!accueil.hidden) { accueil.hidden = true; stockage.ecrire('accueil', 'vu'); }
  }
  if (stockage.lire('accueil') !== 'vu') accueil.hidden = false;
  $('#accueil-ok').addEventListener('click', () => { masquerAccueil(); champ.focus(); });

  /* ——— Infobulle au survol ——— */
  const bulle = $('#infobulle');
  let souris = [0, 0];
  function majBulle() {
    const i = etat.survol;
    if (i == null) { bulle.hidden = true; return; }
    const n = modele.notions[i];
    const nb = modele.voisins[i].length;
    bulle.replaceChildren(el('strong', {}, n.l), el('span', {}, `${n.dominante ? n.dominante.titre : n.famille.nom} · ${nb} ${nb > 1 ? 'notions liées' : 'notion liée'}`));
    bulle.hidden = false;
    const largeur = bulle.offsetWidth, hauteur = bulle.offsetHeight;
    bulle.style.left = Math.min(window.innerWidth - largeur - 8, souris[0] + 16) + 'px';
    bulle.style.top = Math.min(window.innerHeight - hauteur - 8, souris[1] + 16) + 'px';
  }

  /* ——— Gestes sur la carte ——— */
  window.Interactions.attacher(toile, {
    debutGeste() { interrompreVol(); masquerAccueil(); bulle.hidden = true; },
    deplacer(dx, dy) { interrompreVol(); etat.cam = C.deplacer(etat.cam, dx, dy); demander(); },
    zoomer(f, sx, sy) {
      interrompreVol();
      const [kmin, kmax] = bornes();
      etat.cam = C.zoomer(etat.cam, f, sx, sy, rendu.W, rendu.H, kmin, kmax);
      demander();
    },
    zoomerCentre(f) { zoomerAnime(f); },
    doubleClic(sx, sy) {
      const [kmin, kmax] = bornes();
      allerA(C.zoomer(etat.cam, 2, sx, sy, rendu.W, rendu.H, kmin, kmax), 320);
    },
    toucher(sx, sy, tactile) {
      const cible = rendu.toucher(sx, sy, tactile);
      if (cible && cible.type === 'notion') selectionner(cible.i);
      else if (cible && cible.type === 'ile') {
        const [kmin, kmax] = bornes();
        allerA(C.cadrer(modele.continents[cible.k].boite, zoneVisible(), rendu.W, rendu.H, 40, kmin, kmax));
      } else fermer();
    },
    survoler(sx, sy) {
      if (sx == null) { if (etat.survol != null) { etat.survol = null; demander(); } toile.classList.remove('survol'); majBulle(); return; }
      const rect = toile.getBoundingClientRect();
      souris = [sx + rect.left, sy + rect.top];
      const cible = rendu.toucher(sx, sy, false);
      const i = cible && cible.type === 'notion' ? cible.i : null;
      toile.classList.toggle('survol', Boolean(cible));
      if (i !== etat.survol) { etat.survol = i; demander(); }
      majBulle();
    },
    recadrer() { allerA(vueEnsemble()); },
    valider() { if (etat.survol != null) selectionner(etat.survol, { focus: true }); }
  });

  function zoomerAnime(f) {
    const zone = zoneVisible();
    const [kmin, kmax] = bornes();
    const depart = vol ? vol.vers : etat.cam;
    allerA(C.zoomer(depart, f, zone.x + zone.w / 2, zone.y + zone.h / 2, rendu.W, rendu.H, kmin, kmax), 280);
  }
  $('#zoom-plus').addEventListener('click', () => zoomerAnime(1.6));
  $('#zoom-moins').addEventListener('click', () => zoomerAnime(1 / 1.6));
  $('#recadrer').addEventListener('click', () => allerA(vueEnsemble()));
  $('#marque').addEventListener('click', e => { e.preventDefault(); fermer(); allerA(vueEnsemble()); });
  $('#fiche-fermer').addEventListener('click', () => { fermer(); toile.focus({ preventScroll: true }); });
  // Sur téléphone, la fiche s'ouvre à mi-hauteur pour laisser voir le voisinage ; la poignée l'agrandit.
  $('#fiche-poignee').addEventListener('click', e => {
    const etendue = fiche.classList.toggle('etendue');
    e.currentTarget.setAttribute('aria-expanded', String(etendue));
    e.currentTarget.title = etendue ? 'Réduire la fiche' : 'Agrandir la fiche';
    e.currentTarget.firstElementChild.textContent = e.currentTarget.title;
  });

  const minicarte = $('#minicarte');
  const versMini = e => {
    const rect = minicarte.getBoundingClientRect();
    const [x, y] = mini.versMonde(e.clientX - rect.left, e.clientY - rect.top);
    interrompreVol();
    const zone = zoneVisible();
    etat.cam = { k: etat.cam.k, x: x - (zone.x + zone.w / 2 - rendu.W / 2) / etat.cam.k, y: y - (zone.y + zone.h / 2 - rendu.H / 2) / etat.cam.k };
    demander();
  };
  minicarte.addEventListener('pointerdown', e => { minicarte.setPointerCapture(e.pointerId); versMini(e); });
  minicarte.addEventListener('pointermove', e => { if (e.buttons) versMini(e); });

  document.addEventListener('keydown', e => {
    const saisie = e.target.closest && e.target.closest('input, textarea, [contenteditable]');
    if (e.key === '/' && !saisie && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      champ.focus();
      champ.select();
    } else if (e.key === 'Escape' && !saisie && !$('#aide').open) {
      if (!fiche.hidden) { fermer(); toile.focus({ preventScroll: true }); } else masquerAccueil();
    }
  });

  /* ——— Adresse, taille, polices ——— */
  function depuisAdresse(duree) {
    const m = /notion=([^&]+)/.exec(window.location.hash);
    if (!m) return false;
    const id = decodeURIComponent(m[1]);
    const n = modele.notions.find(x => x.id === id);
    if (n && n.i !== etat.selection) selectionner(n.i, { duree });
    return Boolean(n);
  }
  window.addEventListener('hashchange', () => depuisAdresse(700));

  function redimensionner() {
    const zoomRelatif = etat.cam.k / etat.kAjuste;
    const centre = [etat.cam.x, etat.cam.y];
    rendu.redimensionner();
    const origine = toile.getBoundingClientRect();
    const haut = $('.barre').getBoundingClientRect().bottom - origine.top;
    etat.kAjuste = C.cadrer(modele.boite, { x: 0, y: haut, w: rendu.W, h: rendu.H - haut }, rendu.W, rendu.H, 28, 1e-9, 1e9).k;
    if (Number.isFinite(zoomRelatif) && redimensionner.fait) etat.cam = { x: centre[0], y: centre[1], k: etat.kAjuste * zoomRelatif };
    // Un changement de largeur du panneau garde la notion dans la zone de lecture.
    if (etat.selection != null) {
      const zone = zoneVisible(), n = modele.notions[etat.selection];
      interrompreVol();
      etat.cam.x = n.x[0] - (zone.x + zone.w / 2 - rendu.W / 2) / etat.cam.k;
      etat.cam.y = n.x[1] - (zone.y + zone.h / 2 - rendu.H / 2) / etat.cam.k;
    }
    redimensionner.fait = true;
    champ.placeholder = rendu.W < 560 ? 'Chercher une notion…' : 'Chercher une notion : ferrite, ZAT, Wöhler…';
    mini.preparer(rendu);
    demander();
  }
  new ResizeObserver(redimensionner).observe(toile);
  redimensionner();
  construireLegende();
  majLegende();
  etat.cam = vueEnsemble();
  if (!depuisAdresse(900)) demander();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { rendu.oublierMesures(); demander(); });

  /* Accès pour les tests de parcours et le débogage. */
  window.carte = {
    pret: true,
    modele,
    etat: () => ({ selection: etat.selection == null ? null : modele.notions[etat.selection].id, enVol: etat.enVol,
      matieresMasquees: [...etat.filtres.matieresMasquees], carrefours: etat.filtres.carrefours }),
    camera: () => ({ ...etat.cam }),
    selectionner: id => { const n = modele.notions.find(x => x.id === id); if (n) selectionner(n.i); return Boolean(n); },
    ecranDe: id => {
      const n = modele.notions.find(x => x.id === id);
      rendu.dessiner(etat);
      return [rendu.sx[n.i], rendu.sy[n.i]];
    },
    zoneVisible
  };
})();
