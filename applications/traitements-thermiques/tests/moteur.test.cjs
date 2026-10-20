/* Moteur des traitements thermiques : invariants physiques et cibles de calage tirées des références. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../js/moteur.js');
const Mec = require('../js/mecanismes.js');
const { ALLIAGES } = require('../data/alliages.js');
const { TRAITEMENTS } = require('../data/traitements.js');

const tr = id => TRAITEMENTS.find(t => t.id === id);
function lancer(id, changements = {}) {
  const t = tr(id);
  const p = {};
  for (const r of t.reglages) p[r.id] = r.defaut;
  Object.assign(p, changements);
  return M.simuler(t, ALLIAGES[t.alliage], p);
}
const fin = (traj, point) => {
  const n = traj.points.find(p => p.id === point).noeud;
  return traj.famille.proprietes(traj.echantillons.at(-1).noeuds[n], traj.A);
};
const dans = (v, a, b, msg) => assert.ok(v >= a && v <= b, `${msg} : ${v.toFixed(1)} hors de [${a}, ${b}]`);

test('chaque traitement de la banque se simule, vite et de façon reproductible', () => {
  for (const t of TRAITEMENTS) {
    const debut = Date.now();
    const a = lancer(t.id), b = lancer(t.id);
    assert.ok(Date.now() - debut < 2000, t.id + ' trop lent');
    assert.equal(a.echantillons.length, b.echantillons.length);
    assert.deepEqual(a.echantillons.at(-1).noeuds, b.echantillons.at(-1).noeuds);
    assert.ok(a.segments.length >= 3);
    assert.equal(a.segments[0].u0, 0);
    assert.ok(Math.abs(a.segments.at(-1).u1 - 1) < 1e-9);
  }
});

test('le temps visuel est croissant et la lecture interpolée retrouve les échantillons', () => {
  const traj = lancer('trempe-revenu-42crmo4');
  const E = traj.echantillons;
  for (let i = 1; i < E.length; i++) assert.ok(E[i].u >= E[i - 1].u - 1e-12);
  const e = E[Math.floor(E.length / 2)];
  const s = M.etat(traj, e.u);
  assert.ok(Math.abs(s.T[0] - e.T[0]) < 1e-6 || E.filter(x => x.u === e.u).length > 1);
  for (const u of [0, 0.25, 0.5, 0.75, 1]) {
    const st = M.etat(traj, u);
    assert.ok(Number.isFinite(st.t) && st.T.every(Number.isFinite));
    const pr = traj.famille.proprietes(st.noeuds[0], traj.A);
    for (const k of ['HV', 'Rm', 'Rp', 'A']) assert.ok(Number.isFinite(pr[k]), k);
  }
  const si = M.segmentDe(traj, 0.5);
  const g = traj.segments[si];
  const ts = M.tsegDe(traj, si, (g.u0 + g.u1) / 2);
  assert.ok(Math.abs(M.uDe(traj, si, ts) - (g.u0 + g.u1) / 2) < 1e-9);
});

test('acier : les fractions de phases restent normées et le grain ne rétrécit pas au maintien', () => {
  const traj = lancer('trempe-revenu-42crmo4', { Taus: 1000, tAus: 60 });
  let dPrec = 0;
  for (const e of traj.echantillons) {
    for (const s of e.noeuds) {
      const somme = s.fA + s.fF + s.fP + s.fB + s.fM + s.fMf;
      assert.ok(Math.abs(somme - 1) < 1e-6, 'somme des phases = ' + somme);
      for (const k of ['fA', 'fF', 'fP', 'fB', 'fM', 'fMf']) assert.ok(s[k] >= -1e-9, k + ' négatif');
    }
    if (traj.segments[e.seg].id === 'austenitisation') { assert.ok(e.noeuds[0].dG >= dPrec - 1e-9); dPrec = e.noeuds[0].dG; }
  }
  assert.ok(dPrec > 60, 'surchauffe à 1000 °C : grain grossier attendu');
});

test('42CrMo4 trempé à l’huile et revenu à 600 °C : propriétés de l’EN 10083-3 selon le diamètre', () => {
  const d25 = fin(lancer('trempe-revenu-42crmo4', { D: 25 }), 'coeur');
  dans(d25.Rm, 1000, 1200, 'Rm Ø25'); assert.ok(d25.Rp >= 750, 'Rp Ø25'); assert.ok(d25.A >= 11, 'A Ø25');
  const d100 = fin(lancer('trempe-revenu-42crmo4', { D: 100 }), 'coeur');
  dans(d100.Rm, 900, 1100, 'Rm Ø100'); assert.ok(d100.Rp >= 650, 'Rp Ø100'); assert.ok(d100.A >= 12, 'A Ø100');
});

test('42CrMo4 : trempe à l’eau très dure, état recuit doux, cœur des grosses barres non martensitique', () => {
  const eau = lancer('trempe-revenu-42crmo4', { milieu: 'eau', revenu: false });
  assert.ok(fin(eau, 'surface').HV >= 620, 'surface trempée à l’eau ≥ 56 HRC');
  assert.ok(fin(eau, 'surface').phases.M > 0.9);
  const A = ALLIAGES['42CrMo4'];
  assert.ok(Mec.acier.proprietes(Mec.acier.init(A), A).HV <= 253, 'état +A ≤ 241 HB');
  const gros = fin(lancer('trempe-revenu-42crmo4', { D: 100, revenu: false }), 'coeur');
  assert.ok(gros.phases.M < 0.2, 'cœur Ø100 : bainite');
  const four = fin(lancer('trempe-revenu-42crmo4', { milieu: 'four', revenu: false }), 'coeur');
  assert.ok(four.phases.F + four.phases.P > 0.95, 'refroidi au four : ferrite + perlite');
});

test('42CrMo4 : le revenu adoucit de façon monotone avec la température', () => {
  const hv = [200, 350, 500, 600, 680].map(T => fin(lancer('trempe-revenu-42crmo4', { Trev: T, tRev: 1 }), 'surface').HV);
  for (let i = 1; i < hv.length; i++) assert.ok(hv[i] < hv[i - 1], 'dureté après revenu : ' + hv.join(' > '));
  const sans = fin(lancer('trempe-revenu-42crmo4', { revenu: false }), 'surface');
  const rev = fin(lancer('trempe-revenu-42crmo4'), 'surface');
  assert.ok(rev.tenacite > sans.tenacite + 25, 'le revenu rend tenace');
});

test('cuivre : écroui dans l’état R290, recuit dans l’état R220, la conductivité revient avant l’adoucissement', () => {
  const A = ALLIAGES['Cu-ETP'];
  const ecroui = Mec.cuivre.proprietes(Mec.cuivre.init(A, { r: 0.5 }), A);
  dans(ecroui.HV, 90, 110, 'HV écroui 50 %');
  const recuit = fin(lancer('recristallisation-cuivre', { Trec: 400 }), 'coeur');
  dans(recuit.HV, 40, 65, 'HV recuit'); assert.ok(recuit.conductivite >= 58, 'conductivité recuit ≥ 58 MS/m');
  const restaure = fin(lancer('recristallisation-cuivre', { Trec: 180 }), 'coeur');
  assert.ok(restaure.HV > 90 && restaure.conductivite > ecroui.conductivite + 0.5, 'restauration sans recristallisation');
  const critique = fin(lancer('recristallisation-cuivre', { r: 0.06, Trec: 600 }), 'coeur');
  assert.ok(critique.grain > 100, 'écrouissage critique : gros grains');
  const normal = fin(lancer('recristallisation-cuivre', { r: 0.5, Trec: 600 }), 'coeur');
  assert.ok(normal.grain < critique.grain / 2);
  const h2 = fin(lancer('recristallisation-cuivre', { Trec: 600, atmosphere: 'H2' }), 'coeur');
  assert.ok(h2.A < 15, 'maladie de l’hydrogène : ductilité effondrée');
});

test('6082 : états T4 et T6 conformes à l’EN 755-2, conductivités proches des fiches producteur', () => {
  const t6 = fin(lancer('durcissement-6082'), 'coeur');
  assert.ok(t6.Rp >= 260 && t6.Rm >= 310, `T6 : Rp ${t6.Rp.toFixed(0)}, Rm ${t6.Rm.toFixed(0)}`);
  dans(t6.conductivite, 24.5, 26.5, 'conductivité T6 (≈ 25,6 MS/m)');
  const t4 = fin(lancer('durcissement-6082', { revenu: false, delai: 168 }), 'coeur');
  assert.ok(t4.Rp >= 110 && t4.Rm >= 205, `T4 : Rp ${t4.Rp.toFixed(0)}, Rm ${t4.Rm.toFixed(0)}`);
  dans(t4.conductivite, 23.5, 25.5, 'conductivité T4 (≈ 24,4 MS/m)');
  const A = ALLIAGES['AW-6082'];
  dans(Mec.aluminium.proprietes(Mec.aluminium.init(A), A).Rm, 100, 160, 'Rm état O');
});

test('6082 : la courbe de vieillissement suit les mesures du producteur et le pic arrive plus tôt à chaud', () => {
  const H = { 175: [[1, 188], [3, 257], [5, 292], [9, 311], [13, 310], [24, 307], [48, 290]], 195: [[0.5, 260], [1, 290], [2, 306], [3, 303], [6, 292], [13, 263]] };
  const pics = {};
  let e2 = 0, n = 0;
  for (const T of [175, 195]) {
    const traj = lancer('durcissement-6082', { e: 3, delai: 24, Trev: T, tRev: 48 });
    const E = traj.echantillons.filter(e => traj.segments[e.seg].id === 'revenu');
    const rp = h => { const k = E.findIndex(e => e.tseg >= h * 3600); return traj.famille.proprietes(E[k < 0 ? E.length - 1 : k].noeuds[0], traj.A).Rp; };
    for (const [h, mesure] of H[T]) { e2 += (rp(h) - mesure) ** 2; n++; }
    let best = 0, tPic = 0;
    for (const e of E) { const v = traj.famille.proprietes(e.noeuds[0], traj.A).Rp; if (v > best) { best = v; tPic = e.tseg; } }
    pics[T] = tPic;
  }
  assert.ok(Math.sqrt(e2 / n) < 12, 'écart quadratique au producteur ' + Math.sqrt(e2 / n).toFixed(1) + ' MPa');
  assert.ok(pics[195] < pics[175] / 2, 'pic plus précoce à 195 °C');
});

test('6082 : trempe lente, sous-solution et brûlure dégradent l’état T6', () => {
  const ref = fin(lancer('durcissement-6082'), 'coeur');
  assert.ok(fin(lancer('durcissement-6082', { trempe: 'air' }), 'coeur').Rp < ref.Rp - 50, 'trempe à l’air');
  assert.ok(fin(lancer('durcissement-6082', { Tsol: 480 }), 'coeur').Rp < ref.Rp - 15, 'mise en solution trop froide');
  assert.equal(fin(lancer('durcissement-6082', { Tsol: 590 }), 'coeur').A, 2, 'brûlure');
});

test('TTAS : relaxation des contraintes et revenu de la ZAT selon la température de palier', () => {
  const A = ALLIAGES['S355'];
  const ok = fin(lancer('ttas-s355'), 'coeur');
  assert.ok(ok.sigma <= 0.3 * A.Re, 'contrainte après 600 °C, 2 h : ' + ok.sigma.toFixed(0));
  assert.ok(ok.HVz <= 320, 'ZAT ≤ 320 HV10 après TTAS (EN ISO 15614-1)');
  assert.ok(ok.H < 1, 'hydrogène diffusible chassé');
  const froid = fin(lancer('ttas-s355', { Tp: 500 }), 'coeur');
  assert.ok(froid.sigma >= 0.4 * A.Re, 'palier à 500 °C insuffisant');
  const chaud = fin(lancer('ttas-s355', { Tp: 740 }), 'coeur');
  assert.equal(chaud.mart, 1, 'au-dessus d’Ac1 : martensite fraîche');
  const traj = lancer('ttas-s355');
  let prec = Infinity;
  for (const e of traj.echantillons) if (traj.segments[e.seg].id === 'palier') { assert.ok(e.noeuds[0].sig <= prec + 1e-6); prec = e.noeuds[0].sig; }
});

/* ——— Lot 2 : aciers ——— */

