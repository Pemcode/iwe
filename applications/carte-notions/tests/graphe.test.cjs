const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/graphe.js');
const DATA = require('../data/carte-data.js');

const PETIT = {
  matieres: [{ id: 'inox', titre: 'Aciers inoxydables' }, { id: 'brasage', titre: 'Brasage' }, { id: 'nouvelle', titre: 'Nouvelle' }],
  cours: [{ id: 'inox-01', titre: 'Inox 1', m: 0, url: 'Inox/01-bases.html', fichier: 'Cours/Inox/Inox, cours 1 _ bases.html', s: [['c1', 'Bases']] },
    { id: 'local-1', titre: 'Inox local', m: 0, url: null, fichier: 'Cours/Inox/Inox, cours 9.html', s: [['c2', 'Suite']] }],
  continents: [{ nom: 'Ferrite · Austénite', taille: 3, m: 0 }],
  notions: [
    { id: 'ferrite', l: 'Ferrite', k: 'n', a: ['α'], d: [], f: 10, m: [[0, 10]], h: 0, c: 0, p: 5, r: [], x: [0, 0], z: [0, 0, 0] },
    { id: 'zat', l: 'ZAT', k: 's', a: ['Zone affectée thermiquement', 'HAZ'], d: [], f: 8, m: [[1, 8]], h: 1, c: 0, p: 4, r: [], x: [1, 0], z: [1, 0, 0] },
    { id: 'oeil', l: 'Œil-de-bœuf', k: 'n', a: [], d: [], f: 2, m: [[2, 2]], h: 0, c: 0, p: 1, r: [], x: [0, 1], z: [0, 1, 0] }
  ],
  liens: [[0, 1, 0.3, 4, 0, 0, [[0, 0]]], [0, 2, 0.8, 9, 1, 0, []]]
};

test('normalisation : accents, casse, ligatures et lettres grecques', () => {
  assert.equal(G.normaliser('Œil-de-bœuf'), 'oeil de boeuf');
  assert.equal(G.normaliser('Phase σ'), 'phase sigma');
  assert.equal(G.normaliser("Loi d’Arrhenius"), 'loi d arrhenius');
});

test('modèle : voisins triés par force et famille de repli pour une matière inconnue', () => {
  const m = G.construire(PETIT);
  assert.deepEqual(m.voisins[0].map(v => m.notions[v.j].id), ['oeil', 'zat']);
  assert.equal(m.voisins[0][0].def, true);
  assert.equal(m.notions[0].famille.id, 'materiaux');
  assert.equal(m.notions[1].famille.id, 'procedes');
  assert.equal(m.notions[2].famille.id, 'autres');
});

test('recherche : préfixe, alias, sans accents et faute de frappe', () => {
  const m = G.construire(PETIT);
  assert.equal(G.chercher(m, 'ferr')[0].i, 0);
  assert.equal(G.chercher(m, 'zone affectee')[0].i, 1);
  assert.equal(G.chercher(m, 'HAZ')[0].i, 1);
  assert.equal(G.chercher(m, 'oeil de boeuf')[0].i, 2);
  assert.equal(G.chercher(m, 'ferite')[0].i, 0);
  assert.deepEqual(G.chercher(m, '   '), []);
});

test('liens vers les cours selon le lieu d’ouverture', () => {
  const [publie, local] = PETIT.cours;
  assert.equal(G.lienCours(publie, 'c1', { mode: 'depot', racine: '../../' }), '../../Cours/Inox/Inox%2C%20cours%201%20_%20bases.html#c1');
  assert.equal(G.lienCours(publie, 'c1', { mode: 'wiki', racine: '../' }), '../Inox/01-bases.html#c1');
  assert.equal(G.lienCours(publie, 'c1', { mode: 'en-ligne' }), 'https://pemcode.github.io/iwe/Inox/01-bases.html#c1');
  assert.equal(G.lienCours(local, 'c2', { mode: 'en-ligne' }), null);
  assert.equal(G.environnement({ pathname: '/x/applications/carte-notions/index.html' }, {}).mode, 'depot');
  assert.equal(G.environnement({ pathname: '/iwe/Carte/index.html' }, { application: true }).racine, '../');
});

test('filtres : matières masquées, types masqués, carrefours seulement', () => {
  const m = G.construire(PETIT);
  const filtres = { matieresMasquees: new Set(['brasage']), typesMasques: new Set(), carrefours: false };
  assert.deepEqual(m.notions.filter(n => G.visible(n, filtres)).map(n => n.id), ['ferrite', 'oeil']);
  assert.deepEqual(m.notions.filter(n => G.visible(n, { matieresMasquees: new Set(), typesMasques: new Set(), carrefours: true })).map(n => n.id), ['zat']);
});

test('données générées : cohérentes et cherchables', () => {
  const m = G.construire(DATA);
  assert.ok(m.notions.length > 500);
  for (const [a, b] of DATA.liens) assert.ok(m.notions[a] && m.notions[b]);
  for (const n of DATA.notions) for (const [ci, si] of n.r) assert.ok(DATA.cours[ci].s[si]);
  assert.equal(m.notions[G.chercher(m, 'ferrite')[0].i].id, 'ferrite');
  assert.ok(m.voisins[G.chercher(m, 'martensite')[0].i].length >= 3);
});
