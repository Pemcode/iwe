/* Symboles de soudage : règles de l'ISO 2553:2019 (4.7, 5, 4.8) vérifiées sur les primitives. */
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../js/symbole.js");

const ys = o => o.lignes.filter(l => l.r === "symbole").concat(o.polys.filter(l => l.r === "symbole")).flatMap(l => l.p.map(q => q[1]))
  .concat(o.cercles.filter(c => c.role === "symbole").flatMap(c => [c.c[1] - c.r, c.c[1] + c.r]));
const tous = (arr, f) => arr.length > 0 && arr.every(f);

test("système A, trait discontinu dessous : côté flèche sur le trait continu, au-dessus", () => {
  const o = S.primitives({ systeme: "A", fleche: { sym: "V" } });
  assert.ok(o.pointilles, "le trait discontinu est tracé");
  assert.ok(o.pointilles.p[0][1] > 0, "dessous par défaut (4.7.1A)");
  assert.ok(tous(ys(o), y => y <= 0.01), "le V est au-dessus du trait continu");
});

test("système A : côté opposé sur le trait discontinu", () => {
  const o = S.primitives({ systeme: "A", oppose: { sym: "angle", a: 5 } });
  assert.ok(tous(ys(o), y => y >= o.dA - 0.01), "le symbole part du trait discontinu, vers l'extérieur");
});

test("système A, trait discontinu dessus : les côtés s'inversent sur le dessin, pas dans le sens", () => {
  const f = S.primitives({ systeme: "A", pointilles: "dessus", fleche: { sym: "V" } });
  assert.ok(f.pointilles.p[0][1] < 0);
  assert.ok(tous(ys(f), y => y >= -0.01), "côté flèche : toujours sur le trait continu, ici dessous");
  const o = S.primitives({ systeme: "A", pointilles: "dessus", oppose: { sym: "V" } });
  assert.ok(tous(ys(o), y => y <= o.dA + 0.01), "côté opposé : toujours sur le trait discontinu, ici dessus");
});

test("système B : côté flèche au-dessous du trait unique, côté opposé au-dessus", () => {
  const f = S.primitives({ systeme: "B", fleche: { sym: "V" } });
  assert.equal(f.pointilles, null, "un seul trait de référence (4.7.1B)");
  assert.ok(tous(ys(f), y => y >= -0.01));
  const o = S.primitives({ systeme: "B", oppose: { sym: "V" } });
  assert.ok(tous(ys(o), y => y <= 0.01));
});

test("soudure symétrique des deux côtés : pas de trait discontinu en système A", () => {
  const o = S.primitives({ systeme: "A", fleche: { sym: "V" }, oppose: { sym: "V" } });
  assert.equal(o.symetrique, true);
  assert.equal(o.pointilles, null);
  const a = S.primitives({ systeme: "A", fleche: { sym: "V", s: 8 }, oppose: { sym: "V", s: 4 } });
  assert.ok(a.pointilles, "asymétrique : le trait discontinu reste");
});

test("soudures à l'interface : symbole centré sur le trait, sans trait discontinu", () => {
  const o = S.primitives({ systeme: "A", interface: { sym: "pointR", d: 5, n: 4, e: 30 } });
  assert.equal(o.pointilles, null);
  const c = o.cercles.find(k => k.role === "symbole");
  assert.equal(c.c[1], 0, "cercle centré sur le trait");
});

test("cotes : section à gauche du symbole, longueur à droite, du même côté (5.1 à 5.3)", () => {
  const o = S.primitives({ systeme: "A", fleche: { sym: "angle", a: 5, n: 4, l: 100, e: 200 } });
  const g = o.textes.find(t => t.r === "gauche"), d = o.textes.filter(t => t.r === "droite");
  assert.equal(g.t, "a5");
  assert.ok(g.x < o.x0 && g.y < 0, "gauche, côté du symbole");
  assert.deepEqual(d.map(t => t.t), ["4 × 100", "(200)"]);
  assert.ok(d.every(t => t.x > o.x0 && t.y < 0));
  assert.equal(S.coteGauche({ s: 8, a: 6 }), "s8 a6", "pénétration profonde : s avant a (5.5.2)");
  assert.equal(S.coteGauche({ h: 6, s: 8 }), "h6 s8", "profondeur de préparation avant la pénétration (6.5)");
});