test('aciers : fractions normées pour chaque traitement et chaque exemple de la banque', () => {
  for (const t of TRAITEMENTS.filter(x => ALLIAGES[x.alliage].famille === 'acier')) {
    for (const ex of [{}, ...t.exemples.map(x => x.valeurs)]) {
      const traj = lancer(t.id, ex);
      for (const e of traj.echantillons) for (const s of e.noeuds) {
        const somme = s.fA + s.fF + s.fP + s.fB + s.fM + s.fMf;
        assert.ok(Math.abs(somme - 1) < 1e-6, `${t.id} : somme des phases ${somme}`);
      }
    }
  }
});

test('C45 : le recuit adoucit et grossit le grain, la normalisation affine un grain de forge', () => {
  const recuit = fin(lancer('recuit-complet-c45'), 'coeur');
  const norm = fin(lancer('normalisation-c45'), 'coeur');
  assert.ok(recuit.phases.F + recuit.phases.P > 0.99 && norm.phases.F + norm.phases.P > 0.99, 'ferrite + perlite');
  assert.ok(recuit.HV <= 207 && recuit.HV < norm.HV - 15, `recuit ${recuit.HV.toFixed(0)} HV, normalisé ${norm.HV.toFixed(0)} HV`);
  dans(norm.Rm, 620, 760, 'Rm normalisé (EN 10083-2 : ≥ 620 MPa)');
  assert.ok(norm.grain <= 15 && recuit.grain >= 2.5 * norm.grain, `grain normalisé ${norm.grain.toFixed(0)} µm, recuit ${recuit.grain.toFixed(0)} µm`);
  const brut = Mec.acier.proprietes(Mec.acier.init(ALLIAGES.C45, {}, tr('normalisation-c45')), ALLIAGES.C45);
  assert.ok(brut.grain >= 60 && norm.tenacite > brut.tenacite + 20, 'gros grain de forge effacé');
  assert.ok(fin(lancer('normalisation-c45', { Taus: 760 }), 'coeur').grain > 2.5 * norm.grain, 'sous Ac3 : pas d’affinage');
  assert.ok(fin(lancer('normalisation-c45', { Taus: 1000 }), 'coeur').grain > 1.8 * norm.grain, 'trop chaud : grain regrossi');
});

