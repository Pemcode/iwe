/* Banque de traitements thermiques : cycle, réglages, points observés, propriétés suivies, textes et liens.
   Les textes d'événements acceptent {T} (température du point observé) et {t} (instant écoulé). */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTH = Object.assign(root.TTH || {}, { TRAITEMENTS: api });
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MILIEUX = { eau: 'Trempe à l’eau', huile: 'Trempe à l’huile', air: 'Refroidissement à l’air calme', four: 'Refroidissement au four' };

  /* Propriétés suivies : clé, libellé, unité, bornes de la jauge, nombre de décimales. */
  const P = {
    HV: { cle: 'HV', nom: 'Dureté', unite: 'HV', min: 0, max: 700, dec: 0 },
    Rm: { cle: 'Rm', nom: 'Résistance à la traction Rm', unite: 'MPa', min: 0, max: 2200, dec: 0, approx: true },
    Rp: { cle: 'Rp', nom: 'Limite d’élasticité Rp0,2', unite: 'MPa', min: 0, max: 2000, dec: 0, approx: true },
    A: { cle: 'A', nom: 'Allongement à rupture A', unite: '%', min: 0, max: 40, dec: 0 },
    tenacite: { cle: 'tenacite', nom: 'Ténacité', unite: '', min: 0, max: 100, dec: 0, qualitatif: true },
    sigma: { cle: 'sigma', nom: 'Contrainte résiduelle', unite: 'MPa', min: -700, max: 700, dec: 0, signe: true },
    grain: { cle: 'grain', nom: 'Taille de grain', unite: 'µm', min: 5, max: 400, dec: 0, log: true },
    conductivite: { cle: 'conductivite', nom: 'Conductivité électrique à 20 °C', unite: 'MS/m', min: 20, max: 60, dec: 1 },
    H: { cle: 'H', nom: 'Hydrogène diffusible', unite: 'ml/100 g', min: 0, max: 6, dec: 1 }
  };
  const borne = (p, o) => Object.assign({}, p, o);

  /* Événements des aciers, communs à toute la famille (un traitement peut en préciser certains). */
  const EVT_ACIER = {
    Ac1: ['Ac1 franchie à {T} : la perlite commence à se transformer en austénite.', 'Au-dessus de A1, la perlite (ferrite + cémentite) n’est plus stable : elle se dissout en austénite à 0,8 % C.'],
    Ac3: ['Ac3 franchie à {T} : la dernière ferrite disparaît.', 'Entre Ac1 et Ac3, ferrite et austénite coexistent (règle des segments inverses) ; au-dessus d’Ac3, l’acier est entièrement austénitique.'],
    austenite: ['Austénitisation complète : un réseau neuf de grains fins remplace l’ancienne structure.', 'Les nouveaux grains γ germent sur les interfaces ferrite/cémentite : le grain de départ est fin (une dizaine de micromètres), puis il croît.'],
    grainGrossier: ['Attention, le grain austénitique dépasse 60 µm : surchauffe.', 'Un gros grain γ donne des paquets de martensite plus grands, donc moins d’obstacles à la fissure : la résilience chute.'],
    ferritePerlite: ['De la ferrite et de la perlite apparaissent à {T} : le refroidissement est trop lent ici pour une trempe complète.', 'La courbe de refroidissement coupe le domaine ferrito-perlitique du diagramme de transformation en refroidissement continu (TRC).'],
    bainite: ['De la bainite se forme à {T}.', 'Bainite : ferrite en lattes et carbures, formée entre ≈ 550 °C (Bs) et Ms. Plus dure que la ferrite-perlite, moins que la martensite.'],
    Ms: ['Ms atteinte à {T} : la martensite commence à se former.', 'Transformation displacive : les atomes de fer basculent collectivement, le carbone reste piégé dans une maille quadratique centrée.'],
    M50: ['La moitié de l’austénite est déjà devenue martensite ({T}).', 'Koistinen-Marburger : 50 % vers Ms − 63 °C, ≈ 90 % vers Ms − 210 °C. Un peu d’austénite reste à 20 °C : l’austénite résiduelle.'],
    revenu1: ['Revenu, stade 1 : de minuscules carbures ε précipitent.', 'Stade 1 (≈ 100–200 °C) : carbures de transition ε (Fe₂,₄C) ; la quadraticité de la martensite diminue.'],
    revenu2: ['Revenu, stade 2 : l’austénite résiduelle se décompose.', 'Stade 2 (≈ 200–300 °C) : austénite résiduelle → ferrite + carbures, comme une bainite.'],
    revenu3: ['Revenu, stade 3 : la cémentite remplace les carbures ε.', 'Stade 3 (≈ 250–400 °C) : cémentite Fe₃C en bâtonnets ; la martensite devient de la ferrite sursaturée en voie d’appauvrissement.'],
    revenu4: ['Revenu, stade 4 : les carbures coalescent et la ferrite se restaure.', 'Stade 4 (> 400 °C) : globulisation et grossissement de la cémentite, restauration des dislocations. Les carbures alliés (Cr, Mo) freinent l’adoucissement.'],
    fragiliteRevenu: ['Piège : revenir entre 250 et 400 °C fragilise la martensite revenue.', 'Fragilité de la martensite revenue (« 350 °C ») : films de cémentite aux joints de lattes, issus de la décomposition de l’austénite résiduelle.'],
    martensiteFraiche: ['Ms atteinte à {T} : l’austénite restante devient de la martensite fraîche, pas encore revenue.', 'Cette martensite fraîche est dure et fragile : elle devra être revenue à son tour, d’où le revenu suivant.'],
    conditionnement: ['L’austénite résiduelle s’appauvrit en carbone pendant ce revenu : elle se transformera au refroidissement.', 'Conditionnement : des carbures précipitent dans l’austénite résiduelle, son Ms remonte au-dessus de l’ambiante.'],
    durcissementSecondaire: ['Durcissement secondaire : de minuscules carbures alliés précipitent, la dureté se maintient ou remonte.', 'Carbures MC (V) et M₂C (Mo) de quelques nanomètres, cohérents avec la ferrite : ils freinent les dislocations et retardent l’adoucissement.'],
    revenuIntercritique: ['Au-dessus d’Ac1 pendant le revenu : de l’austénite se forme, elle redeviendra martensite fraîche au refroidissement !', 'Revenu intercritique : il faut rester sous Ac1. La martensite fraîche formée ensuite est dure et fragile.'],
    globulisation: ['Plus de la moitié de la cémentite est en globules : l’acier s’adoucit nettement.', 'Les lamelles se fragmentent, puis les globules grossissent (mûrissement d’Ostwald) : la ferrite devient continue, la dureté baisse de 15 à 20 %.'],
    homogeneise: ['Les écarts de manganèse ont diminué de moitié.', 'L’amplitude est divisée par deux quand 4π²·D·t/λ² ≈ 0,7 : le temps nécessaire croît comme λ².']
  };
  const evt = suite => Object.assign({}, EVT_ACIER, suite);
  /* Ferrite et perlite voulues (recuits, normalisation) : le message n'est plus celui d'une trempe ratée. */
  const EVT_FP = {
    ferritePerlite: ['L’austénite se transforme en ferrite puis en perlite à {T}.', 'Transformation diffusive : la ferrite germe sur les joints de l’austénite ; le carbone qu’elle rejette forme la perlite (ferrite + cémentite) vers 650–700 °C.']
  };

  const TRAITEMENTS = [
    {
      id: 'trempe-revenu-42crmo4',
      titre: 'Trempe et revenu',
      sousTitre: 'L’amélioration d’un acier de construction',
      alliage: '42CrMo4', famille: 'Aciers', mecanismes: ['Transformation de phase', 'Revenu', 'Croissance du grain', 'Contraintes'],
      etape: 1,
      but: 'Obtenir le meilleur compromis entre résistance et ténacité : on fabrique d’abord de la martensite très dure, puis on la « détend » par un revenu.',
      image: 'Un ressort trop tendu (martensite) qu’on détend juste ce qu’il faut (revenu).',
      reglages: [
        { id: 'Taus', nom: 'Température d’austénitisation', min: 760, max: 1100, pas: 5, defaut: 850, unite: '°C',
          alertes: [{ max: 794, texte: 'Sous Ac3 ≈ 795 °C : une partie de la ferrite reste, la trempe sera incomplète.' }, { min: 900, texte: 'Surchauffe : le grain austénitique grossit, la ténacité chute.' }] },
        { id: 'tAus', nom: 'Maintien d’austénitisation', min: 5, max: 180, pas: 5, defaut: 30, unite: 'min' },
        { id: 'milieu', nom: 'Refroidissement', choix: [['eau', 'Eau'], ['huile', 'Huile'], ['air', 'Air calme'], ['four', 'Four']], defaut: 'huile' },
        { id: 'D', nom: 'Diamètre de la barre', min: 10, max: 120, pas: 5, defaut: 25, unite: 'mm' },
        { id: 'revenu', nom: 'Revenu', bascule: true, defaut: true },
        { id: 'Trev', nom: 'Température de revenu', min: 150, max: 720, pas: 10, defaut: 600, unite: '°C', si: 'revenu',
          alertes: [{ min: 250, max: 400, texte: 'Zone de fragilité du revenu (250–400 °C) : la résilience baisse.' }, { min: 690, texte: 'Revenu très proche d’Ac1 ≈ 740 °C : dureté faible, résistance garantie compromise.' }] },
        { id: 'tRev', nom: 'Durée du revenu', min: 0.5, max: 10, pas: 0.5, defaut: 2, unite: 'h', si: 'revenu' }
      ],
      exemples: [
        { nom: 'Huile Ø25 + revenu 600 °C', valeurs: { Taus: 850, tAus: 30, milieu: 'huile', D: 25, revenu: true, Trev: 600, tRev: 2 } },
        { nom: 'Trempe sans revenu', valeurs: { Taus: 850, tAus: 30, milieu: 'huile', D: 25, revenu: false } },
        { nom: 'Grosse barre Ø100', valeurs: { Taus: 850, tAus: 60, milieu: 'huile', D: 100, revenu: true, Trev: 600, tRev: 2 } },
        { nom: 'Revenu à 350 °C (piège)', valeurs: { Taus: 850, tAus: 30, milieu: 'huile', D: 25, revenu: true, Trev: 350, tRev: 2 } },
        { nom: 'Surchauffe 1050 °C', valeurs: { Taus: 1050, tAus: 60, milieu: 'huile', D: 25, revenu: true, Trev: 600, tRev: 2 } },
        { nom: 'Refroidi à l’air', valeurs: { Taus: 850, tAus: 30, milieu: 'air', D: 25, revenu: false } }
      ],
      geometrie: p => ({ forme: 'cylindre', L: p.D / 2000, n: 11, contraintes: true, nom: 'barre Ø' + p.D + ' mm' }),
      points: g => [{ id: 'surface', nom: 'Surface', noeud: g.n - 1 }, { id: 'coeur', nom: 'Cœur', noeud: 0 }],
      programme(p) {
        const s = [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Taus, jusqua: { coeurAtteint: p.Taus - 5 }, dureeMax: 6 * 3600, dTmax: 10, dt0: 2 },
          { id: 'austenitisation', nom: 'Austénitisation', etape: 'maintien', milieu: 'four', env: p.Taus, duree: p.tAus * 60, dTmax: 10 }
        ];
        const four = p.milieu === 'four';
        s.push({ id: 'trempe', nom: MILIEUX[p.milieu], etape: four ? 'refroidissement' : 'trempe', milieu: p.milieu,
          env: four ? (t => Math.max(20, p.Taus - 50 * t / 3600)) : 20,
          jusqua: { toutSous: four ? 80 : 40 }, dureeMax: four ? 30 * 3600 : 6 * 3600, dt0: four ? 5 : 0.02, dTmax: 4 });
        if (p.revenu) {
          s.push({ id: 'chauffeRevenu', nom: 'Chauffage de revenu', etape: 'chauffage', milieu: 'four', env: p.Trev, jusqua: { coeurAtteint: p.Trev - 5 }, dureeMax: 6 * 3600, revenu: true, dTmax: 10, dt0: 2 });
          s.push({ id: 'revenu', nom: 'Revenu', etape: 'revenu', milieu: 'four', env: p.Trev, duree: p.tRev * 3600, revenu: true, dTmax: 10 });
          s.push({ id: 'refroidissement', nom: 'Refroidissement à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 8 * 3600, revenu: true, dt0: 1, dTmax: 6 });
        }
        return s;
      },
      reperes: A => [{ T: A.Ac3, nom: 'Ac3' }, { T: A.Ac1, nom: 'Ac1' }, { T: A.Ms, nom: 'Ms' }],
      proprietes: [P.HV, P.Rm, P.Rp, P.A, P.tenacite, borne(P.sigma, {}), borne(P.grain, { max: 250 })],
      phases: [['A', 'Austénite γ'], ['F', 'Ferrite α'], ['P', 'Perlite'], ['B', 'Bainite'], ['M', 'Martensite']],
      etapes: {
        chauffe: ['La barre monte en température dans le four. La surface chauffe la première : le cœur suit avec du retard, d’autant plus que la barre est grosse.',
          'Le flux de chaleur traverse la pièce par conduction : le temps de mise à cœur croît comme le carré du rayon (t ∝ R²/a, a diffusivité thermique ≈ 6 mm²/s). D’où la règle d’atelier « environ une minute par millimètre ».'],
        austenitisation: ['Au-dessus d’Ac3, tout l’acier est devenu de l’austénite γ : le carbone se dissout dans ce réseau cubique à faces centrées. Plus on chauffe chaud ou longtemps, plus les grains grossissent.',
          'Croissance normale du grain : d² − d₀² = K·t avec K = K₀·exp(−Q/RT). Un gros grain austénitique retarde ferrite et bainite (moins de joints pour germer) : la trempabilité augmente, mais la ténacité finale baisse.'],
        trempe: ['On refroidit brutalement : le carbone n’a pas le temps de sortir du réseau. Sous Ms, l’austénite bascule d’un coup en martensite, dure et fragile.',
          'Au-dessus de Ms, chaque transformation diffusive avance par additivité sur sa courbe en C (règle de Scheil) ; sous Ms, la fraction de martensite suit Koistinen-Marburger : f = 1 − exp(−0,011·(Ms − T)). Le cœur refroidit moins vite que la surface : c’est la trempabilité qui décide s’il devient martensitique.'],
        chauffeRevenu: ['On réchauffe, mais en restant sous Ac1 : pas question de refaire de l’austénite.', 'Le paramètre de revenu commence à augmenter dès les premières centaines de degrés : P = T·(C + log t), T en kelvins, t en heures, C ≈ 20.'],
        revenu: ['Le carbone piégé sort de la martensite en fins carbures : l’acier perd un peu de dureté et gagne beaucoup en ténacité. C’est la température qui règle cet échange.',
          'Équivalence temps–température de Hollomon-Jaffe : P = T·(20 + log t). Une heure à 600 °C vaut ≈ 3 h à 580 °C. Les contraintes résiduelles se relaxent aussi par fluage (loi de Norton).'],
        refroidissement: ['Refroidissement à l’air : la structure est désormais stable, plus rien ne change.', 'Après un revenu au-dessus de 450 °C, un refroidissement lent dans 350–550 °C peut provoquer la fragilité réversible de revenu ; le molybdène du 42CrMo4 la limite.']
      },
      evenements: EVT_ACIER,
      pieges: [
        'Une trempe sans revenu laisse une martensite fragile et des contraintes résiduelles élevées : risque de tapures.',
        'Le cœur d’une grosse barre refroidit trop lentement : la dureté visée en surface n’est pas atteinte au cœur. C’est la trempabilité qui limite le diamètre.',
        'Revenir entre 250 et 400 °C fait chuter la résilience : on choisit soit un revenu bas (≈ 200 °C, outils), soit un revenu d’amélioration (540–680 °C).'
      ],
      metier: [
        'Le 42CrMo4 se trempe vers 820–860 °C à l’huile ou à l’eau, puis se revient entre 540 et 680 °C (EN 10083-3). La résistance garantie baisse quand le diamètre augmente.',
        'Une pièce trempée et revenue qu’on soude perd localement son revenu : la zone affectée thermiquement (ZAT) redevient dure. Préchauffage et traitement après soudage s’imposent.'
      ],
      reviser: [
        { cours: 'met-03', ancre: 's3', titre: 'Les traitements thermiques des aciers' },
        { cours: 'met-03', ancre: 's1', titre: 'La martensite, une transformation sans diffusion' },
        { cours: 'met-02', ancre: 's4', titre: 'Les courbes TRC' },
        { cours: 'essais-02', ancre: 'c5', titre: 'Convertir dureté et résistance' }
      ]
    },

    {
      id: 'recristallisation-cuivre',
      titre: 'Recuit de recristallisation',
      sousTitre: 'Adoucir un cuivre écroui',
      alliage: 'Cu-ETP', famille: 'Cuivre', mecanismes: ['Restauration', 'Recristallisation', 'Croissance du grain'],
      etape: 1,
      but: 'Rendre au cuivre écroui sa ductilité et sa conductivité, en remplaçant les grains déformés par des grains neufs, sans aller jusqu’au gros grain.',
      image: 'Une pelouse piétinée (grains écrasés) qui repousse brin par brin (nouveaux grains).',
      reglages: [
        { id: 'r', nom: 'Taux de réduction à froid', min: 0, max: 0.8, pas: 0.01, defaut: 0.5, unite: '%', facteur: 100,
          alertes: [{ max: 0.04, texte: 'Écrouissage trop faible : pas de recristallisation, seulement de la restauration.' }, { min: 0.05, max: 0.1, texte: 'Écrouissage critique : très peu de germes, les grains recristallisés seront énormes.' }] },
        { id: 'Trec', nom: 'Température de recuit', min: 120, max: 850, pas: 10, defaut: 400, unite: '°C',
          alertes: [{ min: 650, texte: 'Recuit très chaud : le grain grossit, l’état de surface devient « peau d’orange » au formage.' }] },
        { id: 'tRec', nom: 'Durée du maintien', min: 1, max: 600, pas: 1, defaut: 60, unite: 'min' },
        { id: 'atmosphere', nom: 'Atmosphère du four', choix: [['protectrice', 'Protectrice (N₂)'], ['air', 'Air'], ['H2', 'Hydrogène']], defaut: 'protectrice',
          alertes: [{ egal: 'H2', texte: 'Cu-ETP sous hydrogène au-delà de 400 °C : maladie de l’hydrogène.' }] }
      ],
      exemples: [
        { nom: 'Écroui 50 %, recuit 400 °C', valeurs: { r: 0.5, Trec: 400, tRec: 60, atmosphere: 'protectrice' } },
        { nom: 'Recuit à 180 °C (restauration seule)', valeurs: { r: 0.5, Trec: 180, tRec: 60, atmosphere: 'protectrice' } },
        { nom: 'Écrouissage critique 6 %', valeurs: { r: 0.06, Trec: 600, tRec: 60, atmosphere: 'protectrice' } },
        { nom: 'Recuit à 750 °C', valeurs: { r: 0.5, Trec: 750, tRec: 60, atmosphere: 'protectrice' } },
        { nom: 'Sous hydrogène (piège)', valeurs: { r: 0.5, Trec: 600, tRec: 60, atmosphere: 'H2' } }
      ],
      geometrie: () => ({ forme: 'plaque', L: 0.001, n: 3, contraintes: false, nom: 'bande de 2 mm' }),
      points: () => [{ id: 'coeur', nom: 'Bande', noeud: 0 }],
      programme(p) {
        return [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Trec, jusqua: { coeurAtteint: p.Trec - 3 }, dureeMax: 3 * 3600, dt0: 1, dTmax: 8 },
          { id: 'maintien', nom: 'Recuit', etape: 'maintien', milieu: 'four', env: p.Trec, duree: p.tRec * 60, dTmax: 8 },
          { id: 'refroidissement', nom: 'Refroidissement', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 4 * 3600, dt0: 1, dTmax: 8 }
        ];
      },
      reperes: () => [{ T: 270, nom: '≈ 0,4 Tf' }, { T: 400, nom: 'seuil H₂' }],
      proprietes: [borne(P.HV, { max: 130 }), borne(P.Rp, { max: 400 }), borne(P.Rm, { max: 400 }), borne(P.A, { max: 50 }), borne(P.conductivite, { min: 56, max: 59.5, dec: 2 }), borne(P.grain, { max: 400 })],
      etapes: {
        chauffe: ['La bande, mince et très conductrice, prend vite la température du four.', 'Diffusivité du cuivre ≈ 110 mm²/s, vingt fois celle de l’acier : l’écart surface–cœur est négligeable.'],
        maintien: ['À chaud, le métal se répare : les défauts disparaissent (restauration), puis de nouveaux grains sans dislocations dévorent les grains écrasés (recristallisation).',
          'La force motrice est l’énergie stockée par les dislocations (≈ ½·G·b²·ρ par unité de volume). Recristallisation : loi d’Avrami X = 1 − exp(−(t/τ)ⁿ), τ diminue quand l’écrouissage ou la température augmentent.'],
        refroidissement: ['Le refroidissement ne change plus rien : pas de transformation de phase dans le cuivre.', 'Le cuivre reste cubique à faces centrées de l’ambiante à la fusion : seul le recuit compte, la vitesse de refroidissement est sans effet.']
      },
      evenements: {
        restauration: ['Restauration : les défauts ponctuels s’éliminent, la conductivité remonte avant même que la dureté ne baisse.', 'Les lacunes et interstitiels créés par la déformation migrent et s’annihilent (énergie de migration ≈ 0,7–0,8 eV) ; la résistivité électrique y est très sensible.'],
        rxDebut: ['Les premiers grains recristallisés apparaissent à {T}, aux joints des grains écrasés.', 'Germination hétérogène aux joints et dans les bandes de déformation, là où l’énergie stockée est maximale.'],
        rx50: ['La moitié du métal est recristallisée : la dureté chute brutalement.', 'Courbe d’adoucissement en « S », décrite par la loi de Johnson-Mehl-Avrami-Kolmogorov (JMAK). Température de recristallisation : celle qui donne 50 % en une heure, ≈ 0,3 à 0,5 Tf (en kelvins).'],
        rxFin: ['Recristallisation terminée : des grains neufs, équiaxes, avec des macles de recuit.', 'Le cuivre, dont l’énergie de défaut d’empilement est assez faible, forme de nombreuses macles de recuit à bords rectilignes.'],
        croissance: ['Le grain grossit : les gros grains mangent les petits.', 'Croissance normale : d² − d₀² = K·t, entraînée par la tension des joints. Un gros grain abaisse la limite d’élasticité (Hall-Petch) et donne la « peau d’orange » au formage.'],
        hydrogeneCu: ['Maladie de l’hydrogène : l’hydrogène réduit les inclusions de Cu₂O en vapeur d’eau, qui ouvre les joints de grains.', 'Cu₂O + 2 H → 2 Cu + H₂O (gaz) : la vapeur sous pression crée des cavités intergranulaires. Le Cu-ETP contient ≈ 0,02–0,04 % d’oxygène ; on utilise du Cu-OF ou du Cu-DHP sous hydrogène.']
      },
      pieges: [
        'Sous l’écrouissage critique (quelques %), le métal ne recristallise pas, ou alors en grains géants : la pièce devient hétérogène.',
        'Recuire un Cu-ETP sous hydrogène (four de brasage, au-delà de 400 °C) le fragilise : maladie de l’hydrogène.',
        'Un recuit trop chaud ou trop long fait grossir le grain : surface en peau d’orange à l’emboutissage.'
      ],
      metier: [
        'Le cuivre recuit conduit environ 58 MS/m, soit 100 % IACS (International Annealed Copper Standard) : c’est l’état des conducteurs de bobinage.',
        'Un tube de cuivre brasé à la flamme est recuit localement : il perd son état dur à côté du joint.'
      ],
      reviser: [
        { cours: 'brasage-04', ancre: 'c3', titre: 'Braser les aciers, les fontes et les cuivreux' },
        { cours: 'brasage-02', ancre: 'c4', titre: 'Atmosphères et vide' },
        { cours: 'essais-01', ancre: 'c5', titre: 'Ce qui change la courbe de traction' }
      ]
    },

    {
      id: 'durcissement-6082',
      titre: 'Durcissement structural',
      sousTitre: 'Mise en solution, trempe, maturation et revenu d’un Al-Mg-Si',
      alliage: 'AW-6082', famille: 'Aluminium', mecanismes: ['Mise en solution', 'Précipitation', 'Coalescence'],
      etape: 1,
      but: 'Durcir l’alliage par une nuée de précipités nanométriques : on dissout d’abord tout le magnésium et le silicium, on les fige par la trempe, puis on les laisse précipiter finement.',
      image: 'Un sirop très sucré : chaud, tout le sucre est dissous (mise en solution) ; refroidi et laissé au repos, il dépose une infinité de cristaux minuscules (précipitation).',
      reglages: [
        { id: 'Tsol', nom: 'Température de mise en solution', min: 450, max: 600, pas: 5, defaut: 535, unite: '°C',
          alertes: [{ max: 514, texte: 'Sous le solvus (≈ 515 °C) : une partie de Mg₂Si ne se dissout pas.' }, { min: 575, texte: 'Au-delà du solidus (≈ 575 °C) : brûlure, la pièce est perdue.' }] },
        { id: 'tSol', nom: 'Maintien en solution', min: 5, max: 180, pas: 5, defaut: 60, unite: 'min' },
        { id: 'trempe', nom: 'Trempe', choix: [['eau', 'Eau'], ['air', 'Air calme']], defaut: 'eau' },
        { id: 'e', nom: 'Épaisseur', min: 2, max: 60, pas: 1, defaut: 10, unite: 'mm' },
        { id: 'delai', nom: 'Maturation à l’ambiante', min: 0, max: 720, pas: 1, defaut: 24, unite: 'h' },
        { id: 'revenu', nom: 'Revenu', bascule: true, defaut: true },
        { id: 'Trev', nom: 'Température de revenu', min: 140, max: 260, pas: 5, defaut: 175, unite: '°C', si: 'revenu',
          alertes: [{ min: 205, texte: 'Revenu chaud : pic atteint vite, puis sur-revenu rapide.' }] },
        { id: 'tRev', nom: 'Durée du revenu', min: 0.25, max: 100, pas: 0.25, defaut: 10, unite: 'h', si: 'revenu' }
      ],
      exemples: [
        { nom: 'État T6 (175 °C, 10 h)', valeurs: { Tsol: 535, tSol: 60, trempe: 'eau', e: 10, delai: 24, revenu: true, Trev: 175, tRev: 10 } },
        { nom: 'État T4 (maturation)', valeurs: { Tsol: 535, tSol: 60, trempe: 'eau', e: 10, delai: 168, revenu: false } },
        { nom: 'Sur-revenu (T7)', valeurs: { Tsol: 535, tSol: 60, trempe: 'eau', e: 10, delai: 24, revenu: true, Trev: 200, tRev: 30 } },
        { nom: 'Trempe à l’air (lente)', valeurs: { Tsol: 535, tSol: 60, trempe: 'air', e: 10, delai: 24, revenu: true, Trev: 175, tRev: 10 } },
        { nom: 'Mise en solution trop froide', valeurs: { Tsol: 480, tSol: 60, trempe: 'eau', e: 10, delai: 24, revenu: true, Trev: 175, tRev: 10 } },
        { nom: 'Brûlure à 590 °C', valeurs: { Tsol: 590, tSol: 60, trempe: 'eau', e: 10, delai: 24, revenu: true, Trev: 175, tRev: 10 } }
      ],
      geometrie: p => ({ forme: 'plaque', L: p.e / 2000, n: 7, contraintes: false, nom: 'plaque de ' + p.e + ' mm' }),
      points: g => [{ id: 'coeur', nom: 'Cœur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const s = [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Tsol, jusqua: { coeurAtteint: p.Tsol - 3 }, dureeMax: 4 * 3600, dt0: 1, dTmax: 8 },
          { id: 'solution', nom: 'Mise en solution', etape: 'maintien', milieu: 'four', env: p.Tsol, duree: p.tSol * 60, dTmax: 8 },
          { id: 'trempe', nom: p.trempe === 'eau' ? 'Trempe à l’eau' : 'Refroidissement à l’air', etape: 'trempe', milieu: p.trempe, env: 20, jusqua: { toutSous: 35 }, dureeMax: 4 * 3600, dt0: 0.02, dTmax: 5, type: 'trempe' }
        ];
        if (p.delai > 0) s.push({ id: 'maturation', nom: 'Maturation à l’ambiante', etape: 'attente', milieu: 'air', env: 20, duree: p.delai * 3600, dt0: 10, dTmax: 8 });
        if (p.revenu) {
          s.push({ id: 'chauffeRevenu', nom: 'Chauffage de revenu', etape: 'chauffage', milieu: 'four', env: p.Trev, jusqua: { coeurAtteint: p.Trev - 3 }, dureeMax: 3 * 3600, revenu: true, dt0: 1, dTmax: 8 });
          s.push({ id: 'revenu', nom: 'Revenu', etape: 'revenu', milieu: 'four', env: p.Trev, duree: p.tRev * 3600, revenu: true, dTmax: 8 });
          s.push({ id: 'refroidissement', nom: 'Refroidissement', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 35 }, dureeMax: 4 * 3600, dt0: 1, dTmax: 8 });
        }
        return s;
      },
      reperes: A => [{ T: A.solidus, nom: 'solidus' }, { T: A.solvus, nom: 'solvus Mg₂Si' }, { T: A.solvusB2, nom: 'dissolution β″' }],
      proprietes: [borne(P.Rp, { max: 360 }), borne(P.Rm, { max: 380 }), borne(P.A, { max: 30 }), borne(P.HV, { max: 130 }), borne(P.conductivite, { min: 22, max: 33, dec: 1 })],
      etapes: {
        chauffe: ['La plaque d’aluminium chauffe vite… sans changer de couleur : à 535 °C, l’aluminium ne rougeoie pratiquement pas, aucun repère visuel.', 'L’aluminium fond vers 650 °C. Tout corps commence à rougeoyer vers 525 °C (point de Draper), mais l’aluminium émet si peu (faible émissivité) que la lueur reste imperceptible en atelier. Seul le thermocouple dit la vérité.'],
        solution: ['Les gros précipités Mg₂Si se dissolvent : magnésium et silicium passent en solution solide dans l’aluminium.', 'Au-dessus du solvus, la solubilité du Mg₂Si suffit pour tout dissoudre ; la cinétique de dissolution impose un maintien de quelques dizaines de minutes à une heure selon l’épaisseur.'],
        trempe: ['La trempe fige les atomes de Mg et de Si dans le réseau : on obtient une solution solide sursaturée, et beaucoup de lacunes.', 'Trop lente, la trempe laisse précipiter des particules grossières (courbe en C de sensibilité à la trempe, nez vers 350–400 °C) : ce soluté perdu ne durcira plus.'],
        maturation: ['À l’ambiante, Mg et Si se regroupent en amas de quelques atomes : l’alliage durcit tout seul (état T4).', 'Les lacunes de trempe accélèrent la diffusion à 20 °C. Ces amas gênent ensuite la précipitation de β″ au revenu (effet de la maturation préalable).'],
        chauffeRevenu: ['On réchauffe vers 160–200 °C : les amas se redissolvent, les vrais précipités durcissants vont naître.', 'Réversion des amas puis germination de β″.'],
        revenu: ['Une nuée d’aiguilles β″ de quelques nanomètres apparaît : elles bloquent les dislocations. La résistance passe par un maximum (état T6), puis baisse si on insiste (sur-revenu).',
          'Durcissement : cisaillement des précipités (Δσ ∝ √(f·r)) tant qu’ils sont petits, contournement d’Orowan (Δσ ∝ √f / r) quand ils grossissent. Le pic correspond au rayon critique. Cinétique activée : Q ≈ 140 kJ/mol.'],
        refroidissement: ['Le refroidissement final ne change pratiquement plus rien.', 'À l’ambiante, la diffusion est trop lente pour faire évoluer β″ ; l’état T6 est stable.']
      },
      evenements: {
        solvus: ['Solvus franchi à {T} : Mg₂Si peut désormais se dissoudre entièrement.', 'Solvus du pseudo-binaire Al–Mg₂Si pour cette composition : ≈ 515 °C.'],
        miseEnSolution: ['Mise en solution terminée : il ne reste plus de Mg₂Si grossier.', 'Solution solide homogène : tout le soluté est disponible pour la précipitation.'],
        brulure: ['Brûlure ! Au-dessus du solidus, les joints de grains commencent à fondre.', 'Fusion naissante aux joints et aux eutectiques (rosettes) : la ductilité s’effondre, irréversiblement.'],
        trempeLente: ['La trempe est trop lente : du Mg₂Si grossier reprécipite pendant le refroidissement.', 'Le refroidissement traverse le nez de la courbe en C de précipitation hétérogène (sur les dispersoïdes de Mn).'],
        maturation: ['Maturation : les amas de solutés se forment, la limite d’élasticité grimpe (état T4).', 'État T4 : mis en solution, trempé, mûri à l’ambiante (EN 515).'],
        b2: ['Les précipités β″ apparaissent.', 'β″ : aiguilles cohérentes Mg₅Si₆ selon les directions ⟨100⟩ de l’aluminium.'],
        pic: ['Pic de durcissement atteint : c’est l’état T6.', 'Au pic, le rayon des précipités est proche du rayon critique de transition cisaillement → contournement.'],
        surRevenu: ['Sur-revenu : les précipités grossissent et deviennent moins nombreux, la résistance baisse.', 'Coalescence (loi en r³ ∝ t) et passage à β′ semi-cohérent : contournement d’Orowan, Δσ ∝ 1/r.']
      },
      pieges: [
        'Une trempe trop lente (pièce épaisse, air) fait perdre une partie du durcissement : le soluté a précipité trop tôt.',
        'Au-delà du solidus, même de quelques degrés, la pièce est brûlée : irrécupérable.',
        'Au microscope optique, un T4 et un T6 se ressemblent : les précipités durcissants ne se voient qu’au microscope électronique en transmission.'
      ],
      metier: [
        'Souder un 6082-T6 adoucit la ZAT : les β″ s’y dissolvent ou y grossissent. On dimensionne avec les propriétés réduites de la zone soudée.',
        'Les profilés sont souvent trempés sur presse (à l’air ou à l’eau) : le 6082, sensible à la trempe, exige un refroidissement énergique.'
      ],
      reviser: [
        { cours: 'brasage-04', ancre: 'c4', titre: 'Braser l’aluminium et les autres métaux' },
        { cours: 'essais-01', ancre: 'c5', titre: 'Ce qui change la courbe de traction' },
        { cours: 'met-02', ancre: 's1', titre: 'Pourquoi les courbes sont en forme de C' }
      ]
    },

    {
      id: 'ttas-s355',
      titre: 'Traitement thermique après soudage',
      sousTitre: 'Détensionner un assemblage soudé épais',
      alliage: 'S355', famille: 'Assemblages soudés', mecanismes: ['Relaxation des contraintes', 'Revenu de la ZAT', 'Dégazage de l’hydrogène'],
      etape: 1,
      but: 'Le traitement thermique après soudage (TTAS) relâche les contraintes résiduelles de soudage, revient la zone affectée thermiquement (ZAT) trop dure et chasse l’hydrogène, sans dégrader le métal de base.',
      image: 'Un élastique tendu qu’on laisse se relâcher dans l’eau chaude.',
      reglages: [
        { id: 'e', nom: 'Épaisseur soudée', min: 10, max: 120, pas: 5, defaut: 40, unite: 'mm' },
        { id: 'vChauffe', nom: 'Vitesse de chauffe', min: 25, max: 400, pas: 5, defaut: 100, unite: '°C/h' },
        { id: 'Tp', nom: 'Température de palier', min: 450, max: 760, pas: 5, defaut: 600, unite: '°C',
          alertes: [{ max: 549, texte: 'Palier trop froid : la relaxation reste incomplète.' }, { min: 650, texte: 'Palier trop chaud : risque d’adoucir le métal de base.' }, { min: 716, texte: 'Au-dessus d’Ac1 ≈ 715 °C : de l’austénite se forme, elle donnera de la martensite fraîche au refroidissement.' }] },
        { id: 'tp', nom: 'Durée du palier', min: 0.25, max: 8, pas: 0.25, defaut: 2, unite: 'h' },
        { id: 'vRefr', nom: 'Vitesse de refroidissement', min: 25, max: 400, pas: 5, defaut: 100, unite: '°C/h' },
        { id: 'Hz0', nom: 'Dureté de la ZAT brute de soudage', min: 250, max: 420, pas: 5, defaut: 350, unite: 'HV' }
      ],
      exemples: [
        { nom: 'TTAS 600 °C, 2 h', valeurs: { e: 40, vChauffe: 100, Tp: 600, tp: 2, vRefr: 100, Hz0: 350 } },
        { nom: 'Palier trop froid (500 °C)', valeurs: { e: 40, vChauffe: 100, Tp: 500, tp: 2, vRefr: 100, Hz0: 350 } },
        { nom: 'Palier court (30 min)', valeurs: { e: 40, vChauffe: 100, Tp: 600, tp: 0.5, vRefr: 100, Hz0: 350 } },
        { nom: 'Trop chaud (740 °C)', valeurs: { e: 40, vChauffe: 100, Tp: 740, tp: 2, vRefr: 100, Hz0: 350 } },
        { nom: 'ZAT très dure (420 HV)', valeurs: { e: 40, vChauffe: 100, Tp: 600, tp: 2, vRefr: 100, Hz0: 420 } }
      ],
      geometrie: p => ({ forme: 'plaque', L: p.e / 2000, n: 7, contraintes: false, nom: 'tôles de ' + p.e + ' mm soudées bout à bout' }),
      points: g => [{ id: 'coeur', nom: 'Mi-épaisseur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const vc = p.vChauffe / 3600, vr = p.vRefr / 3600;
        const montee = (p.Tp - 20) / vc, descente = (p.Tp - 300) / vr;
        return [
          { id: 'chauffe', nom: 'Chauffe contrôlée', etape: 'chauffage', milieu: 'four', env: t => Math.min(p.Tp, 20 + vc * t), rampeFin: montee, jusqua: { coeurAtteint: p.Tp - 8 }, dureeMax: montee + 6 * 3600, dt0: 5, dtMax: 120, carte: 'lin', revenu: true },
          { id: 'palier', nom: 'Palier', etape: 'maintien', milieu: 'four', env: p.Tp, duree: p.tp * 3600, dtMax: 300, revenu: true },
          { id: 'descente', nom: 'Refroidissement contrôlé', etape: 'refroidissement', milieu: 'four', env: t => Math.max(300, p.Tp - vr * t), duree: descente, dtMax: 120, carte: 'lin', revenu: true },
          { id: 'air', nom: 'Fin à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 12 * 3600, dt0: 5, dtMax: 300, revenu: true }
        ];
      },
      reperes: A => [{ T: A.Ac1, nom: 'Ac1' }, { T: 620, nom: '620' }, { T: 550, nom: '550' }],
      bande: [550, 620, 'zone usuelle des TTAS des aciers C-Mn'],
      proprietes: [borne(P.sigma, { min: 0, max: 400, signe: false, nom: 'Contrainte résiduelle au joint' }), { cle: 'HVz', nom: 'Dureté de la ZAT', unite: 'HV', min: 150, max: 450, dec: 0, limites: [[380, '380 HV10'], [320, '320 HV10']] }, P.tenacite, borne(P.H, {}), borne(P.Rp, { max: 400, nom: 'Re du métal de base' })],
      etapes: {
        chauffe: ['On chauffe lentement, pour que toute l’épaisseur monte ensemble : un écart de température entre surface et cœur créerait de nouvelles contraintes.', 'Les codes limitent la vitesse au-dessus de ≈ 425 °C, typiquement à quelques milliers divisés par l’épaisseur (°C/h, épaisseur en mm), avec un plafond de l’ordre de 200 °C/h.'],
        palier: ['Au palier, le métal devient moins résistant et flue : les contraintes de soudage se relâchent toutes seules. La ZAT se revient et l’hydrogène s’échappe.',
          'Deux effets : (1) la limite d’élasticité à chaud plafonne les contraintes ; (2) le fluage les relaxe (loi de Norton, dσ/dt = −E·A·σⁿ·exp(−Q/RT)). Durée usuelle ≈ 1 h par 25 mm.'],
        descente: ['On redescend lentement jusqu’à ≈ 300 °C : un refroidissement brutal recréerait des écarts de température.', 'Sous ≈ 300 °C, l’acier est redevenu rigide et les gradients ne laissent plus de contraintes notables.'],
        air: ['Fin du refroidissement à l’air : l’assemblage est détensionné.', 'La contrainte résiduelle finale vaut une fraction de la limite d’élasticité, typiquement 20 à 30 % après un TTAS bien conduit.']
      },
      evenements: {
        plafond: ['La limite d’élasticité baisse avec la température : les contraintes de soudage sont écrêtées dès {T}.', 'À 600 °C, la limite d’élasticité d’un acier de construction ne vaut plus qu’environ la moitié de sa valeur ambiante (EN 1993-1-2).'],
        relaxe50: ['La moitié de la contrainte de soudage a disparu.', 'Écrêtage plastique, puis relaxation par fluage, d’autant plus rapide que T est élevée.'],
        hydrogene: ['L’hydrogène diffusible est presque totalement sorti du joint.', 'Effusion à travers l’épaisseur e : temps caractéristique ≈ e²/(π²·D), avec un coefficient de diffusion D qui gagne plus de deux ordres de grandeur entre 20 et 600 °C.'],
        intercritique: ['Au-dessus d’Ac1 : de l’austénite apparaît dans la ZAT et redeviendra martensite fraîche au refroidissement !', 'Un TTAS ne doit jamais dépasser Ac1 : il recréerait des constituants durs et fragiles (martensite, îlots de martensite et d’austénite résiduelle dits M-A).']
      },
      pieges: [
        'Un palier trop froid ou trop court laisse l’essentiel des contraintes : le TTAS n’a servi à rien.',
        'Dépasser Ac1 recrée de la martensite fraîche : la ZAT redevient dure et fragile.',
        'Un palier trop chaud ou trop long peut faire perdre au métal de base sa limite d’élasticité garantie (aciers normalisés ou thermomécaniques).'
      ],
      metier: [
        'L’EN ISO 15614-1 limite la dureté des aciers des groupes 1 et 2 à 380 HV10 sans traitement thermique et à 320 HV10 avec.',
        'Pour les aciers au carbone, l’ASME VIII prescrit par exemple au moins 595 °C, 1 h par 25 mm d’épaisseur, avec des vitesses de chauffe et de refroidissement limitées.'
      ],
      reviser: [
        { cours: 'met-03', ancre: 's6', titre: 'Fissuration à froid et préchauffage' },
        { cours: 'met-03', ancre: 's4', titre: 'Le soudage, un traitement thermique local' },
        { cours: 'crmo-03', ancre: 'c4', titre: 'La fissuration au réchauffage' },
        { cours: 'fluage-01', ancre: 'c3', titre: 'La loi de Norton' }
      ]
    },

    {
      id: 'recuit-complet-c45',
      titre: 'Recuit complet',
      sousTitre: 'Rendre un acier au carbone le plus doux possible',
      alliage: 'C45', famille: 'Aciers', mecanismes: ['Austénitisation', 'Transformation ferrito-perlitique', 'Taille du grain'],
      etape: 2,
      but: 'Adoucir l’acier et régulariser sa structure pour l’usiner ou le déformer : austénitisation complète au-dessus d’Ac3, puis refroidissement très lent au four.',
      image: 'Une pâte qu’on laisse lever sans se presser : en refroidissant lentement, l’acier a tout son temps pour former de gros grains de ferrite et de la perlite grossière.',
      reglages: [
        { id: 'Taus', nom: 'Température d’austénitisation', min: 740, max: 960, pas: 5, defaut: 830, unite: '°C',
          alertes: [{ max: 779, texte: 'Sous Ac3 ≈ 780 °C : une partie de la ferrite d’origine n’est pas régénérée.' }, { min: 900, texte: 'Trop chaud : le grain austénitique grossit inutilement.' }] },
        { id: 'tAus', nom: 'Maintien', min: 10, max: 240, pas: 10, defaut: 60, unite: 'min' },
        { id: 'v', nom: 'Vitesse de refroidissement au four', min: 5, max: 300, pas: 5, defaut: 30, unite: '°C/h',
          alertes: [{ min: 150, texte: 'Refroidissement rapide : on se rapproche d’une normalisation, l’acier reste plus dur.' }] },
        { id: 'D', nom: 'Diamètre de la pièce', min: 20, max: 200, pas: 10, defaut: 60, unite: 'mm' }
      ],
      exemples: [
        { nom: 'Recuit à 830 °C, four 30 °C/h', valeurs: { Taus: 830, tAus: 60, v: 30, D: 60 } },
        { nom: 'Four trop rapide (200 °C/h)', valeurs: { Taus: 830, tAus: 60, v: 200, D: 60 } },
        { nom: 'Recuit trop chaud (950 °C)', valeurs: { Taus: 950, tAus: 120, v: 30, D: 60 } },
        { nom: 'Sous Ac3 (760 °C)', valeurs: { Taus: 760, tAus: 60, v: 30, D: 60 } }
      ],
      geometrie: p => ({ forme: 'cylindre', L: p.D / 2000, n: 7, contraintes: false, nom: 'barre Ø' + p.D + ' mm' }),
      points: g => [{ id: 'coeur', nom: 'Cœur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const v = p.v / 3600;
        return [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Taus, jusqua: { coeurAtteint: p.Taus - 5 }, dureeMax: 8 * 3600, dt0: 2, dTmax: 10 },
          { id: 'austenitisation', nom: 'Austénitisation', etape: 'maintien', milieu: 'four', env: p.Taus, duree: p.tAus * 60, dTmax: 10 },
          { id: 'four', nom: 'Refroidissement au four', etape: 'refroidissement', milieu: 'four', env: t => Math.max(20, p.Taus - v * t), jusqua: { toutSous: 550 }, dureeMax: 80 * 3600, carte: 'lin', dt0: 10, dtMax: 600, dTmax: 6 },
          { id: 'air', nom: 'Fin à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 12 * 3600, dt0: 5, dTmax: 6 }
        ];
      },
      reperes: A => [{ T: A.Ac3, nom: 'Ac3' }, { T: A.Ac1, nom: 'Ac1' }],
      proprietes: [borne(P.HV, { max: 320 }), borne(P.Rm, { max: 1100 }), borne(P.A, { max: 35 }), P.tenacite, borne(P.grain, { max: 200 })],
      etapes: {
        chauffe: ['La pièce monte lentement jusqu’au-dessus d’Ac3 : toute la ferrite et toute la perlite vont se redissoudre en austénite.', 'La mise à température du cœur suit la conduction : t ∝ R²/a, avec une diffusivité thermique a ≈ 6 mm²/s.'],
        austenitisation: ['Austénite homogène : l’acier « oublie » sa structure d’avant (grains écrouis, hétérogènes, durs).', 'Le maintien égalise la température et la composition de l’austénite. Recuit complet : Ac3 + 30 à 50 °C.'],
        four: ['On laisse refroidir dans le four, très lentement : la ferrite puis la perlite se forment près de l’équilibre, en gros grains.', 'Très faible surfusion : peu de germes de ferrite, grain ferritique grossier ; perlite à lamelles espacées. C’est l’état le plus doux de l’acier (le diagramme d’équilibre s’applique presque).'],
        air: ['Sous ≈ 550 °C, la transformation est terminée : on peut sortir la pièce à l’air.', 'Sous A1, plus aucune transformation de phase ; le refroidissement final ne change plus la structure.']
      },
      evenements: evt(EVT_FP),
      pieges: [
        'Ne pas confondre avec la normalisation : même chauffage, mais refroidissement au four. Le recuit adoucit et grossit le grain ; la normalisation l’affine.',
        'Chauffer bien au-dessus d’Ac3 ne sert à rien et fait grossir le grain.',
        'Un recuit complet est long (souvent une nuit) : on lui préfère la globulisation quand on veut seulement usiner.'
      ],
      metier: [
        'Le C45 recuit (+A) est garanti au plus 207 HB environ par l’EN 10083-2 : c’est l’état d’usinage.',
        'Une pièce soudée ne se recuit pas ainsi : le grossissement du grain dégraderait la ténacité du joint.'
      ],
      reviser: [
        { cours: 'met-01', ancre: 's4', titre: 'Un acier à 0,3 % C refroidi lentement' },
        { cours: 'met-03', ancre: 's3', titre: 'Les traitements thermiques des aciers' },
        { cours: 'met-01', ancre: 's3', titre: 'La perlite, un tri du carbone' }
      ]
    },

    {
      id: 'normalisation-c45',
      titre: 'Normalisation',
      sousTitre: 'Affiner le grain d’une pièce forgée',
      alliage: 'C45', famille: 'Aciers', mecanismes: ['Austénitisation', 'Affinage du grain', 'Transformation ferrito-perlitique'],
      etape: 2,
      but: 'Effacer le gros grain d’une pièce forgée, moulée ou surchauffée : on régénère des grains d’austénite neufs et fins, puis on refroidit à l’air calme.',
      image: 'On repart de zéro : des grains neufs et fins naissent partout dans l’austénite, comme une forêt replantée serrée.',
      initial: { dF: 80, dG: 200, nom: 'état brut de forge : gros grains (≈ 80 µm), structure de surchauffe' },
      reglages: [
        { id: 'Taus', nom: 'Température de normalisation', min: 740, max: 1050, pas: 5, defaut: 850, unite: '°C',
          alertes: [{ max: 779, texte: 'Sous Ac3 ≈ 780 °C : la ferrite grossière d’origine subsiste, le grain n’est pas affiné.' }, { min: 920, texte: 'Trop chaud : le grain austénitique regrossit, l’affinage est perdu.' }] },
        { id: 'tAus', nom: 'Maintien', min: 5, max: 120, pas: 5, defaut: 30, unite: 'min' },
        { id: 'milieu', nom: 'Refroidissement', choix: [['air', 'Air calme'], ['four', 'Four (recuit)']], defaut: 'air' },
        { id: 'D', nom: 'Diamètre de la pièce', min: 10, max: 150, pas: 5, defaut: 40, unite: 'mm' }
      ],
      exemples: [
        { nom: 'Normalisation à 850 °C', valeurs: { Taus: 850, tAus: 30, milieu: 'air', D: 40 } },
        { nom: 'Sous Ac3 (760 °C)', valeurs: { Taus: 760, tAus: 30, milieu: 'air', D: 40 } },
        { nom: 'Trop chaude (1000 °C)', valeurs: { Taus: 1000, tAus: 60, milieu: 'air', D: 40 } },
        { nom: 'Refroidie au four (recuit)', valeurs: { Taus: 850, tAus: 30, milieu: 'four', D: 40 } },
        { nom: 'Grosse pièce Ø150', valeurs: { Taus: 850, tAus: 60, milieu: 'air', D: 150 } }
      ],
      geometrie: p => ({ forme: 'cylindre', L: p.D / 2000, n: 7, contraintes: false, nom: 'pièce forgée Ø' + p.D + ' mm' }),
      points: g => [{ id: 'coeur', nom: 'Cœur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const four = p.milieu === 'four';
        return [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Taus, jusqua: { coeurAtteint: p.Taus - 5 }, dureeMax: 8 * 3600, dt0: 2, dTmax: 10 },
          { id: 'austenitisation', nom: 'Austénitisation', etape: 'maintien', milieu: 'four', env: p.Taus, duree: p.tAus * 60, dTmax: 10 },
          four ? { id: 'four', nom: 'Refroidissement au four', etape: 'refroidissement', milieu: 'four', env: t => Math.max(20, p.Taus - 30 * t / 3600), jusqua: { toutSous: 550 }, dureeMax: 60 * 3600, carte: 'lin', dt0: 10, dtMax: 600, dTmax: 6 }
            : { id: 'air', nom: 'Refroidissement à l’air calme', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 12 * 3600, dt0: 1, dTmax: 6 }
        ].concat(four ? [{ id: 'air', nom: 'Fin à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 12 * 3600, dt0: 5, dTmax: 6 }] : []);
      },
      reperes: A => [{ T: A.Ac3, nom: 'Ac3' }, { T: A.Ac1, nom: 'Ac1' }],
      proprietes: [borne(P.HV, { max: 320 }), borne(P.Rm, { max: 1100 }), borne(P.Rp, { max: 700 }), borne(P.A, { max: 35 }), P.tenacite, borne(P.grain, { max: 200 })],
      etapes: {
        chauffe: ['On chauffe juste au-dessus d’Ac3. Au passage d’Ac1 puis d’Ac3, la vieille structure à gros grains disparaît.', 'Chaque grain d’austénite neuf germe sur les interfaces ferrite/cémentite : il en naît beaucoup, ils sont fins.'],
        austenitisation: ['Maintien court : juste ce qu’il faut pour que tout le cœur soit austénitique, sans laisser le grain regrossir.', 'Normalisation : Ac3 + 30 à 50 °C, maintien de l’ordre d’une minute par millimètre puis refroidissement à l’air calme.'],
        air: ['À l’air calme, le refroidissement est plus rapide qu’au four : la ferrite naît en grains nombreux et fins, la perlite est fine.', 'Surfusion plus forte qu’au recuit : germination abondante de la ferrite, grain ferritique de 10 à 15 µm environ (indice G 8 à 10) ; perlite fine, un peu plus dure.'],
        four: ['Au four, on obtient un recuit : plus doux, mais à gros grain.', 'Refroidissement lent : grain ferritique grossier, perlite grossière.']
      },
      evenements: evt(EVT_FP),
      pieges: [
        'Rester sous Ac3 n’affine rien : la ferrite d’origine, grossière, n’est pas régénérée.',
        'Normaliser trop chaud refait grossir le grain austénitique, et donc le grain final.',
        'Une grosse pièce refroidit lentement à cœur : le grain y reste plus gros qu’en surface.'
      ],
      metier: [
        'La normalisation suit souvent le forgeage, le moulage ou un soudage hétérogène (électrode de grosse section, rechargement) pour retrouver une ténacité correcte.',
        'Les tôles « N » (P355N, S355N…) sont livrées normalisées : un TTAS trop chaud peut leur faire perdre leurs caractéristiques.'
      ],
      reviser: [
        { cours: 'met-03', ancre: 's3', titre: 'Les traitements thermiques des aciers' },
        { cours: 'met-01', ancre: 's6', titre: 'L’acier à 0,3 % C à 1000 °C' },
        { cours: 'essais-01', ancre: 'c5', titre: 'Ce qui change la courbe de traction' }
      ]
    },

    {
      id: 'globulisation-c45',
      titre: 'Recuit de globulisation',
      sousTitre: 'Mettre la cémentite en globules pour usiner et déformer',
      alliage: 'C45', famille: 'Aciers', mecanismes: ['Coalescence de la cémentite', 'Adoucissement'],
      etape: 2,
      but: 'Transformer les lamelles de cémentite de la perlite en petits globules dans une ferrite continue : l’acier devient doux, ductile et facile à usiner ou à frapper à froid.',
      image: 'Des spaghettis cuits qui, laissés au chaud très longtemps, se mettraient en boulettes pour réduire leur surface.',
      reglages: [
        { id: 'Tg', nom: 'Température de maintien', min: 600, max: 720, pas: 5, defaut: 700, unite: '°C',
          alertes: [{ max: 649, texte: 'Trop froid : la diffusion du carbone est lente, il faudrait des jours.' }] },
        { id: 'tg', nom: 'Durée du maintien', min: 1, max: 48, pas: 1, defaut: 16, unite: 'h' },
        { id: 'v', nom: 'Refroidissement au four', min: 5, max: 100, pas: 5, defaut: 20, unite: '°C/h' },
        { id: 'D', nom: 'Diamètre de la barre', min: 20, max: 120, pas: 10, defaut: 40, unite: 'mm' }
      ],
      exemples: [
        { nom: '700 °C, 16 h', valeurs: { Tg: 700, tg: 16, v: 20, D: 40 } },
        { nom: 'Trop court (4 h)', valeurs: { Tg: 700, tg: 4, v: 20, D: 40 } },
        { nom: 'Trop froid (640 °C)', valeurs: { Tg: 640, tg: 16, v: 20, D: 40 } },
        { nom: 'Très long (715 °C, 40 h)', valeurs: { Tg: 715, tg: 40, v: 20, D: 40 } }
      ],
      geometrie: p => ({ forme: 'cylindre', L: p.D / 2000, n: 7, contraintes: false, nom: 'barre Ø' + p.D + ' mm' }),
      points: g => [{ id: 'coeur', nom: 'Cœur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const v = p.v / 3600;
        return [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Tg, jusqua: { coeurAtteint: p.Tg - 5 }, dureeMax: 8 * 3600, dt0: 2, dTmax: 10 },
          { id: 'maintien', nom: 'Globulisation', etape: 'maintien', milieu: 'four', env: p.Tg, duree: p.tg * 3600, dTmax: 10, dtMax: 1200 },
          { id: 'four', nom: 'Refroidissement au four', etape: 'refroidissement', milieu: 'four', env: t => Math.max(20, p.Tg - v * t), jusqua: { toutSous: 500 }, dureeMax: 40 * 3600, carte: 'lin', dt0: 10, dtMax: 600, dTmax: 6 },
          { id: 'air', nom: 'Fin à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 12 * 3600, dt0: 5, dTmax: 6 }
        ];
      },
      reperes: A => [{ T: A.Ac1, nom: 'Ac1' }],
      proprietes: [borne(P.HV, { max: 260 }), borne(P.Rm, { max: 900 }), borne(P.A, { max: 35 }), P.tenacite, { cle: 'globules', nom: 'Cémentite globulisée', unite: '%', min: 0, max: 100, dec: 0 }],
      etapes: {
        chauffe: ['On chauffe juste sous Ac1 : aucune austénite ne doit se former.', 'Sous A1, la perlite est stable ; seule la forme de la cémentite va changer.'],
        maintien: ['Lentement, les lamelles de cémentite se fragmentent puis s’arrondissent en globules : l’acier s’adoucit.', 'Force motrice : la diminution de l’énergie des interfaces ferrite/cémentite. Cinétique contrôlée par la diffusion du carbone (et du fer aux interfaces) : quelques heures à quelques dizaines d’heures vers 680–720 °C.'],
        four: ['Refroidissement lent au four, pour ne pas créer de contraintes ni de nouvelles lamelles.', 'Sous Ac1, rien ne se retransforme : le refroidissement lent limite surtout les écarts de température.'],
        air: ['Sortie à l’air : la structure globulaire est figée.', 'État « +AC » (recuit de globulisation) des aciers destinés à la frappe à froid.']
      },
      evenements: evt(EVT_FP),
      pieges: [
        'Dépasser Ac1 redissout la perlite : au refroidissement, de nouvelles lamelles se reforment si l’on refroidit trop vite.',
        'Trop froid ou trop court, la cémentite reste en lamelles : l’adoucissement est incomplet.',
        'La globulisation est lente : elle se compte en heures, souvent en dizaines d’heures.'
      ],
      metier: [
        'On globulise les aciers destinés à la frappe à froid (vis, boulons) et les aciers à roulements avant usinage.',
        'Partir d’une structure trempée ou écrouie accélère beaucoup la globulisation.'
      ],
      reviser: [
        { cours: 'met-03', ancre: 's3', titre: 'Les traitements thermiques des aciers' },
        { cours: 'met-01', ancre: 's3', titre: 'La perlite, un tri du carbone' }
      ]
    },

    {
      id: 'homogeneisation-g20mn5',
      titre: 'Recuit d’homogénéisation',
      sousTitre: 'Effacer les ségrégations d’un acier moulé, puis normaliser',
      alliage: 'G20Mn5', famille: 'Aciers', mecanismes: ['Diffusion à longue distance', 'Croissance du grain', 'Normalisation'],
      etape: 2,
      but: 'Réduire les écarts de composition hérités de la solidification (le manganèse s’est concentré entre les branches des dendrites) par un long maintien très chaud, puis régénérer un grain fin par une normalisation.',
      image: 'Un sirop mal mélangé : il faut beaucoup de temps et de chaleur pour que le sucre se répartisse, et le mélange n’est jamais parfait.',
      reglages: [
        { id: 'homog', nom: 'Homogénéisation', bascule: true, defaut: true },
        { id: 'Th', nom: 'Température d’homogénéisation', min: 1000, max: 1250, pas: 10, defaut: 1200, unite: '°C', si: 'homog',
          alertes: [{ max: 1099, texte: 'Trop froid : le manganèse diffuse beaucoup trop lentement.' }, { min: 1230, texte: 'Très chaud : grain très grossier, oxydation et décarburation de surface.' }] },
        { id: 'th', nom: 'Durée du maintien', min: 1, max: 30, pas: 1, defaut: 10, unite: 'h', si: 'homog' },
        { id: 'lambda', nom: 'Espacement des ségrégations (entre zones enrichies)', min: 30, max: 300, pas: 10, defaut: 100, unite: 'µm',
          alertes: [{ min: 200, texte: 'Grosses dendrites (pièce massive, solidification lente) : homogénéisation très longue.' }] },
        { id: 'norm', nom: 'Normalisation finale', bascule: true, defaut: true },
        { id: 'Tn', nom: 'Température de normalisation', min: 850, max: 960, pas: 10, defaut: 900, unite: '°C', si: 'norm' },
        { id: 'e', nom: 'Épaisseur de la pièce', min: 20, max: 200, pas: 10, defaut: 60, unite: 'mm' }
      ],
      exemples: [
        { nom: '1200 °C, 10 h + normalisation', valeurs: { homog: true, Th: 1200, th: 10, lambda: 100, norm: true, Tn: 900, e: 60 } },
        { nom: 'Normalisation seule', valeurs: { homog: false, lambda: 100, norm: true, Tn: 900, e: 60 } },
        { nom: 'Sans normalisation (gros grain)', valeurs: { homog: true, Th: 1200, th: 10, lambda: 100, norm: false, e: 60 } },
        { nom: 'Trop froid (1050 °C)', valeurs: { homog: true, Th: 1050, th: 10, lambda: 100, norm: true, Tn: 900, e: 60 } },
        { nom: 'Grosses dendrites (250 µm)', valeurs: { homog: true, Th: 1200, th: 10, lambda: 250, norm: true, Tn: 900, e: 60 } }
      ],
      geometrie: p => ({ forme: 'plaque', L: p.e / 2000, n: 7, contraintes: false, nom: 'pièce moulée de ' + p.e + ' mm' }),
      points: g => [{ id: 'coeur', nom: 'Cœur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const s = [];
        if (p.homog) {
          s.push({ id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Th, jusqua: { coeurAtteint: p.Th - 5 }, dureeMax: 10 * 3600, dt0: 2, dTmax: 12 });
          s.push({ id: 'homogeneisation', nom: 'Homogénéisation', etape: 'maintien', milieu: 'four', env: p.Th, duree: p.th * 3600, dTmax: 12, dtMax: 1200 });
          s.push({ id: 'four', nom: 'Refroidissement au four', etape: 'refroidissement', milieu: 'four', env: t => Math.max(20, p.Th - 100 * t / 3600), jusqua: { toutSous: 550 }, dureeMax: 20 * 3600, carte: 'lin', dt0: 10, dtMax: 600, dTmax: 6 });
          s.push({ id: 'air1', nom: 'Fin à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 60 }, dureeMax: 12 * 3600, dt0: 5, dTmax: 6 });
        }
        if (p.norm) {
          s.push({ id: 'chauffeNorm', nom: 'Chauffage de normalisation', etape: 'chauffage', milieu: 'four', env: p.Tn, jusqua: { coeurAtteint: p.Tn - 5 }, dureeMax: 8 * 3600, dt0: 2, dTmax: 10 });
          s.push({ id: 'normalisation', nom: 'Normalisation', etape: 'maintien', milieu: 'four', env: p.Tn, duree: 3600, dTmax: 10 });
          s.push({ id: 'air', nom: 'Refroidissement à l’air calme', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 12 * 3600, dt0: 1, dTmax: 6 });
        }
        if (!s.length) s.push({ id: 'attente', nom: 'Brut de coulée', etape: 'attente', milieu: 'air', env: 20, duree: 3600 });
        return s;
      },
      reperes: A => [{ T: A.Ac3, nom: 'Ac3' }, { T: A.Ac1, nom: 'Ac1' }],
      proprietes: [{ cle: 'seg', nom: 'Ségrégation du manganèse (écart local)', unite: '%', min: 0, max: 35, dec: 0 }, borne(P.grain, { max: 600, nom: 'Taille de grain' }), P.tenacite, borne(P.HV, { max: 260 }), borne(P.A, { max: 35 })],
      etapes: {
        chauffe: ['On chauffe très haut, vers 1150–1250 °C : à cette température seulement, le manganèse peut voyager dans l’austénite.', 'Le carbone diffuse vite ; le manganèse, élément de substitution, des milliers de fois plus lentement : c’est lui qui fixe la durée.'],
        homogeneisation: ['Pendant des heures, le manganèse quitte les zones riches pour les zones pauvres : les écarts s’atténuent… et le grain grossit énormément.', 'L’amplitude des ségrégations décroît comme exp(−4π²·D·t/λ²) : doubler l’espacement λ quadruple la durée ; D = D₀·exp(−Q/RT) avec Q ≈ 264 kJ/mol.'],
        four: ['Refroidissement au four : l’acier ressort très doux, mais à grain énorme.', 'La structure ferrito-perlitique est grossière : la ténacité est mauvaise tant qu’on ne normalise pas.'],
        air1: ['Fin à l’air.', 'La pièce est homogène mais à gros grain.'],
        chauffeNorm: ['On rechauffe juste au-dessus d’Ac3 : de nouveaux grains d’austénite, fins, remplacent les gros.', 'La normalisation affine le grain mais ne change presque rien aux ségrégations : à 900 °C, le manganèse ne bouge pratiquement pas.'],
        normalisation: ['Austénite neuve à grain fin.', 'Maintien court pour ne pas regrossir le grain.'],
        air: ['Refroidissement à l’air : grain fin, structure homogène et tenace.', 'Ferrite et perlite fines, réparties régulièrement si l’homogénéisation a été efficace.'],
        attente: ['État brut de coulée.', 'Sans traitement, l’acier moulé garde ses ségrégations et son gros grain.']
      },
      evenements: evt(Object.assign({}, EVT_FP, {
        grainGrossier: ['Le grain austénitique grossit fortement (plus de 60 µm) : c’est le prix à payer de l’homogénéisation.', 'À 1200 °C, plus rien ne freine les joints : le grain atteint plusieurs centaines de micromètres. La normalisation devra l’affiner.']
      })),
      pieges: [
        'Une normalisation seule affine le grain mais n’efface pas les ségrégations : le manganèse ne diffuse pas à 900 °C.',
        'L’homogénéisation fait grossir le grain : elle doit être suivie d’une normalisation (ou d’une trempe et d’un revenu).',
        'Plus les dendrites sont grosses (pièce massive), plus l’homogénéisation est longue : la durée croît comme le carré de l’espacement.'
      ],
      metier: [
        'Les zones ségrégées se retrouvent en bandes de ferrite et de perlite dans les produits laminés, et en zones dures dans la ZAT des soudures.',
        'Pour les grosses pièces moulées, l’homogénéisation complète est rarement atteinte : on limite les ségrégations dès la coulée.'
      ],
      reviser: [
        { cours: 'met-03', ancre: 's3', titre: 'Les traitements thermiques des aciers' },
        { cours: 'met-02', ancre: 's5', titre: 'Les éléments d’addition' }
      ]
    },

    {
      id: 'trempes-etagees-34crnimo6',
      titre: 'Trempes étagées',
      sousTitre: 'Martensitique ou bainitique, en bain de sel',
      alliage: '34CrNiMo6', famille: 'Aciers', mecanismes: ['Bain de sel', 'Transformation isotherme', 'Contraintes de trempe'],
      etape: 2,
      but: 'Limiter déformations et tapures en évitant que surface et cœur se transforment à des moments différents : on trempe dans un bain de sel chaud, on attend l’égalisation des températures, puis on transforme.',
      image: 'Faire une pause sur le palier d’un escalier avant la dernière marche : toute la pièce arrive en même temps.',
      reglages: [
        { id: 'mode', nom: 'Type de trempe', choix: [['martensitique', 'Étagée martensitique'], ['bainitique', 'Étagée bainitique'], ['huile', 'Directe à l’huile']], defaut: 'bainitique' },
        { id: 'Tb', nom: 'Température du bain de sel', min: 280, max: 500, pas: 5, defaut: 380, unite: '°C',
          alertes: [{ max: 329, texte: 'Sous Ms ≈ 330 °C : la martensite commence déjà dans le bain.' }, { min: 451, texte: 'Bain chaud : bainite supérieure, plus grossière et moins tenace.' }] },
        { id: 'tb', nom: 'Durée dans le bain', min: 1, max: 240, pas: 1, defaut: 120, unite: 'min' },
        { id: 'D', nom: 'Diamètre de la pièce', min: 10, max: 80, pas: 5, defaut: 25, unite: 'mm',
          alertes: [{ min: 50, texte: 'Grosse pièce : son cœur refroidit lentement dans le bain chaud, de la bainite peut naître pendant la descente.' }] },
        { id: 'revenu', nom: 'Revenu final', bascule: true, defaut: false },
        { id: 'Trev', nom: 'Température de revenu', min: 150, max: 650, pas: 10, defaut: 550, unite: '°C', si: 'revenu' },
        { id: 'tRev', nom: 'Durée du revenu', min: 0.5, max: 6, pas: 0.5, defaut: 2, unite: 'h', si: 'revenu' }
      ],
      exemples: [
        { nom: 'Bainitique : 380 °C, 2 h', valeurs: { mode: 'bainitique', Tb: 380, tb: 120, D: 25, revenu: false } },
        { nom: 'Martensitique : 340 °C, 10 min + revenu', valeurs: { mode: 'martensitique', Tb: 340, tb: 10, D: 25, revenu: true, Trev: 550, tRev: 2 } },
        { nom: 'Martensitique, palier trop long (90 min)', valeurs: { mode: 'martensitique', Tb: 340, tb: 90, D: 25, revenu: false } },
        { nom: 'Bainitique, palier trop court (30 min)', valeurs: { mode: 'bainitique', Tb: 380, tb: 30, D: 25, revenu: false } },
        { nom: 'Bainite supérieure (470 °C)', valeurs: { mode: 'bainitique', Tb: 470, tb: 120, D: 25, revenu: false } },
        { nom: 'Directe à l’huile (comparaison)', valeurs: { mode: 'huile', D: 25, revenu: false } }
      ],
      geometrie: p => ({ forme: 'cylindre', L: p.D / 2000, n: 11, contraintes: true, nom: 'pièce Ø' + p.D + ' mm' }),
      points: g => [{ id: 'surface', nom: 'Surface', noeud: g.n - 1 }, { id: 'coeur', nom: 'Cœur', noeud: 0 }],
      programme(p) {
        const s = [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: 850, jusqua: { coeurAtteint: 845 }, dureeMax: 6 * 3600, dTmax: 10, dt0: 2 },
          { id: 'austenitisation', nom: 'Austénitisation', etape: 'maintien', milieu: 'four', env: 850, duree: 1800, dTmax: 10 }
        ];
        if (p.mode === 'huile') {
          s.push({ id: 'trempe', nom: 'Trempe à l’huile', etape: 'trempe', milieu: 'huile', env: 20, jusqua: { toutSous: 40 }, dureeMax: 6 * 3600, dt0: 0.02, dTmax: 4 });
        } else {
          s.push({ id: 'bain', nom: 'Trempe au bain de sel', etape: 'trempe', milieu: 'sel', env: p.Tb, jusqua: { toutSous: p.Tb + 8 }, dureeMax: 3600, dt0: 0.02, dTmax: 4 });
          s.push({ id: 'palier', nom: p.mode === 'martensitique' ? 'Palier au-dessus de Ms' : 'Palier bainitique', etape: 'maintien', milieu: 'sel', env: p.Tb, duree: p.tb * 60, dTmax: 4, dtMax: 120 });
          s.push({ id: 'air', nom: 'Refroidissement à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 8 * 3600, dt0: 0.5, dTmax: 4 });
        }
        if (p.revenu) {
          s.push({ id: 'chauffeRevenu', nom: 'Chauffage de revenu', etape: 'chauffage', milieu: 'four', env: p.Trev, jusqua: { coeurAtteint: p.Trev - 5 }, dureeMax: 6 * 3600, revenu: true, dTmax: 10, dt0: 2 });
          s.push({ id: 'revenu', nom: 'Revenu', etape: 'revenu', milieu: 'four', env: p.Trev, duree: p.tRev * 3600, revenu: true, dTmax: 10 });
          s.push({ id: 'refroidissement', nom: 'Refroidissement à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 8 * 3600, revenu: true, dt0: 1, dTmax: 6 });
        }
        return s;
      },
      reperes: A => [{ T: A.Ac3, nom: 'Ac3' }, { T: A.Bs, nom: 'Bs' }, { T: A.Ms, nom: 'Ms' }],
      proprietes: [P.HV, P.Rm, P.A, P.tenacite, { cle: 'ecartMs', nom: 'Écart surface–cœur quand la surface atteint Ms', unite: '°C', min: 0, max: 300, dec: 0, vide: 'pas de martensite', inverse: true }, borne(P.sigma, { min: -400, max: 400 })],
      etapes: {
        chauffe: ['Chauffage jusqu’à 850 °C, comme pour une trempe classique.', 'Austénitisation complète au-dessus d’Ac3 ≈ 785 °C.'],
        austenitisation: ['Austénite homogène.', 'Grain austénitique fin, environ 20 µm.'],
        trempe: ['Trempe directe à l’huile, pour comparer : la surface devient martensite bien avant le cœur.', 'Écart de température surface–cœur maximal au passage de Ms : c’est lui qui crée contraintes, déformations et tapures.'],
        bain: ['On plonge la pièce dans un bain de sel fondu, maintenu au-dessus de Ms : elle refroidit vite jusqu’à la température du bain, puis s’y arrête.', 'Le bain de sel évite la caléfaction : échange régulier. Il faut traverser assez vite le domaine de la ferrite et de la perlite.'],
        palier: ['Toute la pièce est à la même température. En étagée martensitique, on ressort avant que la bainite démarre ; en bainitique, on attend qu’elle soit complète.', 'Transformation isotherme : on suit l’horizontale du diagramme TTT. La bainite formée bas (bainite inférieure) est fine, dure et tenace.'],
        air: ['Sortie à l’air : en étagée martensitique, la martensite se forme maintenant, partout en même temps.', 'Surface et cœur traversent Ms ensemble : les contraintes de transformation restent faibles.'],
        chauffeRevenu: ['On réchauffe pour le revenu.', 'Le revenu d’une étagée martensitique est le même qu’après une trempe classique.'],
        revenu: ['Revenu : la martensite devient tenace.', 'Paramètre de Hollomon-Jaffe : P = T·(20 + log t).'],
        refroidissement: ['Refroidissement final à l’air.', 'Structure stable.']
      },
      evenements: EVT_ACIER,
      pieges: [
        'En étagée martensitique, un palier trop long fait démarrer la bainite : la pièce n’est plus entièrement martensitique.',
        'Une pièce trop massive refroidit trop lentement dans le bain chaud : de la bainite naît pendant la descente. La trempabilité limite la section.',
        'En étagée bainitique, un palier trop court laisse de l’austénite, qui devient martensite fraîche à l’air.',
        'La bainite supérieure (bain chaud) est moins tenace que la bainite inférieure.'
      ],
      metier: [
        'L’étagée bainitique (« austempering ») donne une bainite qui n’a pas besoin de revenu : ressorts, pièces de transmission, fontes ADI.',
        'L’étagée martensitique (« martempering ») sert aux pièces de forme complexe qui se déforment ou se fissurent à la trempe directe.',
        'Dans un bain chaud, la pièce refroidit moins vite qu’à l’huile au passage du nez de la bainite : il faut un acier assez trempant. Un acier Ni-Cr-Mo comme le 34CrNiMo6 s’y prête bien mieux qu’un Cr-Mo, réservé aux petites sections.'
      ],
      reviser: [
        { cours: 'met-03', ancre: 's3', titre: 'Les traitements thermiques : trempes étagées' },
        { cours: 'met-02', ancre: 's3', titre: 'Les courbes TTT, transformation à température constante' },
        { cours: 'met-02', ancre: 's2', titre: 'Ferrite, perlite, bainite : les mécanismes' }
      ]
    },

    {
      id: 'durcissement-secondaire-x40crmov5',
      titre: 'Revenu à durcissement secondaire',
      sousTitre: 'Trempe et double revenu d’un acier à outils',
      alliage: 'X40CrMoV5-1', famille: 'Aciers', mecanismes: ['Carbures alliés', 'Austénite résiduelle', 'Double revenu'],
      etape: 2,
      but: 'Obtenir un outil dur et tenace à chaud : trempe depuis 1020–1050 °C pour dissoudre les carbures alliés, puis plusieurs revenus vers 550–620 °C qui font précipiter de fins carbures de molybdène et de vanadium et transforment l’austénite résiduelle.',
      image: 'Un deuxième passage au four pour « cuire » ce que le premier a fait naître : la martensite fraîche issue de l’austénite résiduelle.',
      reglages: [
        { id: 'Taus', nom: 'Température d’austénitisation', min: 960, max: 1100, pas: 5, defaut: 1030, unite: '°C',
          alertes: [{ max: 999, texte: 'Trop froid : les carbures alliés restent en partie non dissous, le durcissement secondaire est réduit.' }, { min: 1061, texte: 'Trop chaud : grain grossier et beaucoup d’austénite résiduelle.' }] },
        { id: 'milieu', nom: 'Trempe', choix: [['huile', 'Huile'], ['air', 'Air (ou gaz)']], defaut: 'huile' },
        { id: 'D', nom: 'Épaisseur de l’outil', min: 20, max: 200, pas: 10, defaut: 60, unite: 'mm' },
        { id: 'nRev', nom: 'Nombre de revenus', min: 1, max: 3, pas: 1, defaut: 2, unite: '',
          alertes: [{ max: 1, texte: 'Un seul revenu : l’austénite résiduelle devient martensite fraîche au refroidissement, sans être revenue.' }] },
        { id: 'Trev', nom: 'Température de revenu', min: 450, max: 680, pas: 10, defaut: 600, unite: '°C',
          alertes: [{ max: 499, texte: 'Trop froid : l’austénite résiduelle n’est pas conditionnée et le durcissement secondaire n’a pas commencé.' }] },
        { id: 'tRev', nom: 'Durée de chaque revenu', min: 1, max: 4, pas: 0.5, defaut: 2, unite: 'h' }
      ],
      exemples: [
        { nom: 'Trempe + 2 revenus à 600 °C', valeurs: { Taus: 1030, milieu: 'huile', D: 60, nRev: 2, Trev: 600, tRev: 2 } },
        { nom: 'Un seul revenu (piège)', valeurs: { Taus: 1030, milieu: 'huile', D: 60, nRev: 1, Trev: 600, tRev: 2 } },
        { nom: 'Revenu au pic (540 °C)', valeurs: { Taus: 1030, milieu: 'huile', D: 60, nRev: 2, Trev: 540, tRev: 2 } },
        { nom: 'Austénitisation froide (980 °C)', valeurs: { Taus: 980, milieu: 'huile', D: 60, nRev: 2, Trev: 540, tRev: 2 } },
        { nom: 'Revenu haut (650 °C)', valeurs: { Taus: 1030, milieu: 'huile', D: 60, nRev: 2, Trev: 650, tRev: 2 } }
      ],
      geometrie: p => ({ forme: 'cylindre', L: p.D / 2000, n: 9, contraintes: false, nom: 'bloc d’outil de ' + p.D + ' mm' }),
      points: g => [{ id: 'coeur', nom: 'Cœur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const s = [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Taus, jusqua: { coeurAtteint: p.Taus - 5 }, dureeMax: 8 * 3600, dt0: 2, dTmax: 10 },
          { id: 'austenitisation', nom: 'Austénitisation', etape: 'maintien', milieu: 'four', env: p.Taus, duree: 1800, dTmax: 10 },
          { id: 'trempe', nom: p.milieu === 'air' ? 'Trempe à l’air' : 'Trempe à l’huile', etape: 'trempe', milieu: p.milieu, env: 20, jusqua: { toutSous: 50 }, dureeMax: 8 * 3600, dt0: 0.05, dTmax: 4 }
        ];
        for (let k = 1; k <= p.nRev; k++) {
          const x = k === 1 ? '' : '_' + k;
          s.push({ id: 'chauffeRevenu' + x, nom: 'Chauffage du revenu ' + k, etape: 'chauffage', milieu: 'four', env: p.Trev, jusqua: { coeurAtteint: p.Trev - 5 }, dureeMax: 6 * 3600, revenu: true, dTmax: 10, dt0: 2 });
          s.push({ id: 'revenu' + x, nom: 'Revenu ' + k, etape: 'revenu', milieu: 'four', env: p.Trev, duree: p.tRev * 3600, revenu: true, dTmax: 10 });
          s.push({ id: 'refroidissement' + x, nom: 'Refroidissement ' + k, etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 50 }, dureeMax: 8 * 3600, revenu: true, dt0: 1, dTmax: 6 });
        }
        return s;
      },
      reperes: A => [{ T: A.Ac3, nom: 'Ac3' }, { T: A.Ac1, nom: 'Ac1' }, { T: A.Ms, nom: 'Ms' }],
      proprietes: [borne(P.HV, { max: 720 }), borne(P.Rm, { max: 2300 }), borne(P.A, { max: 25 }), P.tenacite, borne(P.grain, { max: 150 })],
      etapes: {
        chauffe: ['Chauffage lent jusqu’à plus de 1000 °C : l’acier, très allié, conduit mal la chaleur.', 'En atelier, on préchauffe par paliers (vers 650 puis 850 °C) pour limiter les écarts de température dans les gros outils.'],
        austenitisation: ['Vers 1030 °C, une partie des carbures de chrome, de molybdène et de vanadium se dissout : c’est ce qui permettra le durcissement secondaire.', 'Plus on chauffe, plus on dissout de carbures, mais plus le grain grossit et plus il reste d’austénite résiduelle après trempe.'],
        trempe: ['Grâce à ses éléments d’alliage, l’acier devient martensitique même avec un refroidissement modéré.', 'Trempabilité très élevée (Cr, Mo, V) : trempe à l’huile, au gaz sous pression ou même à l’air pour les petites sections. Il reste quelques % d’austénite résiduelle.'],
        chauffeRevenu: ['On réchauffe pour le revenu.', 'Le revenu doit suivre rapidement la trempe pour éviter les fissures.'],
        revenu: ['Vers 500–600 °C, de minuscules carbures alliés précipitent : la dureté remonte au lieu de baisser. C’est le durcissement secondaire.', 'Carbures MC (V) et M₂C (Mo), de quelques nanomètres, cohérents avec la matrice. Pendant le premier revenu, l’austénite résiduelle s’appauvrit en carbone : elle est « conditionnée ».'],
        refroidissement: ['Au refroidissement, l’austénite résiduelle conditionnée se transforme en martensite fraîche, dure et fragile.', 'D’où le second revenu : il revient cette martensite fraîche. Un troisième revenu est parfois prescrit pour les outils les plus exigeants.']
      },
      evenements: evt({
        revenu2: ['Revenu, stade 2 : dans cet acier très allié, l’austénite résiduelle résiste.', 'Le chrome et le molybdène stabilisent l’austénite résiduelle : elle ne se décompose pas comme dans un acier faiblement allié ; elle sera conditionnée plus haut.'],
        revenu4: ['Revenu, stade 4 : la cémentite coalesce… mais les carbures alliés vont prendre le relais.', 'Au-delà de 450 °C, les éléments d’alliage diffusent assez pour former leurs propres carbures.']
      }),
      pieges: [
        'Un seul revenu laisse de la martensite fraîche, née de l’austénite résiduelle : l’outil est fragile.',
        'Revenir au pic de durcissement secondaire donne la dureté maximale, pas la meilleure ténacité : on revient souvent un peu au-delà.',
        'Austénitiser trop froid limite la dissolution des carbures : le durcissement secondaire est plus faible.'
      ],
      metier: [
        'Les filières d’extrusion de l’aluminium et les moules de fonderie sous pression sont souvent en X40CrMoV5-1, utilisés vers 44–50 HRC.',
        'Un outil fissuré se répare par soudage avec préchauffage élevé, puis un nouveau revenu.'
      ],
      reviser: [
        { cours: 'met-03', ancre: 's3', titre: 'Les traitements thermiques : revenu et durcissement secondaire' },
        { cours: 'met-02', ancre: 's5', titre: 'Les éléments d’addition' },
        { cours: 'crmo-02', ancre: 'c3', titre: 'Le ballet des carbures' }
      ]
    },

    {
      id: 'post-chauffage-s690',
      titre: 'Post-chauffage de dégazage',
      sousTitre: 'Chasser l’hydrogène d’un joint en acier à haute limite d’élasticité',
      alliage: 'S690QL', famille: 'Assemblages soudés', mecanismes: ['Diffusion de l’hydrogène', 'Fissuration à froid'],
      etape: 2,
      but: 'Sans laisser refroidir le joint après soudage, le maintenir vers 200–300 °C pendant quelques heures : l’hydrogène diffusible s’échappe avant que la ZAT dure et les contraintes ne provoquent une fissuration à froid.',
      image: 'Laisser la vapeur s’échapper d’une casserole avant de poser le couvercle.',
      temperatureInitiale: p => p.Tinter,
      reglages: [
        { id: 'e', nom: 'Épaisseur soudée', min: 10, max: 80, pas: 5, defaut: 30, unite: 'mm' },
        { id: 'H0', nom: 'Hydrogène diffusible apporté', min: 2, max: 15, pas: 0.5, defaut: 8, unite: 'ml/100 g',
          alertes: [{ min: 10, texte: 'Hydrogène élevé : produits d’apport humides ou procédé à fort potentiel d’hydrogène.' }] },
        { id: 'Hz0', nom: 'Dureté de la ZAT', min: 300, max: 480, pas: 5, defaut: 420, unite: 'HV' },
        { id: 'Tinter', nom: 'Température en fin de soudage', min: 20, max: 250, pas: 5, defaut: 150, unite: '°C',
          alertes: [{ max: 60, texte: 'Le joint a refroidi avant le post-chauffage : l’hydrogène a déjà eu le temps de nuire.' }] },
        { id: 'pc', nom: 'Post-chauffage', bascule: true, defaut: true },
        { id: 'Tpc', nom: 'Température de post-chauffage', min: 150, max: 350, pas: 10, defaut: 250, unite: '°C', si: 'pc',
          alertes: [{ max: 190, texte: 'Trop froid : l’hydrogène diffuse lentement.' }] },
        { id: 'tpc', nom: 'Durée du post-chauffage', min: 0.5, max: 6, pas: 0.5, defaut: 2, unite: 'h', si: 'pc' },
        { id: 'att', nom: 'Attente avant contrôle', min: 1, max: 72, pas: 1, defaut: 48, unite: 'h' }
      ],
      exemples: [
        { nom: 'Post-chauffage 250 °C, 2 h', valeurs: { e: 30, H0: 8, Hz0: 420, Tinter: 150, pc: true, Tpc: 250, tpc: 2, att: 48 } },
        { nom: 'Sans post-chauffage', valeurs: { e: 30, H0: 8, Hz0: 420, Tinter: 150, pc: false, att: 48 } },
        { nom: 'Apport humide (12 ml/100 g)', valeurs: { e: 30, H0: 12, Hz0: 420, Tinter: 150, pc: true, Tpc: 250, tpc: 2, att: 48 } },
        { nom: 'Trop froid (150 °C)', valeurs: { e: 30, H0: 8, Hz0: 420, Tinter: 150, pc: true, Tpc: 150, tpc: 2, att: 48 } },
        { nom: 'Forte épaisseur (70 mm)', valeurs: { e: 70, H0: 8, Hz0: 420, Tinter: 150, pc: true, Tpc: 250, tpc: 2, att: 48 } }
      ],
      geometrie: p => ({ forme: 'plaque', L: p.e / 2000, n: 7, contraintes: false, nom: 'tôles de ' + p.e + ' mm soudées bout à bout' }),
      points: g => [{ id: 'coeur', nom: 'Mi-épaisseur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const s = [];
        if (p.pc) {
          const v = 200 / 3600, montee = Math.max(60, (p.Tpc - p.Tinter) / v);
          s.push({ id: 'chauffe', nom: 'Montée au post-chauffage', etape: 'chauffage', milieu: 'four', env: t => Math.min(p.Tpc, p.Tinter + v * t), rampeFin: montee, jusqua: { coeurAtteint: p.Tpc - 5 }, dureeMax: montee + 4 * 3600, dt0: 5, dtMax: 120, carte: 'lin' });
          s.push({ id: 'postchauffage', nom: 'Post-chauffage', etape: 'maintien', milieu: 'four', env: p.Tpc, duree: p.tpc * 3600, dtMax: 300 });
        }
        s.push({ id: 'refroidissement', nom: 'Refroidissement à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 30 }, dureeMax: 12 * 3600, dt0: 5, dtMax: 300 });
        s.push({ id: 'attente', nom: 'Attente avant contrôle', etape: 'attente', milieu: 'air', env: 20, duree: p.att * 3600, dtMax: 1800 });
        return s;
      },
      reperes: () => [{ T: 300, nom: '300' }, { T: 200, nom: '200' }],
      bande: [200, 300, 'zone usuelle du post-chauffage'],
      proprietes: [borne(P.H, { max: 15 }), { cle: 'risque', nom: 'Risque de fissuration à froid', unite: '', min: 0, max: 100, dec: 0, qualitatif: true, mots: ['faible', 'modéré', 'élevé', 'très élevé'], inverse: true },
        { cle: 'HVz', nom: 'Dureté de la ZAT', unite: 'HV', min: 200, max: 500, dec: 0 }, borne(P.sigma, { min: 0, max: 800, signe: false, nom: 'Contrainte résiduelle au joint' })],
      etapes: {
        chauffe: ['Sans laisser refroidir, on remonte le joint vers 250 °C (chalumeaux, résistances chauffantes).', 'L’hydrogène diffuse d’autant plus vite que la température est élevée ; en dessous de ≈ 100 °C il reste piégé des jours.'],
        postchauffage: ['Pendant le palier, l’hydrogène s’échappe par la surface : le risque de fissuration à froid s’effondre.', 'Effusion à travers l’épaisseur e : temps caractéristique ≈ e²/(π²·D). Le palier ne revient pratiquement pas la ZAT (P très faible).'],
        refroidissement: ['Refroidissement à l’air jusqu’à l’ambiante.', 'C’est à basse température, sous ≈ 150 °C, que l’hydrogène restant fragilise la martensite de la ZAT.'],
        attente: ['On attend avant le contrôle final : une fissuration à froid peut apparaître des heures, voire des jours après le soudage.', 'Fissuration différée : l’hydrogène migre lentement vers les zones les plus contraintes. D’où un délai avant contrôle, souvent de 16 à 48 h pour les aciers à haute limite d’élasticité.']
      },
      evenements: {
        plafond: ['La limite d’élasticité à chaud écrête légèrement les contraintes dès {T}.', 'Effet faible à ces températures : le post-chauffage ne détensionne pas.'],
        relaxe50: ['La moitié de la contrainte a disparu.', 'Écrêtage plastique puis relaxation.'],
        hydrogene: ['L’hydrogène diffusible est presque totalement sorti du joint.', 'Teneur résiduelle inférieure à 1 ml/100 g.'],
        intercritique: ['Au-dessus d’Ac1.', 'Hors domaine du post-chauffage.']
      },
      pieges: [
        'Laisser le joint refroidir avant de post-chauffer : la fissuration peut déjà avoir commencé.',
        'Le post-chauffage n’est pas un TTAS : il chasse l’hydrogène mais ne détensionne pas et ne revient pas la ZAT.',
        'Contrôler trop tôt peut masquer une fissuration différée.'
      ],
      metier: [
        'L’EN 1011-2 décrit le préchauffage et le post-chauffage selon l’épaisseur combinée, l’hydrogène du procédé et la composition (carbone équivalent).',
        'Les aciers S690 et plus servent aux engins de levage : leurs ZAT martensitiques sont très sensibles à l’hydrogène.'
      ],
      reviser: [
        { cours: 'met-03', ancre: 's6', titre: 'Fissuration à froid, carbone équivalent et préchauffage' },
        { cours: 'crmo-03', ancre: 'c2', titre: 'La fissuration à froid' },
        { cours: 'essais-02', ancre: 'c6', titre: 'La dureté en soudage' }
      ]
    },

    {
      id: 'normalisation-revenu-p91',
      titre: 'Normalisation et revenu',
      sousTitre: 'Le traitement d’un acier à 9 % Cr pour le fluage',
      alliage: 'P91', famille: 'Aciers', mecanismes: ['Trempe à l’air', 'Revenu haut', 'Carbures M₂₃C₆ et MX'],
      etape: 2,
      but: 'Donner au P91 sa structure de martensite revenue, stable à 600 °C pendant des décennies : normalisation vers 1060 °C (l’air suffit à tremper), puis revenu vers 750–780 °C.',
      image: 'Un squelette de lattes de martensite cloué par de petits carbures : il tient debout même chaud, longtemps.',
      reglages: [
        { id: 'Tn', nom: 'Température de normalisation', min: 980, max: 1120, pas: 5, defaut: 1060, unite: '°C',
          alertes: [{ max: 1039, texte: 'Trop froid : les carbonitrures de V et de Nb restent en partie non dissous, la résistance au fluage baisse.' }, { min: 1101, texte: 'Trop chaud : grain grossier, risque de ferrite δ.' }] },
        { id: 'tn', nom: 'Maintien de normalisation', min: 10, max: 120, pas: 5, defaut: 30, unite: 'min' },
        { id: 'e', nom: 'Épaisseur de paroi', min: 10, max: 100, pas: 5, defaut: 40, unite: 'mm' },
        { id: 'Trev', nom: 'Température de revenu', min: 650, max: 850, pas: 5, defaut: 760, unite: '°C',
          alertes: [{ max: 729, texte: 'Revenu insuffisant : dureté trop élevée, ductilité et ténacité faibles.' }, { min: 806, texte: 'Trop près d’Ac1 ≈ 820 °C : au-delà, de l’austénite se forme et redonne de la martensite fraîche.' }] },
        { id: 'tRev', nom: 'Durée du revenu', min: 1, max: 6, pas: 0.5, defaut: 3, unite: 'h' }
      ],
      exemples: [
        { nom: 'N 1060 °C + R 760 °C, 3 h', valeurs: { Tn: 1060, tn: 30, e: 40, Trev: 760, tRev: 3 } },
        { nom: 'Revenu trop froid (700 °C)', valeurs: { Tn: 1060, tn: 30, e: 40, Trev: 700, tRev: 3 } },
        { nom: 'Revenu au-delà d’Ac1 (840 °C)', valeurs: { Tn: 1060, tn: 30, e: 40, Trev: 840, tRev: 3 } },
        { nom: 'Paroi épaisse (100 mm)', valeurs: { Tn: 1060, tn: 60, e: 100, Trev: 760, tRev: 4 } }
      ],
      geometrie: p => ({ forme: 'plaque', L: p.e / 2000, n: 7, contraintes: false, nom: 'paroi de tube de ' + p.e + ' mm' }),
      points: g => [{ id: 'coeur', nom: 'Mi-paroi', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        return [
          { id: 'chauffe', nom: 'Chauffage', etape: 'chauffage', milieu: 'four', env: p.Tn, jusqua: { coeurAtteint: p.Tn - 5 }, dureeMax: 8 * 3600, dt0: 2, dTmax: 10 },
          { id: 'normalisation', nom: 'Normalisation', etape: 'maintien', milieu: 'four', env: p.Tn, duree: p.tn * 60, dTmax: 10 },
          { id: 'air', nom: 'Refroidissement à l’air', etape: 'trempe', milieu: 'air', env: 20, jusqua: { toutSous: 60 }, dureeMax: 12 * 3600, dt0: 1, dTmax: 5 },
          { id: 'chauffeRevenu', nom: 'Chauffage de revenu', etape: 'chauffage', milieu: 'four', env: p.Trev, jusqua: { coeurAtteint: p.Trev - 5 }, dureeMax: 8 * 3600, revenu: true, dTmax: 10, dt0: 2 },
          { id: 'revenu', nom: 'Revenu', etape: 'revenu', milieu: 'four', env: p.Trev, duree: p.tRev * 3600, revenu: true, dTmax: 10 },
          { id: 'refroidissement', nom: 'Refroidissement à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 12 * 3600, revenu: true, dt0: 1, dTmax: 6 }
        ];
      },
      reperes: A => [{ T: A.Ac3, nom: 'Ac3' }, { T: A.Ac1, nom: 'Ac1' }, { T: A.Ms, nom: 'Ms' }],
      proprietes: [borne(P.HV, { max: 500 }), borne(P.Rm, { max: 1600 }), borne(P.Rp, { max: 1300 }), borne(P.A, { max: 30 }), P.tenacite],
      etapes: {
        chauffe: ['On chauffe vers 1060 °C : il faut dissoudre les fins carbonitrures de vanadium et de niobium.', 'Ces particules MX reprécipiteront au revenu et bloqueront les dislocations en service.'],
        normalisation: ['Austénite homogène, grain encore fin grâce aux précipités qui l’épinglent.', 'Normalisation : 1040 à 1080 °C environ selon la norme du produit.'],
        air: ['À l’air, un acier à 9 % de chrome devient entièrement martensitique, même en forte épaisseur.', 'Trempabilité très élevée : pas besoin de liquide de trempe. Ms ≈ 400 °C ; on laisse refroidir sous ≈ 100 °C avant le revenu pour que toute l’austénite se transforme.'],
        chauffeRevenu: ['On réchauffe vers 760 °C, en restant sous Ac1.', 'Ac1 du P91 ≈ 800–830 °C selon la teneur en Ni + Mn : c’est la limite à ne pas franchir.'],
        revenu: ['Revenu haut : la martensite se détend, des carbures de chrome se fixent sur les joints de lattes.', 'Précipitation de M₂₃C₆ aux joints de lattes et de MX dans les lattes : une structure stable au fluage. Dureté visée ≈ 190–250 HV.'],
        refroidissement: ['Refroidissement à l’air.', 'L’état normalisé et revenu (+NT) est l’état de livraison des tubes.']
      },
      evenements: evt({
        Ms: ['Ms atteinte à {T} : la martensite se forme à l’air.', 'Ms ≈ 400 °C : la transformation se termine vers 200 °C.'],
        durcissementSecondaire: ['Des carbures de chrome se fixent sur les joints de lattes ; de fins carbonitrures précipitent dans les lattes.', 'M₂₃C₆ aux joints de lattes et MX (V, Nb) dans les lattes : ils épinglent joints et dislocations et assurent la tenue au fluage pendant des décennies.']
      }),
      pieges: [
        'Revenir au-delà d’Ac1 reforme de l’austénite, qui redevient martensite fraîche au refroidissement : dureté et fragilité remontent.',
        'Un revenu trop court ou trop froid laisse une dureté élevée ; trop long ou trop chaud, la résistance au fluage baisse.',
        'Le même piège vaut pour le TTAS des soudures en P91, fait vers 750–770 °C.'
      ],
      metier: [
        'Les tuyauteries de vapeur et collecteurs des centrales sont en P91 (X10CrMoVNb9-1) : service autour de 550–600 °C.',
        'La dureté après traitement (≈ 190–250 HV) est un contrôle courant : une valeur hors plage révèle un traitement raté.'
      ],
      reviser: [
        { cours: 'crmo-02', ancre: 'c6', titre: 'Les traitements thermiques des Cr-Mo' },
        { cours: 'crmo-02', ancre: 'c2', titre: 'Les renforts invisibles' },
        { cours: 'crmo-03', ancre: 'c5', titre: 'Le joint en fluage' }
      ]
    },

    {
      id: 'ttas-10crmo9-10',
      titre: 'TTAS d’un acier Cr-Mo',
      sousTitre: 'Détensionner un 2,25Cr-1Mo soudé',
      alliage: '10CrMo9-10', famille: 'Assemblages soudés', mecanismes: ['Relaxation des contraintes', 'Revenu de la ZAT', 'Résistance au fluage'],
      etape: 2,
      but: 'Revenir la ZAT bainito-martensitique et relâcher les contraintes d’un joint en acier résistant au fluage : il faut plus chaud que pour un acier C-Mn, vers 680–720 °C.',
      image: 'Un élastique épais et coriace : il faut de l’eau plus chaude pour qu’il se détende.',
      reglages: [
        { id: 'e', nom: 'Épaisseur soudée', min: 10, max: 150, pas: 5, defaut: 60, unite: 'mm' },
        { id: 'vChauffe', nom: 'Vitesse de chauffe', min: 25, max: 300, pas: 5, defaut: 60, unite: '°C/h' },
        { id: 'Tp', nom: 'Température de palier', min: 550, max: 780, pas: 5, defaut: 690, unite: '°C',
          alertes: [{ max: 659, texte: 'Trop froid pour un 2,25Cr-1Mo : sa résistance au fluage freine la relaxation.' }, { min: 731, texte: 'Trop chaud : adoucissement du métal de base.' }, { min: 801, texte: 'Au-dessus d’Ac1 ≈ 800 °C : martensite fraîche au refroidissement.' }] },
        { id: 'tp', nom: 'Durée du palier', min: 0.5, max: 8, pas: 0.25, defaut: 2, unite: 'h' },
        { id: 'vRefr', nom: 'Vitesse de refroidissement', min: 25, max: 300, pas: 5, defaut: 60, unite: '°C/h' },
        { id: 'Hz0', nom: 'Dureté de la ZAT brute de soudage', min: 300, max: 450, pas: 5, defaut: 400, unite: 'HV' }
      ],
      exemples: [
        { nom: 'TTAS 690 °C, 2 h', valeurs: { e: 60, vChauffe: 60, Tp: 690, tp: 2, vRefr: 60, Hz0: 400 } },
        { nom: 'Comme un acier C-Mn (600 °C)', valeurs: { e: 60, vChauffe: 60, Tp: 600, tp: 2, vRefr: 60, Hz0: 400 } },
        { nom: 'Palier court (30 min)', valeurs: { e: 60, vChauffe: 60, Tp: 690, tp: 0.5, vRefr: 60, Hz0: 400 } },
        { nom: 'Trop chaud (810 °C)', valeurs: { e: 60, vChauffe: 60, Tp: 810, tp: 2, vRefr: 60, Hz0: 400 } }
      ],
      geometrie: p => ({ forme: 'plaque', L: p.e / 2000, n: 7, contraintes: false, nom: 'tôles de ' + p.e + ' mm soudées bout à bout' }),
      points: g => [{ id: 'coeur', nom: 'Mi-épaisseur', noeud: 0 }, { id: 'surface', nom: 'Surface', noeud: g.n - 1 }],
      programme(p) {
        const vc = p.vChauffe / 3600, vr = p.vRefr / 3600;
        const montee = (p.Tp - 20) / vc, descente = (p.Tp - 300) / vr;
        return [
          { id: 'chauffe', nom: 'Chauffe contrôlée', etape: 'chauffage', milieu: 'four', env: t => Math.min(p.Tp, 20 + vc * t), rampeFin: montee, jusqua: { coeurAtteint: p.Tp - 8 }, dureeMax: montee + 6 * 3600, dt0: 5, dtMax: 120, carte: 'lin', revenu: true },
          { id: 'palier', nom: 'Palier', etape: 'maintien', milieu: 'four', env: p.Tp, duree: p.tp * 3600, dtMax: 300, revenu: true },
          { id: 'descente', nom: 'Refroidissement contrôlé', etape: 'refroidissement', milieu: 'four', env: t => Math.max(300, p.Tp - vr * t), duree: descente, dtMax: 120, carte: 'lin', revenu: true },
          { id: 'air', nom: 'Fin à l’air', etape: 'refroidissement', milieu: 'air', env: 20, jusqua: { toutSous: 40 }, dureeMax: 12 * 3600, dt0: 5, dtMax: 300, revenu: true }
        ];
      },
      reperes: A => [{ T: A.Ac1, nom: 'Ac1' }, { T: 720, nom: '720' }, { T: 680, nom: '680' }],
      bande: [680, 720, 'zone usuelle des TTAS des aciers 2,25Cr-1Mo'],
      proprietes: [borne(P.sigma, { min: 0, max: 400, signe: false, nom: 'Contrainte résiduelle au joint' }), { cle: 'HVz', nom: 'Dureté de la ZAT', unite: 'HV', min: 150, max: 450, dec: 0 }, P.tenacite, borne(P.H, {}), borne(P.Rp, { max: 400, nom: 'Re du métal de base' })],
      etapes: {
        chauffe: ['Chauffe lente et contrôlée de toute l’épaisseur.', 'Un 2,25Cr-1Mo épais demande des vitesses de chauffe et de refroidissement modestes.'],
        palier: ['Au palier, la ZAT se revient et les contraintes se relâchent, mais plus lentement que dans un acier C-Mn : cet acier est fait pour résister au fluage.', 'Le Cr et le Mo freinent le fluage, donc la relaxation : après 2 h à 600 °C, un 2,25Cr-1Mo garde environ deux fois plus de contraintes qu’un acier C-Mn. D’où des TTAS vers 680–720 °C.'],
        descente: ['Descente lente jusqu’à ≈ 300 °C.', 'Une descente lente dans 350–550 °C favorise la fragilisation au revenu des Cr-Mo : on limite les impuretés P, Sn, As et Sb (facteur J pour P et Sn).'],
        air: ['Fin du refroidissement à l’air : le joint est détensionné et sa ZAT revenue.', 'Les spécifications de raffinerie limitent souvent la dureté de la ZAT à environ 250 HV après TTAS.']
      },
      evenements: {
        plafond: ['La limite d’élasticité baisse avec la température : les contraintes sont écrêtées dès {T}.', 'Un acier résistant au fluage garde mieux sa limite d’élasticité à chaud.'],
        relaxe50: ['La moitié de la contrainte de soudage a disparu.', 'Relaxation par fluage, lente dans un Cr-Mo.'],
        hydrogene: ['L’hydrogène diffusible est presque totalement sorti du joint.', 'Le TTAS dégaze aussi le joint.'],
        intercritique: ['Au-dessus d’Ac1 : de l’austénite apparaît dans la ZAT !', 'Martensite fraîche au refroidissement : le TTAS est raté.']
      },
      pieges: [
        'Appliquer la température d’un acier C-Mn (≈ 600 °C) à un Cr-Mo : la relaxation reste très incomplète.',
        'Les Cr-Mo sont sensibles à la fissuration au réchauffage pendant le TTAS, dans les zones à gros grains de la ZAT.',
        'Dépasser Ac1 recrée de la martensite fraîche.'
      ],
      metier: [
        'Les réacteurs d’hydrotraitement et d’hydrocraquage des raffineries sont souvent en 2,25Cr-1Mo (parfois avec V), à parois très épaisses.',
        'Pour les 2,25Cr-1Mo (P-No. 5A de l’ASME), le code impose un palier d’au moins 675 °C environ (1 250 °F).'
      ],
      reviser: [
        { cours: 'crmo-03', ancre: 'c4', titre: 'La fissuration au réchauffage' },
        { cours: 'crmo-03', ancre: 'c3', titre: 'La fragilisation au revenu' },
        { cours: 'crmo-02', ancre: 'c6', titre: 'Les traitements thermiques des Cr-Mo' },
        { cours: 'fluage-01', ancre: 'c3', titre: 'La loi de Norton' }
      ]
    }
  ];

  /* Sigles et symboles, rappelés dans « En savoir plus » pour chaque traitement. */
  const GLOSSAIRE = {
    'A': 'Allongement à rupture : déformation permanente de l’éprouvette rompue, en %.',
    'A1, Ac1, Ac3': 'A1 : température de l’eutectoïde à l’équilibre (≈ 727 °C pour un acier au carbone). Ac1, Ac3 : températures de début et de fin de formation de l’austénite au chauffage (c pour « chauffage »).',
    'Bs': 'Température de début de formation de la bainite au refroidissement.',
    'Ms': 'Température de début de la transformation martensitique (martensite start).',
    'HV, HV10': 'Dureté Vickers ; HV10 : essai sous une charge de 10 kgf, soit 98 N.',
    'Rm': 'Résistance à la traction : contrainte maximale de l’essai de traction, en MPa.',
    'Rp0,2, Re': 'Limite d’élasticité conventionnelle à 0,2 % de déformation plastique ; Re : limite d’élasticité.',
    'P': 'Paramètre de revenu de Hollomon-Jaffe : P = T·(C + log t), T en kelvins, t en heures, C ≈ 20.',
    'TRC': 'Diagramme de transformation en refroidissement continu.',
    'ZAT': 'Zone affectée thermiquement : métal de base modifié par la chaleur du soudage, sans avoir fondu.',
    'TTAS': 'Traitement thermique après soudage.',
    'M-A': 'Îlots de martensite et d’austénite résiduelle, durs et fragiles.',
    'JMAK': 'Loi de Johnson-Mehl-Avrami-Kolmogorov : avancement en « S » d’une transformation par germination et croissance.',
    'IACS': 'International Annealed Copper Standard : 100 % IACS = 58,0 MS/m, conductivité du cuivre recuit de référence.',
    'MS/m': 'Mégasiemens par mètre, unité de conductivité électrique.',
    'Cu-ETP, Cu-OF, Cu-DHP': 'Cuivre électrolytique à oxygène ; cuivre sans oxygène ; cuivre désoxydé au phosphore.',
    'Tf': 'Température de fusion (en kelvins quand on écrit 0,4 Tf).',
    'G': 'Indice de grosseur de grain (ISO 643) : plus G est grand, plus le grain est fin.',
    'T4, T6, T7': 'États des alliages d’aluminium (EN 515) : mûri à l’ambiante, revenu au pic, sur-revenu.',
    'β″, β′, β': 'Précipités Mg-Si successifs : aiguilles cohérentes, bâtonnets semi-cohérents, Mg₂Si d’équilibre.',
    'MET': 'Microscope électronique en transmission : il révèle des détails de quelques nanomètres.',
    'Ø': 'Diamètre de la barre.',
    'HB': 'Dureté Brinell (empreinte d’une bille) ; pour les aciers doux, voisine de la dureté Vickers.',
    'HRC': 'Dureté Rockwell C (cône de diamant), pour les aciers trempés : 50 HRC ≈ 510 HV.',
    '+A, +AC, +N, +NT, +QT': 'États de traitement thermique des aciers : recuit (+A), recuit de globulisation (+AC), normalisé (+N), normalisé et revenu (+NT), trempé et revenu (+QT).',
    'TTT': 'Diagramme temps-température-transformation : transformations à température constante.',
    'ADI': 'Austempered ductile iron : fonte à graphite sphéroïdal traitée par trempe étagée bainitique.',
    'λ': 'Espacement entre deux zones enrichies en soluté, voisin de l’espacement des bras de dendrites (µm).',
    'D, D₀, Q': 'Coefficient de diffusion D = D₀·exp(−Q/RT) : D₀ facteur de fréquence (m²/s), Q énergie d’activation (J/mol), R constante des gaz parfaits, T en kelvins.',
    'MC, M₂C': 'Carbures alliés (M : métal, V pour MC, Mo pour M₂C) ; nanométriques, ils causent le durcissement secondaire.',
    'M₂₃C₆, MX': 'Carbures de chrome M₂₃C₆ et carbonitrures MX de vanadium et de niobium (X : carbone ou azote) des aciers à 9 % Cr.',
    'P91': 'Désignation ASTM et ASME de l’acier X10CrMoVNb9-1 : 9 % Cr, 1 % Mo, avec V, Nb et N.',
    '2,25Cr-1Mo': 'Acier à 2,25 % de chrome et 1 % de molybdène : 10CrMo9-10 en EN, grade 22 en ASTM.',
    'P-No.': 'Groupe de matériaux de base de l’ASME (section IX) ; P-No. 5A : aciers 2,25Cr-1Mo et 3Cr-1Mo.',
    'J': 'Facteur de Watanabe J = (Mn + Si)·(P + Sn)·10⁴ (teneurs en %) : sensibilité d’un Cr-Mo à la fragilisation de revenu.',
    'ml/100 g': 'Millilitres d’hydrogène gazeux (conditions normales) pour 100 g de métal fondu : unité de l’hydrogène diffusible (ISO 3690).',
    'S690QL': 'Acier de construction de limite d’élasticité minimale 690 MPa, trempé et revenu (Q), à ténacité garantie à basse température (L).',
    'e': 'Épaisseur de la pièce ou des tôles soudées.'
  };

  /* Suite de la banque : annoncée, pas encore simulée. */
  const A_VENIR = [
    ['Hypertrempe', '304L / 316L', 'Inox'], ['Sensibilisation (cycle subi)', '304 contre 304L', 'Inox'],
    ['Remise en solution, phase σ', 'duplex 2205', 'Inox'], ['Trempe + double revenu', 'X3CrNiMo13-4', 'Inox'],
    ['Durcissement par précipitation', '17-4PH', 'Inox'], ['Ferritisation et bainitisation (ADI)', 'fonte GS', 'Fontes'],
    ['Maturation (T4)', 'AW-2024', 'Aluminium'], ['Recuit d’adoucissement (H → O)', 'AW-5083', 'Aluminium'],
    ['ZAT d’un 6082-T6 soudé', 'AW-6082', 'Aluminium'], ['Durcissement structural', 'CuBe2', 'Cuivre'],
    ['Double vieillissement γ″/γ′', 'Inconel 718', 'Nickel'], ['Recuit et mise en solution + vieillissement', 'Ti-6Al-4V', 'Titane'],
    ['Cémentation + trempe + revenu', '16MnCr5', 'Traitements de surface'], ['Nitruration', '31CrMoV9', 'Traitements de surface'],
    ['Trempe par induction', 'C45', 'Traitements de surface']
  ].map(([titre, alliage, famille]) => ({ titre, alliage, famille }));

  /* Cours du wiki cités dans « Pour réviser » : URL publiée et fichier source (vérifiés par les tests contre le catalogue). */
  const COURS = {
    'met-01': { titre: 'Fer–carbone : du fer pur à la perlite', url: 'Metallurgie/01-fer-carbone.html', fichier: 'Cours/Metallurgie/01-fer-carbone.html' },
    'met-02': { titre: 'Aciers : cinétique, TTT, TRC et éléments d’addition', url: 'Metallurgie/02-cinetique-ttt-trc-elements-addition.html', fichier: 'Cours/Metallurgie/02-cinetique-ttt-trc-elements-addition.html' },
    'met-03': { titre: 'Aciers : martensite, traitements thermiques et soudage', url: 'Metallurgie/03-martensite-traitements-thermiques-soudage.html', fichier: 'Cours/Metallurgie/03-martensite-traitements-thermiques-soudage.html' },
    'fluage-01': { titre: 'Courbe de fluage et mécanismes de déformation à chaud', url: 'Fluage/01-courbe-mecanismes.html', fichier: 'Cours/Fluage/Fluage, cours 1 _ la courbe de fluage et ses mécanismes.html' },
    'brasage-02': { titre: 'Brasage : oxydes, flux, atmosphères et métaux d’apport', url: 'Brasage/02-oxydes-flux-atmospheres-apports.html', fichier: "Cours/Procedes/1.16_Brasage_Fort_Brasage_Tendre/Brasage, cours 2 _ vaincre les oxydes, flux, atmosphères et métaux d'apport.html" },
    'brasage-04': { titre: 'Brasage : conception des joints, métaux et contrôle', url: 'Brasage/04-conception-metaux-controle.html', fichier: 'Cours/Procedes/1.16_Brasage_Fort_Brasage_Tendre/Brasage, cours 4 _ concevoir, braser chaque métal et contrôler.html' },
    'essais-01': { titre: 'Essai de traction : de la courbe aux grandeurs', url: 'Essais/01-traction-courbe-grandeurs.html', fichier: "Cours/Essais/Essais, cours 1 _ l'essai de traction, de la courbe aux grandeurs.html" },
    'essais-02': { titre: 'Essais de dureté : l’empreinte qui raconte le métal', url: 'Essais/02-durete-empreinte-metal.html', fichier: "Cours/Essais/Essais, cours 2 _ les essais de dureté, l'empreinte qui raconte le métal.html" },
    'crmo-02': { titre: 'Aciers Cr-Mo : chrome, molybdène et carbures', url: 'CrMo/02-metallurgie-chrome-molybdene-carbures.html', fichier: 'Cours/CrMo/CrMo, cours 2 _ chrome, molybdène et carbures, la métallurgie des Cr-Mo.html' },
    'crmo-03': { titre: 'Aciers Cr-Mo : souder un Cr-Mo, les pièges du joint', url: 'CrMo/03-souder-crmo-pieges-joint.html', fichier: 'Cours/CrMo/CrMo, cours 3 _ souder un Cr-Mo, les pièges du joint.html' }
  };

  const SIGLES = {
    'trempe-revenu-42crmo4': ['A1, Ac1, Ac3', 'Ms', 'Bs', 'TRC', 'P', 'HV, HV10', 'Rm', 'Rp0,2, Re', 'A', 'G', 'ZAT', 'MET', 'Ø'],
    'recristallisation-cuivre': ['JMAK', 'Tf', 'IACS', 'MS/m', 'Cu-ETP, Cu-OF, Cu-DHP', 'HV, HV10', 'Rm', 'Rp0,2, Re', 'A', 'G', 'MET'],
    'durcissement-6082': ['T4, T6, T7', 'β″, β′, β', 'MET', 'MS/m', 'IACS', 'HV, HV10', 'Rm', 'Rp0,2, Re', 'A'],
    'ttas-s355': ['TTAS', 'ZAT', 'A1, Ac1, Ac3', 'M-A', 'P', 'HV, HV10', 'Rp0,2, Re', 'MET'],
    'recuit-complet-c45': ['A1, Ac1, Ac3', '+A, +AC, +N, +NT, +QT', 'HB', 'HV, HV10', 'Rm', 'A', 'G', 'MET', 'Ø'],
    'normalisation-c45': ['A1, Ac1, Ac3', '+A, +AC, +N, +NT, +QT', 'HV, HV10', 'Rm', 'Rp0,2, Re', 'A', 'G', 'MET', 'Ø'],
    'globulisation-c45': ['A1, Ac1, Ac3', '+A, +AC, +N, +NT, +QT', 'HV, HV10', 'Rm', 'A', 'MET', 'Ø'],
    'homogeneisation-g20mn5': ['A1, Ac1, Ac3', 'λ', 'D, D₀, Q', 'ZAT', 'HV, HV10', 'A', 'G', 'MET', 'e'],
    'trempes-etagees-34crnimo6': ['A1, Ac1, Ac3', 'Ms', 'Bs', 'TTT', 'ADI', 'P', 'HV, HV10', 'Rm', 'A', 'MET', 'Ø'],
    'durcissement-secondaire-x40crmov5': ['A1, Ac1, Ac3', 'Ms', 'MC, M₂C', 'HRC', 'P', 'HV, HV10', 'Rm', 'A', 'G', 'MET'],
    'post-chauffage-s690': ['S690QL', 'ZAT', 'TTAS', 'ml/100 g', 'P', 'HV, HV10', 'MET', 'e'],
    'normalisation-revenu-p91': ['P91', 'A1, Ac1, Ac3', 'Ms', 'M₂₃C₆, MX', '+A, +AC, +N, +NT, +QT', 'P', 'HV, HV10', 'Rm', 'Rp0,2, Re', 'A', 'MET', 'e'],
    'ttas-10crmo9-10': ['2,25Cr-1Mo', 'TTAS', 'ZAT', 'A1, Ac1, Ac3', 'P', 'J', 'P-No.', 'HV, HV10', 'Rp0,2, Re', 'MET', 'e']
  };

  return { TRAITEMENTS, A_VENIR, PROPRIETES: P, COURS, GLOSSAIRE, SIGLES };
});
