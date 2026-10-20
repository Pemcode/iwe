/* Mécanismes métallurgiques par famille d'alliages, et propriétés qui en découlent.
   Chaque famille fournit : init (état d'un nœud), pas (évolution pendant dt), global (couplage
   entre nœuds, facultatif) et proprietes (valeurs à 20 °C de la microstructure présente). */
(function (root, factory) {
  const O = (typeof module === 'object' && module.exports) ? require('./outils.js') : root.TTH.Outils;
  const api = factory(O);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTH = Object.assign(root.TTH || {}, { Mecanismes: api });
})(typeof globalThis !== 'undefined' ? globalThis : this, function (O) {
  'use strict';
  const { clamp, table, arrhenius, kY, kE, kRe, courbeC, avrami, relaxer, rmAcier, K0 } = O;
  const log10 = Math.log10;

  /* ———————————————————— Aciers trempants (M1, M2, M3, M6) ———————————————————— */

  function maynier(c, Vr) {
    const L = log10(clamp(Vr, 10, 3e6)); // vitesse de refroidissement à 700 °C, en °C/h
    const C = c.C, Si = c.Si || 0, Mn = c.Mn || 0, Ni = c.Ni || 0, Cr = c.Cr || 0, Mo = c.Mo || 0, V = c.V || 0;
    return {
      M: 127 + 949 * C + 27 * Si + 11 * Mn + 8 * Ni + 16 * Cr + 21 * L,
      B: -323 + 185 * C + 330 * Si + 153 * Mn + 65 * Ni + 144 * Cr + 191 * Mo + L * (89 + 53 * C - 55 * Si - 22 * Mn - 10 * Ni - 20 * Cr - 33 * Mo),
      FP: 42 + 223 * C + 53 * Si + 30 * Mn + 12.6 * Ni + 7 * Cr + 19 * Mo + L * (10 - 19 * Si + 4 * Ni + 8 * Cr + 130 * V)
    };
  }

  const SY_AUSTENITE = [[20, 220], [300, 170], [600, 100], [900, 40], [1200, 20]];

  const acier = {
    prepare(A) {
      if (!A._cFP) {
        A._cFP = courbeC(A.FP); A._cB = courbeC(A.B);
        A._phiEq = clamp((0.77 - A.composition.C) / (0.77 - 0.02), 0, 1);
      }
    },

    /** État de départ : celui de l'alliage, éventuellement précisé par le traitement (brut de forge, ségrégé…). */
    init(A, p, tr) {
      this.prepare(A);
      const propre = tr && tr.initial ? (typeof tr.initial === 'function' ? tr.initial(p, A) : tr.initial) : {};
      const ini = Object.assign({}, A.initial, propre);
      return { fF: ini.fF, fP: ini.fP, fP0: ini.fP, fB: 0, fM: 0, fMf: 0, fA: 0, dG: ini.dG || ini.dF, dA: ini.dF, gl: ini.gl || 0, seg: ini.seg || 0, seg0: ini.seg || 0,
        XFP: 0, XB: 0, cFP: 0, cB: 0, gam: 0, dTms: -1, fAms: -1, MsEff: A.Ms, fMq: 0, fAq: 0, fAr: 0, P: 0, Pf: 0, v700: 50 / 3600, t800: -1, t85: 0, Tmax: 20, aust: 0,
        ep: 0, eT: 0, sig: 0, vRev: 0, TB: 0, cond: 0, dissol: 0 };
    },

    /** Fraction d'austénite à l'équilibre : la perlite d'abord (Ac1), puis la ferrite jusqu'à Ac3. */
    austeniteEq(A, T, s) {
      if (T <= A.Ac1) return 0;
      const fP0 = s ? s.fP0 : A.initial.fP;
      return Math.min(1, fP0 + (1 - fP0) * clamp((T - A.Ac1) / (A.Ac3 - A.Ac1), 0, 1));
    },

    pas(s, T0, T1, dt, A, ctx) {
      const c = A.composition;
      s.Tmax = Math.max(s.Tmax, T1);
      const fA0 = s.fA;
      const chauffe = T1 > T0 + 1e-9;

      // M1 — austénitisation, puis croissance du grain austénitique (freinée par les précipités : limite dMax).
      const fEq = this.austeniteEq(A, T1, s);
      if (fEq > s.fA) {
        const tau = 3 * Math.exp(-(T1 - A.Ac1) / 40);
        let dA = (fEq - s.fA) * (1 - Math.exp(-dt / tau));
        for (const k of ['fP', 'fB', 'fM', 'fMf', 'fF']) { const d = Math.min(s[k], dA); s[k] -= d; dA -= d; s.fA += d; }
        // Austénitisation complète (la première, ou une nouvelle après retransformation) : grains neufs et fins.
        if (s.fA > 0.995 && !s.gam) {
          s.aust = 1; s.gam = 1; s.fA = 1; s.fF = s.fP = s.fB = s.fM = s.fMf = 0; s.dG = A.grain.d0; s.gl = 0; s.TB = 0;
          s.XFP = s.XB = s.cFP = s.cB = 0; s.dTms = -1; s.fAms = -1; s.fMq = 0; s.fAq = 0; s.P = 0; s.Pf = 0; s.ep = 0; s.eT = 0; s.cond = 0;
          ctx.signal('austenite');
        }
      }
      if (s.gam && s.fA < 0.5) s.gam = 0;
      if (s.fA > 0.995 && T1 > A.Ac3) {
        const g = A.grain, frein = g.dMax ? Math.max(0, 1 - s.dG / g.dMax) : 1;
        s.dG = Math.sqrt(s.dG * s.dG + g.Kref * arrhenius(g.Q, T1, g.Tref) * frein * dt);
        if (s.dG > 60) ctx.signal('grainGrossier');
        if (A.dissolution) s.dissol = Math.max(s.dissol, clamp((T1 - A.dissolution.T0) / A.dissolution.dT, 0, 1));
      }
      if (T0 < A.Ac1 && T1 >= A.Ac1) ctx.signal('Ac1');
      if (T0 < A.Ac3 && T1 >= A.Ac3) ctx.signal('Ac3');

      // M7 — homogénéisation : la ségrégation du manganèse s'efface par diffusion dans l'austénite
      // (profil sinusoïdal de période λ : amplitude ∝ exp(−4π²·D·t/λ²)).
      if (A.segregation && s.seg > 0 && s.fA > 0.5) {
        const g = A.segregation, lambda = (ctx.p.lambda || g.lambda) * 1e-6;
        const D = g.D0 * Math.exp(-g.Q / (O.R * (T1 + K0)));
        s.seg *= Math.exp(-4 * Math.PI * Math.PI * D * dt / (lambda * lambda));
        if (s.seg < 0.5 * s.seg0) ctx.signal('homogeneise');
      }

      // Un réchauffage au-dessus de Ms remet à zéro le compteur de la transformation martensitique.
      if (T1 > s.MsEff + 40 && s.fAms >= 0) { s.fAms = -1; s.fMq = 0; }

      // M2 — décomposition de l'austénite au refroidissement (additivité sur les courbes en C).
      if (!chauffe && s.fA > 1e-6) {
        const C0 = c.C;
        const cGamma = clamp((C0 - 0.02 * s.fF - 0.77 * s.fP - C0 * (s.fB + s.fM + s.fMf)) / Math.max(s.fA, 1e-6), 0.5 * C0, 0.85);
        let Ms = A.Ms - 423 * (cGamma - C0);
        if (A.raSecondaire && s.cond) Ms = A.raSecondaire.Ms;
        const dispo = s.fA - fEq;
        const g = s.dG / A.dRef;
        let dFP = 0, dB = 0;
        // Avancement rapporté à ce qui est transformable à la température atteinte : entre Ac3 et Ac1,
        // l'équilibre limite la ferrite ; plus bas, le reste de l'austénite redevient disponible.
        if (dispo > 1e-6 && T1 < A.FP.Te && T1 > Ms && !s.cond) {
          const base = s.cFP + dispo, X0 = s.cFP / base;
          const X = avrami(X0, A._cFP(T1) * Math.pow(g, A.FP.pGrain), A.FP.n, dt);
          dFP = Math.max(0, (X - X0) * base);
          s.XFP = X;
        }
        if (dispo - dFP > 1e-6 && T1 < A.B.Te && T1 > Ms - 30 && !s.cond) {
          const base = s.cB + dispo - dFP, X0 = s.cB / base;
          const X = avrami(X0, A._cB(T1) * Math.pow(g, A.B.pGrain), A.B.n, dt);
          dB = Math.max(0, (X - X0) * base);
          s.XB = X;
        }
        s.cFP += dFP; s.cB += dB;
        if (dFP > 0) {
          const fFP = s.fF + s.fP;
          const phi = T1 > A.Ac1 ? 1 : A._phiEq * clamp((T1 - 560) / 130, 0, 1);
          const dF = Math.min(dFP * phi, Math.max(0, (T1 > A.Ac1 ? 1 : A._phiEq) - s.fF));
          // Grain ferritique : d'autant plus fin que le refroidissement est rapide et le grain austénitique fin.
          const v = Math.max(0.002, (T0 - T1) / dt);
          const dAlpha = clamp(2 + 3 / Math.sqrt(v) + 45 * (1 - Math.exp(-0.007 * s.dG)), 3, 150);
          s.dA = fFP > 0.01 ? (s.dA * fFP + dAlpha * dFP) / (fFP + dFP) : dAlpha;
          s.gl = s.fP > 0 ? s.gl * s.fP / (s.fP + dFP - dF) : 0;
          s.fF += dF; s.fP += dFP - dF;
          if (s.fF + s.fP > 0.01) ctx.signal('ferritePerlite');
        }
        if (dB > 0) {
          s.TB = s.fB > 0 ? (s.TB * s.fB + T1 * dB) / (s.fB + dB) : T1;
          s.fB += dB; if (s.fB > 0.01) ctx.signal('bainite');
        }
        s.fA = Math.max(0, s.fA - dFP - dB);

        // Martensite (Koistinen-Marburger), au-dessous du Ms de l'austénite restante.
        if (T1 < Ms) {
          if (s.fAms < 0) { s.fAms = s.fA; s.MsEff = Ms; if (s.fA > 0.01) ctx.signal(s.P > 0 ? 'martensiteFraiche' : 'Ms'); }
          const cible = s.fAms * (1 - Math.exp(-A.kmAlpha * (s.MsEff - T1)));
          const dM = clamp(cible - s.fMq, 0, s.fA);
          if (s.P > 0) {
            // Après un premier revenu, la martensite qui naît est fraîche : elle n'a pas encore été revenue.
            if (dM > 0) { s.Pf = s.fMf > 0 ? s.Pf * s.fMf / (s.fMf + dM) : 0; s.fMf += dM; }
          } else s.fM += dM;
          s.fMq += dM; s.fA -= dM;
          if (s.fAms > 0.05 && s.fMq > 0.5 * s.fAms) ctx.signal('M50');
        }
        if (T0 >= 700 && T1 < 700) s.v700 = (T0 - T1) / dt;
        if (T0 >= 800 && T1 < 800) s.t800 = ctx.t;
        if (T0 >= 500 && T1 < 500 && s.t800 >= 0) s.t85 = ctx.t + dt - s.t800;
      }

      // Globulisation : sous Ac1, les lamelles de cémentite se fragmentent et coalescent en globules.
      if (A.globulisation && T1 > 550 && T1 < A.Ac1 && s.fP > 0.01) {
        const gb = A.globulisation, tau = gb.tauRef / arrhenius(gb.Q, T1, gb.Tref);
        const x = Math.min(s.gl, 0.9999), teq = tau * Math.pow(-Math.log(1 - x), 1 / gb.n);
        s.gl = 1 - Math.exp(-Math.pow((teq + dt) / tau, gb.n));
        if (s.gl > 0.5) ctx.signal('globulisation');
      }

      // M3 — revenu (paramètre de Hollomon-Jaffe), seulement pendant les segments de revenu.
      if (ctx.revenu && s.fM + s.fB + s.fMf > 0.01 && T1 > 80 && T1 < A.Ac1 + 60) {
        if (s.P === 0) { s.fAq = s.fA; s.fAr = s.fA; }
        const TK = T1 + K0, th = dt / 3600, C = A.revenu.C;
        const avance = P => TK * (C + log10((P > 0 ? Math.pow(10, P / TK - C) : 0) + th));
        s.P = Math.max(s.P, avance(s.P));
        if (s.fMf > 0.002) s.Pf = Math.max(s.Pf, avance(s.Pf));
        s.vRev = Math.max(s.vRev, T1);
        if (A.raSecondaire) {
          // Acier très allié : l'austénite résiduelle est seulement conditionnée par le revenu ; elle se transformera au refroidissement.
          if (s.fA > 0.002 && T1 > A.raSecondaire.T && !s.cond) { s.cond = 1; ctx.signal('conditionnement'); }
        } else if (s.fAr > 0 && T1 < A.Ac1) {
          // Stade 2 : seule l'austénite résiduelle de la trempe se décompose ; celle d'un revenu au-delà d'Ac1 reste à transformer.
          const lim = s.fAq * clamp((11600 - s.P) / 1100, 0, 1);
          const d = Math.min(s.fA, Math.max(0, s.fAr - lim));
          if (d > 0) { s.fB += d; s.fA -= d; s.fAr -= d; }
        }
        for (const [seuil, id] of [[9000, 'revenu1'], [10500, 'revenu2'], [11500, 'revenu3'], [14000, 'revenu4']]) if (s.P >= seuil) ctx.signal(id);
        if (A.carburesAllies && s.P >= A.carburesAllies.P) ctx.signal('durcissementSecondaire');
        if (ctx.segment.etape === 'revenu' && T1 > 250 && T1 < 400 && !A.raSecondaire) ctx.signal('fragiliteRevenu');
        if (T1 > A.Ac1) ctx.signal('revenuIntercritique');
      }

      // Plasticité de transformation : la phase qui naît s'allonge dans le sens de la contrainte.
      s.eT += A.trip * s.sig * Math.abs(s.fA - fA0);
    },

    phases(s) {
      return [['A', s.fA], ['F', s.fF], ['P', s.fP], ['B', s.fB], ['M', s.fM], ['Mf', s.fMf]];
    },

    /** Duretés des constituants : formules de Maynier, sauf valeurs propres à l'alliage (aciers très alliés). */
    constituants(A, s) {
      const h = Object.assign(maynier(A.composition, s.v700 * 3600), A.durete || {});
      const facteur = P => {
        if (!(P > 0)) return 1;
        const r = A.revenu;
        if (r.ancresSansCarbures) return (table(r.ancresSansCarbures, P) + (table(r.ancres, P) - table(r.ancresSansCarbures, P)) * s.dissol) / r.HVref;
        return table(r.ancres, P) / r.HVref;
      };
      const HM = h.M * facteur(s.P), HMf = h.M * facteur(s.Pf);
      // Bainite inférieure (formée bas) plus dure que la supérieure ; le revenu efface ensuite l'écart.
      const corr = s.TB > 0 && !A.durete ? clamp(0.6 * (450 - s.TB), -40, 60) : 0;
      const HB = s.P > 0 ? Math.min(h.B + corr, HM * 0.98) : h.B + corr;
      const HFP = h.FP - (h.FP - (h.FPglob || 0.82 * h.FP)) * s.gl;
      return { HM, HMf, HB, HFP, HA: 250 };
    },

    /** Limite d'élasticité d'un nœud à la température T (MPa). */
    limite(s, A, T) {
      const ky = kY(T), d = this.constituants(A, s);
      const martRevenue = s.P > 0 ? 0.9 * rmAcier(d.HM) * ky : 1500 * ky;
      const martFraiche = s.Pf > 0 ? 0.9 * rmAcier(d.HMf) * ky : 1500 * ky;
      return s.fA * table(SY_AUSTENITE, T) + (s.fF + s.fP) * 450 * ky + s.fB * 850 * ky + s.fM * martRevenue + s.fMf * martFraiche;
    },

    /** M6 et contraintes de trempe : modèle à fibres (sections planes, équilibre des efforts). */
    global(noeuds, T, A, ctx, dt, poids) {
      const n = noeuds.length;
      const Ee = new Float64Array(n), libre = new Float64Array(n), Sy = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        const s = noeuds[i], t = T[i];
        Ee[i] = A.E * kE(t) / (1 - A.nu);
        let e = 0;
        for (const [k, f] of this.phases(s)) { const [e0, a] = A.dilatation[k] || A.dilatation.M; e += f * (e0 + a * (t - 20)); }
        libre[i] = e + s.ep + s.eT;
        Sy[i] = Math.max(20, this.limite(s, A, t));
      }
      const equilibre = () => {
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) { num += poids[i] * Ee[i] * libre[i]; den += poids[i] * Ee[i]; }
        return num / den;
      };
      let eps = equilibre();
      for (let it = 0; it < 12; it++) {
        let viol = false;
        for (let i = 0; i < n; i++) {
          const sig = Ee[i] * (eps - libre[i]);
          if (Math.abs(sig) > Sy[i] * 1.0001) {
            const d = (sig - Math.sign(sig) * Sy[i]) / Ee[i];
            noeuds[i].ep += d; libre[i] += d; viol = true;
          }
        }
        if (!viol) break;
        eps = equilibre();
      }
      // Relaxation par fluage pendant les maintiens chauds.
      if (A.fluage && dt > 0) {
        let relaxe = false;
        for (let i = 0; i < n; i++) {
          if (T[i] < 350) continue;
          const sig = Ee[i] * (eps - libre[i]);
          const Ap = A.fluage.Aref * arrhenius(A.fluage.Q, T[i], A.fluage.Tref);
          const s2 = relaxer(sig, Ee[i] * (1 - A.nu), Ap, A.fluage.n, dt);
          const d = (sig - s2) / Ee[i];
          if (Math.abs(d) > 0) { noeuds[i].ep += d; libre[i] += d; relaxe = true; }
        }
        if (relaxe) eps = equilibre();
      }
      for (let i = 0; i < n; i++) noeuds[i].sig = Ee[i] * (eps - libre[i]);
      // Écart de température surface–cœur quand la surface atteint Ms : c'est lui qui déforme et fissure à la trempe.
      const sf = noeuds[n - 1];
      if (sf.dTms < 0 && sf.fA > 0.05 && T[n - 1] < A.Ms) {
        let hi = -Infinity, lo = Infinity;
        for (let i = 0; i < n; i++) { hi = Math.max(hi, T[i]); lo = Math.min(lo, T[i]); }
        for (const s of noeuds) s.dTms = hi - lo;
      }
    },

    proprietes(s, A) {
      const { HM, HMf, HB, HFP, HA } = this.constituants(A, s);
      const HV = s.fA * HA + (s.fF + s.fP) * HFP + s.fB * HB + s.fM * HM + s.fMf * HMf;
      const Rm = rmAcier(HV);
      const rM = P => (P > 0 ? 0.80 + 0.1 * clamp((P - 9000) / 8000, 0, 1) : 0.75);
      const ratio = s.fA * 0.45 + (s.fF + s.fP) * 0.62 + s.fB * 0.8 + s.fM * rM(s.P) + s.fMf * rM(s.Pf);
      const allM = (P, H) => (P > 0 ? clamp(32 - 0.045 * H, 4, 25) : 2);
      const A_ = s.fA * 30 + (s.fF + s.fP) * clamp(38 - 0.07 * HFP, 12, 30) + s.fB * clamp(30 - 0.04 * HB, 6, 22) + s.fM * allM(s.P, HM) + s.fMf * allM(s.Pf, HMf);
      // Ténacité : indice qualitatif 0–100 (martensite brute fragile, revenu haut tenace, creux 250–400 °C, gros grain, ségrégation).
      const tMart = P => {
        if (!(P > 0)) return 10;
        return 15 + 75 * clamp((P - 9000) / 9500, 0, 1) - 18 * Math.exp(-Math.pow((P - 12400) / 1100, 2));
      };
      const tFP = clamp(78 - 1.3 * s.dA, 12, 70) + 8 * s.gl;
      const tB = s.TB > 0 ? 45 + 20 * clamp((450 - s.TB) / 100, 0, 1) : 45;
      let ten = s.fA * 60 + (s.fF + s.fP) * tFP + s.fB * tB + s.fM * tMart(s.P) + s.fMf * tMart(s.Pf);
      ten -= 30 * clamp((s.dG - 30) / 100, 0, 1) * (s.fB + s.fM + s.fMf);
      ten -= 25 * clamp(s.seg / 0.3, 0, 1);
      // Îlots de martensite fraîche (non revenue) : amorces de rupture, bien plus nocifs que leur fraction.
      ten -= Math.min(30, 300 * s.fMf * clamp(1 - (s.Pf - 9000) / 6000, 0, 1));
      return {
        HV, Rm, Rp: Rm * ratio, A: A_, tenacite: clamp(ten, 2, 98), sigma: s.sig, grain: s.fF + s.fP > 0.5 ? s.dA : s.dG,
        phases: { A: s.fA, F: s.fF, P: s.fP, B: s.fB, M: s.fM, Mf: s.fMf }, P: s.P, t85: s.t85, gl: s.gl, globules: s.gl * 100, seg: s.seg * 100, ecartMs: s.dTms
      };
    }
  };

  /* ———————————————————— Assemblage soudé : TTAS (M3, M6) ———————————————————— */

  const soudure = {
    init(A, p) {
      return { sig: A.Re, P: 0, H: p.H0 != null ? p.H0 : 5, Tmax: 20, mart: 0, Hz0: p.Hz0 || A.revenu.HVref };
    },

    pas(s, T0, T1, dt, A, ctx) {
      s.Tmax = Math.max(s.Tmax, T1);
      // À déformation élastique figée, la contrainte suit le module d'Young quand la température change.
      s.sig *= kE(T1) / kE(T0);
      // Plafond : la contrainte ne peut dépasser la limite d'élasticité à chaud.
      const lim = A.Re * kRe(T1);
      if (Math.abs(s.sig) > lim) { s.sig = Math.sign(s.sig) * lim; ctx.signal('plafond'); }
      if (T1 > 350) {
        const Ap = A.fluage.Aref * arrhenius(A.fluage.Q, T1, A.fluage.Tref);
        s.sig = relaxer(s.sig, A.E * kE(T1), Ap, A.fluage.n, dt);
      }
      if (s.sig < 0.5 * A.Re) ctx.signal('relaxe50');
      if (T1 > 350) {
        const TK = T1 + K0, th = dt / 3600, C = A.revenu.C;
        const teq = s.P > 0 ? Math.pow(10, s.P / TK - C) : 0;
        s.P = Math.max(s.P, TK * (C + log10(teq + th)));
      }
      // Hydrogène diffusible : plaque d'épaisseur e = 2L qui dégaze par ses deux faces ;
      // premier mode de diffusion, temps caractéristique τ = e²/(π²·D), D effectif avec piégeage.
      const D = A.hydrogene.D20 * arrhenius(A.hydrogene.Q, T1, 20);
      s.Hmax = Math.max(s.Hmax || 0, s.H);
      const e = 2 * ctx.geometrie.L;
      s.H *= Math.exp(-dt * Math.PI * Math.PI * D / (e * e));
      if (s.H < 1) ctx.signal('hydrogene');
      if (T1 > A.Ac1) { s.mart = 1; ctx.signal('intercritique'); }
    },

    proprietes(s, A) {
      const f = s.P > 0 ? (table(A.revenu.ancres, s.P) - A.HVmb) / (A.revenu.HVref - A.HVmb) : 1;
      let HVz = A.HVmb + (s.Hz0 - A.HVmb) * clamp(f, 0, 1);
      if (s.mart) HVz = Math.max(HVz, 380);
      const sur = clamp((s.P - 18500) / 2000, 0, 1);
      const Re = A.Re * (1 - 0.08 * sur);
      let ten = 30 + 50 * clamp((s.P - 15000) / 2600, 0, 1) - 10 * sur;
      if (s.mart) ten = 20;
      // Risque de fissuration à froid : hydrogène rapporté à une teneur critique qui baisse quand la ZAT durcit,
      // pondéré par la contrainte (indice qualitatif 0–100, d'esprit proche des méthodes de préchauffage).
      const Hcr = A.hydrogene.Hcrit * Math.exp(-(HVz - 350) / 70);
      const r = s.H / Hcr;
      const risque = 100 * r / (1 + r) * Math.sqrt(clamp(s.sig / A.Re, 0.15, 1));
      return { HVz, HV: HVz, sigma: s.sig, H: s.H, Rp: Re, Rm: A.Rm * (1 - 0.06 * sur), tenacite: clamp(ten, 2, 98), P: s.P, mart: s.mart, risque };
    }
  };

  /* ———————————————————— Cuivre écroui : restauration, recristallisation, croissance (M4) ———————————————————— */

  const cuivre = {
    champs: ['eps', 'rho0', 'cv', 'X', 'Y', 'dR', 'drx', 'ox', 'h2', 'Tmax'],

    hvRecuit(A, d) { return A.hv.base + A.hv.hallPetch / Math.sqrt(d); },

    init(A, p) {
      const r = clamp(p.r || 0, 0, 0.8);
      const eps = -Math.log(1 - r);
      const dSig = (table(A.ecrouissage, r) - this.hvRecuit(A, A.d0)) / 0.3;
      const rho0 = Math.pow(Math.max(0, dSig) / A.taylor, 2) + 1e11;
      const ex = A.drx, rx = A.rx;
      const drx = eps > rx.epsC ? Math.min(ex.max, ex.ref * Math.pow(rx.epsRef / eps, ex.exposant) / Math.sqrt(1 - rx.epsC / eps)) : A.d0;
      return { eps, rho0, cv: Math.min(1, eps / 0.69), X: 0, Y: 0, dR: drx, drx, ox: 0, h2: 0, Tmax: 20 };
    },

    tauRx(s, A, T) {
      const rx = A.rx;
      if (s.eps <= rx.epsC) return Infinity;
      return rx.tauRef * Math.pow(rx.epsRef / s.eps, rx.m) / (1 - rx.epsC / s.eps) / arrhenius(rx.Q, T, rx.Tref);
    },

    pas(s, T0, T1, dt, A, ctx) {
      s.Tmax = Math.max(s.Tmax, T1);
      const v = A.lacunes;
      s.cv *= Math.exp(-dt / (v.tauRef / arrhenius(v.Q, T1, v.Tref)));
      if (s.eps > 0.01 && s.cv < 0.3 * Math.min(1, s.eps / 0.69)) ctx.signal('restauration');
      const tau = this.tauRx(s, A, T1);
      if (isFinite(tau)) {
        s.Y = 1 - (1 - s.Y) * Math.exp(-dt / (tau / 4));
        const t1 = tau * Math.pow(-Math.log(0.99), 1 / A.rx.n);
        s.X = Math.min(1, avrami(s.X, t1, A.rx.n, dt));
        if (s.X > 0.05) ctx.signal('rxDebut');
        if (s.X > 0.5) ctx.signal('rx50');
        if (s.X > 0.95) ctx.signal('rxFin');
      }
      if (s.X > 0.98 || (s.eps <= A.rx.epsC && T1 > 600)) {
        const g = A.croissance;
        s.dR = Math.sqrt(s.dR * s.dR + g.Kref * arrhenius(g.Q, T1, g.Tref) * dt);
        if (s.dR > 2 * s.drx && s.dR > 30) ctx.signal('croissance');
      }
      if (ctx.p.atmosphere === 'air' && T1 > 150) s.ox += dt * 2e-4 * arrhenius(90e3, T1, 400);
      if (ctx.p.atmosphere === 'H2' && T1 > 400) { s.h2 = Math.min(1, s.h2 + dt / 1800 * arrhenius(80e3, T1, 600)); if (s.h2 > 0.2) ctx.signal('hydrogeneCu'); }
    },

    rho(s) { return (1 - s.X) * (s.rho0 * (1 - 0.2 * s.Y)) + s.X * 1e11; },

    proprietes(s, A) {
      const rho = this.rho(s);
      const hvDef = this.hvRecuit(A, A.d0) + 0.3 * A.taylor * Math.sqrt(Math.max(0, s.rho0 * (1 - 0.2 * s.Y) - 1e11));
      const HV = (1 - s.X) * hvDef + s.X * this.hvRecuit(A, s.dR);
      const Rp = 65 + 4.02 * (HV - 47.5), Rm = 225 + 2.0 * (HV - 47.5);
      let A_ = clamp(45 - 0.68 * (HV - 47.5), 3, 50);
      if (s.h2 > 0.2) A_ *= 1 - 0.85 * clamp(s.h2, 0, 1);
      const r = A.resistivite;
      const rhoE = r.base + r.defauts * s.cv * (1 - s.X) + r.dislocations * rho;
      const sigmaE = 100 / rhoE;
      return { HV, Rp, Rm, A: A_, conductivite: sigmaE, iacs: sigmaE / 58 * 100, grain: (1 - s.X) * A.d0 + s.X * s.dR, X: s.X, rho, cv: s.cv, h2: s.h2 };
    }
  };

  /* ———————————————————— Aluminium Al-Mg-Si : mise en solution, trempe, maturation, revenu (M5) ———————————————————— */

  const aluminium = {
    champs: ['cs', 'gc', 'gb', 'rb', 'gq', 'cv', 'nat', 'brule', 'Tmax', 'pic', 'RpMax', 'sur'],

    init() {
      return { cs: 0.05, gc: 0, gb: 0, rb: 0.6, gq: 0.95, cv: 0, nat: 0, brule: 0, Tmax: 20, pic: 0, RpMax: 0, sur: 0 };
    },

    solubilite(A, T, Tsv) {
      if (T >= Tsv) return 1;
      return Math.exp(-A.solubilite * (1 / (T + K0) - 1 / (Tsv + K0)));
    },

    pas(s, T0, T1, dt, A, ctx) {
      if (!A._cTrempe) A._cTrempe = courbeC(A.trempe);
      s.Tmax = Math.max(s.Tmax, T1);
      if (T1 >= A.solidus) { s.brule = 1; ctx.signal('brulure'); }
      if (T0 < A.solvus && T1 >= A.solvus) ctx.signal('solvus');

      // Amas et β'' se redissolvent au-dessus de leur solvus métastable.
      const b = A.b2;
      if (T1 > A.solvusB2 - 30 && (s.gb > 0 || s.gc > 0)) {
        const k = 1 - Math.exp(-dt / (60 / arrhenius(b.Q, T1, A.solvusB2)));
        const d = s.gb * k + s.gc; s.gb -= s.gb * k; s.gc = 0; s.cs += d;
        if (s.gb < 1e-4) { s.gb = 0; s.rb = b.r0; }
      }
      if (T1 > A.solvusB2) s.nat = 0;

      // Phase d'équilibre grossière (Mg2Si) : dissolution vers la solubilité, ou précipitation lente.
      const ceq = this.solubilite(A, T1, A.solvus);
      if (s.cs < ceq && s.gq > 0) {
        const d = Math.min(s.gq, ceq - s.cs) * (1 - Math.exp(-dt / (A.dissolution.tauRef / arrhenius(A.dissolution.Q, T1, A.dissolution.Tref))));
        s.gq -= d; s.cs += d;
        if (T1 > 480 && s.gq < 0.03) ctx.signal('miseEnSolution');
      } else if (s.cs > ceq) {
        const tau = A._cTrempe(T1) / 0.01005;
        if (isFinite(tau)) { const d = (s.cs - ceq) * (1 - Math.exp(-dt / tau)); s.cs -= d; s.gq += d; if (s.gq > 0.1 && ctx.segment.type === 'trempe') ctx.signal('trempeLente'); }
      }

      // Lacunes figées par la trempe : sans elles, les amas ne se forment pratiquement pas à basse température.
      if (T0 >= 400 && T1 < 400) s.cv = clamp((T0 - T1) / dt / 20, 0, 1);
      s.cv *= Math.exp(-dt / (A.amas.tauLacunes / arrhenius(60e3, T1, 20)));

      // Amas de solutés (maturation, état T4).
      const a = A.amas;
      const fEq = a.eq * clamp((A.solvusAmas - T1) / (A.solvusAmas - 100), 0, 1);
      const cible = fEq * (s.cs + s.gc);
      const tauC = a.tauRef / arrhenius(a.Q, T1, a.Tref) / (0.03 + s.cv);
      const dC = (cible - s.gc) * (1 - Math.exp(-dt / tauC));
      s.gc += dC; s.cs -= dC;
      if (T1 < 60) s.nat = Math.max(s.nat, s.gc);
      if (s.gc > 0.3) ctx.signal('maturation');

      // β'' : précipitation durcissante, croissance puis coalescence.
      if (T1 < A.solvusB2 - 30) {
        const ceq2 = this.solubilite(A, T1, A.solvusB2);
        if (s.cs > ceq2) {
          const tau = b.tauRef * (1 + b.effetMaturation * s.nat) / arrhenius(b.Q, T1, b.Tref);
          const d = (s.cs - ceq2) * (1 - Math.exp(-dt / tau));
          s.cs -= d; s.gb += d;
        }
        if (s.gb > 0.01) s.rb = Math.cbrt(s.rb * s.rb * s.rb + b.kcRef * arrhenius(b.Q, T1, b.Tref) * dt / 3600);
        if (s.gb > 0.05 && ctx.revenu) ctx.signal('b2');
      }
      s.cs = Math.max(0, s.cs);
      const Rp = this.proprietes(s, A).Rp;
      if (ctx.revenu && s.gb > 0.05) {
        if (Rp > s.RpMax) s.RpMax = Rp;
        else if (Rp < s.RpMax - 3 && !s.pic) { s.pic = 1; ctx.signal('pic'); }
        // Sur-revenu : la résistance a réellement baissé après le pic (et non un rayon fixé d'avance).
        if (s.pic) {
          s.sur = Math.max(s.sur, clamp((s.RpMax - Rp - 3) / 30, 0, 1));
          if (s.sur > 0.25 && s.rb > b.rt) ctx.signal('surRevenu');
        }
      }
    },

    sigmaB2(s, A) {
      if (s.gb <= 0) return 0;
      const r = A.resistance, b = A.b2;
      const cis = r.b2 * Math.sqrt(s.gb * s.rb / b.rc);
      const oro = r.b2 * Math.sqrt(s.gb) * b.rc / s.rb;
      return 1 / (1 / cis + 1 / oro) * 2;
    },

    proprietes(s, A) {
      const r = A.resistance;
      const sB2 = this.sigmaB2(s, A);
      const sAmas = r.amas * s.gc;
      const Rp = r.s0 + r.ss * Math.pow(Math.max(0, s.cs), 2 / 3) + sAmas + sB2 + r.grossier * Math.sqrt(s.gq) + r.hp;
      const part = clamp(sB2 / Rp, 0, 1);
      const Rm = Rp + 12 + 75 * Math.pow(1 - part, 1.5);
      let A_ = clamp(24 - 0.045 * sB2 - 0.03 * sAmas, 6, 26);
      if (s.brule) A_ = 2;
      const HV = 0.306 * (Rp + 0.75 * (Rm - Rp));
      const e = A.resistivite;
      const rhoE = e.base + e.solute * s.cs + e.amas * s.gc + e.b2 * s.gb;
      const sigmaE = 1000 / rhoE;
      return { HV, Rp, Rm, A: A_, conductivite: sigmaE, iacs: sigmaE / 58 * 100, cs: s.cs, gc: s.gc, gb: s.gb, gq: s.gq, rb: s.rb, brule: s.brule };
    }
  };

  return { acier, soudure, cuivre, aluminium, maynier };
});
