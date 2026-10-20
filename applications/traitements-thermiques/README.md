# Traitements thermiques

Laboratoire de révision : on choisit un traitement dans une banque, on fait avancer le temps le long du cycle T(t), et on regarde évoluer la microstructure à cinq échelles (œil, coupe attaquée, microscope optique, microscope électronique, maille) ainsi que les propriétés (dureté, Rm, Rp0,2, allongement, ténacité, contrainte résiduelle, conductivité, taille de grain, hydrogène diffusible, ségrégation, globulisation, risque de fissuration à froid, écart de température à Ms).

La banque compte 13 traitements :

- trempe et revenu (42CrMo4) ;
- recuit complet, normalisation et globulisation (C45) ;
- homogénéisation puis normalisation (G20Mn5 moulé) ;
- trempes étagées martensitique et bainitique (34CrNiMo6) ;
- revenu à durcissement secondaire (X40CrMoV5-1) ;
- normalisation et revenu (P91) ;
- recristallisation (Cu-ETP) ;
- durcissement structural (EN AW-6082) ;
- post-chauffage de dégazage (S690QL) ;
- TTAS (S355, 10CrMo9-10).

Les vues sont des schémas calculés par le modèle, pas des micrographies. Les valeurs sont des ordres de grandeur pour un alliage de référence de composition médiane, pas des valeurs de calcul. La page le dit en permanence. Les photographies des cartes de la banque, elles, sont réelles (micrographies, pièces, installations) : chacune porte sa légende, son auteur et sa licence.

## Ouvrir l'aperçu

Depuis la racine du dépôt :

```powershell
uv run python -m http.server 8000 --bind 127.0.0.1
```

Ouvrir <http://127.0.0.1:8000/applications/traitements-thermiques/>. Servir la racine du dépôt permet aux liens « Pour réviser » de retrouver les fichiers de `Cours/`. La version publiée est accessible par « Traitements thermiques », sous « Carte des notions », dans le menu du wiki (`traitements-thermiques/index.html`, champ `raccourci` du catalogue).

## Organisation

| Fichier | Rôle |
| --- | --- |
| `js/outils.js` | outils numériques : interpolation, Arrhenius, courbes en C, Avrami avec additivité, relaxation de Norton, coefficients d'échange thermique, EN 1993-1-2, conversions |
| `js/mecanismes.js` | mécanismes et propriétés par famille : `acier`, `soudure`, `cuivre`, `aluminium` |
| `js/moteur.js` | conduction 1D implicite (surface et cœur), intégration le long du cycle, temps visuel, lecture interpolée |
| `js/geometrie.js` | germes reproductibles, cellules de Voronoï, retraits de polygones, couverture de Johnson-Mehl |
| `js/echelles.js` | dessin des cinq échelles pour chaque famille |
| `js/cycle.js` | graphique T(t), curseur, repères, événements, propriété superposée |
| `js/app.js` | assemblage de la page |
| `data/alliages.js` | données d'entrée de chaque alliage et **source de chaque valeur** |
| `data/traitements.js` | la banque : cycle, réglages, exemples, textes à deux niveaux, liens vers les cours |
| `data/vignettes.js`, `assets/vignettes/` | photographie de chaque traitement : fichier, texte alternatif, légende, auteur, licence, notice (registre : `docs/ILLUSTRATIONS.md` du dépôt) |

Tous les modules JavaScript s'exécutent aussi sous Node (motif UMD) : le moteur se teste sans navigateur. Aucune bibliothèque externe ; les polices Google sont facultatives.

## Le modèle et son calage