test('C45 : la globulisation se compte en heures sous Ac1 et adoucit l’acier', () => {
  const g16 = fin(lancer('globulisation-c45'), 'coeur'), g4 = fin(lancer('globulisation-c45', { tg: 4 }), 'coeur');
  const froid = fin(lancer('globulisation-c45', { Tg: 640 }), 'coeur');
  assert.ok(g16.globules > 75 && g4.globules < g16.globules - 15 && froid.globules < 50, `${g4.globules.toFixed(0)} % / ${g16.globules.toFixed(0)} % / ${froid.globules.toFixed(0)} %`);
  const depart = Mec.acier.proprietes(Mec.acier.init(ALLIAGES.C45, {}, tr('globulisation-c45')), ALLIAGES.C45);
  assert.ok(g16.HV < 0.88 * depart.HV && g16.A > depart.A, 'adoucissement (−10 à −20 %) et ductilité');
  assert.equal(g16.phases.A, 0, 'jamais d’austénite sous Ac1');
});

test('G20Mn5 : l’homogénéisation efface la ségrégation, la normalisation seule ne le peut pas', () => {
  const ok = fin(lancer('homogeneisation-g20mn5'), 'coeur');
  const seule = fin(lancer('homogeneisation-g20mn5', { homog: false }), 'coeur');
  const sansN = lancer('homogeneisation-g20mn5', { norm: false });
  assert.ok(ok.seg < 0.4 * 30 && seule.seg > 0.95 * 30, `ségrégation ${ok.seg.toFixed(1)} % contre ${seule.seg.toFixed(1)} %`);
  assert.ok(fin(lancer('homogeneisation-g20mn5', { Th: 1050 }), 'coeur').seg > 0.8 * 30, 'trop froid : le manganèse ne bouge pas');
  assert.ok(fin(lancer('homogeneisation-g20mn5', { lambda: 250 }), 'coeur').seg > 2 * ok.seg, 'durée ∝ λ²');
  assert.ok(sansN.echantillons.at(-1).noeuds[0].dG > 300, 'grain austénitique énorme après 10 h à 1200 °C');
  assert.ok(ok.tenacite > seule.tenacite + 10 && ok.tenacite > fin(sansN, 'coeur').tenacite + 20, 'homogénéiser puis normaliser');
  dans(ok.Rm, 480, 620, 'Rm G20Mn5 +N (EN 10293)');
});

