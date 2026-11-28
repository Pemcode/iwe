/* Atelier des joints : symbole.js
   Symboles de soudage selon l'ISO 2553:2019, systèmes A et B : géométrie (primitives), tracé SVG et lecture en français.
   Repère : pixels SVG (y vers le bas) ; origine à la jonction de la ligne repère et du trait de référence, qui part vers la droite.
   Module UMD : window.Symbole dans le navigateur, require() sous Node (primitives et lecture testables sans navigateur).
   Le même code est recopié dans les manipulations des cours de la matière Conception (pages autonomes).

   Une soudure se décrit par un objet :
   { systeme: "A" | "B", pointilles: "dessous" | "dessus" (système A),
     fleche: côté ligne repère, oppose: côté opposé, interface: soudure à l'interface (points, molette par résistance),
     toutAutour, chantier, alterne, entre: ["A", "B"], brisee, queue: { infos: [...], fermee: "A1" },
     forcerPointilles : trace le trait discontinu même sans symbole (aperçu vide d'un exercice),
     L: longueur du trait, h: hauteur des symboles, dirFleche: [dx, dy] }
   Un côté : { sym, a, z, z2, s, h, d, c, b, alpha, n, l, e, forme: "plat" | "convexe" | "concave",
     envers: "reprise" | "surep" | "support" | "M" | "MR" | "insert" } */
