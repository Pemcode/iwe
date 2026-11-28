/* Atelier des joints : coupe.js
   Géométrie des coupes de joints soudés, en millimètres, et leur tracé en SVG.
   Repère : x horizontal, axe du joint en x = 0 ; y vers le haut ; face endroit en y = t, envers en y = 0.
   Module UMD : window.Coupe dans le navigateur, require() sous Node (la géométrie se teste sans navigateur).
   Le même code est recopié dans les manipulations des cours de la matière Conception (pages autonomes). */
(function (racine, fabrique) {
  if (typeof module === "object" && module.exports) module.exports = fabrique();
  else racine.Coupe = fabrique();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const RAD = Math.PI / 180;
  const SQ2 = Math.SQRT2;

  /* ---------- outils ---------- */
  function aire(P) {
    let s = 0;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  }
  const miroir = P => P.map(p => [-p[0], p[1]]);
  const borne = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- profil du bord d'une pièce ----------
     Points du bord, de la face endroit (y = t) vers l'envers (y = 0), pour une pièce placée à droite
     de l'axe ; x0 = demi-écartement. haut et bas : {type:"droit"|"biseau"|"J"|"biseau2", h, beta (°), R, hr, beta2}.
     Le talon (méplat) occupe ce qui reste entre les deux. */
  function profil(t, x0, haut, bas) {
    const P = [];
    const H = haut || { type: "droit" }, B = bas || { type: "droit" };
    const hH = H.type === "droit" ? 0 : H.h, hB = B.type === "droit" ? 0 : B.h;
    if (H.type === "droit") P.push([x0, t]);
    else if (H.type === "biseau") {
      const tb = Math.tan(H.beta * RAD);
      P.push([x0 + hH * tb, t], [x0, t - hH]);
    } else if (H.type === "biseau2") { /* V à double pente : biseau ouvert à la racine (beta, sur hr), flanc raide au-dessus (beta2) */
      const hr = Math.min(H.hr, hH), x1 = x0 + hr * Math.tan(H.beta * RAD);
      P.push([x1 + (hH - hr) * Math.tan(H.beta2 * RAD), t], [x1, t - hH + hr], [x0, t - hH]);
    } else if (H.type === "J") { /* le rayon ne dépasse pas la profondeur de préparation */
      const R = Math.min(H.R, hH), b = H.beta * RAD, yc = t - hH + R;
      const xp = x0 + R * Math.cos(b), yp = yc - R * Math.sin(b);
      P.push([xp + (t - yp) * Math.tan(b), t]);
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const f = -b - (Math.PI / 2 - b) * i / n;
        P.push([x0 + R * Math.cos(f), yc + R * Math.sin(f)]);
      }
    }
    if (B.type === "droit") P.push([x0, 0]);
    else if (B.type === "biseau") P.push([x0, hB], [x0 + hB * Math.tan(B.beta * RAD), 0]);
    else if (B.type === "J") {
      const R = Math.min(B.R, hB), b = B.beta * RAD, yc = hB - R;
      const n = 16;
      for (let i = 0; i <= n; i++) {
        const f = Math.PI / 2 - (Math.PI / 2 - b) * i / n;
        P.push([x0 + R * Math.cos(f), yc + R * Math.sin(f)]);
      }
      const xp = x0 + R * Math.cos(b), yp = yc + R * Math.sin(b);
      P.push([xp + yp * Math.tan(b), 0]);
    }
    return P;
  }

  /* ---------- préparations bout à bout ----------
     type : I, V (Y si c > 0), V2 (V à double pente), X (h1, h2), U, UU (double U), demiV, K, J.
     o : t, alpha (angle d'ouverture total, °), beta (angle d'un flanc, °), b (écartement), c (talon),
         h1, h2 (profondeurs de préparation côté endroit et côté envers), R (rayon d'un U ou d'un J), hr, beta2. */
  const DEFAUTS = {
    I: { b: 2 }, V: { alpha: 60, b: 2, c: 2 }, V2: { alpha: 70, beta2: 12, hr: 8, b: 3, c: 2 },
    X: { alpha: 60, b: 2, c: 2 }, U: { beta: 10, R: 6, b: 2, c: 3 }, UU: { beta: 10, R: 6, b: 2, c: 3 },
    demiV: { beta: 45, b: 2, c: 2 }, K: { beta: 45, b: 2, c: 2 }, J: { beta: 15, R: 6, b: 2, c: 2 }
  };
  function options(type, o) {
    const d = Object.assign({}, DEFAUTS[type] || {}, o || {});
    d.t = d.t || 10; d.b = d.b === undefined ? 0 : d.b; d.c = borne(d.c || 0, 0, d.t);
    return d;
  }
  function bords(type, o) {
    const t = o.t, x0 = o.b / 2, ht = t - o.c;
    const dr = { type: "droit" };
    let D = [dr, dr], G = [dr, dr];
    if (type === "V") { const s = { type: "biseau", h: ht, beta: o.alpha / 2 }; D = G = [s, dr]; }
    else if (type === "V2") { const s = { type: "biseau2", h: ht, beta: o.alpha / 2, hr: o.hr, beta2: o.beta2 }; D = G = [s, dr]; }
    else if (type === "X") {
      const h1 = o.h1 !== undefined ? o.h1 : ht / 2, h2 = o.h2 !== undefined ? o.h2 : ht - h1;
      const a1 = (o.alpha1 || o.alpha) / 2, a2 = (o.alpha2 || o.alpha) / 2;
      D = G = [{ type: "biseau", h: h1, beta: a1 }, { type: "biseau", h: h2, beta: a2 }];
    } else if (type === "U") { const s = { type: "J", h: ht, beta: o.beta, R: o.R }; D = G = [s, dr]; }
    else if (type === "UU") {
      const h1 = o.h1 !== undefined ? o.h1 : ht / 2, h2 = ht - h1;
      D = G = [{ type: "J", h: h1, beta: o.beta, R: o.R }, { type: "J", h: h2, beta: o.beta, R: o.R }];
    } else if (type === "demiV") D = [{ type: "biseau", h: ht, beta: o.beta }, dr];
    else if (type === "K") {
      const h1 = o.h1 !== undefined ? o.h1 : ht / 2, h2 = ht - h1;
      D = [{ type: "biseau", h: h1, beta: o.beta }, { type: "biseau", h: h2, beta: o.beta }];
    } else if (type === "J") D = [{ type: "J", h: ht, beta: o.beta, R: o.R }, dr];
    return { droite: profil(t, x0, D[0], D[1]), gauche: profil(t, x0, G[0], G[1]) };
  }
  function chanfrein(type, opts) {
    const o = options(type, opts);
    const p = bords(type, o);
    const pd = p.droite, pg = miroir(p.gauche);
    const larg = Math.max(...pd.map(q => q[0]), ...p.gauche.map(q => q[0]));
    const W = larg + Math.max(6, o.t * 0.9);
    const plaqueD = pd.concat([[W, 0], [W, o.t]]);
    const plaqueG = pg.concat([[-W, 0], [-W, o.t]]);
    const vide = pd.concat(pg.slice().reverse());
    return { type: type, o: o, t: o.t, W: W, plaques: [plaqueG, plaqueD], vide: vide, S: aire(vide),
      largeurEndroit: [pg[0][0], pd[0][0]], largeurEnvers: [pg[pg.length - 1][0], pd[pd.length - 1][0]] };
  }

  /* Sections à déposer, formules fermées (hors surépaisseurs), pour vérifier le tracé. */
  const formules = {
    V: (t, alpha, b, c) => Math.pow(t - c, 2) * Math.tan(alpha / 2 * RAD) + b * t,
    X: (t, alpha, b, c) => Math.pow(t - c, 2) * Math.tan(alpha / 2 * RAD) / 2 + b * t,
    demiV: (t, beta, b, c) => Math.pow(t - c, 2) * Math.tan(beta * RAD) / 2 + b * t,
    K: (t, beta, b, c) => Math.pow(t - c, 2) * Math.tan(beta * RAD) / 4 + b * t,
    /* aire entre le plan du talon et un profil en J de profondeur h (une pièce) */
    J1: (h, beta, R) => {
      const b = beta * RAD, yp = R - R * Math.sin(b), dx = R * Math.cos(b);
      return R * R * ((Math.PI / 2 - b) / 2 - Math.sin(2 * b) / 4) + dx * (h - yp) + Math.pow(h - yp, 2) * Math.tan(b) / 2;
    },
    U: (t, beta, R, b, c) => 2 * formules.J1(t - c, beta, R) + b * t
  };

  /* Cordon d'une préparation bout à bout : métal fondu, surépaisseur endroit, pénétration envers. */
  function cordon(ch, o) {
    o = o || {};
    const t = ch.t, e = o.surep === undefined ? Math.min(3, 0.8 + 0.06 * (ch.largeurEndroit[1] - ch.largeurEndroit[0])) : o.surep;
    const m = o.debord === undefined ? 1 : o.debord;
    const cap = [], n = 18, xa = ch.largeurEndroit[0] - m, xb = ch.largeurEndroit[1] + m;
    for (let i = 0; i <= n; i++) { const u = i / n, x = xa + (xb - xa) * u; cap.push([x, t + e * 4 * u * (1 - u)]); }
    const res = { fondu: ch.vide, endroit: cap, envers: null };
    if (o.envers !== false) {
      const er = o.surepEnvers === undefined ? Math.min(1.5, 0.5 + 0.1 * ch.o.b) : o.surepEnvers;
      const ya = ch.largeurEnvers[0] - m * 0.6, yb = ch.largeurEnvers[1] + m * 0.6, R = [];
      for (let i = 0; i <= n; i++) { const u = i / n, x = ya + (yb - ya) * u; R.push([x, -er * 4 * u * (1 - u)]); }
      res.envers = R;
    }
    return res;
  }

  /* ---------- soudure d'angle ----------
     Repère local : racine (angle des pièces) à l'origine ; pièce 1 le long de +x (y = 0), pièce 2 le long de +y (x = 0).
     z1, z2 : côtés ; s : bombé de la face (> 0 convexe, < 0 concave), mesuré au milieu, perpendiculairement à la corde ;
     p : pénétration au-delà de la racine, selon la bissectrice. */
  function faceAngle(z1, z2, s, n) {
    n = n || 40;
    const L = Math.hypot(z1, z2), nx = z2 / L, ny = z1 / L;
    const cx = z1 / 2 + 2 * s * nx, cy = z2 / 2 + 2 * s * ny;
    const P = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
      P.push([a * z1 + b * cx, a * 0 + b * cy + c * z2]);
    }
    return P;
  }
  function cordonAngle(o) {
    const z1 = o.z1, z2 = o.z2 === undefined ? o.z1 : o.z2, s = o.s || 0, p = o.p || 0;
    const face = faceAngle(z1, z2, s);
    const fondu = [[0, 0]].concat(face);
    /* Pénétration : un lobe de rayon r = p·√2 autour de la racine. Il fond la pièce 1 sous la racine
       et le plan de contact sur une largeur r, côté pièce 2. */
    let pen = null;
    const r = p * SQ2;
    if (p > 0) {
      const w1 = Math.max(r, Math.min(z1 * 0.7, r + 1)), w2 = Math.min(z2 * 0.7, 0.5 * r + 1), n = 16;
      pen = [[w1, 0]];
      for (let i = 0; i <= n; i++) { const f = -Math.PI * i / n; pen.push([r * Math.cos(f), r * Math.sin(f)]); }
      pen.push([-0.6 * r, 0.3 * r], [0, 0.45 * r], [0, w2]);
    }
    return { fondu: fondu, penetration: pen, face: face, fondContact: r };
  }
  /* Gorges selon l'ISO 17659 : réelle (hauteur du plus grand triangle isocèle inscrit), efficace (avec la pénétration),
     totale (du fond de la pénétration au point le plus haut de la surépaisseur), côté du triangle inscrit. */
  function gorges(o) {
    const z1 = o.z1, z2 = o.z2 === undefined ? o.z1 : o.z2, p = o.p || 0;
    const face = faceAngle(z1, z2, o.s || 0, 200);
    let L = Math.min(z1, z2), haut = 0;
    face.forEach(q => { L = Math.min(L, q[0] + q[1]); haut = Math.max(haut, (q[0] + q[1]) / SQ2); });
    const a = L / SQ2;
    return { cote: L, a: a, aEff: a + p, totale: haut + p, z1: z1, z2: z2 };
  }
  const zDeA = a => a * SQ2;
  const aDeZ = z => z / SQ2;

  /* ---------- assemblages complets (scènes) ----------
     Une scène : plaques (polygones hachurés), cordons (métal fondu), manques (segments non fondus), axes. */
  function translater(P, dx, dy, sx) { sx = sx || 1; return P.map(q => [sx * q[0] + dx, q[1] + dy]); }

  function sceneBout(type, o) {
    const ch = chanfrein(type, o);
    const c = cordon(ch, o);
    const sc = { plaques: ch.plaques, cordons: [c.fondu, c.endroit], manques: [], ch: ch,
      boite: [-ch.W, -3, ch.W, ch.t + 4] };
    if (c.envers && o && o.penetre !== false) sc.cordons.push(c.envers);
    if (o && o.penetre === false) { /* racine non fondue : le talon et l'écartement restent ouverts */
      const yr = Math.max(o.manque || ch.o.c || 1.5, 1.2);
      sc.cordons[0] = coupeSous(ch.vide, yr);
      sc.manques.push([[0, 0], [0, yr]]);
    }
    return sc;
  }
  /* garde la partie d'un polygone située au-dessus de y = yc (Sutherland-Hodgman, demi-plan) */
  function coupeSous(P, yc) {
    const out = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length], ia = a[1] >= yc, ib = b[1] >= yc;
      if (ia) out.push(a);
      if (ia !== ib) { const u = (yc - a[1]) / (b[1] - a[1]); out.push([a[0] + u * (b[0] - a[0]), yc]); }
    }
    return out;
  }
  /* coupe à hauteur y deux cordons bout à bout faits de chaque côté, sur bords droits, qui se rejoignent ou non */
  function sceneBoutDeuxCotes(o) {
    const t = o.t, b = o.b === undefined ? t / 2 : o.b, pe = o.pEndroit, pv = o.pEnvers, W = Math.max(14, t * 1.6);
    const plaques = [[[-b / 2, 0], [-W, 0], [-W, t], [-b / 2, t]], [[b / 2, t], [W, t], [W, 0], [b / 2, 0]]];
    const lob = (y0, prof, sens) => {
      const n = 18, w = b / 2 + Math.max(1, 0.35 * prof), P = [];
      for (let i = 0; i <= n; i++) { const f = Math.PI * i / n; P.push([-w * Math.cos(f), y0 - sens * prof * Math.sin(f)]); }
      return P;
    };
    const cap = (y, h, sens) => {
      const n = 16, w = b / 2 + 1.2, P = [];
      for (let i = 0; i <= n; i++) { const u = i / n; P.push([-w + 2 * w * u, y + sens * h * 4 * u * (1 - u)]); }
      return P;
    };
    const cordons = [lob(t, pe, 1), cap(t, 1.2, 1), lob(0, pv, -1), cap(0, 1, -1)];
    const manques = pe + pv < t ? [[[0, pv], [0, t - pe]]] : [];
    return { plaques: plaques, cordons: cordons, manques: manques, boite: [-W, -3, W, t + 3] };
  }
  /* Assemblage en T. o : t1 (âme), t2 (semelle), H (hauteur d'âme dessinée), L (demi-largeur de semelle),
     mode : "angle" (cordons d'angle : gauche et droite = {z, s, p} ou null), "demiV" ou "K" (âme chanfreinée, pleine pénétration). */
  function sceneTe(o) {
    const t1 = o.t1, t2 = o.t2, H = o.H || t1 * 2.2, L = o.L || Math.max(t1 * 2.4, 22);
    const semelle = [[-L, 0], [L, 0], [L, t2], [-L, t2]];
    const sc = { plaques: [semelle], cordons: [], manques: [], boite: [-L, -2, L, t2 + H] };
    if (o.mode === "angle") {
      sc.plaques.push([[-t1 / 2, t2], [t1 / 2, t2], [t1 / 2, t2 + H], [-t1 / 2, t2 + H]]);
      let fondG = 0, fondD = 0;
      [["droite", 1], ["gauche", -1]].forEach(([cote, sx]) => {
        const k = o[cote];
        if (!k) return;
        const c = cordonAngle({ z1: k.z, z2: k.z, s: k.s, p: k.p });
        sc.cordons.push(translater(c.fondu, sx * t1 / 2, t2, sx));
        if (c.penetration) sc.cordons.push(translater(c.penetration, sx * t1 / 2, t2, sx));
        if (cote === "droite") fondD = c.fondContact; else fondG = c.fondContact;
      });
      const xa = -t1 / 2 + fondG, xb = t1 / 2 - fondD;
      if (xb > xa + 0.05) sc.manques.push([[xa, t2], [xb, t2]]);
    } else {
      /* Âme chanfreinée : la profondeur du biseau se compte dans l'épaisseur de l'âme (horizontale) ;
         sa hauteur vaut profondeur × tan β. */
      const c = o.c === undefined ? 2 : o.c, beta = o.beta || 45, b = o.b === undefined ? 2 : o.b;
      const tb = Math.tan(beta * RAD), yb = t2 + b, m = 1.4;
      if (o.mode === "K") {
        const hk = (t1 - c) / 2 * tb;
        sc.plaques.push([[-c / 2, yb], [c / 2, yb], [t1 / 2, yb + hk], [t1 / 2, t2 + H], [-t1 / 2, t2 + H], [-t1 / 2, yb + hk]]);
        sc.cordons.push([[-t1 / 2 - m, t2], [t1 / 2 + m, t2], [t1 / 2 + m * 0.7, yb + hk + 0.4], [t1 / 2, yb + hk + m * 0.6],
          [t1 / 2, yb + hk], [c / 2, yb], [-c / 2, yb], [-t1 / 2, yb + hk], [-t1 / 2, yb + hk + m * 0.6], [-t1 / 2 - m * 0.7, yb + hk + 0.4]]);
      } else { /* demi-V : biseau côté droit, talon c côté gauche ; reprise par un cordon d'angle à gauche */
        const xa = -t1 / 2 + c, hb = (t1 - c) * tb;
        sc.plaques.push([[-t1 / 2, yb], [xa, yb], [t1 / 2, yb + hb], [t1 / 2, t2 + H], [-t1 / 2, t2 + H]]);
        sc.cordons.push([[-t1 / 2, t2], [t1 / 2 + m, t2], [t1 / 2 + m * 0.7, yb + hb + 0.4], [t1 / 2, yb + hb + m * 0.6],
          [t1 / 2, yb + hb], [xa, yb], [-t1 / 2, yb]]);
        const r = cordonAngle({ z1: Math.max(3, t1 * 0.3), s: 0.3 });
        sc.cordons.push(translater(r.fondu, -t1 / 2, t2, -1));
      }
      sc.boite = [-L, -2, L, Math.max(t2 + H, t2 + b + t1 * tb + 2)];
    }
    return sc;
  }
  /* Assemblage à recouvrement : tôle basse (t), tôle haute (t) décalée ; cordons d'angle en bout de chaque tôle. */
  function sceneRecouvrement(o) {
    const t = o.t, R = o.recouvrement || 3 * t, L = R + 2.2 * t;
    const bas = [[-L, 0], [R / 2, 0], [R / 2, t], [-L, t]];
    const sc = { plaques: [bas], cordons: [], manques: [], boite: [-L, -2, L, 2 * t + 3] };
    const z = o.z || t * 0.8, f = cordonAngle({ z1: z, s: 0.3 }).fondu;
    /* à droite, le bout de la tôle basse sous la tôle haute : axes +x et −y ; à gauche, le bout de la tôle haute sur la basse : axes −x et +y */
    if (o.droite !== false) sc.cordons.push(f.map(q => [R / 2 + q[0], t - q[1]]));
    if (o.gauche) sc.cordons.push(f.map(q => [-R / 2 - q[0], t + q[1]]));
    if (o.bouchon) { /* lumière dans la tôle haute, remplie de métal fondu qui pénètre la tôle basse */
      const w = Math.max(t, 6), pen = 0.3 * t, d = 0.6;
      sc.plaques.push([[-R / 2, t], [-w / 2, t], [-w / 2, 2 * t], [-R / 2, 2 * t]], [[w / 2, t], [L, t], [L, 2 * t], [w / 2, 2 * t]]);
      sc.cordons.push([[-w / 2, t - pen], [w / 2, t - pen], [w / 2, 2 * t], [w / 2 + d, 2 * t + d], [-w / 2 - d, 2 * t + d], [-w / 2, 2 * t]]);
      sc.manques.push([[-R / 2, t], [-w / 2, t]], [[w / 2, t], [R / 2, t]]);
    } else {
      sc.plaques.push([[-R / 2, t], [L, t], [L, 2 * t], [-R / 2, 2 * t]]);
      sc.manques.push([[-R / 2, t], [R / 2, t]]);
    }
    return sc;
  }

  /* ---------- tracé SVG (navigateur) ----------
     cadre : {x, y, w, h} en pixels ; boite : [xmin, ymin, xmax, ymax] en mm. Renvoie {P, k} : P(x, y) donne les pixels. */
  let compteur = 0;
  function noeud(tag, attrs, parent) {
    const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const k in attrs) {
      const v = attrs[k];
      if (v === undefined || v === null) continue;
      if (typeof v === "string" && v.indexOf("var(") >= 0) e.style.setProperty(k, v); else e.setAttribute(k, v);
    }
    if (parent) parent.appendChild(e);
    return e;
  }
  function hachures(svg) {
    if (svg.__hach) return svg.__hach;
    const id = "hach" + (++compteur);
    let defs = svg.querySelector("defs");
    if (!defs) defs = noeud("defs", {}, svg);
    const pat = noeud("pattern", { id: id, width: 7, height: 7, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }, defs);
    noeud("line", { x1: 0, y1: 0, x2: 0, y2: 7, stroke: "var(--muted)", "stroke-width": 1 }, pat);
    svg.__hach = id;
    return id;
  }
  function transformation(cadre, boite) {
    const k = Math.min(cadre.w / (boite[2] - boite[0]), cadre.h / (boite[3] - boite[1]));
    const ox = cadre.x + (cadre.w - k * (boite[2] - boite[0])) / 2, oy = cadre.y + (cadre.h - k * (boite[3] - boite[1])) / 2;
    const P = (x, y) => [ox + k * (x - boite[0]), oy + k * (boite[3] - y)];
    return { P: P, k: k };
  }
  const chemin = (P, T) => P.map((q, i) => (i ? "L" : "M") + T.P(q[0], q[1]).map(v => v.toFixed(1)).join(",")).join("") + "Z";
  function tracer(svg, scene, cadre, opts) {
    opts = opts || {};
    const T = transformation(cadre, opts.boite || scene.boite);
    const g = noeud("g", { class: "coupe" }, svg);
    if (svg.__hach && !svg.querySelector("#" + svg.__hach)) svg.__hach = null;
    const h = hachures(svg);
    scene.plaques.forEach(P => noeud("path", { d: chemin(P, T), fill: "url(#" + h + ")", stroke: "var(--ink)", "stroke-width": 1.3, "stroke-linejoin": "round" }, g));
    const cw = opts.couleurCordon || "var(--weld)";
    scene.cordons.forEach(P => noeud("path", { d: chemin(P, T), fill: "color-mix(in srgb," + cw + " 42%,var(--card))", stroke: cw, "stroke-width": 1.1, "stroke-linejoin": "round" }, g));
    (scene.manques || []).forEach(S => {
      const a = T.P(S[0][0], S[0][1]), b = T.P(S[1][0], S[1][1]);
      noeud("line", { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "var(--sig)", "stroke-width": 3.2, "stroke-linecap": "round" }, g);
    });
    return T;
  }

  return { RAD: RAD, aire: aire, profil: profil, chanfrein: chanfrein, formules: formules, cordon: cordon,
    faceAngle: faceAngle, cordonAngle: cordonAngle, gorges: gorges, zDeA: zDeA, aDeZ: aDeZ,
    sceneBout: sceneBout, sceneBoutDeuxCotes: sceneBoutDeuxCotes, sceneTe: sceneTe, sceneRecouvrement: sceneRecouvrement,
    coupeSous: coupeSous, transformation: transformation, chemin: chemin, tracer: tracer, DEFAUTS: DEFAUTS };
});