test('34CrNiMo6 : étagée bainitique complète, étagée martensitique sans gradient au passage de Ms', () => {
  const bain = fin(lancer('trempes-etagees-34crnimo6'), 'coeur');
  assert.ok(bain.phases.B > 0.98, 'bainite après 2 h à 380 °C'); dans(bain.HV, 400, 490, 'bainite inférieure');
  assert.ok(fin(lancer('trempes-etagees-34crnimo6', { Tb: 470 }), 'coeur').HV < bain.HV - 30, 'bainite supérieure plus douce');
  assert.ok(fin(lancer('trempes-etagees-34crnimo6', { tb: 30 }), 'coeur').phases.M > 0.3, 'palier trop court : martensite fraîche à l’air');
  const mart = fin(lancer('trempes-etagees-34crnimo6', { mode: 'martensitique', Tb: 340, tb: 10, revenu: false }), 'surface');
  const huile = fin(lancer('trempes-etagees-34crnimo6', { mode: 'huile', revenu: false }), 'surface');
  assert.ok(mart.phases.M > 0.9 && huile.phases.M > 0.9, 'martensite dans les deux cas');
  assert.ok(mart.ecartMs >= 0 && mart.ecartMs < 15 && huile.ecartMs > 50, `écart à Ms : bain ${mart.ecartMs.toFixed(0)} °C, huile ${huile.ecartMs.toFixed(0)} °C`);
  assert.ok(fin(lancer('trempes-etagees-34crnimo6', { mode: 'martensitique', Tb: 340, tb: 90, revenu: false }), 'coeur').phases.B > 0.1, 'palier trop long : la bainite démarre');
  assert.ok(bain.ecartMs < 0, 'étagée bainitique : la martensite ne se forme pas');
});

