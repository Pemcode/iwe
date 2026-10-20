/* Alliages de référence : données d'entrée du modèle, chacune rattachée à sa source.
   Les valeurs sont des ordres de grandeur pour une nuance médiane, pas des valeurs de calcul. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTH = Object.assign(root.TTH || {}, { ALLIAGES: api });
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCES = {
    en10083: 'EN 10083-3 : aciers pour trempe et revenu, aciers alliés (composition, état recuit +A, propriétés +QT selon le diamètre, bande de trempabilité Jominy +H)',
    andrews: 'K. W. Andrews, « Empirical formulae for the calculation of some transformation temperatures », J. Iron Steel Inst., 1965 (Ac1, Ac3, Ms)',
    steven: 'W. Steven, A. G. Haynes, « The temperature of formation of martensite and bainite in low-alloy steels », J. Iron Steel Inst., 1956 (Bs)',
    km: 'D. P. Koistinen, R. E. Marburger, Acta Metallurgica, 1959 (avancement de la transformation martensitique)',
    ho: 'J. M. Hodge, M. A. Orehoski, « Relationship between hardenability and percentage of martensite in some low-alloy steels », Trans. AIME, 1946 (dureté selon le taux de martensite)',
    maynier: 'P. Maynier, B. Jungmann, J. Dollet, « Creusot-Loire system for the prediction of the mechanical properties of low alloy steel products », 1978 (dureté de la martensite, de la bainite et de la ferrite-perlite)',
    hj: 'J. H. Hollomon, L. D. Jaffe, « Time-temperature relations in tempering steel », Trans. AIME, 1945 (paramètre de revenu)',
    cours: 'Courbes de revenu d’une heure : mêmes allures que dans le cours « Aciers : martensite, traitements thermiques et soudage » du wiki',
    ec3: 'EN 1993-1-2, tableau 3.1 : coefficients de réduction de la limite d’élasticité et du module de l’acier à chaud',
    iso18265: 'EN ISO 18265 : conversion des valeurs de dureté (dureté Vickers ↔ résistance à la traction des aciers, valeur indicative)',
    porter: 'D. A. Porter, K. E. Easterling, M. Y. Sherif, Phase Transformations in Metals and Alloys, CRC Press (Avrami, additivité, croissance des grains, précipitation)',
    barralis: 'J. Barralis, G. Maeder, Précis de métallurgie, Nathan (traitements thermiques des aciers et des alliages non ferreux)',
    asm4: 'ASM Handbook, vol. 4 « Heat Treating » et vol. 4E « Heat Treating of Nonferrous Alloys », ASM International',
    en1652: 'EN 1652 et EN 13599 : cuivre en tôles et bandes (états R220 à R360 : Rm, Rp0,2, HV), repris par les fiches des producteurs',
    iacs: 'IACS (International Annealed Copper Standard, 1913) : 100 % IACS = 58,0 MS/m à 20 °C',
    en573: 'EN 573-3 (composition de l’EN AW-6082), EN 755-2 (minima des états T4 et T6 des profilés), EN 515 (désignation des états)',
    hydro: 'Hydro, fiche technique « EN AW-6082 » (rév. 4, 2023) : courbes de vieillissement de 165 à 195 °C après 24 h de maturation, résistivités des états T4 et T6, intervalle de fusion 575–650 °C',
    en10025: 'EN 10025-2 : aciers de construction non alliés (S355)',
    iso15614: 'EN ISO 15614-1 : qualification des modes opératoires de soudage (duretés maximales des groupes d’aciers 1 et 2 : 380 HV10 sans traitement thermique, 320 HV10 avec)',
    asme: 'ASME BPVC section VIII div. 1, UCS-56 : exemple de prescriptions de TTAS des aciers au carbone (P-No. 1 : au moins 595 °C, 1 h par 25 mm, vitesses de chauffe et de refroidissement limitées au-dessus de 425 °C)',
    norton: 'Loi de Norton : vitesse de fluage ε̇ = A·σⁿ·exp(−Q/RT) ; relaxation des contraintes à déformation totale imposée',
    en10083_2: 'EN 10083-2 : aciers non alliés pour trempe et revenu (C45 : composition, états +N, +A et +QT)',
    en10293: 'EN 10293 : aciers moulés d’usage général (G20Mn5 : composition, état normalisé +N)',
    iso4957: 'EN ISO 4957 : aciers à outils (X40CrMoV5-1 : composition, trempe et revenu)',
    en10216: 'EN 10216-2 : tubes sans soudure pour service à température élevée (X10CrMoVNb9-1 dit P91, 10CrMo9-10 : normalisation et revenu, propriétés)',
    en10028: 'EN 10028-2 : produits plats pour appareils à pression, aciers pour températures élevées (10CrMo9-10)',
    en10025_6: 'EN 10025-6 : aciers de construction à haute limite d’élasticité, trempés et revenus (S690QL)',
    en1011: 'EN 1011-2 : recommandations pour le soudage des aciers ferritiques (préchauffage, hydrogène, post-chauffage de dégazage)',
    iso3690: 'ISO 3690 : dosage de l’hydrogène diffusible dans le métal fondu (désorption à l’ambiante en quelques jours pour l’éprouvette normalisée)',
    smithells: 'Tables de diffusion (Smithells Metals Reference Book ; Landolt-Börnstein) : manganèse dans l’austénite, D₀ de l’ordre de 1,6 à 1,8·10⁻⁵ m²/s et Q ≈ 260 kJ/mol (valeurs retenues : 1,8·10⁻⁵ m²/s et 264 kJ/mol)',
    ferrite: 'Relations empiriques entre grain austénitique, vitesse de refroidissement et grain ferritique, du type Sellars–Beynon (forme simplifiée)',
    atlas: 'Diagrammes TTT et TRC publiés des aciers de trempe et revenu au Cr-Mo et au Ni-Cr-Mo (ASM, Atlas of Time-Temperature Diagrams for Irons and Steels) : ordres de grandeur des temps d’incubation de la bainite',
    producteurs: 'Fiches techniques de producteurs d’aciers à outils et de tubes pour chaudières (courbes de revenu, températures de normalisation et de revenu) : ordres de grandeur'
  };

  const ALLIAGES = {
    '42CrMo4': {
      id: '42CrMo4', nom: '42CrMo4', numero: '1.7225', famille: 'acier',
      description: 'Acier faiblement allié au chrome-molybdène pour trempe et revenu : arbres, vilebrequins, boulonnerie à haute résistance.',
      composition: { C: 0.42, Si: 0.25, Mn: 0.75, Cr: 1.05, Mo: 0.22, Ni: 0 },
      compositionTexte: 'C 0,38–0,45 · Mn 0,60–0,90 · Cr 0,90–1,20 · Mo 0,15–0,30 (% massique)',
      thermique: { k: 30, rhoC: 4.8e6 },             // W/(m·K), J/(m³·K) : moyennes sur 20–850 °C
      E: 210000, nu: 0.3,                              // MPa
      Ac1: 740, Ac3: 795, Ms: 324, Bs: 557, Tf: 1490,  // °C (Andrews, Steven & Haynes)
      kmAlpha: 0.011,                                  // K⁻¹ (Koistinen-Marburger)
      initial: { fF: 0.47, fP: 0.53, dF: 15, nom: 'état recuit (+A) : ferrite + perlite' },
      grain: { d0: 12, Kref: 0.167, Tref: 850, Q: 196e3 },  // austénite : d² − d0² = K·t (µm, s)
      // Courbes en C (1 % transformé) : taux de martensite déduits de la bande Jominy moyenne (Hodge-Orehoski),
      // duretés dans la bande min–max de l'EN 10083-3, et trempes de barres conformes à la pratique (voir tests).
      FP: { Te: 790, Tn: 660, tn: 100, Q: 140e3, n: 2.5, pGrain: 1 },
      B: { Te: 557, Tn: 510, tn: 0.5, Q: 250e3, n: 1.5, pGrain: 0.5 },
      dRef: 20,
      revenu: {
        C: 20,
        // P = T(K)·(C + log10 t[h]) → dureté de la martensite revenue (HV), alignée sur la courbe d'une heure du cours.
        ancres: [[5860, 646], [7460, 640], [9460, 590], [11460, 535], [13460, 480], [15460, 410], [17460, 330], [19460, 245], [20500, 215], [21500, 200]],
        HVref: 646
      },
      dilatation: { A: [-0.0075, 2.2e-5], F: [0, 1.45e-5], P: [0, 1.45e-5], B: [0.0015, 1.45e-5], M: [0.0042, 1.2e-5] },
      trip: 5e-5,                                       // MPa⁻¹ (plasticité de transformation)
      fluage: { Aref: 0.8e-17, Tref: 600, Q: 200e3, n: 5 },  // MPa⁻ⁿ·s⁻¹ à Tref
      sources: ['en10083', 'andrews', 'steven', 'km', 'ho', 'maynier', 'hj', 'cours', 'ec3', 'iso18265', 'porter', 'barralis', 'asm4']
    },

    '34CrNiMo6': {
      id: '34CrNiMo6', nom: '34CrNiMo6', numero: '1.6582', famille: 'acier',
      description: 'Acier allié au nickel-chrome-molybdène pour trempe et revenu, très trempant : arbres et pièces forgées de forte section, pièces de transmission.',
      composition: { C: 0.34, Si: 0.25, Mn: 0.65, Cr: 1.5, Mo: 0.22, Ni: 1.5 },
      compositionTexte: 'C 0,30–0,38 · Mn 0,50–0,80 · Cr 1,30–1,70 · Mo 0,15–0,30 · Ni 1,30–1,70 (% massique)',
      thermique: { k: 30, rhoC: 4.8e6 },
      E: 210000, nu: 0.3,
      Ac1: 720, Ac3: 785, Ms: 330, Bs: 500, Tf: 1490,   // Andrews, Steven & Haynes
      kmAlpha: 0.011,
      initial: { fF: 0.55, fP: 0.45, dF: 15, nom: 'état recuit (+A) : ferrite + perlite' },
      grain: { d0: 12, Kref: 0.167, Tref: 850, Q: 196e3 },
      // Bainite et ferrite-perlite nettement retardées par le nickel : la pièce traverse un bain de sel chaud sans se transformer.
      FP: { Te: 760, Tn: 650, tn: 600, Q: 140e3, n: 2.5, pGrain: 1 },
      B: { Te: 500, Tn: 440, tn: 25, Q: 250e3, n: 1.5, pGrain: 0.5 },
      dRef: 20,
      revenu: { C: 20, HVref: 600, ancres: [[5860, 600], [7460, 595], [9460, 550], [11460, 500], [13460, 455], [15460, 395], [17460, 325], [19460, 250], [20500, 225], [21500, 210]] },
      dilatation: { A: [-0.0075, 2.2e-5], F: [0, 1.45e-5], P: [0, 1.45e-5], B: [0.0015, 1.45e-5], M: [0.004, 1.2e-5] },
      trip: 5e-5,
      fluage: { Aref: 0.8e-17, Tref: 600, Q: 200e3, n: 5 },
      sources: ['en10083', 'andrews', 'steven', 'km', 'maynier', 'atlas', 'hj', 'iso18265', 'porter', 'barralis', 'asm4']
    },

    'S355': {
      id: 'S355', nom: 'S355', numero: '1.0577', famille: 'soudure',
      description: 'Acier de construction au carbone-manganèse, soudé en forte épaisseur : appareils à pression, charpentes lourdes.',
      composition: { C: 0.18, Si: 0.3, Mn: 1.4 },
      compositionTexte: 'C ≤ 0,20 · Mn ≤ 1,60 · Si ≤ 0,55 (% massique)',
      thermique: { k: 40, rhoC: 4.6e6 },
      E: 210000, nu: 0.3,
      Re: 355, Rm: 520, HVmb: 165,                    // métal de base, MPa et HV
      Ac1: 715, Ac3: 840, Tf: 1500,
      revenu: {
        C: 20,
        // Dureté d'une ZAT bainito-martensitique de 350 HV après revenu (ordre de grandeur, aciers C-Mn).
        ancres: [[11000, 350], [13460, 336], [14500, 322], [15460, 297], [16300, 268], [17000, 247], [17460, 234], [18000, 222], [18500, 213], [19460, 200], [20500, 192]],
        HVref: 350
      },
      fluage: { Aref: 1.58e-17, Tref: 600, Q: 200e3, n: 5 },
      hydrogene: { D20: 1e-10, Q: 30e3, Hcrit: 6 },     // diffusivité effective avec piégeage (m²/s à 20 °C), teneur critique (ml/100 g)
      sources: ['en10025', 'ec3', 'iso15614', 'asme', 'norton', 'hj', 'iso3690', 'asm4', 'barralis']
    },

    'C45': {
      id: 'C45', nom: 'C45', numero: '1.0503', famille: 'acier',
      description: 'Acier non allié à 0,45 % de carbone pour trempe et revenu : arbres, axes, pièces forgées, outillage simple.',
      composition: { C: 0.45, Si: 0.25, Mn: 0.65, Cr: 0.2, Mo: 0, Ni: 0.2 },
      compositionTexte: 'C 0,42–0,50 · Mn 0,50–0,80 · Si ≤ 0,40 · Cr ≤ 0,40 (% massique)',
      thermique: { k: 35, rhoC: 4.8e6 },
      E: 210000, nu: 0.3,
      Ac1: 725, Ac3: 780, Ms: 330, Bs: 636, Tf: 1495,     // Andrews, Steven & Haynes
      kmAlpha: 0.011,
      initial: { fF: 0.43, fP: 0.57, dF: 12, nom: 'état normalisé : ferrite et perlite fines' },
      grain: { d0: 12, Kref: 0.25, Tref: 850, Q: 196e3, dMax: 400 },
      // Faible trempabilité : seule la peau d'une barre trempée à l'eau devient martensitique (voir tests).
      FP: { Te: 775, Tn: 620, tn: 0.9, Q: 140e3, n: 2.5, pGrain: 1 },
      B: { Te: 636, Tn: 540, tn: 0.5, Q: 250e3, n: 1.5, pGrain: 0.5 },
      dRef: 20,
      revenu: { C: 20, ancres: [[5860, 668], [7460, 660], [9460, 600], [11460, 520], [13460, 440], [15460, 350], [17460, 270], [19460, 210]], HVref: 668 },
      globulisation: { tauRef: 10 * 3600, Tref: 700, Q: 220e3, n: 1 },   // lamelles de cémentite → globules, sous Ac1
      dilatation: { A: [-0.0075, 2.2e-5], F: [0, 1.45e-5], P: [0, 1.45e-5], B: [0.0015, 1.45e-5], M: [0.0045, 1.2e-5] },
      trip: 5e-5,
      fluage: { Aref: 0.8e-17, Tref: 600, Q: 200e3, n: 5 },
      sources: ['en10083_2', 'andrews', 'steven', 'km', 'maynier', 'hj', 'cours', 'ferrite', 'iso18265', 'porter', 'barralis', 'asm4']
    },

    'G20Mn5': {
      id: 'G20Mn5', nom: 'G20Mn5', numero: '1.6220', famille: 'acier',
      description: 'Acier moulé au carbone-manganèse, soudable : nœuds de charpente, pièces de génie civil et de machines.',
      composition: { C: 0.2, Si: 0.4, Mn: 1.3, Cr: 0.2, Mo: 0, Ni: 0.3 },
      compositionTexte: 'C 0,17–0,23 · Mn 1,00–1,60 · Si ≤ 0,60 (% massique)',
      thermique: { k: 40, rhoC: 4.7e6 },
      E: 210000, nu: 0.3,
      Ac1: 720, Ac3: 835, Ms: 415, Bs: 660, Tf: 1505,
      kmAlpha: 0.011,
      // Brut de coulée : gros grains, manganèse ségrégé entre les branches des dendrites (±30 % autour de la moyenne).
      initial: { fF: 0.75, fP: 0.25, dF: 150, dG: 300, seg: 0.3, nom: 'état brut de coulée : gros grains, ségrégation du manganèse' },
      grain: { d0: 15, Kref: 0.3, Tref: 850, Q: 196e3, dMax: 500 },
      segregation: { D0: 1.8e-5, Q: 264e3, lambda: 150 },   // diffusion du Mn dans l'austénite ; espacement λ entre zones enrichies (µm)
      FP: { Te: 830, Tn: 640, tn: 1.2, Q: 140e3, n: 2.5, pGrain: 1 },
      B: { Te: 660, Tn: 550, tn: 1.0, Q: 250e3, n: 1.5, pGrain: 0.5 },
      dRef: 20,
      revenu: { C: 20, ancres: [[5860, 450], [9460, 430], [13460, 380], [15460, 330], [17460, 270], [19460, 210]], HVref: 450 },
      dilatation: { A: [-0.0075, 2.2e-5], F: [0, 1.45e-5], P: [0, 1.45e-5], B: [0.0015, 1.45e-5], M: [0.003, 1.2e-5] },
      trip: 5e-5,
      fluage: { Aref: 1.58e-17, Tref: 600, Q: 200e3, n: 5 },
      sources: ['en10293', 'andrews', 'steven', 'smithells', 'maynier', 'ferrite', 'porter', 'barralis', 'asm4']
    },

    'X40CrMoV5-1': {
      id: 'X40CrMoV5-1', nom: 'X40CrMoV5-1', numero: '1.2344', famille: 'acier',
      description: 'Acier à outils pour travail à chaud (type H13) : filières d’extrusion de l’aluminium, moules de fonderie sous pression, matrices de forge.',
      composition: { C: 0.39, Si: 1.0, Mn: 0.4, Cr: 5.2, Mo: 1.3, V: 1.0, Ni: 0 },
      compositionTexte: 'C 0,35–0,42 · Cr 4,8–5,5 · Mo 1,2–1,5 · V 0,85–1,15 · Si 0,8–1,2 (% massique)',
      thermique: { k: 25, rhoC: 4.6e6 },
      E: 210000, nu: 0.3,
      Ac1: 860, Ac3: 915, Ms: 300, Bs: 420, Tf: 1450,
      kmAlpha: 0.011,
      initial: { fF: 0.9, fP: 0.1, gl: 1, dF: 10, nom: 'état recuit (+A) : ferrite et carbures globulaires' },
      grain: { d0: 10, Kref: 0.05, Tref: 1030, Q: 300e3, dMax: 120 },
      // Duretés propres à l'alliage : les formules de Maynier ne couvrent pas les aciers à 5 % Cr et 1 % V.
      durete: { M: 590, B: 480, FP: 300, FPglob: 220 },
      dissolution: { T0: 980, dT: 70 },                  // mise en solution des carbures alliés à l'austénitisation
      raSecondaire: { T: 500, Ms: 230 },                // austénite résiduelle conditionnée par le revenu, transformée au refroidissement
      carburesAllies: { P: 15000 },                      // précipitation des carbures alliés (Mo, V) : durcissement secondaire
      FP: { Te: 900, Tn: 760, tn: 900, Q: 200e3, n: 2.5, pGrain: 1 },
      B: { Te: 420, Tn: 340, tn: 900, Q: 200e3, n: 1.5, pGrain: 0.5 },
      dRef: 20,
      revenu: {
        C: 20, HVref: 590,
        // Pic de durcissement secondaire vers 500–550 °C, puis chute rapide : ≈ 47 HRC après 2 × 2 h à 600 °C, ≈ 40 HRC à 650 °C.
        ancres: [[5860, 590], [9460, 560], [11460, 540], [13460, 525], [14460, 535], [15460, 560], [16000, 565], [16750, 555], [17460, 520], [17990, 475], [18500, 430], [19020, 390], [19530, 340], [20000, 300]],
        // Carbures alliés mal dissous (austénitisation froide) : moins de carbone et d'éléments en solution, pic émoussé.
        ancresSansCarbures: [[5860, 560], [9460, 535], [11460, 515], [13460, 495], [14460, 490], [15460, 495], [16000, 495], [16750, 480], [17460, 450], [17990, 415], [18500, 380], [19020, 345], [19530, 305], [20000, 275]]
      },
      dilatation: { A: [-0.0075, 2.2e-5], F: [0, 1.3e-5], P: [0, 1.3e-5], B: [0.0015, 1.3e-5], M: [0.004, 1.15e-5] },
      trip: 5e-5,
      fluage: { Aref: 0.3e-17, Tref: 600, Q: 200e3, n: 5 },
      sources: ['iso4957', 'producteurs', 'km', 'hj', 'cours', 'iso18265', 'porter', 'barralis', 'asm4']
    },

    'P91': {
      id: 'P91', nom: 'X10CrMoVNb9-1 (P91)', numero: '1.4903', famille: 'acier',
      description: 'Acier martensitique à 9 % Cr résistant au fluage : collecteurs et tuyauteries de vapeur des centrales.',
      composition: { C: 0.1, Si: 0.35, Mn: 0.45, Cr: 8.75, Mo: 0.95, V: 0.21, Ni: 0.2 },
      compositionTexte: 'C 0,08–0,12 · Cr 8,0–9,5 · Mo 0,85–1,05 · V 0,18–0,25 · Nb 0,06–0,10 · N 0,03–0,07 (% massique)',
      thermique: { k: 26, rhoC: 4.7e6 },
      E: 210000, nu: 0.3,
      Ac1: 820, Ac3: 900, Ms: 400, Bs: 480, Tf: 1480,
      kmAlpha: 0.011,
      initial: { fF: 0.92, fP: 0.08, gl: 1, dF: 15, nom: 'état formé à chaud et recuit : ferrite et carbures' },
      grain: { d0: 15, Kref: 0.04, Tref: 1050, Q: 300e3, dMax: 80 },
      durete: { M: 420, B: 380, FP: 200, FPglob: 185 },
      FP: { Te: 890, Tn: 780, tn: 2500, Q: 200e3, n: 2.5, pGrain: 1 },
      B: { Te: 480, Tn: 420, tn: 1500, Q: 200e3, n: 1.5, pGrain: 0.5 },
      dRef: 20,
      revenu: { C: 20, HVref: 420, ancres: [[5860, 420], [13000, 410], [15460, 400], [17460, 360], [18800, 305], [19600, 275], [19960, 263], [20360, 245], [20970, 225], [21700, 208], [22500, 196]] },
      carburesAllies: { P: 18500 },                      // M23C6 aux joints de lattes et MX : stabilité au fluage
      dilatation: { A: [-0.0075, 2.2e-5], F: [0, 1.15e-5], P: [0, 1.15e-5], B: [0.001, 1.15e-5], M: [0.002, 1.1e-5] },
      trip: 5e-5,
      fluage: { Aref: 0.2e-17, Tref: 600, Q: 250e3, n: 5 },
      sources: ['en10216', 'producteurs', 'km', 'hj', 'porter', 'barralis', 'asm4']
    },

    'S690QL': {
      id: 'S690QL', nom: 'S690QL', numero: '1.8928', famille: 'soudure',
      description: 'Acier de construction trempé et revenu à haute limite d’élasticité : flèches de grues, engins de levage, charpentes légères.',
      composition: { C: 0.16, Si: 0.3, Mn: 1.4, Cr: 0.5, Mo: 0.4, Ni: 0.3 },
      compositionTexte: 'C ≤ 0,20 · Mn ≤ 1,70 · Cr ≤ 1,50 · Mo ≤ 0,70 · Ni ≤ 2,0 · B ≤ 0,005 (% massique)',
      thermique: { k: 38, rhoC: 4.6e6 },
      E: 210000, nu: 0.3,
      Re: 690, Rm: 800, HVmb: 260,
      Ac1: 720, Ac3: 840, Tf: 1500,
      revenu: { C: 20, HVref: 420, ancres: [[9000, 420], [11000, 412], [13460, 392], [15460, 352], [16500, 322], [17460, 296], [18500, 275], [19460, 262]] },
      fluage: { Aref: 1.58e-17, Tref: 600, Q: 200e3, n: 5 },
      hydrogene: { D20: 6e-11, Q: 35e3, Hcrit: 6 },      // ZAT martensitique : piégeage plus fort, diffusion plus activée
      sources: ['en10025_6', 'en1011', 'iso3690', 'iso15614', 'hj', 'asm4', 'barralis']
    },

    '10CrMo9-10': {
      id: '10CrMo9-10', nom: '10CrMo9-10', numero: '1.7380', famille: 'soudure',
      description: 'Acier faiblement allié au chrome-molybdène (2,25Cr-1Mo) pour appareils à pression chauds : réacteurs d’hydrotraitement, chaudières.',
      composition: { C: 0.1, Si: 0.3, Mn: 0.5, Cr: 2.25, Mo: 1.0 },
      compositionTexte: 'C 0,08–0,14 · Cr 2,0–2,5 · Mo 0,90–1,10 · Mn 0,40–0,80 (% massique)',
      thermique: { k: 36, rhoC: 4.6e6 },
      E: 210000, nu: 0.3,
      Re: 310, Rm: 520, HVmb: 160,
      Ac1: 800, Ac3: 880, Tf: 1500,
      revenu: { C: 20, HVref: 400, ancres: [[11000, 400], [15460, 385], [17460, 340], [18500, 300], [19000, 275], [19550, 245], [20200, 225], [21000, 210], [22000, 198]] },
      // Acier résistant au fluage : il relaxe plus lentement qu'un acier C-Mn (calage dans les tests).
      fluage: { Aref: 0.03e-17, Tref: 600, Q: 300e3, n: 5 },
      hydrogene: { D20: 1e-10, Q: 30e3, Hcrit: 6 },
      sources: ['en10028', 'en10216', 'ec3', 'norton', 'hj', 'iso3690', 'asm4', 'barralis']
    },

    'Cu-ETP': {
      id: 'Cu-ETP', nom: 'Cu-ETP', numero: 'CW004A', famille: 'cuivre',
      description: 'Cuivre électrolytique à oxygène (≥ 99,90 % Cu) : conducteurs, barres, bobinages.',
      compositionTexte: 'Cu ≥ 99,90 · O ≈ 0,02–0,04 (% massique)',
      thermique: { k: 390, rhoC: 3.45e6, emissivite: 0.5 },
      E: 120000, nu: 0.34,
      Tf: 1083,
      // Dureté en fonction du taux de réduction à froid (0 → 0,8), d'après les états normalisés R220 à R360.
      ecrouissage: [[0, 50], [0.05, 68], [0.1, 78], [0.2, 90], [0.3, 97], [0.5, 106], [0.7, 112], [0.8, 115]],
      d0: 40,                                          // µm, grain recuit avant laminage
      hv: { base: 38, hallPetch: 60 },                 // HV = base + k/√d(µm)
      taylor: 1.081e-5,                                // M·α·G·b en MPa·m
      rx: { Q: 100e3, Tref: 240, tauRef: 4885, epsRef: 0.693, n: 1.2, m: 2, epsC: 0.05 },
      drx: { ref: 12, exposant: 0.75, max: 400 },
      croissance: { Kref: 0.96, Tref: 600, Q: 120e3 },
      lacunes: { Q: 80e3, Tref: 150, tauRef: 2990 },
      resistivite: { base: 1.708, defauts: 0.04, dislocations: 2e-17 },  // µΩ·cm ; µΩ·cm·m² par dislocation (2e-25 Ω·m³)
      sources: ['en1652', 'iacs', 'porter', 'asm4', 'barralis']
    },

    'AW-6082': {
      id: 'AW-6082', nom: 'EN AW-6082', numero: 'AlSi1MgMn', famille: 'aluminium',
      description: 'Alliage d’aluminium Al-Mg-Si à durcissement structural : profilés de structure, échafaudages, transport.',
      compositionTexte: 'Si 0,7–1,3 · Mg 0,6–1,2 · Mn 0,4–1,0 · Fe ≤ 0,50 (% massique)',
      thermique: { k: 172, rhoC: 2.43e6, emissivite: 0.2 },     // aluminium oxydé : rayonne peu
      E: 70000, nu: 0.33,
      solidus: 575, liquidus: 650, solvus: 515,
      solubilite: 3070,                                // H/R (K) : c_eq = exp(−H/R·(1/T − 1/T_solvus))
      solvusB2: 300, solvusAmas: 160,
      trempe: { Te: 515, Tn: 380, tn: 1, Q: 250e3 },    // sensibilité à la trempe : ≈ 80 % de la résistance T6 après 1 °C/s
      dissolution: { tauRef: 300, Tref: 530, Q: 130e3 },
      amas: { tauRef: 6 * 3600, Tref: 20, Q: 60e3, eq: 0.4, tauLacunes: 4 * 86400 },
      // β″ calé sur les courbes Hydro (165–195 °C) : écart quadratique moyen ≈ 7 MPa sur 25 points.
      b2: { tauRef: 33180, Tref: 175, Q: 141e3, r0: 0.11, kcRef: 10.7, rc: 2.75, rt: 4.5, effetMaturation: 0.6 },
      resistance: { s0: 35, ss: 40, amas: 190, b2: 451, grossier: 15, hp: 5 },
      resistivite: { base: 31.82, solute: 9.56, amas: 8.6, b2: 6.39, bp: 1.5 },  // nΩ·m
      grain: 60,
      sources: ['en573', 'hydro', 'asm4', 'porter', 'barralis']
    }
  };

  return { ALLIAGES, SOURCES };
});
