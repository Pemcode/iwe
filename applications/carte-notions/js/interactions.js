/* Gestes sur la carte : glisser, pincer, molette, double-clic, clavier. Traduits en ordres pour l'application. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Interactions = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function attacher(toile, ordres) {
    const pointeurs = new Map();
    let depart = null, glisse = false, pince = null;

    const position = e => {
      const rect = toile.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };
    const ecartCentre = () => {
      const [a, b] = [...pointeurs.values()];
      return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    };

    toile.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      toile.setPointerCapture(e.pointerId);
      pointeurs.set(e.pointerId, position(e));
      if (pointeurs.size === 1) {
        depart = { p: position(e), tactile: e.pointerType !== 'mouse' };
        glisse = false;
      } else if (pointeurs.size === 2) {
        pince = ecartCentre();
        glisse = true;
        ordres.debutGeste();
      }
    });

    toile.addEventListener('pointermove', e => {
      const p = position(e);
      if (!pointeurs.has(e.pointerId)) {
        if (e.pointerType === 'mouse') ordres.survoler(p[0], p[1]);
        return;
      }
      const avant = pointeurs.get(e.pointerId);
      pointeurs.set(e.pointerId, p);
      if (pointeurs.size === 1 && depart) {
        if (!glisse && Math.hypot(p[0] - depart.p[0], p[1] - depart.p[1]) > (depart.tactile ? 8 : 4)) {
          glisse = true;
          toile.classList.add('saisi');
          ordres.debutGeste();
          ordres.deplacer(p[0] - depart.p[0], p[1] - depart.p[1]);
        } else if (glisse) {
          ordres.deplacer(p[0] - avant[0], p[1] - avant[1]);
        }
      } else if (pointeurs.size === 2 && pince) {
        const maintenant = ecartCentre();
        ordres.zoomer(maintenant.d / Math.max(1, pince.d), maintenant.c[0], maintenant.c[1]);
        ordres.deplacer(maintenant.c[0] - pince.c[0], maintenant.c[1] - pince.c[1]);
        pince = maintenant;
      }
    });

    const fin = e => {
      if (!pointeurs.has(e.pointerId)) return;
      const p = position(e);
      if (e.type === 'pointerup' && pointeurs.size === 1 && depart && !glisse) ordres.toucher(p[0], p[1], depart.tactile);
      pointeurs.delete(e.pointerId);
      if (pointeurs.size < 2) pince = null;
      if (pointeurs.size === 0) {
        toile.classList.remove('saisi');
        depart = null;
        glisse = false;
      } else if (pointeurs.size === 1) {
        // Après un pincement, le doigt restant reprend le glisser sans sauter.
        depart = { p: [...pointeurs.values()][0], tactile: true };
      }
    };
    toile.addEventListener('pointerup', fin);
    toile.addEventListener('pointercancel', fin);
    toile.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && !pointeurs.size) ordres.survoler(null); });

    toile.addEventListener('wheel', e => {
      e.preventDefault();
      const [x, y] = position(e);
      const pas = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      // Le pincement d'un pavé tactile arrive comme une molette avec ctrlKey : plus sensible.
      ordres.zoomer(Math.exp(-e.deltaY * pas * (e.ctrlKey ? 0.012 : 0.0016)), x, y);
    }, { passive: false });

    toile.addEventListener('dblclick', e => {
      const [x, y] = position(e);
      ordres.doubleClic(x, y);
    });

    toile.addEventListener('keydown', e => {
      const pas = e.shiftKey ? 220 : 70;
      const actions = {
        ArrowLeft: () => ordres.deplacer(pas, 0), ArrowRight: () => ordres.deplacer(-pas, 0),
        ArrowUp: () => ordres.deplacer(0, pas), ArrowDown: () => ordres.deplacer(0, -pas),
        '+': () => ordres.zoomerCentre(1.5), '=': () => ordres.zoomerCentre(1.5), '-': () => ordres.zoomerCentre(1 / 1.5),
        '0': () => ordres.recadrer(), Enter: () => ordres.valider()
      };
      if (actions[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        actions[e.key]();
      }
    });
  }

  return { attacher };
});
