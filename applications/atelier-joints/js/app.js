/* Atelier des joints : app.js — l'interface. Le contenu des exercices vient de generateur.js,
   les dessins de coupe.js et symbole.js, la progression de progression.js et leitner.js. */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const NS = "http://www.w3.org/2000/svg";
  const CLES = { prog: "atelier-joints-progression", rev: "atelier-joints-revision", theme: "atelier-joints-theme" };
  const LETTRES = ["A", "B", "C", "D", "E"];

  /* ---------- stockage ---------- */
  let stockageOk = true;
  function lire(k) { try { return localStorage.getItem(k); } catch (e) { stockageOk = false; return null; } }
  function ecrire(k, v) { try { localStorage.setItem(k, v); } catch (e) { stockageOk = false; } }
  let prog = Progression.restaurer(lire(CLES.prog));
  let boites = Leitner.restaurer(lire(CLES.rev));
  function sauver() { ecrire(CLES.prog, JSON.stringify(prog)); ecrire(CLES.rev, JSON.stringify(boites)); avisStockage(); pastille(); }
  function avisStockage() { $("#avis-stockage").hidden = stockageOk; }
  try { localStorage.setItem("atelier-joints-essai", "1"); localStorage.removeItem("atelier-joints-essai"); } catch (e) { stockageOk = false; }

  /* ---------- liens vers les cours ---------- */
  const COURS = {
    "conception-01": { court: "Cours 1", url: "Conception/01-types-joints-preparations.html", fichier: "Cours/Conception/Conception, cours 1 _ types de joints et préparations.html",
      chap: { c1: "Concevoir un assemblage", c2: "La gorge d'un cordon d'angle", c3: "Les chanfreins bout à bout", c4: "Le métal à déposer", c5: "Épaisseurs différentes et profilés", c6: "En T, en croix, en L" } },
    "conception-02": { court: "Cours 2", url: "Conception/02-symboles-tolerances.html", fichier: "Cours/Conception/Conception, cours 2 _ symboles de soudage et tolérances.html",
      chap: { c1: "La grammaire du symbole", c2: "Les symboles élémentaires", c3: "Les symboles supplémentaires", c4: "Coter une soudure", c5: "La fourche", c6: "Les tolérances générales (ISO 13920)" } }
  };
  function lienCours(c) {
    const f = COURS[c.id]; if (!f) return null;
    const meta = document.querySelector('meta[name="wiki-racine"]');
    const base = meta ? meta.content + encodeURI(f.url) : "../../" + encodeURI(f.fichier).replace(/'/g, "%27");
    const a = document.createElement("a");
    a.href = base + "#" + c.ancre; a.target = "_blank"; a.rel = "noopener"; a.className = "lien-cours";
    a.textContent = "Revoir : " + f.court + ", chapitre " + c.ancre.slice(1) + " (" + f.chap[c.ancre] + ")";
    return a;
  }

  /* ---------- petits outils DOM ---------- */
  function h(tag, attrs, enfants) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === "texte") e.textContent = v; else if (k === "html") e.innerHTML = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
    }
    (enfants || []).forEach(c => { if (c) e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return e;
  }
  function svgVide(w, hh, label) { const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 " + w + " " + hh); s.setAttribute("role", "img"); s.setAttribute("aria-label", label || ""); return s; }
  function symbole(spec, w, hh, kmax, label) { const s = svgVide(w, hh, label || Symbole.decrire(spec)); Symbole.tracer(s, spec, Symbole.ajuster(spec, { x: 6, y: 6, w: w - 12, h: hh - 12 }, kmax || 1.6)); return s; }
  function scene(rec) { const sc = Coupe[rec.f].apply(null, JSON.parse(JSON.stringify(rec.a))); sc.manques = []; return sc; }
  function coupe(rec, w, hh, label) { const s = svgVide(w, hh, label || "Coupe du joint"); Coupe.tracer(s, scene(rec), { x: 6, y: 6, w: w - 12, h: hh - 12 }); return s; }
  function coupeFleche(fig, w, hh) {
    const s = svgVide(w, hh, "Coupe du joint ; la flèche du symbole touche " + (fig.joint === "V" ? "la face du dessus" : "l'angle de droite") + " ; métal fondu en bronze");
    const k = { z: 6, s: 0.4 };
    let sc, tip;
    if (fig.joint === "V") {
      const t = 12;
      sc = fig.cote === "deux" ? Coupe.sceneBout("X", { t, alpha: 60, b: 2, c: 2 }) : Coupe.sceneBout("V", { t, alpha: 60, b: 2, c: 1.5 });
      if (fig.cote === "oppose") { const f = P => P.map(q => [q[0], t - q[1]]); sc.plaques = sc.plaques.map(f); sc.cordons = sc.cordons.map(f); }
      sc.boite = [-22, -4, 34, t + 13]; tip = [0, t + 0.3];
    } else {
      sc = Coupe.sceneTe({ t1: 9, t2: 9, H: 20, L: 22, mode: "angle", droite: fig.cote !== "oppose" ? k : null, gauche: fig.cote !== "fleche" ? k : null });
      sc.boite = [-22, -2, 38, 32]; tip = [4.5 + 1.2, 9 + 1.2];
    }
    sc.manques = [];
    const T = Coupe.tracer(s, sc, { x: 6, y: 6, w: w - 12, h: hh - 12 }), p = T.P(tip[0], tip[1]), q = [p[0] + 0.32 * w, p[1] - 0.3 * hh];
    const ux = p[0] - q[0], uy = p[1] - q[1], L = Math.hypot(ux, uy), a = [ux / L, uy / L];
    const ligne = document.createElementNS(NS, "path");
    ligne.setAttribute("d", "M" + q[0] + "," + q[1] + "L" + (p[0] - a[0] * 8) + "," + (p[1] - a[1] * 8) + "M" + (q[0] + 0) + "," + q[1] + "L" + (q[0] + 0.16 * w) + "," + q[1]);
    ligne.style.cssText = "fill:none;stroke:var(--mat);stroke-width:2";
    const tete = document.createElementNS(NS, "path");
    tete.setAttribute("d", "M" + p[0] + "," + p[1] + "L" + (p[0] - a[0] * 11 - a[1] * 4.5) + "," + (p[1] - a[1] * 11 + a[0] * 4.5) + "L" + (p[0] - a[0] * 11 + a[1] * 4.5) + "," + (p[1] - a[1] * 11 - a[0] * 4.5) + "Z");
    tete.style.cssText = "fill:var(--mat);stroke:none";
    s.appendChild(ligne); s.appendChild(tete);
    return s;
  }
  function figure(fig, w, hh, label) {
    if (!fig) return null;
    if (fig.kind === "symbole") return symbole(fig.spec, w, hh, 1.7, label);
    if (fig.kind === "coupe") return coupe(fig.recette, w, hh, label);
    if (fig.kind === "coupeFleche") return coupeFleche(fig, w, hh);
    return null;
  }
  function etoiles(n) {
    const e = h("span", { class: "etoiles", "aria-label": n + " étoile" + (n > 1 ? "s" : "") + " sur 3" });
    for (let i = 0; i < 3; i++) e.appendChild(h("span", { class: i < n ? "" : "vide", "aria-hidden": "true", texte: "★" }));
    return e;
  }
  function annoncer(t) { const a = $("#annonce"); a.textContent = ""; setTimeout(() => { a.textContent = t; }, 30); }
  function pastille() { const n = Leitner.dues(boites, Date.now()).length, p = $("#pastille"); p.hidden = n === 0; p.textContent = n; p.setAttribute("aria-label", n + " à revoir"); }

  /* ---------- état et routes ---------- */
  let ctx = null; /* partie en cours : { genre: "serie"|"revision"|"examen", items, i, reponses, ... } */
  window.Atelier = { etat: () => ctx, prog: () => prog, boites: () => boites };
  function aller(route) { if (location.hash !== "#" + route) history.pushState(null, "", "#" + route); rendre(); }
  function rendre() {
    const r = (location.hash || "#parcours").slice(1);
    document.querySelectorAll(".nav a").forEach(a => a.removeAttribute("aria-current"));
    const m = /^serie-([1-5])-(decoder|coder)$/.exec(r);
    let vue, nav;
    if (m) { vue = demarrerSerie(+m[1], m[2]); nav = "parcours"; }
    else if (r === "revision") { vue = vueRevision(); nav = "revision"; }
    else if (r === "examen") { vue = vueExamen(); nav = "examen"; }
    else if (r === "aide") { vue = vueAide(); nav = "aide"; }
    else { vue = vueParcours(); nav = "parcours"; }
    const a = document.querySelector('.nav a[data-route="' + nav + '"]'); if (a) a.setAttribute("aria-current", "page");
    monter(vue);
  }
  function monter(vue) { const m = $("#contenu"); m.innerHTML = ""; m.appendChild(vue); window.scrollTo(0, 0); }
  const graine = () => Math.floor(Math.random() * 1e9);

  /* ---------- parcours ---------- */
  function vueParcours() {
    ctx = null;
    const e = h("section", { class: "ecran parcours", "aria-labelledby": "titre-parcours" }, [
      h("h1", { id: "titre-parcours", texte: "Atelier des joints" }),
      h("p", { class: "chapeau", texte: "Lis et écris les symboles de soudage de l'ISO 2553, la fourche et les tolérances de l'ISO 13920. Chaque niveau se joue de deux façons : décoder un symbole, ou coder une soudure. Une série de dix questions réussie à 8 sur 10 débloque le niveau suivant ; tes erreurs reviennent en révision." })
    ]);
    const ol = h("ol", { class: "niveaux", "aria-label": "Niveaux" });
    Generateur.NIVEAUX.forEach(n => {
      const ouvert = Progression.debloque(prog, n.n);
      const modes = h("div", { class: "modes" });
      [["decoder", "Décoder"], ["coder", "Coder"]].forEach(([m, nom]) => {
        const st = prog.etoiles[Progression.cle(n.n, m)] || 0;
        modes.appendChild(h("div", { class: "mode" }, [
          h("button", { type: "button", class: "bouton" + (m === "decoder" ? " principal" : ""), disabled: !ouvert, "aria-label": nom + ", niveau " + n.n, onclick: () => aller("serie-" + n.n + "-" + m) }, [nom]),
          etoiles(st)
        ]));
      });
      const lc = lienCours(n.cours);
      ol.appendChild(h("li", { class: "carte niveau" + (ouvert ? "" : " verrou") }, [
        h("div", { class: "niveau-num", "aria-hidden": "true", texte: ouvert ? String(n.n) : "🔒" }),
        h("div", {}, [h("h2", { texte: "Niveau " + n.n + " · " + n.titre }), h("p", { texte: n.description }), ouvert ? lc : h("p", { class: "verrou-texte", texte: "Valide le niveau " + (n.n - 1) + " pour l'ouvrir." })]),
        modes
      ]));
    });
    e.appendChild(ol);
    const dues = Leitner.dues(boites, Date.now()).length, total = Leitner.total(boites), exOuvert = Progression.examenOuvert(prog);
    e.appendChild(h("div", { class: "bas" }, [
      h("div", { class: "carte" }, [h("h2", { texte: "Révision" }),
        h("p", { texte: total ? dues + " carte" + (dues > 1 ? "s" : "") + " à revoir aujourd'hui, " + total + " en boîte, " + boites.maitrisees + " maîtrisée" + (boites.maitrisees > 1 ? "s" : "") + "." : "Aucune erreur à revoir pour l'instant : chaque question manquée viendra ici." }),
        h("div", { class: "boutons" }, [h("button", { type: "button", class: "bouton", disabled: !dues, onclick: () => aller("revision") }, ["Réviser"])])]),
      h("div", { class: "carte" }, [h("h2", { texte: "Examen blanc" }),
        h("p", { texte: exOuvert ? "20 questions, quatre par niveau, environ 20 minutes, sans correction avant la fin." + (prog.examTentatives ? " Meilleur score : " + prog.examMeilleur + " %." : "") : "Il s'ouvre quand les cinq niveaux sont validés en Décoder (ou en accès libre, dans l'aide)." }),
        h("div", { class: "boutons" }, [h("button", { type: "button", class: "bouton", disabled: !exOuvert, onclick: () => aller("examen") }, ["Commencer l'examen"])])])
    ]));
    return e;
  }

  /* ---------- séries, révision, examen : le déroulé commun ---------- */
  function demarrerSerie(n, mode) {
    if (!Progression.debloque(prog, n)) return vueParcours();
    if (!ctx || ctx.genre !== "serie" || ctx.niveau !== n || ctx.mode !== mode || ctx.fini) {
      ctx = { genre: "serie", niveau: n, mode, items: Generateur.serie(n, mode, graine()), i: 0, reponses: [], titre: "Niveau " + n + " · " + (mode === "coder" ? "Coder" : "Décoder") };
    }
    return vueQuestion();
  }
  function vueQuestion() {
    const it = ctx.items[ctx.i], examen = ctx.genre === "examen", N = ctx.items.length;
    const e = h("section", { class: "ecran question", "aria-labelledby": "q-enonce" });
    const barre = h("div", { class: "q-barre", "aria-hidden": "true" }, [h("i", { style: "width:" + Math.round(100 * ctx.i / N) + "%" })]);
    e.appendChild(h("div", { class: "q-tete" }, [
      h("a", { href: examen ? "#parcours" : ctx.genre === "revision" ? "#parcours" : "#parcours", class: "lien-retour", texte: "← Quitter" }),
      h("span", { class: "q-fil", texte: ctx.titre + (examen ? "" : " · " + it.competence) }),
      h("span", { class: "q-compte", texte: "Question " + (ctx.i + 1) + " / " + N }), barre]));
    const gauche = h("div", { class: "q-gauche" }, [h("p", { class: "q-enonce", id: "q-enonce", html: it.enonce })]);
    const fig = figure(it.figure, 420, it.figure && it.figure.kind === "coupeFleche" ? 230 : 170, it.figure && it.figure.kind === "symbole" ? "Symbole à lire : " + Symbole.decrire(it.figure.spec).replace(/\.$/, "") : null);
    if (fig) gauche.appendChild(h("div", { class: "q-figure" }, [fig]));
    const droite = h("div", { class: "q-droite" });
    const retour = h("div", { class: "retour", id: "retour", "aria-live": "polite", hidden: true });
    const actions = h("div", { class: "boutons" });
    e.appendChild(h("div", { class: "q-corps" }, [gauche, droite]));
    let repondu = false;
    function suite() {
      ctx.i += 1;
      if (ctx.i >= ctx.items.length) { ctx.fini = true; monter(ctx.genre === "examen" ? bilanExamen() : bilanSerie()); }
      else monter(vueQuestion());
      const t = $("#contenu h1, #q-enonce"); if (t) { t.setAttribute("tabindex", "-1"); t.focus(); }
    }
    const btSuite = h("button", { type: "button", class: "bouton principal", id: "suivant", hidden: !examen, disabled: examen, onclick: suite }, [examen ? (ctx.i + 1 < N ? "Valider et continuer" : "Valider et terminer") : (ctx.i + 1 < N ? "Question suivante" : "Voir le bilan")]);
    function corriger(rep) {
      if (repondu) return; repondu = true;
      const ok = Generateur.verifier(it, rep).ok;
      ctx.reponses[ctx.i] = { rep, ok };
      if (ctx.genre === "revision") { if (ok) Leitner.reussite(boites, it, Date.now()); else Leitner.erreur(boites, it, Date.now()); sauver(); }
      else if (!ok) { Leitner.erreur(boites, it, Date.now()); sauver(); }
      retour.hidden = false; retour.className = "retour " + (ok ? "juste" : "faux"); retour.innerHTML = "";
      retour.appendChild(h("p", { class: "verdict", texte: ok ? "✔ Juste." : "✘ Pas tout à fait." }));
      if (!ok && it.outil) { retour.appendChild(h("p", { texte: "Réponse attendue :" })); retour.appendChild(symbole(Generateur.specDeReponse(it, it.attendu), 320, 96, 1.4)); }
      retour.appendChild(h("p", { html: it.explication }));
      const lc = lienCours(it.cours); if (lc) retour.appendChild(h("p", {}, [lc]));
      btSuite.hidden = false; btSuite.disabled = false; btSuite.focus();
      annoncer((ok ? "Juste. " : "Pas tout à fait. ") + retour.textContent.slice(0, 200));
    }
    if (!it.outil) {
      const avecFig = it.options.some(o => o.figure);
      const opts = h("div", { class: "options" + (avecFig ? " figures" : ""), role: "group", "aria-label": "Réponses proposées" });
      it.options.forEach((o, k) => {
        const b = h("button", { type: "button", class: "option", "data-k": k, "aria-pressed": examen ? "false" : null }, [h("span", { class: "lettre", "aria-hidden": "true", texte: LETTRES[k] })]);
        if (o.figure) { b.appendChild(figure(o.figure, 240, 110, (o.figure.kind === "symbole" ? "Réponse " + LETTRES[k] + " : " + Symbole.decrire(o.figure.spec) : "Réponse " + LETTRES[k] + " : une coupe"))); }
        else b.appendChild(h("span", { texte: o.texte }));
        b.addEventListener("click", () => {
          if (examen) { opts.querySelectorAll(".option").forEach(x => x.setAttribute("aria-pressed", String(x === b))); ctx.reponses[ctx.i] = { rep: k, ok: k === it.bonne }; btSuite.disabled = false; return; }
          if (repondu) return;
          opts.querySelectorAll(".option").forEach((x, j) => { x.disabled = true; if (j === it.bonne) x.classList.add("juste"); else if (x === b) x.classList.add("faux"); });
          corriger(k);
        });
        opts.appendChild(b);
      });
      droite.appendChild(opts);
      if (examen && ctx.reponses[ctx.i]) { const k = ctx.reponses[ctx.i].rep; opts.children[k].setAttribute("aria-pressed", "true"); btSuite.disabled = false; }
    } else {
      const outil = construireOutil(it);
      droite.appendChild(outil.el);
      actions.appendChild(h("button", { type: "button", class: "bouton principal", id: "valider", onclick: ev => { ev.currentTarget.disabled = true; outil.figer(); corriger(outil.reponse()); } }, ["Valider"]));
    }
    actions.appendChild(btSuite);
    droite.appendChild(retour);
    droite.appendChild(actions);
    return e;
  }

  /* ---------- outils du mode Coder ---------- */
  function segmente(nom, choix, valeur, change) {
    const g = h("div", { class: "groupe" }, [h("span", { texte: nom })]), s = h("div", { class: "segmente", role: "group", "aria-label": nom });
    choix.forEach(([v, t]) => s.appendChild(h("button", { type: "button", "data-v": v, "aria-pressed": String(v === valeur), onclick: ev => { s.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === ev.currentTarget))); change(v); } }, [t])));
    g.appendChild(s); return g;
  }
  function construireOutil(it) {
    const el = h("div", { class: "outil" }), rep = {};
    const apercu = h("div", { class: "apercu" }, [h("span", { texte: "Ton symbole" })]);
    function maj() {
      const v = apercu.querySelector("svg"); if (v) v.remove();
      const sp = Generateur.specDeReponse(it, rep), d = Symbole.decrire(sp);
      apercu.appendChild(symbole(sp, 360, 110, 1.5, "Aperçu : " + (d.length > 2 ? d : "trait de référence, sans symbole")));
    }
    if (it.outil === "palette" || it.outil === "palettePosition") {
      const pal = h("div", { class: "palette", role: "group", "aria-label": "Symboles élémentaires" });
      it.palette.forEach(k => {
        const E = Generateur.ELEM[k], sp = Object.assign({ L: 64, dirFleche: [-12, 12] }, JSON.parse(JSON.stringify(E.spec)));
        const b = h("button", { type: "button", "data-sym": k, "aria-pressed": "false", "aria-label": E.nom, title: E.nom }, [symbole(sp, 100, 56, 1.15, "")]);
        b.addEventListener("click", () => { pal.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); rep.sym = k; maj(); });
        pal.appendChild(b);
      });
      el.appendChild(h("div", { class: "groupe" }, [h("span", { texte: "Symbole élémentaire" }), pal]));
      if (it.outil === "palettePosition") el.appendChild(segmente("Place du symbole", [["dessus", "Au-dessus du trait"], ["dessous", "Au-dessous du trait"], ["deux", "Des deux côtés"]], null, v => { rep.place = v; maj(); }));
    } else if (it.outil === "supp") {
      rep.forme = ""; rep.envers = ""; rep.toutAutour = false; rep.chantier = false;
      el.appendChild(segmente("Forme du cordon", [["", "Libre"], ["plat", "Plate"], ["convexe", "Convexe"], ["concave", "Concave"]], "", v => { rep.forme = v; maj(); }));
      if (it.base === "V") el.appendChild(segmente("Envers", [["", "Rien"], ["reprise", "Reprise à l'envers"], ["surep", "Surépaisseur à la racine"], ["M", "Support M"], ["MR", "Support MR"]], "", v => { rep.envers = v; maj(); }));
      const t = h("div", { class: "segmente", role: "group", "aria-label": "Position" });
      [["toutAutour", "Tout autour"], ["chantier", "Sur chantier"]].forEach(([k, nom]) => t.appendChild(h("button", { type: "button", "data-v": k, "aria-pressed": "false", onclick: ev => { rep[k] = !rep[k]; ev.currentTarget.setAttribute("aria-pressed", String(rep[k])); maj(); } }, [nom])));
      el.appendChild(h("div", { class: "groupe" }, [h("span", { texte: "Position (au coude de la ligne repère)" }), t]));
    } else if (it.outil === "cotes") {
      rep.lettre = ""; rep.valeur = ""; rep.discontinue = false;
      const lettres = it.base === "V" ? [["", "Aucune"], ["s", "s"]] : [["", "Aucune"], ["a", "a"], ["z", "z"], ["s", "s"]];
      el.appendChild(segmente("Cote de section (à gauche)", lettres, "", v => { rep.lettre = v; val.disabled = v === ""; maj(); }));
      const val = h("input", { type: "number", inputmode: "decimal", min: "0", step: "0.5", id: "c-valeur", disabled: true, oninput: ev => { rep.valeur = ev.target.value; maj(); } });
      const fn = (id, nom) => { const i = h("input", { type: "number", inputmode: "numeric", min: "0", step: "1", id, disabled: true, oninput: ev => { rep[nom] = ev.target.value; maj(); } }); return i; };
      const iN = fn("c-n", "n"), iL = fn("c-l", "l"), iE = fn("c-e", "e");
      el.appendChild(h("div", { class: "champs" }, [h("label", { for: "c-valeur" }, ["Valeur (mm)", val])]));
      el.appendChild(segmente("Longueur (à droite)", [["0", "Continue"], ["1", "Discontinue"]], "0", v => { rep.discontinue = v === "1"; [iN, iL, iE].forEach(i => { i.disabled = !rep.discontinue; }); maj(); }));
      el.appendChild(h("div", { class: "champs" }, [h("label", { for: "c-n" }, ["n (cordons)", iN]), h("label", { for: "c-l" }, ["l (mm)", iL]), h("label", { for: "c-e" }, ["(e) intervalle (mm)", iE])]));
    } else if (it.outil === "fourche") {
      const c = it.choixFourche;
      el.appendChild(segmente("Niveau de qualité (ISO 5817)", c.niveau.map(v => [v, v]), null, v => { rep.niveau = v; maj(); }));
      el.appendChild(segmente("Procédé (ISO 4063)", c.procede.map(v => [v, v]), null, v => { rep.procede = v; maj(); }));
      el.appendChild(segmente("Position (ISO 6947)", c.position.map(v => [v, v]), null, v => { rep.position = v; maj(); }));
    }
    el.appendChild(apercu); maj();
    return { el, reponse: () => JSON.parse(JSON.stringify(rep, (k, v) => (k === "valeur" || k === "n" || k === "l" || k === "e") && v !== "" ? Number(v) : v)), figer: () => el.querySelectorAll("button,input").forEach(x => { x.disabled = true; }) };
  }

  /* ---------- bilans ---------- */
  function recap(items, reponses) {
    const ul = h("ul", { class: "recap" });
    items.forEach((it, k) => {
      const r = reponses[k], ok = r && r.ok;
      const li = h("li", { class: ok ? "juste" : "faux" }, [h("p", { class: "rq", html: (ok ? "✔ " : "✘ ") + (k + 1) + ". " + it.enonce.replace(/<table[\s\S]*<\/table>/, "") })]);
      if (!ok) {
        const fq = figure(it.figure, 300, it.figure && it.figure.kind === "coupeFleche" ? 160 : 100);
        if (fq) li.appendChild(h("div", { class: "recap-fig" }, [fq]));
        if (!it.outil && it.options[it.bonne].texte) li.appendChild(h("p", { texte: "Bonne réponse : " + it.options[it.bonne].texte }));
        else if (!it.outil) { li.appendChild(h("p", { texte: "Bonne réponse : la proposition " + LETTRES[it.bonne] + " :" })); const fb = figure(it.options[it.bonne].figure, 300, 110); if (fb) li.appendChild(h("div", { class: "recap-fig" }, [fb])); }
        else { li.appendChild(h("p", { texte: "Réponse attendue :" })); li.appendChild(symbole(Generateur.specDeReponse(it, it.attendu), 320, 96, 1.4)); }
        li.appendChild(h("p", { html: it.explication }));
        const lc = lienCours(it.cours); if (lc) li.appendChild(h("p", {}, [lc]));
      }
      ul.appendChild(li);
    });
    return ul;
  }
  function bilanSerie() {
    const bons = ctx.reponses.filter(r => r && r.ok).length, N = ctx.items.length;
    let message;
    if (ctx.genre === "revision") {
      message = bons + " réussite" + (bons > 1 ? "s" : "") + " : ces cartes montent d'une boîte. Les autres reviennent en boîte 1.";
    } else {
      const avant = Progression.debloque(prog, ctx.niveau + 1), st = Progression.noter(prog, ctx.niveau, ctx.mode, bons); sauver();
      const apres = ctx.niveau < 5 && Progression.debloque(prog, ctx.niveau + 1);
      message = st ? "Série validée : " + st + " étoile" + (st > 1 ? "s" : "") + "." + (apres && !avant ? " Le niveau " + (ctx.niveau + 1) + " est débloqué !" : "") : "Il faut 8 bonnes réponses sur 10 pour valider la série. Les questions manquées partent en révision.";
    }
    const e = h("section", { class: "ecran bilan", "aria-labelledby": "titre-bilan" }, [
      h("h1", { id: "titre-bilan", texte: ctx.genre === "revision" ? "Bilan de la révision" : "Bilan · " + ctx.titre }),
      h("p", { class: "score", texte: bons + " / " + N }),
      ctx.genre === "revision" ? null : etoiles(Progression.etoiles(bons)),
      h("p", { texte: message })
    ]);
    const bt = h("div", { class: "boutons" });
    if (ctx.genre === "serie") {
      const n = ctx.niveau, m = ctx.mode;
      bt.appendChild(h("button", { type: "button", class: "bouton principal", onclick: () => { ctx = null; rendre(); } }, ["Rejouer une série"]));
      if (n < 5 && Progression.debloque(prog, n + 1)) bt.appendChild(h("button", { type: "button", class: "bouton", onclick: () => aller("serie-" + (n + 1) + "-" + m) }, ["Niveau " + (n + 1)]));
    } else if (Leitner.dues(boites, Date.now()).length) bt.appendChild(h("button", { type: "button", class: "bouton principal", onclick: () => { ctx = null; rendre(); } }, ["Continuer la révision"]));
    bt.appendChild(h("a", { href: "#parcours", class: "bouton" }, ["Retour au parcours"]));
    e.appendChild(bt);
    e.appendChild(recap(ctx.items, ctx.reponses));
    annoncer("Bilan : " + bons + " sur " + N + ". " + message);
    return e;
  }

  /* ---------- révision ---------- */
  function vueRevision() {
    const dues = Leitner.dues(boites, Date.now(), 10);
    if (ctx && ctx.genre === "revision" && !ctx.fini) return vueQuestion();
    const n = Leitner.compter(boites);
    const e = h("section", { class: "ecran revision", "aria-labelledby": "titre-revision" }, [
      h("h1", { id: "titre-revision", texte: "Révision espacée" }),
      h("p", { class: "chapeau", texte: "Chaque question manquée devient une carte. Une carte juste monte d'une boîte et revient plus tard : boîte 1 aujourd'hui, puis 1, 3, 7 et 14 jours. Une erreur la renvoie en boîte 1. Réussie en boîte 5, elle est maîtrisée." }),
      h("div", { class: "boites", role: "list", "aria-label": "Cartes par boîte" }, n.map((v, k) => h("div", { class: "boite", role: "listitem" }, [h("b", { texte: String(v) }), h("small", { texte: "boîte " + (k + 1) })])))
    ]);
    e.appendChild(h("p", { texte: dues.length ? dues.length + " carte" + (dues.length > 1 ? "s" : "") + " à revoir maintenant." : (Leitner.total(boites) ? "Rien à revoir pour l'instant : reviens demain." : "Aucune carte : joue une série du parcours pour en créer.") + " " + boites.maitrisees + " carte" + (boites.maitrisees > 1 ? "s" : "") + " maîtrisée" + (boites.maitrisees > 1 ? "s" : "") + "." }));
    e.appendChild(h("div", { class: "boutons" }, [h("button", { type: "button", class: "bouton principal", disabled: !dues.length, onclick: () => {
      ctx = { genre: "revision", items: dues.map(c => Generateur.generer(c.niveau, c.mode, c.graine)), i: 0, reponses: [], titre: "Révision" }; monter(vueQuestion());
    } }, ["Commencer la révision"]), h("a", { href: "#parcours", class: "bouton" }, ["Retour au parcours"])]));
    ctx = null;
    return e;
  }

  /* ---------- examen ---------- */
  function vueExamen() {
    if (ctx && ctx.genre === "examen" && !ctx.fini) return vueQuestion();
    ctx = null;
    const ouvert = Progression.examenOuvert(prog);
    return h("section", { class: "ecran examen", "aria-labelledby": "titre-examen" }, [
      h("h1", { id: "titre-examen", texte: "Examen blanc" }),
      h("p", { class: "chapeau", texte: "Vingt questions tirées des cinq niveaux, quatre par niveau, en mode Décoder. Compte environ vingt minutes, sans montre qui coupe. Pas de correction avant la fin : tu peux changer ta réponse tant que tu n'as pas validé. Le bilan donne ton score par compétence, et tes erreurs partent en révision." }),
      ouvert ? null : h("p", { class: "avis", texte: "L'examen s'ouvre quand les cinq niveaux sont validés en Décoder. Tu peux aussi activer l'accès libre dans l'aide." }),
      prog.examTentatives ? h("p", { texte: "Meilleur score : " + prog.examMeilleur + " % (" + prog.examTentatives + " tentative" + (prog.examTentatives > 1 ? "s" : "") + ")." }) : null,
      h("div", { class: "boutons" }, [h("button", { type: "button", class: "bouton principal", disabled: !ouvert, onclick: () => {
        ctx = { genre: "examen", items: Generateur.examen(graine()), i: 0, reponses: [], titre: "Examen blanc" }; monter(vueQuestion());
      } }, ["Commencer l'examen"]), h("a", { href: "#parcours", class: "bouton" }, ["Retour au parcours"])])
    ]);
  }
  function bilanExamen() {
    const N = ctx.items.length, bons = ctx.reponses.filter(r => r && r.ok).length, pc = Math.round(100 * bons / N);
    Progression.noterExamen(prog, pc);
    ctx.items.forEach((it, k) => { if (!(ctx.reponses[k] && ctx.reponses[k].ok)) Leitner.erreur(boites, it, Date.now()); });
    sauver();
    const comp = h("div", { class: "competences" });
    Generateur.NIVEAUX.forEach(n => {
      const idx = ctx.items.map((it, k) => [it, k]).filter(([it]) => it.niveau === n.n), ok = idx.filter(([, k]) => ctx.reponses[k] && ctx.reponses[k].ok).length;
      comp.appendChild(h("div", { class: "competence" }, [h("span", { texte: n.n + ". " + n.titre }), h("div", { class: "jauge", "aria-hidden": "true" }, [h("i", { style: "width:" + Math.round(100 * ok / idx.length) + "%" })]), h("b", { texte: ok + " / " + idx.length })]));
    });
    const e = h("section", { class: "ecran bilan", "aria-labelledby": "titre-bilan" }, [
      h("h1", { id: "titre-bilan", texte: "Bilan de l'examen blanc" }),
      h("p", { class: "score", texte: pc + " %" }),
      h("p", { texte: bons + " bonnes réponses sur " + N + ". " + (pc >= 80 ? "Tu lis les plans sans hésiter : continue la révision pour le garder." : pc >= 60 ? "C'est en bonne voie : reprends les compétences les plus faibles." : "Reprends les niveaux les plus faibles, puis repasse l'examen.") + " Meilleur score : " + prog.examMeilleur + " %." }),
      comp,
      h("div", { class: "boutons" }, [h("a", { href: "#revision", class: "bouton principal" }, ["Réviser mes erreurs"]), h("a", { href: "#parcours", class: "bouton" }, ["Retour au parcours"])]),
      recap(ctx.items, ctx.reponses)
    ]);
    annoncer("Examen terminé : " + pc + " pour cent.");
    return e;
  }

  /* ---------- aide ---------- */
  function vueAide() {
    ctx = null;
    let confirmer = false;
    const raz = h("button", { type: "button", class: "bouton", id: "effacer", onclick: () => {
      if (!confirmer) { confirmer = true; raz.textContent = "Confirmer : tout effacer"; return; }
      prog = Progression.neuf(); boites = Leitner.neuf(); sauver(); raz.textContent = "Progression effacée"; raz.disabled = true; annoncer("Progression effacée.");
    } }, ["Effacer ma progression"]);
    const libre = h("button", { type: "button", class: "bouton", id: "acces-libre", "aria-pressed": String(!!prog.libre), onclick: () => {
      prog.libre = !prog.libre; sauver(); libre.setAttribute("aria-pressed", String(prog.libre)); libre.textContent = prog.libre ? "Accès libre activé" : "Activer l'accès libre"; annoncer(prog.libre ? "Tous les niveaux et l'examen sont ouverts." : "Accès libre désactivé.");
    } }, [prog.libre ? "Accès libre activé" : "Activer l'accès libre"]);
    return h("section", { class: "ecran aide", "aria-labelledby": "titre-aide" }, [
      h("h1", { id: "titre-aide", texte: "Mode d'emploi" }),
      h("h2", { texte: "Jouer" }),
      h("ul", {}, [
        h("li", { texte: "Décoder : un symbole, une coupe ou une fourche à lire ; choisis la bonne réponse, la correction s'affiche aussitôt." }),
        h("li", { texte: "Coder : compose le symbole ou ses cotes avec l'outil proposé ; l'aperçu se dessine en direct, puis valide." }),
        h("li", { texte: "Une série compte dix questions. À 8 sur 10, elle rapporte une étoile, à 9 deux, à 10 trois, et débloque le niveau suivant." }),
        h("li", { texte: "Au clavier : Tab pour passer d'une réponse à l'autre, Entrée pour choisir ; les touches 1 à 4 choisissent directement une réponse." })
      ]),
      h("h2", { texte: "Les conventions" }),
      h("ul", {}, [
        h("li", { texte: "Les symboles suivent l'ISO 2553:2019. Sauf mention contraire, ils sont en système A, avec le trait discontinu dessous." }),
        h("li", { texte: "Une question en système B se reconnaît à son trait unique : dessous veut dire côté flèche, dessus côté opposé." }),
        h("li", { texte: "Les tolérances viennent de l'ISO 13920:2023 ; l'énoncé donne l'extrait du tableau utile, comme à l'examen." })
      ]),
      h("h2", { texte: "Sources" }),
      h("p", { texte: "ISO 2553:2019 (représentation symbolique), ISO 13920:2023 (tolérances générales), ISO 4063:2023 (procédés), ISO 5817:2023 (niveaux de qualité), ISO 6947:2020 (positions), ISO 9692-1:2013 (préparations), ISO 17659:2004 (terminologie). Les exercices sont des cas d'école ; la norme, le plan et le DMOS font foi." }),
      h("div", { class: "carte" }, [h("h2", { texte: "Tes données" }),
        h("p", { texte: "Ta progression et tes cartes de révision restent dans ce navigateur : pas de compte, pas d'envoi." }),
        h("p", { texte: "L'accès libre ouvre tous les niveaux et l'examen, pour réviser dans l'ordre que tu veux." }),
        h("div", { class: "boutons" }, [libre, raz])])
    ]);
  }

  /* ---------- démarrage ---------- */
  document.addEventListener("keydown", ev => {
    if (!ctx || ev.target.closest && ev.target.closest("input")) return;
    const k = "1234".indexOf(ev.key);
    if (k >= 0) { const o = document.querySelectorAll(".options .option")[k]; if (o && !o.disabled) { o.click(); ev.preventDefault(); } }
  });
  $("#bouton-theme").addEventListener("click", () => {
    const sombre = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches;
    const t = sombre ? "light" : "dark"; document.documentElement.dataset.theme = t; ecrire(CLES.theme, t);
  });
  window.addEventListener("hashchange", rendre);
  window.addEventListener("popstate", rendre);
  /* Typographie française : espace insécable avant ; : ! ? » et après «, quel que soit le texte affiché
     (énoncés, corrections, bilans). Les nœuds ajoutés sont corrigés à leur insertion. */
  const TYPO = /(\S) ([;:!?»])|(«) /g;
  function typo(racine) {
    const w = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = n.data.replace(TYPO, (m, a, b, c) => c ? c + " " : a + " " + b);
      if (t !== n.data) n.data = t;
    }
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => typo(n.nodeType === 1 ? n : n.parentNode))))
    .observe($("#contenu"), { childList: true, subtree: true });
  typo($("#avis-stockage"));
  avisStockage(); pastille(); rendre();
})();