test("fourche ouverte, fourche fermée, tout autour, chantier, alternées", () => {
  const o = S.primitives({ fleche: { sym: "angle", a: 4 }, queue: { infos: ["ISO 5817-C", "ISO 4063-135"] }, toutAutour: true, chantier: true });
  assert.ok(o.lignes.some(l => l.r === "fourche"));
  assert.equal(o.textes.find(t => t.r === "queue").t, "ISO 5817-C / ISO 4063-135", "informations séparées par une barre oblique (4.8)");
  assert.ok(o.cercles.some(c => c.role === "toutAutour" && c.c[0] === 0 && c.c[1] === 0), "cercle à la jonction");
  assert.ok(o.lignes.some(l => l.r === "chantier" && l.p[1][1] < 0), "drapeau au-dessus du trait");
  const f = S.primitives({ fleche: { sym: "angle", a: 4 }, queue: { fermee: "A1" } });
  assert.ok(f.polys.some(p => p.r === "fourche"), "fourche fermée : cadre");
  const z = S.primitives({ fleche: { sym: "angle", a: 5, n: 3, l: 50, e: 100 }, oppose: { sym: "angle", a: 5, n: 3, l: 50, e: 100 }, alterne: true });
  assert.ok(z.lignes.some(l => l.r === "alterne"), "Z traversant le trait (5.3.2.3)");
});

test("symboles côté envers (reprise, support, surépaisseur) : à la place du côté opposé", () => {
  const a = S.primitives({ systeme: "A", fleche: { sym: "V", envers: "M" } });
  const r = a.polys.find(p => p.r === "envers");
  assert.ok(r.p.every(q => q[1] >= a.dA - 0.01), "système A : sur le trait discontinu");
  const b = S.primitives({ systeme: "B", fleche: { sym: "V", envers: "reprise" } });
  assert.ok(b.lignes.find(l => l.r === "envers").p.every(q => q[1] <= 0.01), "système B : au-dessus, côté opposé");
});

test("la fourche ne chevauche jamais les cotes de droite", () => {
  const o = S.primitives({ L: 80, fleche: { sym: "angle", a: 4, n: 3, l: 50, e: 100 }, oppose: { sym: "angle", a: 4, n: 3, l: 50, e: 100 }, alterne: true, queue: { infos: ["ISO 5817-C", "135", "PB"] } });
  const fourche = o.lignes.find(l => l.r === "fourche").p[1][0];
  const droite = o.textes.filter(t => t.r === "droite").map(t => t.x + t.t.length * 12.5 * 0.56);
  assert.ok(droite.every(x => x < fourche), `cotes jusqu'à ${Math.max(...droite)}, fourche à ${fourche}`);
  assert.equal(o.lignes[0].p[1][0], fourche, "le trait de référence va jusqu'à la fourche");
});

test("aperçu vide : le trait discontinu peut être forcé", () => {
  assert.equal(S.primitives({ systeme: "A" }).pointilles, null);
  assert.ok(S.primitives({ systeme: "A", forcerPointilles: true }).pointilles);
  assert.equal(S.primitives({ systeme: "B", forcerPointilles: true }).pointilles, null, "jamais en système B");
});

test("tous les symboles élémentaires se tracent", () => {
  Object.keys(S.NOMS).forEach(k => {
    const g = S.elementaire(k, 15);
    if (S.INTERFACE.indexOf(k) >= 0) return;
    assert.ok(g.L.length + g.P.length + g.C.length > 0, k);
  });
});

test("lecture en français", () => {
  const t = S.decrire({ fleche: { sym: "angle", a: 5, n: 4, l: 100, e: 200, forme: "concave" }, toutAutour: true, chantier: true, queue: { infos: ["ISO 4063-111"] } });
  assert.match(t, /Soudure d'angle, côté flèche/);
  assert.match(t, /gorge a = 5 mm/);
  assert.match(t, /4 cordons de 100 mm, espacés de 200 mm/);
  assert.match(t, /tout autour/);
  assert.match(t, /sur chantier/);
  assert.match(S.decrire({ fleche: { sym: "V" }, oppose: { sym: "V" } }), /^Soudure bout à bout en X/);
  assert.match(S.decrire({ oppose: { sym: "V", s: 6 } }), /côté opposé.*pénétration s = 6 mm/);
  assert.match(S.decrire({ fleche: { sym: "V" } }), /pleine pénétration/, "sans cote à gauche, une soudure bout à bout est à pleine pénétration (5.4.1)");
});

test("SVG en chaîne : trait discontinu seulement si nécessaire", () => {
  assert.match(S.enChaine(S.primitives({ fleche: { sym: "V" } })), /stroke-dasharray/);
  assert.doesNotMatch(S.enChaine(S.primitives({ systeme: "B", fleche: { sym: "V" } })), /stroke-dasharray/);
});