- **Aciers (42CrMo4)** : austénitisation entre Ac1 et Ac3, croissance du grain d² − d₀² = K·t ; décomposition de l'austénite par additivité sur deux courbes en C (ferrite-perlite, bainite) calées sur les taux de martensite déduits de la bande Jominy moyenne (correspondance de Hodge et Orehoski), avec des duretés dans la bande de l'EN 10083-3, et sur la pratique des trempes de barres (Ø25 à l'huile ≈ 85 % de martensite, Ø100 bainitique à cœur) ; martensite de Koistinen-Marburger ; duretés des constituants par les formules de Maynier ; revenu par le paramètre de Hollomon-Jaffe, avec la courbe d'une heure du cours Métallurgie 3 ; contraintes par un modèle à fibres (sections planes, plasticité, plasticité de transformation, relaxation de Norton). Vérifié : propriétés +QT de l'EN 10083-3 selon le diamètre, état recuit ≤ 241 HB.
- **Cuivre (Cu-ETP)** : restauration des défauts ponctuels, recristallisation d'Avrami avec écrouissage critique, croissance du grain ; dureté par Hall-Petch et Taylor, conductivité par Matthiessen. Vérifié : états R220 et R290, ≥ 58 MS/m recuit.
- **Aluminium (EN AW-6082)** : dissolution de Mg₂Si, sensibilité à la trempe (courbe en C), amas aidés par les lacunes de trempe, précipitation de β″ calée sur les courbes de vieillissement publiées par Hydro de 165 à 195 °C (écart quadratique ≈ 8 MPa sur 25 points), coalescence, durcissement cisaillement/Orowan, conductivité par Matthiessen. Vérifié : minima T4 et T6 de l'EN 755-2, résistivités T4 et T6 du producteur.
- **TTAS (S355 soudé)** : contrainte initiale = Re, écrêtée par la limite d'élasticité à chaud (EN 1993-1-2), relaxée par fluage (Norton calé sur des taux de détensionnement usuels) ; revenu de la ZAT ; effusion de l'hydrogène. Vérifié : ZAT ≤ 320 HV10 après TTAS (EN ISO 15614-1), contrainte résiduelle ≈ 20 % de Re après 2 h à 600 °C.

Ajouts du lot 2, communs à la famille des aciers :

- la transformation ferrito-perlitique avance vers l'équilibre de la température atteinte. Elle ne se bloque plus entre Ac3 et Ac1 au refroidissement lent.
- Une nouvelle austénitisation complète régénère le grain (homogénéisation puis normalisation).
- Le grain ferritique dépend de la vitesse de refroidissement et du grain austénitique.
- La globulisation de la cémentite sous Ac1 suit une loi d'Avrami activée.
- La ségrégation du manganèse s'efface par diffusion, avec une amplitude ∝ exp(−4π²·D·t/λ²).
- La martensite fraîche, née après un revenu, est suivie avec son propre paramètre de revenu. Elle pénalise la ténacité tant qu'elle n'est pas revenue.
- L'austénite formée au-delà d'Ac1 pendant un revenu n'est plus confondue avec l'austénite résiduelle de la trempe.
- Pour les aciers à outils, on suit les carbures alliés dissous à l'austénitisation, puis l'austénite résiduelle conditionnée par le revenu.
- L'écart de température surface–cœur est relevé au passage de Ms.

Calages vérifiés par les tests :

- **C45 (EN 10083-2)** :
  - recuit ≤ 207 HB, plus doux et à grain plus gros que l'état normalisé ;
  - Rm normalisé de 620 à 760 MPa ;
  - globulisation de 16 h à 700 °C : environ −15 % de dureté.
- **G20Mn5 (EN 10293)** :
  - ségrégation réduite d'environ 70 % après 10 h à 1 200 °C ;
  - effet négligeable de la normalisation seule ;
  - durée qui croît comme λ².
- **34CrNiMo6** :
  - bainite complète après 2 h à 380 °C, à 400–490 HV ;
  - étagée martensitique avec un écart surface–cœur inférieur à 15 °C à Ms, contre environ 80 °C à l'huile.
  - Le 42CrMo4, calé sur sa bande Jominy, garde 12 à 50 % de bainite dans un bain à 330–360 °C (Ø10 à Ø25). Il n'est donc pas pris pour la trempe étagée.
- **X40CrMoV5-1 (courbes de producteurs du H13)** : environ 46 HRC après 2 × 2 h à 600 °C, pic vers 540 °C, environ 39 HRC à 650 °C ; trempe à l'air jusqu'à 200 mm.
- **P91 (EN 10216-2)** : 190–250 HV après normalisation et revenu à 760 °C ; martensite fraîche au-delà d'Ac1.
- **S690QL** : hydrogène inférieur à 1 ml/100 g après 2 h à 250 °C sur 30 mm ; plus de 5 ml/100 g sans post-chauffage.
- **10CrMo9-10** : environ 20 % de Re après 2 h à 690 °C, contre environ 40 % après 2 h à 600 °C, soit deux fois le résidu d'un S355.

Les références complètes sont affichées dans l'onglet « En savoir plus » de chaque traitement. Les cibles de calage sont des tests (`tests/moteur.test.cjs`) : modifier une donnée de `data/alliages.js` sans les faire tourner est interdit.

## Ajouter un traitement à la banque

1. Si l'alliage est nouveau, l'ajouter à `data/alliages.js`, avec ses sources, dans une famille existante ou une nouvelle famille de `js/mecanismes.js` (et ses scènes dans `js/echelles.js`).
2. Ajouter l'entrée dans `TRAITEMENTS` (`data/traitements.js`) : réglages bornés et alertes, exemples, `programme(p)` (segments du cycle), points observés, propriétés suivies, textes d'étapes et d'événements aux deux niveaux, pièges, encadrés métier, liens vers les cours (et la table `COURS`).
3. Retirer la ligne correspondante de `A_VENIR`.
4. Écrire d'abord les cibles de calage dans `tests/moteur.test.cjs` (RED), puis caler (GREEN).
5. Choisir une photographie : une micrographie de la structure visée ou une pièce du secteur d'emploi. Sa licence doit être vérifiable (Commons). La réduire à environ 500 px, la convertir en WebP sans autre retouche et l'ajouter à `assets/vignettes/<id>.webp`. Inscrire ses métadonnées dans `data/vignettes.js` : légende fidèle à la source, nuance et technique non inventées, barre d'échelle gardée par la découpe. Compléter enfin le registre `docs/ILLUSTRATIONS.md`.
6. Déclarer tout nouveau fichier dans `fichiers` de l'entrée `traitements-thermiques` du catalogue.

## Vérifier

```powershell
node --test applications/traitements-thermiques/tests/*.test.cjs
uv run --group browser pytest applications/traitements-thermiques -q
uv run --group browser pytest tests/browser/test_tth_publiee.py -q
```

Les parcours Chromium couvrent toute la banque, à toutes les échelles et à plusieurs instants ; ils vérifient aussi les photographies (décodage, crédits, registre, absence d'emoji) et les nouvelles jauges, ainsi que le clavier, les exemples, la banque, le thème et le niveau mémorisés, six largeurs en clair et en sombre (sans débordement, textes SVG dans le cadre, tenue en paysage sans défilement) et les liens vers les sections des cours.

Clés de stockage du navigateur : `traitements-thermiques-theme`, `traitements-thermiques-niveau`, `traitements-thermiques-dernier`.
