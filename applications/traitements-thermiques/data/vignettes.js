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
      fichier: 'assets/vignettes/recristallisation-cuivre.webp', largeur: 500, hauteur: 889, nature: 'photographie', cadrage: '50% 38%',
      alt: 'Jeux de barres en cuivre nu, épais et brillants, boulonnés dans une armoire électrique.',
      legende: 'Jeux de barres en cuivre de 2 500 A dans une armoire de commande de moteurs : le cuivre électrolytique conduit d’autant mieux qu’il est recuit.',
      titre: '2500A copper busbars in motor control panel.jpg', auteur: 'ToT89', licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:2500A_copper_busbars_in_motor_control_panel.jpg'
    },
    'durcissement-6082': {
      fichier: 'assets/vignettes/durcissement-6082.webp', largeur: 500, hauteur: 485, nature: 'photographie', cadrage: '50% 50%',
      alt: 'Profilés d’aluminium extrudés suspendus en file dans une cabine de thermolaquage, sous les pistolets de poudre.',
      legende: 'Profilés extrudés en aluminium sur une chaîne de thermolaquage (alliage non précisé par la source). Les profilés Al-Mg-Si sont mis en solution et trempés en sortie de presse.',
      titre: 'Powder Coating Aluminium Extrusions.jpg', auteur: 'Euro Quality Coatings', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Powder_Coating_Aluminium_Extrusions.jpg'
    },
    'ttas-s355': {
      fichier: 'assets/vignettes/ttas-s355.webp', largeur: 500, hauteur: 375, nature: 'macrographie', cadrage: '50% 50%',
      alt: 'Coupe attaquée d’une soudure bout à bout en V à côté d’un mètre ruban : métal fondu clair au centre, bandes plus sombres de part et d’autre, repères a à f.',
      legende: 'Macrographie d’une soudure bout à bout en V de tôles de 40 mm en acier ferrito-perlitique S355J2G3 : métal fondu au centre, zone affectée thermiquement de part et d’autre. Les repères a à f sont ceux de la page source.',
      titre: 'V-butt-weld.jpg', auteur: 'Alu.cz', licence: 'domaine public',
      source: 'https://commons.wikimedia.org/wiki/File:V-butt-weld.jpg'
    },
    'recuit-complet-c45': {
      fichier: 'assets/vignettes/recuit-complet-c45.webp', largeur: 500, hauteur: 375, nature: 'micrographie', cadrage: '50% 100%',
      alt: 'Micrographie optique : grains clairs de ferrite et plages sombres de perlite, dont les lamelles sont visibles ; barre d’échelle de 50 µm.',
      legende: 'Ferrite (claire) et perlite (sombre, lamellaire) d’un acier C45 à 0,45 % de carbone, au microscope optique (barre d’échelle : 50 µm). La source ne précise pas l’état de traitement.',
      titre: 'Ferrit-perlit 500x.jpg', auteur: 'Samson00', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Ferrit-perlit_500x.jpg'
    },
    'normalisation-c45': {
      fichier: 'assets/vignettes/normalisation-c45.webp', largeur: 500, hauteur: 333, nature: 'photographie', cadrage: '50% 50%',
      alt: 'Vilebrequin brut de matriçage, encore entouré de sa bavure, posé sur un fond sombre.',
      legende: 'Vilebrequin matricé dont la bavure n’est pas encore ébarbée (forge de Völklingen ; nuance non précisée). Les pièces forgées sont souvent normalisées pour effacer le gros grain de forge.',
      titre: 'VK Huette Schmiedeprodukt.JPG', auteur: 'TeWeBs', licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:VK_Huette_Schmiedeprodukt.JPG'
    },
    'globulisation-c45': {
      fichier: 'assets/vignettes/globulisation-c45.webp', largeur: 500, hauteur: 500, nature: 'micrographie', cadrage: '50% 100%',
      alt: 'Micrographie : petits globules sombres et arrondis dispersés dans une matrice claire ; barre d’échelle de 50 µm.',
      legende: 'Cémentite globulisée d’un acier eutectoïde à 0,8 % de carbone après un recuit de globulisation (barre d’échelle : 50 µm) : les lamelles de la perlite sont devenues des globules.',
      titre: 'PearliteSph3.jpg', auteur: 'Eduard Pleshakov', licence: 'domaine public',
      source: 'https://commons.wikimedia.org/wiki/File:PearliteSph3.jpg'
    },
    'homogeneisation-g20mn5': {
      fichier: 'assets/vignettes/homogeneisation-g20mn5.webp', largeur: 500, hauteur: 361, nature: 'photographie', cadrage: '50% 55%',
      alt: 'Deux grosses pièces moulées en acier, rougeoyantes, sur le chariot d’un four de traitement thermique sorti dans l’atelier.',
      legende: 'Pièces moulées en acier à la sortie du four de traitement thermique, après 12 h à 1 200 °C selon la source.',
      titre: 'Castings fresh from the heat treatment furnace.jpg', auteur: 'Goodwin Steel Castings', licence: 'CC BY-SA 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Castings_fresh_from_the_heat_treatment_furnace.jpg'
    },
    'trempes-etagees-34crnimo6': {
      fichier: 'assets/vignettes/trempes-etagees-34crnimo6.webp', largeur: 500, hauteur: 364, nature: 'micrographie', cadrage: '50% 100%',
      alt: 'Micrographie de bainite inférieure : fines aiguilles sombres entrecroisées en paquets ; barre d’échelle de 5 µm.',
      legende: 'Bainite inférieure d’un acier 80Si10 transformé 4 h à 250 °C (barre d’échelle : 5 µm) : c’est la structure que vise une trempe étagée bainitique, ici sur une autre nuance que celle simulée.',
      titre: '518UB80Si10 250.jpg', auteur: 'Luenibaer', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:518UB80Si10_250.jpg'
    },
    'durcissement-secondaire-x40crmov5': {
      fichier: 'assets/vignettes/durcissement-secondaire-x40crmov5.webp', largeur: 500, hauteur: 487, nature: 'photographie', cadrage: '50% 50%',
      alt: 'Disque d’acier sombre percé de quatre ouvertures en T : la face avant d’une filière d’extrusion.',
      legende: 'Face avant d’une filière d’extrusion de l’aluminium (nuance non précisée par la source). Ces outils travaillent à chaud et sont souvent en X40CrMoV5-1.',
      titre: 'Aluminium extrusion die front.png', auteur: 'Wizard191', licence: 'CC BY-SA 3.0',
      source: 'https://commons.wikimedia.org/wiki/File:Aluminium_extrusion_die_front.png'
    },
    'post-chauffage-s690': {
      fichier: 'assets/vignettes/post-chauffage-s690.webp', largeur: 500, hauteur: 375, nature: 'photographie', cadrage: '50% 45%',
      alt: 'Grue mobile jaune, flèche télescopique levée, au pied du mât d’une éolienne.',
      legende: 'Grue mobile sur le chantier d’un parc éolien (Pougny, Nièvre). Les flèches des engins de levage sont souvent en aciers à haute limite d’élasticité, dont les joints soudés craignent l’hydrogène.',
      titre: 'Demag crane, Pougny (1).jpg', auteur: 'Cjp24', licence: 'CC BY-SA 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:Demag_crane,_Pougny_(1).jpg'
    },
    'normalisation-revenu-p91': {
      fichier: 'assets/vignettes/normalisation-revenu-p91.webp', largeur: 500, hauteur: 333, nature: 'photographie', cadrage: '50% 50%',
      alt: 'Vue aérienne d’une centrale thermique au charbon : cheminées, tours de refroidissement, bâtiments des chaudières et stock de charbon.',
      legende: 'Centrale thermique au charbon John E. Amos (Virginie-Occidentale), vue aérienne. Les tuyauteries de vapeur des centrales de ce type emploient des aciers résistant au fluage comme le P91.',
      titre: 'John E. Amos Power Plant.jpg', auteur: 'Quintin Soloviev', licence: 'CC BY 4.0',
      source: 'https://commons.wikimedia.org/wiki/File:John_E._Amos_Power_Plant.jpg'
    },
    'ttas-10crmo9-10': {
      fichier: 'assets/vignettes/ttas-10crmo9-10.webp', largeur: 500, hauteur: 375, nature: 'photographie', cadrage: '50% 50%',
      alt: 'Unité de raffinerie vue d’en haut : charpentes métalliques, colonnes et tuyauteries, un estuaire en arrière-plan.',
      legende: 'Unité d’hydrocraquage de la raffinerie de Shell Haven (Royaume-Uni). Les réacteurs de ces unités, à parois très épaisses, sont souvent en acier 2,25Cr-1Mo.',
      titre: 'Hydrocracker Unit - geograph.org.uk - 606333.jpg', auteur: 'terry joyce', licence: 'CC BY-SA 2.0',
      source: 'https://commons.wikimedia.org/wiki/File:Hydrocracker_Unit_-_geograph.org.uk_-_606333.jpg'
    }
  };

  for (const v of Object.values(VIGNETTES)) v.licenceUrl = LICENCES[v.licence];
  return VIGNETTES;
});