test('X40CrMoV5-1 : durcissement secondaire et double revenu (courbes des producteurs)', () => {
  const hv = T => fin(lancer('durcissement-secondaire-x40crmov5', { Trev: T }), 'coeur').HV;
  const h540 = hv(540), h600 = hv(600), h650 = hv(650);
  dans(h600, 440, 500, 'HV après 2 × 2 h à 600 °C (≈ 45–49 HRC)');
  assert.ok(h540 > h600 + 40 && h600 > h650 + 40, `${h540.toFixed(0)} > ${h600.toFixed(0)} > ${h650.toFixed(0)} HV`);
  const un = lancer('durcissement-secondaire-x40crmov5', { nRev: 1 }), deux = lancer('durcissement-secondaire-x40crmov5');
  const s1 = un.echantillons.at(-1).noeuds[0], s2 = deux.echantillons.at(-1).noeuds[0];
  assert.ok(s1.fMf > 0.02 && s1.Pf < 9000 && s2.Pf > 15000, 'la martensite fraîche n’est revenue que par le second revenu');
  assert.ok(fin(deux, 'coeur').tenacite > fin(un, 'coeur').tenacite + 10, 'un seul revenu : moins tenace');
  assert.ok(fin(lancer('durcissement-secondaire-x40crmov5', { Taus: 980, Trev: 540 }), 'coeur').HV < h540 - 25, 'carbures mal dissous');
  const air = fin(lancer('durcissement-secondaire-x40crmov5', { milieu: 'air' }), 'coeur');
  assert.ok(air.phases.M + air.phases.Mf > 0.95, 'trempant à l’air');
});

