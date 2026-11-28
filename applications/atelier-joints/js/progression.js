/* Atelier des joints : progression.js
   Étoiles par niveau et par mode, déblocage des niveaux et de l'examen, sauvegarde tolérante aux données corrompues.
   Clés d'étoiles : "<niveau><d|c>" (d = Décoder, c = Coder). Module UMD. */
(function (racine, fabrique) {
  if (typeof module === "object" && module.exports) module.exports = fabrique();
  else racine.Progression = fabrique();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const NIV = 5;
  const neuf = () => ({ version: 1, etoiles: {}, libre: false, examMeilleur: 0, examTentatives: 0 });
  const etoiles = score => score >= 10 ? 3 : score === 9 ? 2 : score === 8 ? 1 : 0;
  const cle = (n, mode) => n + (mode === "coder" ? "c" : "d");
  function noter(p, n, mode, score) {
    const k = cle(n, mode), e = etoiles(score);
    if (e > (p.etoiles[k] || 0)) p.etoiles[k] = e;
    return e;
  }
  const valide = (p, n) => (p.etoiles[cle(n, "decoder")] || 0) > 0 || (p.etoiles[cle(n, "coder")] || 0) > 0;
  const debloque = (p, n) => n === 1 || !!p.libre || valide(p, n - 1);
  const examenOuvert = p => !!p.libre || Array.from({ length: NIV }, (_, i) => i + 1).every(n => (p.etoiles[cle(n, "decoder")] || 0) > 0);
  function noterExamen(p, pourcent) {
    p.examTentatives += 1;
    p.examMeilleur = Math.max(p.examMeilleur, Math.round(pourcent));
  }
  function restaurer(brut) {
    try {
      const x = JSON.parse(brut);
      if (!x || x.version !== 1 || typeof x.etoiles !== "object" || x.etoiles === null || Array.isArray(x.etoiles)) return neuf();
      const p = neuf();
      Object.keys(x.etoiles).forEach(k => {
        const m = /^([1-5])([dc])$/.exec(k), v = x.etoiles[k];
        if (m && [1, 2, 3].indexOf(v) >= 0) p.etoiles[k] = v;
      });
      p.libre = x.libre === true;
      p.examMeilleur = Number.isFinite(x.examMeilleur) ? Math.max(0, Math.min(100, Math.round(x.examMeilleur))) : 0;
      p.examTentatives = Number.isInteger(x.examTentatives) && x.examTentatives >= 0 ? Math.min(x.examTentatives, 100000) : 0;
      return p;
    } catch (e) { return neuf(); }
  }
  return { NIV, neuf, etoiles, cle, noter, valide, debloque, examenOuvert, noterExamen, restaurer };
});
