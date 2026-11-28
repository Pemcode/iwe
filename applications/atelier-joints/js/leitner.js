/* Atelier des joints : leitner.js
   Révision espacée des erreurs : cinq boîtes, revues après 0, 1, 3, 7 et 14 jours.
   Une carte est un exercice reproductible { niveau, mode, graine } ; une erreur la remet en boîte 1,
   une réussite la fait monter ; réussie en boîte 5, elle est maîtrisée et quitte les boîtes. Module UMD. */
(function (racine, fabrique) {
  if (typeof module === "object" && module.exports) module.exports = fabrique();
  else racine.Leitner = fabrique();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const JOUR = 86400000, DELAIS = [0, 1, 3, 7, 14];
  const neuf = () => ({ version: 1, cartes: {}, maitrisees: 0 });
  const id = c => c.niveau + (c.mode === "coder" ? "c" : "d") + "-" + c.graine;
  const valideCarte = c => c && Number.isInteger(c.niveau) && c.niveau >= 1 && c.niveau <= 5 && (c.mode === "decoder" || c.mode === "coder") && Number.isInteger(c.graine);
  function erreur(b, c, maintenant) {
    if (!valideCarte(c)) return;
    b.cartes[id(c)] = { niveau: c.niveau, mode: c.mode, graine: c.graine, boite: 1, due: maintenant };
  }
  function reussite(b, c, maintenant) {
    const k = id(c), x = b.cartes[k];
    if (!x) return;
    if (x.boite >= 5) { delete b.cartes[k]; b.maitrisees += 1; return; }
    x.boite += 1;
    x.due = maintenant + DELAIS[x.boite - 1] * JOUR;
  }
  function dues(b, maintenant, max) {
    const l = Object.values(b.cartes).filter(x => x.due <= maintenant).sort((p, q) => p.boite - q.boite || p.due - q.due);
    return max ? l.slice(0, max) : l;
  }
  function compter(b) { const n = [0, 0, 0, 0, 0]; Object.values(b.cartes).forEach(x => { n[x.boite - 1] += 1; }); return n; }
  const total = b => Object.keys(b.cartes).length;
  function restaurer(brut) {
    try {
      const x = JSON.parse(brut);
      if (!x || x.version !== 1 || typeof x.cartes !== "object" || x.cartes === null) return neuf();
      const b = neuf();
      Object.values(x.cartes).forEach(c => {
        if (valideCarte(c) && Number.isInteger(c.boite) && c.boite >= 1 && c.boite <= 5 && Number.isFinite(c.due))
          b.cartes[id(c)] = { niveau: c.niveau, mode: c.mode, graine: c.graine, boite: c.boite, due: c.due };
      });
      b.maitrisees = Number.isInteger(x.maitrisees) && x.maitrisees >= 0 ? x.maitrisees : 0;
      return b;
    } catch (e) { return neuf(); }
  }
  return { JOUR, DELAIS, neuf, id, erreur, reussite, dues, compter, total, restaurer };
});