test('P91 : martensite à l’air, dureté de 190 à 250 HV après revenu, piège au-delà d’Ac1', () => {
  const ok = fin(lancer('normalisation-revenu-p91'), 'coeur');
  dans(ok.HV, 190, 250, 'HV après N + R 760 °C'); assert.ok(ok.Rm >= 630 && ok.Rp >= 450 && ok.A >= 20, 'EN 10216-2');
  assert.ok(fin(lancer('normalisation-revenu-p91', { e: 100 }), 'coeur').phases.M > 0.95, 'paroi de 100 mm martensitique à l’air');
  assert.ok(fin(lancer('normalisation-revenu-p91', { Trev: 700 }), 'coeur').HV > 250, 'revenu trop froid');
  const ac1 = fin(lancer('normalisation-revenu-p91', { Trev: 840 }), 'coeur');
  assert.ok(ac1.phases.Mf > 0.15 && ac1.HV > ok.HV + 25 && ac1.tenacite < ok.tenacite - 30, 'revenu intercritique : martensite fraîche');
});

test('S690QL : le post-chauffage chasse l’hydrogène et fait tomber le risque de fissuration à froid', () => {
  const pc = fin(lancer('post-chauffage-s690'), 'coeur'), sans = fin(lancer('post-chauffage-s690', { pc: false }), 'coeur');
  assert.ok(pc.H < 1 && pc.risque < 25, `avec : ${pc.H.toFixed(2)} ml/100 g, risque ${pc.risque.toFixed(0)}`);
  assert.ok(sans.H > 5 && sans.risque > 60, `sans : ${sans.H.toFixed(2)} ml/100 g, risque ${sans.risque.toFixed(0)}`);
  assert.ok(fin(lancer('post-chauffage-s690', { Tpc: 150 }), 'coeur').H > 3, 'trop froid');
  assert.ok(fin(lancer('post-chauffage-s690', { e: 70 }), 'coeur').H > 4 * pc.H, 'durée ∝ e²');
  assert.ok(pc.sigma > 0.85 * ALLIAGES.S690QL.Re && pc.HVz === sans.HVz, 'pas de détensionnement ni de revenu');
});

test('10CrMo9-10 : il faut 680–720 °C pour détensionner un Cr-Mo', () => {
  const A = ALLIAGES['10CrMo9-10'];
  const ok = fin(lancer('ttas-10crmo9-10'), 'coeur'), cmn = fin(lancer('ttas-10crmo9-10', { Tp: 600 }), 'coeur');
  assert.ok(ok.sigma <= 0.3 * A.Re && ok.HVz <= 250, `690 °C : ${ok.sigma.toFixed(0)} MPa, ${ok.HVz.toFixed(0)} HV`);
  const s355 = fin(lancer('ttas-s355'), 'coeur');
  assert.ok(cmn.sigma / A.Re > 1.5 * s355.sigma / ALLIAGES.S355.Re && cmn.HVz > 300, 'à 600 °C, le Cr-Mo relaxe et se revient bien moins qu’un C-Mn');
  assert.equal(fin(lancer('ttas-10crmo9-10', { Tp: 810 }), 'coeur').mart, 1, 'au-dessus d’Ac1');
});

