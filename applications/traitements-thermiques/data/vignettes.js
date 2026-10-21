/* Photographies des cartes de la banque : une par traitement, choisie pour montrer la microstructure visée
   ou le secteur d'emploi de l'alliage. Toutes viennent de Wikimedia Commons, sous licence ouverte vérifiée ;
   elles sont réduites à 500 px de large (vignette de Commons) et converties en WebP, sans autre retouche.
   Registre complet (révision, empreinte SHA-256) : docs/ILLUSTRATIONS.md, conservé localement. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TTH = Object.assign(root.TTH || {}, { VIGNETTES: api });
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LICENCES = {
    'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/deed.fr',
    'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/deed.fr',
    'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/deed.fr',
    'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/deed.fr',
    'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/deed.fr',
    'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/deed.fr',
    'domaine public': null
  };

  /* nature : micrographie, macrographie ou photographie ; cadrage : position de la découpe dans la carte. */
  const VIGNETTES = {
    'trempe-revenu-42crmo4': {
      fichier: 'assets/vignettes/trempe-revenu-42crmo4.webp', largeur: 500, hauteur: 375, nature: 'micrographie', cadrage: '50% 100%',
      alt: 'Micrographie optique d’une martensite revenue : un fouillis d’aiguilles fines, grises et claires ; barre d’échelle de 50 µm.',
      legende: 'Martensite revenue d’un acier de construction trempé et revenu, au microscope optique (barre d’échelle : 50 µm). Les aiguilles héritées de la trempe restent visibles.',
      titre: '20180308 Martensite rinvenuta.jpg', auteur: 'Melancholia~itwiki', licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:20180308_Martensite_rinvenuta.jpg'
    },
    'recristallisation-cuivre': {
      fichier: 'assets/vignettes/recristallisation-cuivre.webp', largeur: 500, hauteur: 375, nature: 'micrographie', cadrage: '50% 50%',
      alt: 'Micrographie optique d’un laiton recuit : grains polygonaux de teintes variées, souvent barrés de bandes rectilignes à bords parallèles (macles de recuit).',
      legende: 'Laiton laminé puis recuit, au microscope optique : des grains neufs et équiaxes, barrés de macles de recuit rectilignes. C’est l’allure d’un alliage de cuivre recristallisé ; le Cu-ETP simulé forme les mêmes macles. Grossissement d’origine ×400, sans valeur à l’écran.',
      titre: 'Microstructure of rolled and annealed brass; magnification 400X.jpg', auteur: 'Strangerhahaha', licence: 'domaine public',
      source: 'https://commons.wikimedia.org/wiki/File:Microstructure_of_rolled_and_annealed_brass;_magnification_400X.jpg'
    },
    'durcissement-6082': {
      fichier: 'assets/vignettes/durcissement-6082.webp', largeur: 500, hauteur: 321, nature: 'micrographie', cadrage: '50% 0%',
      alt: 'Micrographie électronique en transmission : fines plaquettes sombres et rectilignes orientées selon deux directions perpendiculaires ; barre d’échelle de 100 nm.',
      legende: 'Précipités durcissants en plaquettes dans un alliage Al-Cu, au microscope électronique en transmission (barre d’échelle : 100 nm). Le 6082 durcit de la même façon, avec des aiguilles β″ plus fines encore, invisibles au microscope optique.',
      titre: 'Al-Cu-BrightField.jpg', auteur: 'A1 (Wikipédia en anglais)', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Al-Cu-BrightField.jpg'
    },
    'ttas-s355': {
      fichier: 'assets/vignettes/ttas-s355.webp', largeur: 500, hauteur: 333, nature: 'photographie', cadrage: '55% 55%',
      alt: 'Groupe de chauffe mobile bleu, sur roulettes, avec régulateurs et départs de câbles, devant des tuyauteries d’une usine chimique.',
      legende: 'Station de recuit mobile pour traitement thermique sur site, dans l’industrie chimique (Cologne). Ce type de groupe alimente des résistances chauffantes posées autour des soudures et règle le cycle d’après des thermocouples : c’est ainsi qu’on fait un TTAS sans four.',
      titre: 'Annealing equipment-for-ambulant-heat-tratment-01.jpg', auteur: 'CEphoto, Uwe Aranas', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Annealing_equipment-for-ambulant-heat-tratment-01.jpg'
    },
    'recuit-complet-c45': {
      fichier: 'assets/vignettes/recuit-complet-c45.webp', largeur: 500, hauteur: 375, nature: 'micrographie', cadrage: '50% 100%',
      alt: 'Micrographie optique : grains clairs de ferrite et plages sombres de perlite, dont les lamelles sont visibles ; barre d’échelle de 50 µm.',
      legende: 'Ferrite (claire) et perlite (sombre, lamellaire) d’un acier C45 à 0,45 % de carbone, au microscope optique (barre d’échelle : 50 µm). La source ne précise pas l’état de traitement.',
      titre: 'Ferrit-perlit 500x.jpg', auteur: 'Samson00', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Ferrit-perlit_500x.jpg'
    },
    'normalisation-c45': {
      fichier: 'assets/vignettes/normalisation-c45.webp', largeur: 500, hauteur: 369, nature: 'photographie', cadrage: '50% 50%',
      alt: 'Intérieur d’un four de traitement thermique ouvert, de nuit : résistances et pièces rougeoyant d’un orange vif.',
      legende: 'Pièces portées au rouge dans un four de traitement thermique, à 982 °C selon l’auteur. Une normalisation commence ainsi, au-dessus d’Ac3, avant le refroidissement à l’air calme qui donne le grain fin.',
      titre: 'Heat-Treating-Furnace.jpg', auteur: 'Ichudov', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Heat-Treating-Furnace.jpg'
    },
    'globulisation-c45': {
      fichier: 'assets/vignettes/globulisation-c45.webp', largeur: 500, hauteur: 500, nature: 'micrographie', cadrage: '50% 100%',
      alt: 'Micrographie : petits globules sombres et arrondis dispersés dans une matrice claire ; barre d’échelle de 50 µm.',
      legende: 'Cémentite globulisée d’un acier eutectoïde à 0,8 % de carbone après un recuit de globulisation (barre d’échelle : 50 µm) : les lamelles de la perlite sont devenues des globules.',
      titre: 'PearliteSph3.jpg', auteur: 'Eduard Pleshakov', licence: 'domaine public',
      source: 'https://commons.wikimedia.org/wiki/File:PearliteSph3.jpg'
    },
    'homogeneisation-g20mn5': {
      fichier: 'assets/vignettes/homogeneisation-g20mn5.webp', largeur: 500, hauteur: 540, nature: 'micrographie', cadrage: '50% 100%',
      alt: 'Image au microscope électronique à balayage d’une dendrite d’acier : tronc et bras couverts de petites excroissances arrondies ; bandeau de mesure en bas, barre de 50 µm.',
      legende: 'Dendrite d’un acier Fe-Mn-Al-C formée dans une retassure de lingot, au microscope électronique à balayage (barre d’échelle : 50 µm). En se solidifiant ainsi, l’acier rejette le manganèse entre les bras des dendrites : c’est cette ségrégation que l’homogénéisation doit effacer.',
      titre: 'High-Mn steel dendrite inside shrinkage cavity.jpg', auteur: 'Mykhailo Voron', licence: 'CC BY 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:High-Mn_steel_dendrite_inside_shrinkage_cavity.jpg'
    },
    'trempes-etagees-34crnimo6': {
      fichier: 'assets/vignettes/trempes-etagees-34crnimo6.webp', largeur: 500, hauteur: 364, nature: 'micrographie', cadrage: '50% 100%',
      alt: 'Micrographie de bainite inférieure : fines aiguilles sombres entrecroisées en paquets ; barre d’échelle de 5 µm.',
      legende: 'Bainite inférieure d’un acier 80Si10 transformé 4 h à 250 °C (barre d’échelle : 5 µm) : c’est la structure que vise une trempe étagée bainitique, ici sur une autre nuance que celle simulée.',
      titre: '518UB80Si10 250.jpg', auteur: 'Luenibaer', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:518UB80Si10_250.jpg'
    },
    'durcissement-secondaire-x40crmov5': {
      fichier: 'assets/vignettes/durcissement-secondaire-x40crmov5.webp', largeur: 500, hauteur: 385, nature: 'photographie', cadrage: '50% 40%',
      alt: 'Photographie ancienne en noir et blanc : un technicien règle le pupitre d’un four de traitement thermique sous vide à enceinte sphérique.',
      legende: 'Conduite d’un four de traitement thermique sous vide (arsenal de Watertown, États-Unis, vers 1960). Les aciers à outils comme le X40CrMoV5-1 sont souvent trempés et revenus sous vide, pour que leur surface ne s’oxyde ni ne se décarbure.',
      titre: 'Operating a vacuum heat treating furnace, by the Watertown Arsenal, United States Army, c. 1959–1962, from the Digital Commonwealth - commonwealth 2n49vs61t.jpg', auteur: 'Watertown Arsenal, US Army', licence: 'domaine public',
      source: 'https://commons.wikimedia.org/wiki/File:Operating_a_vacuum_heat_treating_furnace,_by_the_Watertown_Arsenal,_United_States_Army,_c._1959%E2%80%931962,_from_the_Digital_Commonwealth_-_commonwealth_2n49vs61t.jpg'
    },
    'post-chauffage-s690': {
      fichier: 'assets/vignettes/post-chauffage-s690.webp', largeur: 500, hauteur: 342, nature: 'photographie', cadrage: '50% 40%',
      alt: 'Un ouvrier casqué fixe des thermocouples sur une tuyauterie soudée, sous un réseau de conduites.',
      legende: 'Pose de thermocouples sur une tuyauterie avant son traitement thermique après soudage. Le post-chauffage emploie le même matériel : des résistances chauffantes autour du joint et des thermocouples qui pilotent la température, ici quelques heures vers 250 °C.',
      titre: 'Blue Grass Chemical Agent-Destruction Pilot Plant Munitions Demilitarization Building (27926033117).jpg', auteur: 'PEO ACWA', licence: 'CC BY 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Blue_Grass_Chemical_Agent-Destruction_Pilot_Plant_Munitions_Demilitarization_Building_(27926033117).jpg'
    },
    'normalisation-revenu-p91': {
      fichier: 'assets/vignettes/normalisation-revenu-p91.webp', largeur: 500, hauteur: 796, nature: 'photographie', cadrage: '50% 58%',
      alt: 'Conduite de vapeur entourée d’isolant blanc sanglé, rougeoyant de l’intérieur, d’où sortent des fils de thermocouples.',
      legende: 'Recuit d’une conduite de vapeur vive en X10CrMoVNb9-1 (P91) dans une centrale à biomasse : sous l’isolant, des résistances chauffantes portent la paroi à température, contrôlée par thermocouples. Le revenu du P91 et le traitement de ses soudures se font vers 730 à 780 °C, toujours sous Ac1.',
      titre: 'Glühen der Frischdampfleitung P91 Biomasseheizkraftwerk Steyr.jpg', auteur: 'Sensenschmied', licence: 'CC BY 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Gl%C3%BChen_der_Frischdampfleitung_P91_Biomasseheizkraftwerk_Steyr.jpg'
    },
    'ttas-10crmo9-10': {
      fichier: 'assets/vignettes/ttas-10crmo9-10.webp', largeur: 500, hauteur: 346, nature: 'photographie', cadrage: '50% 40%',
      alt: 'Un ouvrier casqué règle un pupitre de commande bleu hérissé de câbles de thermocouples, à côté d’un enregistreur à écran.',
      legende: 'Pupitre de pilotage d’un traitement thermique après soudage de tuyauteries : chaque voie règle une zone de chauffe et enregistre sa température. Pour un acier Cr-Mo, la courbe enregistrée (montée, palier vers 690 °C, descente) est conservée comme preuve du traitement.',
      titre: 'Blue Grass Chemical Agent-Destruction Pilot Plant Munitions Demilitarization Building (41894093865).jpg', auteur: 'PEO ACWA', licence: 'CC BY 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Blue_Grass_Chemical_Agent-Destruction_Pilot_Plant_Munitions_Demilitarization_Building_(41894093865).jpg'
    }
  };

  for (const v of Object.values(VIGNETTES)) v.licenceUrl = LICENCES[v.licence];
  return VIGNETTES;
});