(function (racine, fabrique) {
  if (typeof module === "object" && module.exports) module.exports = fabrique();
  else racine.Symbole = fabrique();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const NOMS = {
    I: "soudure bout à bout à bords droits", V: "soudure bout à bout en V", Y: "soudure bout à bout en Y",
    demiV: "soudure bout à bout en demi-V", demiY: "soudure bout à bout en demi-Y", U: "soudure bout à bout en U",
    J: "soudure bout à bout en J (demi-U)", Vf: "soudure bout à bout en V à flancs droits", demiVf: "soudure bout à bout en demi-V à flancs droits",
    evV: "soudure en V à bords évasés", evDemiV: "soudure en demi-V à bord évasé", angle: "soudure d'angle",
    bouchon: "soudure en bouchon", pointF: "soudure par points par fusion", moletteF: "soudure à la molette par fusion",
    goujon: "soudure de goujons", recharge: "soudure de rechargement", chant: "soudure sur chant", releves: "soudure bout à bout à bords relevés",
    pointR: "soudure par points par résistance", moletteR: "soudure à la molette par résistance", qualite: "soudure bout à bout définie par son niveau de qualité"
  };
  const BOUT = ["I", "V", "Y", "demiV", "demiY", "U", "J", "Vf", "demiVf", "evV", "evDemiV", "releves", "qualite"];
  const INTERFACE = ["pointR", "moletteR"];
  const COMBINES = { "V+V": "soudure bout à bout en X (double V)", "demiV+demiV": "soudure bout à bout en K", "U+U": "soudure bout à bout en double U",
    "J+J": "soudure bout à bout en double J", "Y+Y": "soudure bout à bout en double Y", "I+I": "soudure bout à bout à bords droits des deux côtés" };

  /* ---------- géométrie d'un symbole élémentaire ----------
     Coordonnées locales (u horizontal, v perpendiculaire au trait, positif vers l'extérieur du trait). */
  function arcPts(cx, cy, r, t0, t1, n) {
    const P = []; n = n || 10;
    for (let i = 0; i <= n; i++) { const t = (t0 + (t1 - t0) * i / n) * Math.PI / 180; P.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    return P;
  }
  function elementaire(sym, h) {
    const L = [], P = [], C = [], F = []; /* lignes ouvertes, polygones fermés, cercles, formes pleines */
    const q = 0.3 * h;
    switch (sym) {
      case "I": L.push([[-3, 0], [-3, h]], [[3, 0], [3, h]]); break;
      case "V": L.push([[-0.75 * h, h], [0, 0], [0.75 * h, h]]); break;
      case "Y": L.push([[0, 0], [0, 0.4 * h]], [[-0.6 * h, h], [0, 0.4 * h], [0.6 * h, h]]); break;
      case "demiV": L.push([[-q, h], [-q, 0], [0.5 * h, h]]); break;
      case "demiY": L.push([[-q, 0], [-q, h]], [[-q, 0.4 * h], [0.45 * h, h]]); break;
      case "U": { const r = 0.42 * h, cy = 0.32 * h + r;
        L.push([[0, 0], [0, 0.32 * h]], [[-r, h]].concat(arcPts(0, cy, r, 180, 360, 12)).concat([[r, h]])); break; }
      case "J": { const r = 0.5 * h, cy = 0.32 * h + r;
        L.push([[-q, 0], [-q, h]], arcPts(-q, cy, r, 270, 360, 8).concat([[-q + r, h]])); break; }
      case "Vf": L.push([[-0.12 * h, 0], [-0.3 * h, h]], [[0.12 * h, 0], [0.3 * h, h]]); break;
      case "demiVf": L.push([[-q, 0], [-q, h]], [[-0.05 * h, 0], [0.12 * h, h]]); break;
      case "evV": { const r = 0.85 * h; L.push(arcPts(-r, 0, r, 0, 90, 10), arcPts(r, 0, r, 180, 90, 10)); break; }
      case "evDemiV": { const r = 0.85 * h; L.push([[-q, 0], [-q, h]], arcPts(-q + r, 0, r, 180, 90, 10)); break; }
      case "angle": P.push([[-0.4 * h, 0], [-0.4 * h, h], [0.6 * h, 0]]); break;
      case "bouchon": L.push([[-0.6 * h, 0], [-0.6 * h, 0.75 * h], [0.6 * h, 0.75 * h], [0.6 * h, 0]]); break;
      case "pointF": C.push([0, 0.45 * h, 0.45 * h]); break;
      case "moletteF": C.push([0, 0.45 * h, 0.45 * h]); L.push([[-0.75 * h, 0.27 * h], [0.75 * h, 0.27 * h]], [[-0.75 * h, 0.63 * h], [0.75 * h, 0.63 * h]]); break;
      case "goujon": { const r = 0.45 * h, k = r * 0.7071; C.push([0, r, r]); L.push([[-k, r - k], [k, r + k]], [[-k, r + k], [k, r - k]]); break; }
      case "recharge": L.push(arcPts(-0.35 * h, 0, 0.35 * h, 180, 0, 10), arcPts(0.35 * h, 0, 0.35 * h, 180, 0, 10)); break;
      case "chant": L.push([[-0.6 * h, 0], [-0.6 * h, 0.75 * h], [0.6 * h, 0.75 * h], [0.6 * h, 0]], [[0, 0], [0, 0.75 * h]]); break;
      case "releves": { const w = 0.8 * h, P1 = [], P2 = [];
        for (let i = 0; i <= 10; i++) { const t = i / 10, x = -w + w * 0.9 * (1 - Math.pow(1 - t, 2)), y = h * 0.9 * t * t; P1.push([x, y]); P2.push([-x, y]); }
        L.push([[0, 0], [0, h]], P1, P2); break; }
      case "qualite": P.push([[-0.5 * h, 0], [0.5 * h, 0], [0.5 * h, h], [-0.5 * h, h]]); L.push([[-0.5 * h, 0], [0.5 * h, h]], [[0.5 * h, 0], [-0.5 * h, h]]); break;
      default: break;
    }
    return { L, P, C, F };
  }
  /* demi-largeur et hauteur utiles d'un symbole (pour placer cotes et symboles supplémentaires) */
  function emprise(sym, h) {
    const W = { I: 0.45, V: 0.8, Y: 0.65, demiV: 0.55, demiY: 0.5, U: 0.5, J: 0.55, Vf: 0.35, demiVf: 0.35, evV: 0.9, evDemiV: 0.6,
      angle: 0.62, bouchon: 0.62, pointF: 0.5, moletteF: 0.78, goujon: 0.5, recharge: 0.72, chant: 0.62, releves: 0.85, qualite: 0.55, pointR: 0.5, moletteR: 0.78 };
    return { w: (W[sym] || 0.6) * h, h: ["bouchon", "chant"].indexOf(sym) >= 0 ? 0.75 * h : ["pointF", "goujon", "moletteF"].indexOf(sym) >= 0 ? 0.9 * h : h };
  }

  /* ---------- textes des cotes ---------- */
  const nb = v => String(v).replace(".", ",");
  function coteGauche(c) {
    const p = [];
    if (c.h !== undefined) p.push("h" + nb(c.h));
    if (c.s !== undefined) p.push("s" + nb(c.s));
    if (c.a !== undefined) p.push("a" + nb(c.a));
    if (c.z !== undefined) p.push("z" + nb(c.z) + (c.z2 !== undefined ? " z" + nb(c.z2) : ""));
    if (c.d !== undefined) p.push("d" + nb(c.d));
    if (c.c !== undefined) p.push("c" + nb(c.c));
    return p.join(" ");
  }
  function coteDroite(c, alterne) {
    if (c.n !== undefined && c.l !== undefined) return { avant: nb(c.n) + " × " + nb(c.l), apres: c.e !== undefined ? "(" + nb(c.e) + ")" : "" };
    if (c.n !== undefined) return { avant: nb(c.n), apres: c.e !== undefined ? "(" + nb(c.e) + ")" : "" };
    if (c.l !== undefined) return { avant: nb(c.l), apres: "" };
    return { avant: "", apres: "" };
  }
  const largeurTexte = (t, fs) => t.length * fs * 0.56;

  /* ---------- primitives du symbole complet ---------- */
  function memeCote(a, b) {
    if (!a || !b) return false;
    const k = ["sym", "a", "z", "z2", "s", "h", "d", "c", "b", "alpha", "n", "l", "e", "forme", "envers"];
    const miroir = { V: "V", I: "I", U: "U", Y: "Y", demiV: "demiV", J: "J", angle: "angle", qualite: "qualite" };
    return miroir[a.sym] !== undefined && k.every(x => a[x] === b[x]);
  }
  function primitives(spec) {
    const sp = Object.assign({ systeme: "A", pointilles: "dessous", L: 130, h: 15, fs: 12.5, dirFleche: [-34, 30] }, spec || {});
    const h = sp.h, fs = sp.fs, out = { lignes: [], polys: [], cercles: [], pleins: [], textes: [], pointilles: null, fleche: null };
    const symetrique = memeCote(sp.fleche, sp.oppose);
    const iface = sp.interface && INTERFACE.indexOf(sp.interface.sym) >= 0;
    const dA = 4.5 * (sp.pointilles === "dessus" ? -1 : 1);
    const avecPointilles = sp.systeme === "A" && (sp.forcerPointilles || (!symetrique && !iface && (sp.fleche || sp.oppose)));
    const x0 = sp.L * 0.42;
    /* trait de référence, ligne d'identification, ligne repère */
    out.lignes.push({ p: [[0, 0], [sp.L, 0]], r: "trait" });
    if (avecPointilles) out.pointilles = { p: [[0, dA], [sp.L, dA]], r: "identification" };
    const fx = sp.dirFleche[0], fy = sp.dirFleche[1];
    const pts = sp.brisee ? [[0, 0], [fx * 0.55, fy * 0.55], [fx * 0.55 - 10, fy]] : [[0, 0], [fx, fy]];
    out.lignes.push({ p: pts, r: "repere" });
    const a = pts[pts.length - 2], b = pts[pts.length - 1], Lf = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / Lf, uy = (b[1] - a[1]) / Lf;
    out.fleche = [b, [b[0] - 9 * ux - 3.5 * uy, b[1] - 9 * uy + 3.5 * ux], [b[0] - 9 * ux + 3.5 * uy, b[1] - 9 * uy - 3.5 * ux]];
    /* base et sens de chaque côté */
    function placement(cote) {
      if (sp.systeme === "B") return cote === "fleche" ? { yb: 0, s: 1 } : { yb: 0, s: -1 };
      if (symetrique || !avecPointilles) return cote === "fleche" ? { yb: 0, s: -1 } : { yb: 0, s: 1 };
      const haut = dA > 0;
      if (cote === "fleche") return { yb: 0, s: haut ? -1 : 1 };
      return { yb: dA, s: haut ? 1 : -1 };
    }
    function dessiner(c, yb, s, centre) {
      const g = elementaire(c.sym, h), T = (q) => [x0 + q[0], yb + s * q[1]];
      g.L.forEach(l => out.lignes.push({ p: l.map(T), r: "symbole" }));
      g.P.forEach(l => out.polys.push({ p: l.map(T), r: "symbole" }));
      g.C.forEach(k => out.cercles.push({ c: T([k[0], k[1]]), r: k[2], role: "symbole" }));
      const E = emprise(c.sym, h);
      /* symbole supplémentaire de forme */
      if (c.forme) {
        let base, nrm;
        if (c.sym === "angle") { base = [[-0.4 * h, h], [0.6 * h, 0]]; nrm = [0.7071, 0.7071]; }
        else { base = [[-0.7 * h, E.h], [0.7 * h, E.h]]; nrm = [0, 1]; }
        const o = 4, A = [base[0][0] + o * nrm[0], base[0][1] + o * nrm[1]], B = [base[1][0] + o * nrm[0], base[1][1] + o * nrm[1]];
        const sg = c.forme === "convexe" ? 1 : c.forme === "concave" ? -1 : 0, Q = [];
        for (let i = 0; i <= 12; i++) { const t = i / 12, k = sg * 4 * t * (1 - t) * 4; Q.push([A[0] + (B[0] - A[0]) * t + k * nrm[0], A[1] + (B[1] - A[1]) * t + k * nrm[1]]); }
        out.lignes.push({ p: Q.map(T), r: "forme" });
      }
      /* symboles supplémentaires côté envers : ils désignent l'autre côté de l'assemblage, donc la place du côté opposé */
      if (c.envers) {
        const po = placement(centre === "fleche" ? "oppose" : "fleche"), Tm = (q) => [x0 + q[0], po.yb + po.s * q[1]], r = 0.42 * h;
        if (c.envers === "reprise" || c.envers === "surep") {
          const arc = arcPts(0, 0, r, 0, 180, 12);
          if (c.envers === "surep") out.pleins.push({ p: arc.map(Tm), r: "envers" }); else out.lignes.push({ p: arc.map(Tm), r: "envers" });
        } else if (c.envers === "insert") out.polys.push({ p: [[-0.25 * h, 0], [0.25 * h, 0], [0.25 * h, 0.5 * h], [-0.25 * h, 0.5 * h]].map(Tm), r: "envers" });
        else {
          out.polys.push({ p: [[-0.7 * h, 0], [0.7 * h, 0], [0.7 * h, 0.62 * h], [-0.7 * h, 0.62 * h]].map(Tm), r: "envers" });
          if (c.envers === "M" || c.envers === "MR") out.textes.push({ x: x0, y: po.yb + po.s * 0.31 * h + 4, t: c.envers, ancre: "middle", taille: fs * 0.82, r: "envers" });
        }
      }
      /* cotes : section à gauche, longueur à droite, angle à l'extérieur, écartement dans le symbole */
      const yt = yb + s * (E.h / 2) + 4.2;
      const g1 = coteGauche(c);
      if (g1) out.textes.push({ x: x0 - E.w - 4, y: yt, t: g1, ancre: "end", taille: fs, r: "gauche" });
      const d1 = coteDroite(c);
      let xd = x0 + E.w + 4;
      if (d1.avant) { out.textes.push({ x: xd, y: yt, t: d1.avant, ancre: "start", taille: fs, r: "droite" }); xd += largeurTexte(d1.avant, fs) + 3; }
      if (sp.alterne && centre === "fleche") out.zX = xd + 5;
      if (sp.alterne) xd += 14;
      if (d1.apres) out.textes.push({ x: xd, y: yt, t: d1.apres, ancre: "start", taille: fs, r: "droite" });
      if (c.alpha !== undefined) out.textes.push({ x: x0, y: yb + s * (E.h + (c.forme ? 9 : 4)) + (s < 0 ? -1 : 10), t: nb(c.alpha) + "°", ancre: "middle", taille: fs * 0.9, r: "angle" });
      if (c.b !== undefined) out.textes.push({ x: x0, y: yb + s * (E.h * 0.62) + 4, t: nb(c.b), ancre: "middle", taille: fs * 0.72, r: "b" });
    }
    if (sp.fleche) { const p = placement("fleche"); dessiner(sp.fleche, p.yb, p.s, "fleche"); }
    if (sp.oppose) { const p = placement("oppose"); dessiner(sp.oppose, p.yb, p.s, "oppose"); }
    if (sp.interface) {
      const c = sp.interface, r = 0.45 * h;
      out.cercles.push({ c: [x0, 0], r, role: "symbole" });
      if (c.sym === "moletteR") out.lignes.push({ p: [[x0 - 0.75 * h, -0.18 * h], [x0 + 0.75 * h, -0.18 * h]], r: "symbole" }, { p: [[x0 - 0.75 * h, 0.18 * h], [x0 + 0.75 * h, 0.18 * h]], r: "symbole" });
      const g1 = coteGauche(c), d1 = coteDroite(c);
      if (g1) out.textes.push({ x: x0 - 0.8 * h - 4, y: -4, t: g1, ancre: "end", taille: fs, r: "gauche" });
      if (d1.avant || d1.apres) out.textes.push({ x: x0 + 0.8 * h + 4, y: -4, t: (d1.avant + " " + d1.apres).trim(), ancre: "start", taille: fs, r: "droite" });
    }
    if (sp.alterne) { const xz = out.zX || x0 + 2 * h; out.lignes.push({ p: [[xz - 5, -0.8 * h], [xz + 5, -0.8 * h], [xz - 5, 0.8 * h + (avecPointilles ? dA : 0)], [xz + 5, 0.8 * h + (avecPointilles ? dA : 0)]], r: "alterne" }); }
    /* le trait s'allonge pour que les cotes de droite ne débordent pas sur la fourche */
    const finTextes = Math.max(0, ...out.textes.filter(t => t.r === "droite").map(t => t.x + largeurTexte(t.t, t.taille || fs)));
    if (finTextes + 8 > sp.L) {
      sp.L = finTextes + 8;
      out.lignes[0].p[1][0] = sp.L;
      if (out.pointilles) out.pointilles.p[1][0] = sp.L;
    }
    if (sp.toutAutour) out.cercles.push({ c: [0, 0], r: 5, role: "toutAutour" });
    if (sp.chantier) { out.lignes.push({ p: [[0, 0], [0, -20]], r: "chantier" }); out.pleins.push({ p: [[0, -20], [11, -16.5], [0, -13]], r: "chantier" }); }
    if (sp.entre) out.textes.push({ x: sp.L - 6, y: -5, t: sp.entre[0] + " ↔ " + sp.entre[1], ancre: "end", taille: fs, r: "entre" });
    if (sp.queue) {
      const L = sp.L;
      out.lignes.push({ p: [[L + 9, -7], [L, 0], [L + 9, 7]], r: "fourche" });
      const t = sp.queue.fermee ? sp.queue.fermee : (sp.queue.infos || []).join(" / ");
      if (t) {
        out.textes.push({ x: L + 13, y: 4.3, t, ancre: "start", taille: fs * 0.92, r: "queue" });
        if (sp.queue.fermee) { const w = largeurTexte(t, fs * 0.92) + 8; out.polys.push({ p: [[L + 9, -8.5], [L + 9 + w, -8.5], [L + 9 + w, 8.5], [L + 9, 8.5]], r: "fourche" }); }
      }
    }
    out.symetrique = symetrique; out.avecPointilles = !!avecPointilles; out.x0 = x0; out.L = sp.L; out.dA = dA;
    out.boite = boite(out, fs);
    return out;
  }
  function boite(o, fs) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    o.lignes.concat(o.polys, o.pleins, o.pointilles ? [o.pointilles] : []).forEach(l => l.p.forEach(q => add(q[0], q[1])));
    o.cercles.forEach(c => { add(c.c[0] - c.r, c.c[1] - c.r); add(c.c[0] + c.r, c.c[1] + c.r); });
    if (o.fleche) o.fleche.forEach(q => add(q[0], q[1]));
    o.textes.forEach(t => { const w = largeurTexte(t.t, t.taille || fs), xa = t.ancre === "end" ? t.x - w : t.ancre === "middle" ? t.x - w / 2 : t.x; add(xa, t.y - 10); add(xa + w, t.y + 3); });
    return [x0, y0, x1, y1];
  }

  /* ---------- tracé ---------- */
  const STY = { trait: "stroke:var(--mat);stroke-width:1.6", repere: "stroke:var(--mat);stroke-width:1.4", symbole: "stroke:var(--ink);stroke-width:1.6",
    forme: "stroke:var(--ink);stroke-width:1.4", envers: "stroke:var(--ink);stroke-width:1.4", alterne: "stroke:var(--ink);stroke-width:1.4",
    chantier: "stroke:var(--ink);stroke-width:1.4", fourche: "stroke:var(--mat);stroke-width:1.4" };
  const f1 = v => (Math.round(v * 10) / 10).toString();
  const chemin = (P, T, ferme) => P.map((q, i) => (i ? "L" : "M") + f1(T(q)[0]) + "," + f1(T(q)[1])).join("") + (ferme ? "Z" : "");
  function enChaine(o, opts) {
    opts = opts || {};
    const k = opts.k || 1, dx = opts.dx || 0, dy = opts.dy || 0, T = q => [dx + k * q[0], dy + k * q[1]];
    const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    let s = "";
    if (o.pointilles) s += `<path d="${chemin(o.pointilles.p, T)}" style="fill:none;stroke:var(--mat);stroke-width:1.4;stroke-dasharray:6 3"/>`;
    o.lignes.forEach(l => { s += `<path d="${chemin(l.p, T)}" style="fill:none;${STY[l.r] || STY.symbole};stroke-linejoin:round;stroke-linecap:round"/>`; });
    o.polys.forEach(l => { s += `<path d="${chemin(l.p, T, true)}" style="fill:none;${STY[l.r] || STY.symbole};stroke-linejoin:round"/>`; });
    o.pleins.forEach(l => { s += `<path d="${chemin(l.p, T, true)}" style="fill:var(--ink);stroke:var(--ink);stroke-width:1"/>`; });
    o.cercles.forEach(c => { const p = T(c.c); s += `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${f1(c.r * k)}" style="fill:none;${c.role === "toutAutour" ? STY.repere : STY.symbole}"/>`; });
    if (o.fleche) s += `<path d="${chemin(o.fleche, T, true)}" style="fill:var(--mat);stroke:var(--mat);stroke-width:1"/>`;
    o.textes.forEach(t => { const p = T([t.x, t.y]); s += `<text x="${f1(p[0])}" y="${f1(p[1])}" style="font-size:${f1((t.taille || 12.5) * k)}px;fill:var(--ink);text-anchor:${t.ancre};font-family:var(--font-math)">${esc(t.t)}</text>`; });
    return s;
  }
  /* trace dans un SVG du navigateur, à l'échelle k, origine (dx, dy) ; renvoie le groupe créé */
  function tracer(svg, spec, opts) {
    const o = primitives(spec), g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "symbole");
    const doc = new DOMParser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">' + enChaine(o, opts) + "</svg>", "image/svg+xml");
    Array.from(doc.documentElement.childNodes).forEach(n => g.appendChild(document.importNode(n, true)));
    svg.appendChild(g);
    return { g, o };
  }
  /* place un symbole dans un cadre {x, y, w, h} en pixels, centré, sans dépasser l'échelle kmax */
  function ajuster(spec, cadre, kmax) {
    const o = primitives(spec), b = o.boite, k = Math.min(kmax || 1.6, cadre.w / (b[2] - b[0] + 8), cadre.h / (b[3] - b[1] + 8));
    return { k, dx: cadre.x + (cadre.w - k * (b[2] - b[0])) / 2 - k * b[0], dy: cadre.y + (cadre.h - k * (b[3] - b[1])) / 2 - k * b[1] };
  }

  /* ---------- lecture en français ---------- */
  function lireCote(c) {
    const t = [];
    if (c.a !== undefined) t.push("gorge a = " + nb(c.a) + " mm");
    if (c.z !== undefined) t.push(c.z2 !== undefined ? "côtés " + nb(c.z) + " et " + nb(c.z2) + " mm" : "côté z = " + nb(c.z) + " mm");
    if (c.s !== undefined) t.push((c.sym === "angle" ? "pénétration profonde s = " : "pénétration s = ") + nb(c.s) + " mm");
    if (c.h !== undefined) t.push("préparation sur h = " + nb(c.h) + " mm");
    if (c.d !== undefined) t.push("diamètre d = " + nb(c.d) + " mm");
    if (c.c !== undefined) t.push("largeur c = " + nb(c.c) + " mm");
    if (c.alpha !== undefined) t.push("ouverture " + nb(c.alpha) + "°");
    if (c.b !== undefined) t.push("écartement b = " + nb(c.b) + " mm");
    if (c.n !== undefined && c.l !== undefined) t.push(nb(c.n) + " cordons de " + nb(c.l) + " mm" + (c.e !== undefined ? ", espacés de " + nb(c.e) + " mm" : ""));
    else if (c.n !== undefined) t.push(nb(c.n) + " soudures" + (c.e !== undefined ? " à " + nb(c.e) + " mm d'entraxe" : ""));
    else if (c.l !== undefined) t.push("sur " + nb(c.l) + " mm");
    if (c.forme) t.push({ plat: "finition plate", convexe: "convexe", concave: "concave" }[c.forme]);
    if (c.envers) t.push({ reprise: "reprise à l'envers", surep: "surépaisseur spécifiée à la racine", support: "support envers", M: "support envers subsistant (M)", MR: "support envers temporaire (MR)", insert: "insert consommable" }[c.envers]);
    if (BOUT.indexOf(c.sym) >= 0 && c.s === undefined) t.push("pleine pénétration");
    if (c.n === undefined && c.l === undefined) t.push("continue sur toute la longueur");
    return t;
  }
  function decrire(spec) {
    const sp = spec || {}, phr = [];
    const nom = c => NOMS[c.sym] || c.sym;
    if (sp.fleche && sp.oppose) {
      const comb = COMBINES[sp.fleche.sym + "+" + sp.oppose.sym];
      phr.push((comb ? comb.charAt(0).toUpperCase() + comb.slice(1) + " : " : "Soudure des deux côtés : ") + "côté flèche, " + nom(sp.fleche) + " (" + lireCote(sp.fleche).join(", ") + ") ; côté opposé, " + nom(sp.oppose) + " (" + lireCote(sp.oppose).join(", ") + ")");
    } else if (sp.fleche) phr.push(nom(sp.fleche).charAt(0).toUpperCase() + nom(sp.fleche).slice(1) + ", côté flèche : " + lireCote(sp.fleche).join(", "));
    else if (sp.oppose) phr.push(nom(sp.oppose).charAt(0).toUpperCase() + nom(sp.oppose).slice(1) + ", côté opposé à la flèche : " + lireCote(sp.oppose).join(", "));
    if (sp.interface) phr.push(nom(sp.interface).charAt(0).toUpperCase() + nom(sp.interface).slice(1) + ", à l'interface des tôles : " + lireCote(sp.interface).join(", "));
    if (sp.alterne) phr.push("cordons alternés d'un côté à l'autre");
    if (sp.toutAutour) phr.push("tout autour");
    if (sp.chantier) phr.push("faite sur chantier");
    if (sp.entre) phr.push("du point " + sp.entre[0] + " au point " + sp.entre[1]);
    if (sp.brisee) phr.push("la pièce à préparer est celle que désigne la ligne repère brisée");
    if (sp.queue) phr.push(sp.queue.fermee ? "selon le document de référence " + sp.queue.fermee + " (DMOS, par exemple)" : "fourche : " + (sp.queue.infos || []).join(" / "));
    return phr.join(" ; ") + ".";
  }

  return { NOMS, BOUT, INTERFACE, COMBINES, elementaire, emprise, primitives, enChaine, tracer, ajuster, decrire, lireCote, coteGauche, coteDroite };
});
