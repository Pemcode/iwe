/* Géométrie des coupes : les aires tracées doivent égaler les formules fermées,
   et les gorges suivre les définitions de l'ISO 17659. */
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../js/coupe.js");

const proche = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg} : ${a} au lieu de ${b} (±${tol})`);

test("aire d'un carré unité", () => {
  assert.equal(C.aire([[0, 0], [1, 0], [1, 1], [0, 1]]), 1);
});

test("chanfrein en V : section tracée = (t − c)²·tan(α/2) + b·t", () => {
  for (const [t, alpha, b, c] of [[10, 60, 2, 2], [16, 60, 2, 2], [25, 50, 3, 1], [40, 40, 1, 2]]) {
    const ch = C.chanfrein("V", { t, alpha, b, c });
    proche(ch.S, C.formules.V(t, alpha, b, c), 1e-9, `V t=${t}`);
  }
});

test("chanfrein en X symétrique : moitié de la part en V, plus b·t", () => {
  for (const [t, alpha, b, c] of [[20, 60, 2, 2], [30, 60, 2, 2], [50, 50, 3, 3]]) {
    const ch = C.chanfrein("X", { t, alpha, b, c });
    proche(ch.S, C.formules.X(t, alpha, b, c), 1e-9, `X t=${t}`);
    const partV = C.formules.V(t, alpha, 0, c), partX = C.formules.X(t, alpha, 0, c);
    proche(partX, partV / 2, 1e-9, "le X divise par deux le métal des biseaux");
  }
});

test("demi-V et K : section tracée = formules fermées", () => {
  proche(C.chanfrein("demiV", { t: 12, beta: 45, b: 2, c: 2 }).S, C.formules.demiV(12, 45, 2, 2), 1e-9, "demi-V");
  proche(C.chanfrein("K", { t: 24, beta: 45, b: 2, c: 2 }).S, C.formules.K(24, 45, 2, 2), 1e-9, "K");
});

test("chanfrein en U : section tracée à 0,5 % de la formule fermée", () => {
  for (const [t, beta, R, b, c] of [[20, 10, 6, 2, 3], [40, 8, 6, 2, 3], [60, 12, 8, 3, 3]]) {
    const ch = C.chanfrein("U", { t, beta, R, b, c });
    const f = C.formules.U(t, beta, R, b, c);
    assert.ok(Math.abs(ch.S - f) / f < 0.005, `U t=${t} : ${ch.S} au lieu de ${f}`);
  }
});

test("double U : deux J par pièce, de profondeur (t − c)/2", () => {
  const t = 60, beta = 10, R = 6, b = 2, c = 3, h = (t - c) / 2;
  const ch = C.chanfrein("UU", { t, beta, R, b, c });
  const f = 4 * C.formules.J1(h, beta, R) + b * t;
  assert.ok(Math.abs(ch.S - f) / f < 0.005, `${ch.S} au lieu de ${f}`);
});

test("aux fortes épaisseurs, le U et le double U demandent moins de métal que le V", () => {
  const t = 60;
  const V = C.chanfrein("V", { t, alpha: 60, b: 2, c: 2 }).S;
  const U = C.chanfrein("U", { t }).S, UU = C.chanfrein("UU", { t }).S, X = C.chanfrein("X", { t, alpha: 60, b: 2, c: 2 }).S;
  assert.ok(U < V && UU < X && X < V, `V ${V}, X ${X}, U ${U}, UU ${UU}`);
});

test("les profils restent dans l'épaisseur et hors de l'écartement", () => {
  for (const type of ["I", "V", "V2", "X", "U", "UU", "demiV", "K", "J"]) {
    const ch = C.chanfrein(type, { t: 30 });
    ch.vide.forEach(([x, y]) => {
      assert.ok(y >= -1e-9 && y <= 30 + 1e-9, `${type} : y = ${y}`);
    });
    assert.ok(ch.S > 0, `${type} : section nulle`);
    assert.ok(ch.plaques.every(P => C.aire(P) > 0), `${type} : plaque dégénérée`);
  }
});

test("gorge réelle : hauteur du plus grand triangle isocèle inscrit", () => {
  const z = 7;
  proche(C.gorges({ z1: z, s: 0 }).a, z / Math.SQRT2, 1e-9, "face plate");
  proche(C.gorges({ z1: z, s: 1.2 }).a, z / Math.SQRT2, 1e-9, "face convexe : le bombé ne compte pas");
  proche(C.gorges({ z1: z, s: -0.6 }).a, z / Math.SQRT2 - 0.6, 0.01, "face concave : le creux se retranche");
  proche(C.gorges({ z1: 6, z2: 9, s: 0 }).a, 6 / Math.SQRT2, 1e-9, "côtés inégaux : le plus petit côté commande");
  const g = C.gorges({ z1: z, s: 0.5, p: 1.5 });
  proche(g.aEff, g.a + 1.5, 1e-9, "la pénétration s'ajoute à la gorge efficace");
  assert.ok(g.totale > g.aEff, "la gorge totale inclut la surépaisseur");
});

test("relation côté et gorge d'un cordon isocèle : z = a·√2", () => {
  proche(C.zDeA(5), 7.071, 0.001, "a5 → z");
  proche(C.aDeZ(7), 4.950, 0.001, "z7 → a");
});

test("pleine pénétration : les scènes signalent la racine non fondue", () => {
  const deuxAngles = C.sceneTe({ t1: 12, t2: 16, mode: "angle", gauche: { z: 7 }, droite: { z: 7 } });
  assert.equal(deuxAngles.manques.length, 1, "deux cordons d'angle laissent un plan non fondu");
  const penetrants = C.sceneTe({ t1: 8, t2: 16, mode: "angle", gauche: { z: 7, p: 3 }, droite: { z: 7, p: 3 } });
  assert.equal(penetrants.manques.length, 0, "deux cordons pénétrants qui se rejoignent");
  assert.equal(C.sceneTe({ t1: 12, t2: 16, mode: "K" }).manques.length, 0, "K : pleine pénétration");
  assert.equal(C.sceneBoutDeuxCotes({ t: 8, pEndroit: 5, pEnvers: 4 }).manques.length, 0, "I des deux côtés, cordons qui se rejoignent");
  assert.equal(C.sceneBoutDeuxCotes({ t: 12, pEndroit: 4, pEnvers: 3 }).manques.length, 1, "cordons disjoints");
  assert.equal(C.sceneBout("V", { t: 16, penetre: false }).manques.length, 1, "V sans pénétration de la racine");
  assert.ok(C.sceneRecouvrement({ t: 6, gauche: true }).manques.length >= 1, "un recouvrement garde toujours son plan de contact");
});
