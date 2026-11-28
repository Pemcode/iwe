/* Générateur d'exercices : chaque item est bien formé, reproductible, et n'a qu'une bonne réponse. */
const test = require("node:test");
const assert = require("node:assert/strict");
const G = require("../js/generateur.js");
const S = require("../js/symbole.js");

const MODES = ["decoder", "coder"];
const GRAINES = Array.from({ length: 160 }, (_, i) => 1000 + i * 7);

test("cinq niveaux décrits, chacun relié à une section de cours", () => {
  assert.equal(G.NIVEAUX.length, 5);
  G.NIVEAUX.forEach((n, i) => {
    assert.equal(n.n, i + 1);
    assert.ok(n.titre && n.description);
    assert.match(n.cours.id, /^conception-0[12]$/);
    assert.match(n.cours.ancre, /^c[1-6]$/);
  });
});

test("un item est reproductible à partir de sa graine", () => {
  for (const niv of [1, 2, 3, 4, 5]) for (const mode of MODES) {
    const a = G.generer(niv, mode, 4242), b = G.generer(niv, mode, 4242);
    assert.deepEqual(a, b, `niveau ${niv} ${mode}`);
  }
});

test("QCM : options distinctes, une seule bonne réponse, explication et cours", () => {
  for (const niv of [1, 2, 3, 4, 5]) for (const g of GRAINES) {
    const it = G.generer(niv, "decoder", g);
    assert.equal(it.niveau, niv);
    assert.ok(it.enonce && it.explication, `${it.id} : énoncé et explication`);
    assert.ok(it.cours && it.cours.id && it.cours.ancre, `${it.id} : cours`);
    assert.ok(Array.isArray(it.options) && it.options.length >= 3 && it.options.length <= 5, `${it.id} : options`);
    const cles = it.options.map(o => JSON.stringify(o));
    assert.equal(new Set(cles).size, cles.length, `${it.id} : options en double ${cles}`);
    const bonnes = it.options.map((_, i) => G.verifier(it, i).ok).filter(Boolean).length;
    assert.equal(bonnes, 1, `${it.id} : ${bonnes} bonnes réponses`);
    assert.ok(G.verifier(it, it.bonne).ok);
  }
});

test("les symboles des items se tracent", () => {
  for (const niv of [1, 2, 3, 4, 5]) for (const mode of MODES) for (const g of GRAINES.slice(0, 40)) {
    const it = G.generer(niv, mode, g);
    const specs = [];
    if (it.figure && it.figure.kind === "symbole") specs.push(it.figure.spec);
    (it.options || []).forEach(o => { if (o.figure && o.figure.kind === "symbole") specs.push(o.figure.spec); });
    specs.forEach(sp => { const o = S.primitives(sp); assert.ok(o.lignes.length > 1, it.id); });
  }
});

test("Coder : la réponse attendue est acceptée, une réponse altérée est refusée", () => {
  for (const niv of [1, 2, 3, 4, 5]) for (const g of GRAINES) {
    const it = G.generer(niv, "coder", g);
    assert.ok(it.outil, `${it.id} : outil`);
    assert.ok(G.verifier(it, it.attendu).ok, `${it.id} : attendu refusé`);
    const faux = G.alterer(it, it.attendu);
    assert.ok(!G.verifier(it, faux).ok, `${it.id} : réponse altérée acceptée ${JSON.stringify(faux)}`);
    const sp = G.specDeReponse(it, it.attendu);
    assert.ok(S.primitives(sp).lignes.length > 1, `${it.id} : aperçu`);
  }
});

test("niveau 2 : la place du symbole suit le système (ISO 2553, 4.7.2)", () => {
  assert.equal(G.coteDePlace("dessus", "A", "dessous"), "fleche");
  assert.equal(G.coteDePlace("dessous", "A", "dessous"), "oppose");
  assert.equal(G.coteDePlace("dessus", "A", "dessus"), "oppose");
  assert.equal(G.coteDePlace("dessous", "A", "dessus"), "fleche");
  assert.equal(G.coteDePlace("dessous", "B"), "fleche");
  assert.equal(G.coteDePlace("dessus", "B"), "oppose");
  assert.equal(G.coteDePlace("deux", "B"), "deux");
});

test("niveau 4 : les longueurs annoncées sont exactes", () => {
  for (const g of GRAINES) {
    const it = G.generer(4, "decoder", g);
    if (!it.calcul) continue;
    const { n, l, e, quoi } = it.calcul, v = quoi === "soudee" ? n * l : quoi === "occupee" ? n * l + (n - 1) * e : null;
    if (v !== null) assert.match(it.options[it.bonne].texte, new RegExp("^" + v.toLocaleString("fr-FR").replace(/\s/g, "\\s") + "\\smm"));
  }
});

test("niveau 5 : les tolérances proposées sont celles de l'ISO 13920 (extrait)", () => {
  assert.equal(G.tolerance(1500, "B"), 4);
  assert.equal(G.tolerance(250, "D"), 7);
  assert.equal(G.tolerance(6000, "C"), 14);
  assert.equal(G.tolerance(300, "A"), 1);
});

test("une série compte 10 items distincts ; l'examen 20, quatre par niveau", () => {
  const s = G.serie(3, "decoder", 77);
  assert.equal(s.length, 10);
  assert.equal(new Set(s.map(i => i.id)).size, 10);
  const ex = G.examen(99);
  assert.equal(ex.length, 20);
  [1, 2, 3, 4, 5].forEach(n => assert.equal(ex.filter(i => i.niveau === n).length, 4));
  assert.ok(ex.every(i => i.mode === "decoder"));
});
