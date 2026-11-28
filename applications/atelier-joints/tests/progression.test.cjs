/* Progression (étoiles, déblocage, examen) et révision espacée (boîtes de Leitner). */
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../js/progression.js");
const L = require("../js/leitner.js");

const JOUR = 86400000;

test("étoiles : 8/10 = 1, 9/10 = 2, 10/10 = 3, en dessous rien ; on garde le meilleur", () => {
  assert.deepEqual([7, 8, 9, 10].map(P.etoiles), [0, 1, 2, 3]);
  const p = P.neuf();
  P.noter(p, 1, "decoder", 9);
  P.noter(p, 1, "decoder", 8);
  assert.equal(p.etoiles["1d"], 2);
});

test("un niveau se débloque quand le précédent est validé, dans l'un ou l'autre mode", () => {
  const p = P.neuf();
  assert.equal(P.debloque(p, 1), true);
  assert.equal(P.debloque(p, 2), false);
  P.noter(p, 1, "coder", 8);
  assert.equal(P.debloque(p, 2), true);
  assert.equal(P.debloque(p, 3), false);
});

test("l'examen se débloque quand les cinq niveaux sont validés en Décoder, ou en accès libre", () => {
  const p = P.neuf();
  [1, 2, 3, 4].forEach(n => P.noter(p, n, "decoder", 10));
  assert.equal(P.examenOuvert(p), false);
  P.noter(p, 5, "decoder", 8);
  assert.equal(P.examenOuvert(p), true);
  const q = P.neuf(); q.libre = true;
  assert.equal(P.examenOuvert(q), true);
  assert.equal(P.debloque(q, 5), true);
});

test("une sauvegarde corrompue redonne une progression neuve", () => {
  assert.deepEqual(P.restaurer("{pas du json"), P.neuf());
  assert.deepEqual(P.restaurer(JSON.stringify({ version: 9 })), P.neuf());
  const p = P.restaurer(JSON.stringify({ version: 1, etoiles: { "1d": 3, "2c": 7, "9d": 2 }, examMeilleur: 140, libre: "oui" }));
  assert.deepEqual(p.etoiles, { "1d": 3 }, "étoiles hors bornes ignorées");
  assert.equal(p.examMeilleur, 100);
  assert.equal(p.libre, false);
});

test("Leitner : une erreur met la carte en boîte 1, due tout de suite", () => {
  const b = L.neuf(), t0 = 1e12;
  L.erreur(b, { niveau: 2, mode: "decoder", graine: 7 }, t0);
  assert.equal(L.dues(b, t0).length, 1);
  assert.equal(L.compter(b)[0], 1);
});

test("Leitner : une réussite fait monter la carte et repousse sa date", () => {
  const b = L.neuf(), t0 = 1e12, c = { niveau: 1, mode: "decoder", graine: 3 };
  L.erreur(b, c, t0);
  L.reussite(b, c, t0);
  assert.equal(L.compter(b)[1], 1, "boîte 2");
  assert.equal(L.dues(b, t0).length, 0);
  assert.equal(L.dues(b, t0 + JOUR).length, 1, "revue le lendemain");
  [3, 7, 14].forEach((j, i) => { L.reussite(b, c, t0 + 100 * JOUR * (i + 1)); });
  assert.equal(L.compter(b)[4], 1, "boîte 5");
  L.reussite(b, c, t0 + 1000 * JOUR);
  assert.equal(L.total(b), 0, "carte maîtrisée, retirée");
  assert.equal(b.maitrisees, 1);
});

test("Leitner : une nouvelle erreur renvoie en boîte 1 ; les dues sont limitées", () => {
  const b = L.neuf(), t0 = 1e12, c = { niveau: 4, mode: "coder", graine: 11 };
  L.erreur(b, c, t0); L.reussite(b, c, t0); L.reussite(b, c, t0 + 2 * JOUR);
  L.erreur(b, c, t0 + 3 * JOUR);
  assert.equal(L.compter(b)[0], 1);
  for (let i = 0; i < 25; i++) L.erreur(b, { niveau: 1, mode: "decoder", graine: 100 + i }, t0);
  assert.equal(L.dues(b, t0 + 3 * JOUR, 10).length, 10);
});

test("Leitner : une sauvegarde corrompue est ignorée", () => {
  assert.deepEqual(L.restaurer("x"), L.neuf());
  const b = L.restaurer(JSON.stringify({ version: 1, cartes: { a: { niveau: 9, mode: "x", graine: 1, boite: 2, due: 0 }, "1d-5": { niveau: 1, mode: "decoder", graine: 5, boite: 3, due: 7 } } }));
  assert.equal(L.total(b), 1);
});
