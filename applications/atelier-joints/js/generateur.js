/* Atelier des joints : generateur.js
   Exercices tirés d'une graine, reproductibles, avec une seule bonne réponse.
   Décoder : un QCM illustré (symbole, coupe ou texte). Coder : composer le symbole ou ses cotes avec un outil.
   Les figures sont des données (spécification de symbole pour symbole.js, recette de coupe pour coupe.js) :
   l'item se sauvegarde, se rejoue et se teste sans navigateur. Règles : ISO 2553:2019 et ISO 13920:2023. Module UMD. */
(function (racine, fabrique) {
  if (typeof module === "object" && module.exports) module.exports = fabrique();
  else racine.Generateur = fabrique();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /* ---------- hasard reproductible ---------- */
  function rng(graine) {
    let a = (graine >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const choix = (r, l) => l[Math.floor(r() * l.length)];
  function melanger(r, l) { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
  const cle = o => JSON.stringify(o);
  function qcm(r, bon, faux) {
    const vus = new Set([cle(bon)]), d = [];
    faux.forEach(f => { if (d.length < 3 && !vus.has(cle(f))) { vus.add(cle(f)); d.push(f); } });
    const opts = melanger(r, [bon].concat(d));
    return { options: opts, bonne: opts.findIndex(o => cle(o) === cle(bon)) };
  }
  const fr = v => v.toLocaleString("fr-FR");
  const mm = v => fr(v) + " mm";
  const C1 = a => ({ id: "conception-01", ancre: a }), C2 = a => ({ id: "conception-02", ancre: a });

  /* ---------- niveaux ---------- */
  const NIVEAUX = [
    { n: 1, titre: "Symboles élémentaires", description: "Reconnaître le symbole d'une préparation, et la préparation d'un symbole.", cours: C2("c2") },
    { n: 2, titre: "Côté flèche, côté opposé", description: "Dire où souder, en système A comme en système B.", cours: C2("c1") },
    { n: 3, titre: "Symboles supplémentaires", description: "Forme du cordon, envers, support, tout autour, chantier.", cours: C2("c3") },
    { n: 4, titre: "Les cotes", description: "Gorge et côté, pénétration, soudures discontinues.", cours: C2("c4") },
    { n: 5, titre: "Fourche et tolérances", description: "Lire la fourche ; appliquer les tolérances de l'ISO 13920.", cours: C2("c5") }
  ];

  /* ---------- préparations et symboles élémentaires ---------- */
  const ELEM = {
    I: { nom: "soudure bout à bout à bords droits", spec: { fleche: { sym: "I" } }, coupe: { f: "sceneBout", a: ["I", { t: 6, b: 3 }] }, lecture: "Deux traits parallèles : deux bords droits face à face." },
    V: { nom: "soudure bout à bout en V", spec: { fleche: { sym: "V" } }, coupe: { f: "sceneBout", a: ["V", { t: 12, alpha: 60, b: 2, c: 1.5 }] }, lecture: "Le V reproduit les deux flancs du chanfrein, pointe vers la racine." },
    Y: { nom: "soudure bout à bout en Y", spec: { fleche: { sym: "Y" } }, coupe: { f: "sceneBout", a: ["V", { t: 14, alpha: 60, b: 2, c: 5 }] }, lecture: "Un V posé sur une tige : le chanfrein en V garde un talon épais." },
    demiV: { nom: "soudure bout à bout en demi-V", spec: { fleche: { sym: "demiV" } }, coupe: { f: "sceneBout", a: ["demiV", { t: 12, beta: 45, b: 2, c: 1.5 }] }, lecture: "Un flanc vertical, un flanc oblique : une seule pièce est biseautée. La branche verticale reste à gauche." },
    U: { nom: "soudure bout à bout en U", spec: { fleche: { sym: "U" } }, coupe: { f: "sceneBout", a: ["U", { t: 16, beta: 10, R: 5, b: 2, c: 2 }] }, lecture: "Une coupe arrondie sur une tige : le fond arrondi et le talon du chanfrein en U." },
    J: { nom: "soudure bout à bout en J (demi-U)", spec: { fleche: { sym: "J" } }, coupe: { f: "sceneBout", a: ["J", { t: 16, beta: 15, R: 5, b: 2, c: 2 }] }, lecture: "Une branche verticale et un arrondi : un demi-U usiné dans une seule pièce." },
    angle: { nom: "soudure d'angle", spec: { fleche: { sym: "angle" } }, coupe: { f: "sceneTe", a: [{ t1: 8, t2: 8, H: 18, L: 20, mode: "angle", droite: { z: 6, s: 0.3 } }] }, lecture: "Le triangle est la coupe du cordon d'angle, branche verticale à gauche." },
    bouchon: { nom: "soudure en bouchon", spec: { fleche: { sym: "bouchon" } }, coupe: { f: "sceneRecouvrement", a: [{ t: 6, bouchon: true, droite: false, recouvrement: 20 }] }, lecture: "Le rectangle ouvert figure la lumière de la tôle, remplie de métal fondu." },
    X: { nom: "soudure bout à bout en X (double V)", spec: { fleche: { sym: "V" }, oppose: { sym: "V" } }, coupe: { f: "sceneBout", a: ["X", { t: 16, alpha: 60, b: 2, c: 2 }] }, lecture: "Deux V face à face : un chanfrein en V de chaque côté, sans trait discontinu car la soudure est symétrique." },
    K: { nom: "soudure bout à bout en K", spec: { fleche: { sym: "demiV" }, oppose: { sym: "demiV" } }, coupe: { f: "sceneBout", a: ["K", { t: 16, beta: 45, b: 2, c: 2 }] }, lecture: "Deux demi-V face à face : une seule pièce biseautée des deux côtés." },
    UU: { nom: "soudure bout à bout en double U", spec: { fleche: { sym: "U" }, oppose: { sym: "U" } }, coupe: { f: "sceneBout", a: ["UU", { t: 26, beta: 10, R: 5, b: 2, c: 2 }] }, lecture: "Deux U face à face : la préparation des très fortes épaisseurs." },
    angle2: { nom: "deux soudures d'angle, une de chaque côté", spec: { fleche: { sym: "angle" }, oppose: { sym: "angle" } }, coupe: { f: "sceneTe", a: [{ t1: 8, t2: 8, H: 18, L: 20, mode: "angle", droite: { z: 6, s: 0.3 }, gauche: { z: 6, s: 0.3 } }] }, lecture: "Un triangle de chaque côté du trait : un cordon d'angle de chaque côté de l'âme." }
  };
  const AUTRES = {
    pointR: { nom: "soudure par points par résistance", spec: { interface: { sym: "pointR" } }, lecture: "Un cercle centré sur le trait : des points soudés à l'interface des tôles." },
    pointF: { nom: "soudure par points par fusion", spec: { fleche: { sym: "pointF" } }, lecture: "Un cercle posé sur le trait : des points fondus depuis le côté flèche." },
    moletteR: { nom: "soudure à la molette par résistance", spec: { interface: { sym: "moletteR" } }, lecture: "Un cercle barré de deux traits, centré sur le trait : la molette roule à l'interface." },
    goujon: { nom: "soudure de goujons", spec: { fleche: { sym: "goujon" } }, lecture: "Un cercle et une croix : la tête d'un goujon soudé." },
    recharge: { nom: "soudure de rechargement", spec: { fleche: { sym: "recharge" } }, lecture: "Deux arcs côte à côte : des cordons de rechargement juxtaposés." },
    chant: { nom: "soudure sur chant", spec: { fleche: { sym: "chant" } }, lecture: "Un rectangle partagé : deux pièces accolées, soudées sur leurs bords." },
    releves: { nom: "soudure à bords relevés", spec: { fleche: { sym: "releves" } }, lecture: "Deux bords recourbés vers le haut : des bords relevés, entièrement fondus." },
    evV: { nom: "soudure en V à bords évasés", spec: { fleche: { sym: "evV" } }, lecture: "Deux arcs bombés vers le joint : deux surfaces arrondies qui se touchent." }
  };
  const nomDe = k => (ELEM[k] || AUTRES[k]).nom;
  const avecSysteme = (spec, sys) => Object.assign({ systeme: sys.systeme, pointilles: sys.pointilles || "dessous" }, JSON.parse(JSON.stringify(spec)));
  const SYS_A = { systeme: "A", pointilles: "dessous" };

  function n1d(r) {
    if (r() < 0.5) {
      const pool = Object.keys(ELEM).concat(Object.keys(AUTRES)), k = choix(r, pool), E = ELEM[k] || AUTRES[k];
      const q = qcm(r, { texte: E.nom }, melanger(r, pool.filter(x => x !== k)).map(x => ({ texte: nomDe(x) })));
      return Object.assign({ type: "nom", enonce: "Quel joint ce symbole désigne-t-il ?", figure: { kind: "symbole", spec: avecSysteme(E.spec, SYS_A) },
        explication: E.lecture + " C'est une " + E.nom + ".", cours: C2("c2") }, q);
    }
    const pool = Object.keys(ELEM), k = choix(r, pool), E = ELEM[k];
    const fig = x => ({ figure: { kind: "coupe", recette: ELEM[x].coupe } });
    const q = qcm(r, fig(k), melanger(r, pool.filter(x => x !== k && cle(ELEM[x].coupe) !== cle(E.coupe))).map(fig));
    return Object.assign({ type: "coupe", enonce: "Quelle coupe ce symbole décrit-il ?", figure: { kind: "symbole", spec: avecSysteme(E.spec, SYS_A) },
      explication: E.lecture + " Le symbole est la coupe en miniature : " + E.nom + ".", cours: C2("c2") }, q);
  }
  function n1c(r) {
    const k = choix(r, Object.keys(ELEM)), E = ELEM[k];
    return { type: "palette", outil: "palette", palette: Object.keys(ELEM),
      enonce: "Compose le symbole de cette préparation (système A, trait discontinu dessous). " + (E.spec.oppose ? "La soudure est faite des deux côtés." : "La soudure est faite du côté que touche la flèche."),
      figure: { kind: "coupe", recette: E.coupe }, attendu: { sym: k }, systeme: SYS_A,
      explication: E.lecture + " Symbole attendu : " + E.nom + ".", cours: C2("c2") };
  }

  /* ---------- niveau 2 : côté flèche, côté opposé ---------- */
  const SYSTEMES = [{ systeme: "A", pointilles: "dessous" }, { systeme: "A", pointilles: "dessus" }, { systeme: "B" }];
  const nomSysteme = s => s.systeme === "B" ? "système B" : "système A, trait discontinu " + (s.pointilles === "dessus" ? "dessus" : "dessous");
  function coteDePlace(place, systeme, pointilles) {
    if (place === "deux") return "deux";
    if (systeme === "B") return place === "dessous" ? "fleche" : "oppose";
    if (pointilles === "dessus") return place === "dessous" ? "fleche" : "oppose";
    return place === "dessus" ? "fleche" : "oppose";
  }
  function placeDeCote(cote, systeme, pointilles) {
    if (cote === "deux") return "deux";
    return ["dessus", "dessous"].find(p => coteDePlace(p, systeme, pointilles) === cote);
  }
  function specCote(sym, cote, sys) {
    const sp = { systeme: sys.systeme, pointilles: sys.pointilles || "dessous" };
    if (cote !== "oppose") sp.fleche = { sym };
    if (cote !== "fleche") sp.oppose = { sym };
    return sp;
  }
  const regleSys = s => s.systeme === "B" ? "En système B (un seul trait), dessous veut dire côté flèche et dessus côté opposé."
    : "En système A, le symbole posé sur le trait continu est côté flèche, celui posé sur le trait discontinu côté opposé" + (s.pointilles === "dessus" ? " ; ici le trait discontinu est dessus." : ".");
  function n2d(r) {
    const sym = choix(r, ["V", "angle", "demiV", "U", "Y"]), cote = choix(r, ["fleche", "oppose"]), sys = choix(r, SYSTEMES);
    if (r() < 0.55) {
      const options = [{ texte: "côté flèche" }, { texte: "côté opposé à la flèche" }, { texte: "des deux côtés" }, { texte: "on ne peut pas savoir" }];
      return { type: "cote", enonce: "De quel côté du joint faut-il souder ?", figure: { kind: "symbole", spec: specCote(sym, cote, sys) }, options, bonne: cote === "fleche" ? 0 : 1,
        explication: regleSys(sys) + (sys.systeme === "B" ? " Pas de trait discontinu : c'est le système B." : "") + " La soudure est donc " + (cote === "fleche" ? "côté flèche." : "côté opposé à la flèche."), cours: C2("c1") };
    }
    const joint = choix(r, ["V", "angle"]), s0 = joint === "V" ? "V" : "angle", faux0 = joint === "V" ? "demiV" : "V";
    const opt = (s, c) => ({ figure: { kind: "symbole", spec: specCote(s, c, sys) } });
    const q = qcm(r, opt(s0, cote), [opt(s0, cote === "fleche" ? "oppose" : "fleche"), opt(s0, "deux"), opt(faux0, cote)]);
    return Object.assign({ type: "choisir", enonce: "Le plan suit le " + nomSysteme(sys) + ". Quel symbole décrit cette soudure ?", figure: { kind: "coupeFleche", joint, cote },
      explication: "La flèche touche le côté " + (joint === "V" ? "du dessus" : "droit") + " du joint ; la soudure est " + (cote === "fleche" ? "de ce côté : côté flèche." : "de l'autre côté : côté opposé.") + " " + regleSys(sys), cours: C2("c1") }, q);
  }
  function n2c(r) {
    const joint = choix(r, ["V", "angle"]), cote = choix(r, ["fleche", "oppose", "deux"]), sys = choix(r, SYSTEMES);
    const sym = joint === "V" ? "V" : "angle";
    return { type: "position", outil: "palettePosition", palette: ["I", "V", "Y", "demiV", "U", "angle"], systeme: sys,
      enonce: "Compose le symbole de cette soudure. Le plan suit le " + nomSysteme(sys) + " : choisis le symbole, puis sa place.",
      figure: { kind: "coupeFleche", joint, cote }, attendu: { sym, place: placeDeCote(cote, sys.systeme, sys.pointilles) },
      explication: (cote === "deux" ? "Soudure des deux côtés : un symbole de chaque côté du trait." : "La soudure est " + (cote === "fleche" ? "côté flèche." : "côté opposé à la flèche.") + " " + regleSys(sys)) + " Symbole : " + ELEM[sym].nom + ".", cours: C2("c1") };
  }

  /* ---------- niveau 3 : symboles supplémentaires ---------- */
  const FORMES = { plat: "surface plate (finition affleurée)", convexe: "surface convexe", concave: "surface concave" };
  const ENVERS = { reprise: "avec reprise à l'envers", surep: "avec surépaisseur spécifiée à la racine", M: "sur support envers subsistant (M)", MR: "sur support envers temporaire (MR)" };
  function decrireSupp(base, f) {
    const p = [base === "V" ? "Soudure bout à bout en V, côté flèche" : "Soudure d'angle, côté flèche"];
    if (f.forme) p.push(FORMES[f.forme]);
    if (f.envers) p.push(ENVERS[f.envers]);
    if (f.toutAutour) p.push("tout autour");
    if (f.chantier) p.push("faite sur chantier");
    if (p.length === 1) p.push("sans symbole supplémentaire");
    return p.join(", ") + ".";
  }
  function tirerSupp(r, base) {
    const f = { forme: "", envers: "", toutAutour: false, chantier: false }, cats = melanger(r, base === "V" ? ["forme", "envers", "toutAutour", "chantier"] : ["forme", "toutAutour", "chantier"]);
    cats.slice(0, 1 + Math.floor(r() * 2)).forEach(c => {
      if (c === "forme") f.forme = choix(r, Object.keys(FORMES));
      else if (c === "envers") f.envers = choix(r, Object.keys(ENVERS));
      else f[c] = true;
    });
    return f;
  }
  const VOISIN = { plat: "convexe", convexe: "concave", concave: "convexe", reprise: "surep", surep: "reprise", M: "MR", MR: "M" };
  function variantesSupp(base, f) {
    const v = [];
    if (f.forme) v.push(Object.assign({}, f, { forme: VOISIN[f.forme] }), Object.assign({}, f, { forme: f.forme === "plat" ? "concave" : "plat" }));
    if (f.envers) v.push(Object.assign({}, f, { envers: VOISIN[f.envers] }), Object.assign({}, f, { envers: f.envers === "M" || f.envers === "MR" ? "reprise" : "M" }));
    if (f.toutAutour !== f.chantier) v.push(Object.assign({}, f, { toutAutour: f.chantier, chantier: f.toutAutour }));
    v.push(Object.assign({}, f, { toutAutour: !f.toutAutour }), Object.assign({}, f, { chantier: !f.chantier }));
    if (!f.forme) v.push(Object.assign({}, f, { forme: "convexe" }));
    return v;
  }
  const specSupp = (base, f) => ({ systeme: "A", pointilles: "dessous", fleche: Object.assign({ sym: base }, f.forme ? { forme: f.forme } : {}, f.envers ? { envers: f.envers } : {}), toutAutour: !!f.toutAutour, chantier: !!f.chantier });
  const expliquerSupp = (base, f) => {
    const t = [];
    if (f.forme) t.push("le signe posé sur le symbole donne la forme : " + FORMES[f.forme]);
    if (f.envers) t.push("le signe placé de l'autre côté du trait concerne l'envers : " + ENVERS[f.envers].replace(/^(avec|sur) /, ""));
    if (f.toutAutour) t.push("le cercle au coude demande une soudure tout autour");
    if (f.chantier) t.push("le drapeau indique une soudure faite sur chantier");
    return t.length ? t.join(" ; ").replace(/^./, c => c.toUpperCase()) + "." : "Aucun symbole supplémentaire.";
  };
  function n3d(r) {
    const base = r() < 0.6 ? "V" : "angle", f = tirerSupp(r, base);
    const q = qcm(r, { texte: decrireSupp(base, f) }, melanger(r, variantesSupp(base, f)).map(x => ({ texte: decrireSupp(base, x) })));
    return Object.assign({ type: "supp", enonce: "Que demande ce symbole ?", figure: { kind: "symbole", spec: specSupp(base, f) }, explication: expliquerSupp(base, f), cours: C2("c3") }, q);
  }
  function n3c(r) {
    const base = r() < 0.6 ? "V" : "angle", f = tirerSupp(r, base);
    return { type: "supp", outil: "supp", base, enonce: "Ajoute au symbole les symboles supplémentaires demandés : " + decrireSupp(base, f).replace(/^Soudure (bout à bout en V|d'angle), côté flèche, /, "").replace(/\.$/, "") + ".",
      figure: { kind: "coupe", recette: ELEM[base].coupe }, attendu: f, explication: expliquerSupp(base, f), cours: C2("c3") };
  }

  /* ---------- niveau 4 : cotes ---------- */
  function n4d(r) {
    const t = choix(r, ["soudee", "occupee", "z", "a", "penetration", "total"]);
    if (t === "soudee" || t === "occupee") {
      const a = choix(r, [3, 4, 5, 6]), n = 2 + Math.floor(r() * 5), l = choix(r, [40, 50, 60, 75, 80, 100, 120, 150]), e = choix(r, [50, 60, 75, 80, 100, 120, 150, 200, 250]);
      const soudee = n * l, occupee = n * l + (n - 1) * e;
      const bon = t === "soudee" ? soudee : occupee;
      const faux = (t === "soudee" ? [occupee, n * (l + e), (n - 1) * l, n * e] : [soudee, n * (l + e), n * l + (n + 1) * e, (n - 1) * (l + e)]).filter(v => v > 0 && v !== bon);
      const q = qcm(r, { texte: mm(bon) }, faux.map(v => ({ texte: mm(v) })));
      return Object.assign({ type: t, enonce: t === "soudee" ? "Quelle longueur est soudée en tout ?" : "Sur quelle longueur de joint s'étendent ces cordons ?", calcul: { n, l, e, quoi: t },
        figure: { kind: "symbole", spec: { systeme: "A", pointilles: "dessous", fleche: { sym: "angle", a, n, l, e } } },
        explication: n + " × " + l + " (" + e + ") : " + n + " cordons de " + l + " mm séparés par " + (n - 1) + " intervalles de " + e + " mm. Soudé : n · l = " + mm(soudee) + " ; occupé : n · l + (n − 1) · e = " + mm(occupee) + ".", cours: C2("c4") }, q);
    }
    if (t === "z" || t === "a") {
      const v = t === "z" ? choix(r, [3, 4, 5, 6, 8]) : choix(r, [5, 6, 7, 8, 10]);
      const bon = t === "z" ? v * Math.SQRT2 : v / Math.SQRT2, f1 = x => fr(Math.round(x * 10) / 10) + " mm";
      const faux = t === "z" ? [v, v / Math.SQRT2, 2 * v] : [v, v * Math.SQRT2, v / 2];
      const q = qcm(r, { texte: f1(bon) }, faux.map(x => ({ texte: f1(x) })));
      const sp = { systeme: "A", pointilles: "dessous", fleche: t === "z" ? { sym: "angle", a: v } : { sym: "angle", z: v } };
      return Object.assign({ type: t, enonce: t === "z" ? "Quel côté z le soudeur doit-il viser ?" : "Quelle gorge a ce cordon donne-t-il ?", figure: { kind: "symbole", spec: sp },
        explication: (t === "z" ? "a" + v + " est une gorge : z = a · √2 ≈ " + f1(bon) : "z" + v + " est un côté : a = z/√2 ≈ " + f1(bon)) + ". La lettre fait partie de la cote.", cours: C1("c2") }, q);
    }
    if (t === "penetration") {
      const sym = choix(r, ["V", "I", "Y"]), s = choix(r, [3, 4, 5, 6, 8]), partielle = r() < 0.6;
      const options = [{ texte: "pleine pénétration" }, { texte: "pénétration partielle de " + s + " mm" }, { texte: "chanfrein de " + s + " mm de profondeur" }, { texte: "écartement de " + s + " mm à la racine" }];
      return { type: t, enonce: partielle ? "Que signifie la cote « s" + s + " » ?" : "Ce symbole ne porte aucune cote. Quelle pénétration est demandée ?",
        figure: { kind: "symbole", spec: { systeme: "A", pointilles: "dessous", fleche: partielle ? { sym, s } : { sym } } }, options, bonne: partielle ? 1 : 0,
        explication: partielle ? "s est la profondeur de pénétration d'une soudure bout à bout, écrite à gauche du symbole : pénétration partielle de " + s + " mm." : "Sans cote à gauche, une soudure bout à bout est à pleine pénétration (ISO 2553, 5.4.1).", cours: C2("c4") };
    }
    const a = choix(r, [3, 4, 5]), n = 2 + Math.floor(r() * 4), l = choix(r, [40, 50, 60, 80]), e = choix(r, [80, 100, 120, 150]);
    const q = qcm(r, { texte: String(2 * n) }, [String(n), String(2 * n - 1), String(n - 1), String(2 * n + 2)].map(x => ({ texte: x })));
    return Object.assign({ type: "total", enonce: "Combien de cordons faut-il souder en tout ?",
      figure: { kind: "symbole", spec: { systeme: "A", pointilles: "dessous", fleche: { sym: "angle", a, n, l, e }, oppose: { sym: "angle", a, n, l, e }, alterne: true } },
      explication: "Les cotes sont écrites des deux côtés : " + n + " cordons de chaque côté, alternés (le Z), soit " + 2 * n + " cordons.", cours: C2("c4") }, q);
  }
  function n4c(r) {
    const cas = choix(r, ["aDisc", "zCont", "aCont", "sV", "plein"]);
    let base = "angle", at, enonce;
    if (cas === "aDisc") {
      const a = choix(r, [3, 4, 5, 6]), n = 2 + Math.floor(r() * 4), l = choix(r, [50, 60, 75, 100]), e = choix(r, [100, 120, 150, 200]);
      at = { lettre: "a", valeur: a, discontinue: true, n, l, e };
      enonce = "Cordon d'angle côté flèche, de gorge " + a + " mm, en " + n + " cordons de " + l + " mm séparés de " + e + " mm.";
    } else if (cas === "zCont" || cas === "aCont") {
      const v = choix(r, [4, 5, 6, 7, 8]);
      at = { lettre: cas === "zCont" ? "z" : "a", valeur: v, discontinue: false };
      enonce = "Cordon d'angle côté flèche, continu, de " + (cas === "zCont" ? "côté " : "gorge ") + v + " mm.";
    } else if (cas === "sV") {
      const s = choix(r, [4, 5, 6, 8]); base = "V";
      at = { lettre: "s", valeur: s, discontinue: false };
      enonce = "Soudure bout à bout en V côté flèche, continue, à pénétration partielle de " + s + " mm.";
    } else {
      base = "V"; at = { lettre: "", valeur: 0, discontinue: false };
      enonce = "Soudure bout à bout en V côté flèche, continue, à pleine pénétration.";
    }
    return { type: "cotes", outil: "cotes", base, enonce: enonce + " Écris ses cotes.", figure: { kind: "coupe", recette: ELEM[base].coupe }, attendu: at,
      explication: at.lettre === "" ? "Pleine pénétration et soudure continue : on n'écrit aucune cote." : "À gauche du symbole, la lettre puis la valeur (« " + at.lettre + at.valeur + " »)" + (at.discontinue ? " ; à droite, « " + at.n + " × " + at.l + " (" + at.e + ") »." : " ; rien à droite, puisque la soudure est continue."), cours: C2("c4") };
  }

  /* ---------- niveau 5 : fourche et tolérances ---------- */
  const PROC = { 111: "électrode enrobée", 121: "arc sous flux", 135: "MAG avec fil plein", 141: "TIG" };
  const POS = { PA: "à plat", PB: "en angle à plat", PC: "en corniche", PD: "en angle au plafond", PE: "au plafond", PF: "verticale montante", PG: "verticale descendante" };
  const NIVQ = { B: "le plus exigeant", C: "intermédiaire", D: "le moins exigeant" };
  /* ISO 13920:2023, tableau 1 : trois tranches seulement (valeurs repères du cours) */
  const TRANCHES = [{ de: 120, a: 400, t: { A: 1, B: 2, C: 4, D: 7 } }, { de: 1000, a: 2000, t: { A: 3, B: 4, C: 8, D: 12 } }, { de: 4000, a: 8000, t: { A: 5, B: 8, C: 14, D: 21 } }];
  function tolerance(L, classe) { const tr = TRANCHES.find(x => L > x.de && L <= x.a); return tr ? tr.t[classe] : null; }
  const EXTRAIT = '<table class="extrait"><caption>Extrait de l\'ISO 13920:2023, tableau 1 (tolérances en mm)</caption><tr><th>Dimension nominale</th><th>A</th><th>B</th><th>C</th><th>D</th></tr>'
    + TRANCHES.map(x => "<tr><td>" + fr(x.de) + " &lt; l ≤ " + fr(x.a) + "</td>" + ["A", "B", "C", "D"].map(c => "<td>± " + x.t[c] + "</td>").join("") + "</tr>").join("") + "</table>";
  function tirerFourche(r) {
    const p = choix(r, Object.keys(PROC)), x = p === "121" ? choix(r, ["PA", "PB"]) : choix(r, ["PA", "PB", "PC", "PF"]), q = choix(r, ["B", "C", "D"]);
    return { p, x, q };
  }
  const specFourche = f => ({ systeme: "A", pointilles: "dessous", fleche: { sym: "angle", a: 4 }, queue: { infos: ["ISO 5817-" + f.q, f.p, f.x] } });
  function n5d(r) {
    const t = choix(r, ["proc", "pos", "niv", "fermee", "tolerance", "designation"]);
    if (t === "proc" || t === "pos" || t === "niv") {
      const f = tirerFourche(r);
      let q, enonce;
      if (t === "proc") { enonce = "Quel procédé cette fourche demande-t-elle ?"; q = qcm(r, { texte: f.p + " : " + PROC[f.p] }, melanger(r, Object.keys(PROC).filter(k => k !== f.p)).map(k => ({ texte: k + " : " + PROC[k] }))); }
      else if (t === "pos") { enonce = "Quelle position de soudage cette fourche demande-t-elle ?"; q = qcm(r, { texte: POS[f.x] }, melanger(r, Object.keys(POS).filter(k => k !== f.x)).map(k => ({ texte: POS[k] }))); }
      else { enonce = "Quel niveau de qualité cette fourche demande-t-elle ?"; q = qcm(r, { texte: "niveau " + f.q + " de l'ISO 5817 (" + NIVQ[f.q] + ")" }, [{ texte: "classe " + f.q + " de tolérances de l'ISO 13920" }].concat(["B", "C", "D"].filter(k => k !== f.q).map(k => ({ texte: "niveau " + k + " de l'ISO 5817 (" + NIVQ[k] + ")" })))); }
      return Object.assign({ type: t, enonce, figure: { kind: "symbole", spec: specFourche(f) },
        explication: "La fourche ouverte se lit dans l'ordre : niveau " + f.q + " de l'ISO 5817 (" + NIVQ[f.q] + "), procédé " + f.p + " de l'ISO 4063 (" + PROC[f.p] + "), position " + f.x + " de l'ISO 6947 (" + POS[f.x] + ").", cours: C2("c5") }, q);
    }
    if (t === "fermee") {
      const n = 2 + Math.floor(r() * 20), ref = "DMOS " + n;
      const q = qcm(r, { texte: "un renvoi au document « " + ref + " », qui donne procédé, apport, position et paramètres" },
        [{ texte: "une soudure de niveau de qualité " + n }, { texte: "la position de soudage n° " + n }, { texte: n + " soudures identiques" }]);
      return Object.assign({ type: t, enonce: "Que signifie la fourche fermée de ce symbole ?", figure: { kind: "symbole", spec: { systeme: "A", pointilles: "dessous", fleche: { sym: "angle", a: 5 }, queue: { fermee: ref } } },
        explication: "Une fourche fermée (un cadre) ne contient qu'une référence de document : DMOS, PV-QMOS ou autre.", cours: C2("c5") }, q);
    }
    if (t === "tolerance") {
      const tr = choix(r, TRANCHES), L = choix(r, tr.de === 120 ? [180, 250, 300, 350] : tr.de === 1000 ? [1200, 1500, 1800] : [5000, 6000, 7500]), c = choix(r, ["A", "B", "C", "D"]);
      const q = qcm(r, { texte: "± " + tr.t[c] + " mm" }, ["A", "B", "C", "D"].filter(k => k !== c).map(k => ({ texte: "± " + tr.t[k] + " mm" })));
      return Object.assign({ type: t, enonce: "Une cote de " + mm(L) + " n'a pas de tolérance propre ; le cartouche indique « ISO 13920-" + c + " ». Quelle tolérance s'applique ?" + EXTRAIT, figure: null,
        explication: fr(L) + " mm se range dans la tranche de " + fr(tr.de) + " à " + fr(tr.a) + " mm ; la classe " + c + " y donne ± " + tr.t[c] + " mm.", cours: { id: "conception-02", ancre: "c6" } }, q);
    }
    const x = choix(r, ["A", "B", "C", "D"]), y = choix(r, ["E", "F", "G", "H"]);
    const q = qcm(r, { texte: "classe " + x + " pour les longueurs et les angles, classe " + y + " pour la rectitude, la planéité et le parallélisme" },
      [{ texte: "classe " + y + " pour les longueurs et les angles, classe " + x + " pour la rectitude, la planéité et le parallélisme" }, { texte: "niveau de qualité " + x + ", finition " + y }, { texte: "classe " + x + " en atelier, classe " + y + " sur chantier" }]);
    return Object.assign({ type: t, enonce: "Le cartouche d'un plan porte « ISO 13920-" + x + y + " ». Que demande-t-il ?", figure: null,
      explication: "La première lettre (A à D) vaut pour les longueurs et les angles, la seconde (E à H) pour la forme : rectitude, planéité, parallélisme.", cours: { id: "conception-02", ancre: "c6" } }, q);
  }
  function n5c(r) {
    const f = tirerFourche(r);
    return { type: "fourche", outil: "fourche", enonce: "Compose la fourche d'un cordon d'angle a4 : niveau " + f.q + " de l'ISO 5817, procédé " + PROC[f.p] + ", position " + POS[f.x] + ".",
      figure: { kind: "coupe", recette: ELEM.angle.coupe }, attendu: { niveau: f.q, procede: f.p, position: f.x }, choixFourche: { niveau: ["B", "C", "D"], procede: Object.keys(PROC), position: Object.keys(POS) },
      explication: "Fourche ouverte, dans l'ordre : « ISO 5817-" + f.q + " / " + f.p + " / " + f.x + " ». " + PROC[f.p].replace(/^./, c => c.toUpperCase()) + " : " + f.p + " (ISO 4063) ; " + POS[f.x] + " : " + f.x + " (ISO 6947).", cours: C2("c5") };
  }

  /* ---------- assemblage ---------- */
  const FN = { 1: [n1d, n1c], 2: [n2d, n2c], 3: [n3d, n3c], 4: [n4d, n4c], 5: [n5d, n5c] };
  function generer(niveau, mode, graine) {
    const r = rng(graine * 31 + niveau * 7 + (mode === "coder" ? 1 : 0));
    const it = FN[niveau][mode === "coder" ? 1 : 0](r);
    return Object.assign({ id: niveau + (mode === "coder" ? "c" : "d") + "-" + graine, niveau, mode, graine, competence: NIVEAUX[niveau - 1].titre }, it);
  }
  const serie = (niveau, mode, graine, n) => Array.from({ length: n || 10 }, (_, i) => generer(niveau, mode, graine + i));
  function examen(graine) {
    const items = [];
    for (let n = 1; n <= 5; n++) for (let i = 0; i < 4; i++) items.push(generer(n, "decoder", graine * 100 + n * 10 + i));
    return melanger(rng(graine), items);
  }

  /* ---------- correction ---------- */
  const egal = (a, b) => Math.abs(Number(a) - Number(b)) < 1e-9;
  function verifier(it, rep) {
    if (!it.outil) return { ok: rep === it.bonne };
    const at = it.attendu;
    if (!rep || typeof rep !== "object") return { ok: false };
    switch (it.outil) {
      case "palette": return { ok: rep.sym === at.sym };
      case "palettePosition": return { ok: rep.sym === at.sym && rep.place === at.place };
      case "supp": return { ok: (rep.forme || "") === at.forme && (rep.envers || "") === at.envers && !!rep.toutAutour === at.toutAutour && !!rep.chantier === at.chantier };
      case "cotes":
        if ((rep.lettre || "") !== at.lettre) return { ok: false };
        if (at.lettre && !egal(rep.valeur, at.valeur)) return { ok: false };
        if (!!rep.discontinue !== at.discontinue) return { ok: false };
        return { ok: !at.discontinue || (egal(rep.n, at.n) && egal(rep.l, at.l) && egal(rep.e, at.e)) };
      case "fourche": return { ok: rep.niveau === at.niveau && rep.procede === at.procede && rep.position === at.position };
      default: return { ok: false };
    }
  }
  /* une réponse fausse voisine de la bonne (pour les tests et les exemples) */
  function alterer(it, rep) {
    const x = JSON.parse(JSON.stringify(rep));
    switch (it.outil) {
      case "palette": x.sym = x.sym === "V" ? "Y" : "V"; break;
      case "palettePosition": x.place = x.place === "dessus" ? "dessous" : "dessus"; break;
      case "supp": x.chantier = !x.chantier; break;
      case "cotes": if (x.lettre === "") { x.lettre = "s"; x.valeur = 4; } else if (x.discontinue) x.e += 10; else x.lettre = x.lettre === "a" ? "z" : "a"; break;
      case "fourche": x.position = x.position === "PB" ? "PA" : "PB"; break;
      default: break;
    }
    return x;
  }
  /* spécification du symbole qu'une réponse dessine (aperçu en direct) */
  function specDeReponse(it, rep) {
    rep = rep || {};
    switch (it.outil) {
      case "palette": return rep.sym && ELEM[rep.sym] ? avecSysteme(ELEM[rep.sym].spec, it.systeme || SYS_A) : Object.assign({ forcerPointilles: true }, it.systeme || SYS_A);
      case "palettePosition": { const s = it.systeme; if (!rep.sym || !rep.place) return Object.assign({ forcerPointilles: true }, s); return specCote(rep.sym, coteDePlace(rep.place, s.systeme, s.pointilles), s); }
      case "supp": return specSupp(it.base, { forme: rep.forme || "", envers: it.base === "V" ? rep.envers || "" : "", toutAutour: !!rep.toutAutour, chantier: !!rep.chantier });
      case "cotes": {
        const c = { sym: it.base };
        if (rep.lettre && Number(rep.valeur) > 0) c[rep.lettre] = Number(rep.valeur);
        if (rep.discontinue && rep.n > 0 && rep.l > 0) { c.n = Number(rep.n); c.l = Number(rep.l); if (rep.e > 0) c.e = Number(rep.e); }
        return { systeme: "A", pointilles: "dessous", fleche: c };
      }
      case "fourche": return specFourche({ q: rep.niveau || "?", p: rep.procede || "?", x: rep.position || "?" });
      default: return { fleche: { sym: "V" } };
    }
  }

  return { NIVEAUX, ELEM, AUTRES, PROC, POS, NIVQ, TRANCHES, rng, generer, serie, examen, verifier, alterer, specDeReponse, coteDePlace, placeDeCote, tolerance, nomSysteme };
});
