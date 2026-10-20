# Mohr Forge

Un jeu de révision en français pour le DU Ingénierie du soudage / IWE : tenseurs de contrainte et de déformation, cercle et tricercle de Mohr, applications aux assemblages soudés.

## Jouer

**En ligne**, depuis la matière RDM du wiki : [Mohr Forge sur Révisions IWE](https://pemcode.github.io/iwe/RDM/mohr-forge/index.html). **Hors ligne**, double-cliquer sur `Jouer.cmd` ou ouvrir `index.html` dans un navigateur récent. Aucune installation, connexion Internet ou création de compte n’est nécessaire. Le jeu fonctionne sous Windows, macOS, Linux et sur mobile lorsqu’il est servi par un hébergement statique.

1. Suivre les huit ateliers et leurs 24 défis, environ deux heures au total.
2. Utiliser les mini-cours, formules et indices ; vivre les douze épisodes du **mode histoire** et manipuler librement le laboratoire 3D.
3. Gagner XP, étoiles et badges. Chaque atelier terminé débloque le suivant.
4. Résoudre l’examen blanc débloqué à la fin : trois dossiers, 18 réponses, 50 minutes conseillées, sept variantes. Le temps ne coupe pas la copie. Objectif : 80 %.
5. Consulter les corrections, revenir aux ateliers à renforcer et exporter ou imprimer le bilan.

La progression, les épisodes réussis et la copie d’examen restent dans le navigateur. Le Carnet permet d’exporter/importer les badges et XP. Les origines web et `file://` peuvent avoir des stockages différents. Le jeu prévient si le stockage est indisponible. Pas de compte, de suivi collectif, d’analytics ou d’envoi de données.

## Le parcours

| Atelier | Compétence |
| --- | --- |
| 1 | Lire un tenseur symétrique, convertir kN/mm², calculer σn |
| 2 | Projeter un vecteur contrainte, tourner le repère, conserver la trace |
| 3 | Centre, rayon, valeurs et directions principales, cisaillement 2D/3D |
| 4 | Déformations, distinction εxy = γxy/2, rosette 0°/45°/90° |
| 5 | Hooke 3D, contraintes/déformations planes, dilatation empêchée |
| 6 | Valeurs propres d’une matrice 3D, tricercle, von Mises, hydrostatique |
| 7 | Gorge de cordon d’angle, deux critères Eurocode, gorge minimale |
| 8 | Synthèse, métal de base, fatigue, qualité et exécution |

## Le laboratoire 3D

Un élément de matière en 3D, dessiné en JavaScript natif sur un canevas, sans bibliothèque. On le fait tourner au doigt, à la souris, au clavier ou par vues prédéfinies. Il réagit en direct avec le cercle de Mohr, les matrices et le tableau de bord :

- **Flèches** dans le repère tourné : traction sortante, compression rentrante, cisaillements dans le plan des faces. La facette étudiée porte le vecteur contrainte T = σ·n et ses composantes. La poignée *n* oriente la facette.
- **Déformée** selon la loi de Hooke (ou le tenseur ε saisi), amplifiée avec un facteur affiché. La forme initiale reste en pointillés et les arêtes se colorent selon leur allongement. Le bouton « Échelle réelle » montre que la déformée est invisible : c’est l’HPP.
- **Cercle de Mohr** : point P déplaçable, faces x′ et y′, arc 2θ, trace, plafond de Tresca. En 3D, une normale quelconque (azimut φ, élévation ψ) donne un point dans la zone entre les trois cercles. « Aligner » oriente l’élément sur les directions principales, où tout cisaillement disparaît.
- **Cas de soudage** : dilatation empêchée selon une, deux ou trois directions ; contrôle d’un cordon d’angle par la méthode directionnelle de EN 1993-1-8 sur la facette de gorge. Les paramètres fu, βw et γM2 restent imposés.
- Matériau acier ou aluminium (E, ν, α des Eurocodes), intensité λ du chargement, pression hydrostatique p et rotation de corps rigide ω.

Les valeurs propres de la matrice symétrique complète et leurs directions sont obtenues par rotations de Jacobi. Les cercles gardent la même échelle sur les deux axes. L’angle se règle au curseur ou par saisie numérique, avec point ou virgule.

## Le mode histoire

Douze épisodes en trois actes accompagnent la fabrication d’une passerelle soudée, avec Otto, chef d’atelier : contraintes et facettes, déformations et HPP, puis 3D et cordon. Chaque épisode propose un briefing, des objectifs vérifiés en direct sur l’état du laboratoire, des instruments dédiés, un indice et un débrief relié à l’atelier de calcul correspondant. Seules les commandes utiles sont proposées. Un épisode réussi débloque le suivant et rapporte 80 XP sans indice, 65 avec. Rejouer peut améliorer les étoiles, sans cumuler de points.

| Acte | Épisodes |
| --- | --- |
| I · La matière sous tension | Éprouvette de qualification, coupe inclinée, cercle de Mohr, directions principales |
| II · La matière se déforme | Facteur 2 et glissement simple, rosette, tôle mince et pièce épaisse, barre bridée |
| III · L’espace et le cordon | Tricercle et facette quelconque, piège des contraintes planes, pression hydrostatique, cordon d’angle EN 1993-1-8 |

Chaque épisode possède une solution de référence vérifiée par les tests : elle atteint tous les objectifs, alors que l’état initial n’en atteint aucun. Les contrôles QA et les améliorations d’ergonomie sont détaillés dans [docs/QA.md](docs/QA.md).

Les tenseurs se lisent en matrices entre crochets, avec trois lignes et trois colonnes pour les cas 3D, dans les défis, les rappels, le laboratoire et l’examen. Les modèles limités au plan gardent leur matrice 2 × 2. Le bilan imprimé conserve cet affichage ; son export texte sépare également les lignes.

## Hypothèses scientifiques et normes

Traction positive ; σij = force selon i sur la face de normale j ; rotation du repère +θ antihoraire. Axe τ du cercle vers le haut, donc rotation du point −2θ. Petites déformations ; εxy = γxy/2. Les calculs sont élastiques isotropes lorsqu’ils utilisent Hooke. Les µε sont convertis en 10⁻⁶ avant calcul des contraintes. Les arrondis sont acceptés avec 0,5 % ou 0,05 unité minimum, angles ±0,6° modulo 180°, rapports ±0,005.

Les cas sont **des situations industrielles reconstruites avec des données pédagogiques**, pas des mesures réelles certifiées : tôles soudées, goussets, rosettes et zones bridées. Les paramètres de résistance sont explicitement donnés ; ils ne sont pas déduits automatiquement d’une nuance ou d’une épaisseur.

Références publiques consultées le 30 septembre 2026 :

- [NF EN 1993-1-8, décembre 2005 — AFNOR](https://www.boutique.afnor.org/fr-fr/norme/nf-en-199318/eurocode-3-calcul-des-structures-en-acier-partie-18-calcul-des-assemblages/fa114133/26358) et [annexe nationale de juillet 2007](https://www.boutique.afnor.org/fr-fr/norme/nf-en-199318-na/eurocode-3-calcul-des-structures-en-acier-partie-18-calcul-des-assemblages-/fa149363/29575), notices indiquées en vigueur. Calcul directionnel des soudures d’angle, §4.5.3.2, avec vérification combinée **et** normale.
- [JRC / F. Wald, Bolts, welds, column base, 2014](https://eurocodes.jrc.ec.europa.eu/sites/default/files/2022-06/06_Eurocodes_Steel_Workshop_WALD.pdf), support pédagogique public.
- [ISO 5817:2023](https://www.iso.org/standard/80209.html), qualité des imperfections ; [NF EN 1090-2+A1, mai 2024](https://www.boutique.afnor.org/fr-fr/norme/nf-en-10902-a1/execution-des-structures-en-acier-et-des-structures-en-aluminium-partie-2-e/fa209783/421615), exécution des structures acier.
- [Eurocode 3 — JRC](https://eurocodes.jrc.ec.europa.eu/EN-Eurocodes/eurocode-3-design-steel-structures), contexte EN 1993-1-9 pour la fatigue.
- [JRC, évolution de l’Eurocode 3, 2025](https://eurocodes.jrc.ec.europa.eu/sites/default/files/2025-08/20250603_2G_Eurocode3_JRC%2BWorkshop_final_website_0.pdf) : EN 1993-1-8:2024 publiée au niveau européen, transition nationale à prendre en compte. Les règles de 2005 et 2024 ne sont pas mélangées dans le jeu.
- [MIT OpenCourseWare, Materials / Structures](https://ocw.mit.edu/courses/16-01-unified-engineering-i-ii-iii-iv-fall-2005-spring-2006/pages/materials-structures/), mécanique des tenseurs et de Mohr, cours M12/M15.

Les textes complets des normes ne sont pas reproduits. La fatigue, les géométries de soudure, la plasticité, les singularités de pied de cordon et le cycle thermométallurgique ne font pas l’objet d’une v## Développement et vérification

Le jeu fait partie du dépôt [PolyWE](https://github.com/Pemcode/iwe) : ses sources vivent dans `applications/mohr-forge/`. Le catalogue du wiki le déclare dans sa liste `applications` et le générateur publie uniquement les onze fichiers listés, à `RDM/mohr-forge/`, en ajoutant la barre du wiki à la copie de `index.html`. Tests, documentation et scripts du jeu ne sont pas publiés. Un nouveau fichier nécessaire au jeu doit être ajouté à la liste `fichiers` du catalogue.

HTML/CSS/JavaScript natifs, sans dépendance frontend ni npm. Node 24 sert uniquement aux tests du moteur ; les parcours Chromium utilisent l’environnement uv du wiki. Commandes à lancer depuis la racine du dépôt :

```powershell
uv sync --locked --group browser
uv run --group browser playwright install chromium
node --test applications/mohr-forge/tests/*.test.cjs
uv run --group browser pytest applications/mohr-forge/tests
uv run python -m wiki build
uv run --group browser python applications/mohr-forge/scripts/visual_check.py
```

Le contrôle visuel construit le wiki puis audite le jeu publié à la racine et sous `/iwe/`, aux largeurs 320, 390, 768 et 1440 px ; captures et rapport restent dans `artifacts/`, ignoré par Git. La CI du wiki exécute les tests du moteur et les parcours du jeu avant toute publication. Les évolutions du jeu sont du code : elles suivent les commits de développement, pas la routine `publier` réservée aux contenus.

Structure : `js/mechanics.js` (calculs), `js/labmodel.js` (grandeurs du laboratoire), `js/scene3d.js` (vue 3D), `js/story.js` (épisodes et objectifs), `js/lab.js` (laboratoire et mode histoire), `js/progression.js` (récompenses), `js/curriculum.js` (mini-cours, défis et examen), `js/app.js` (navigation et pages), `assets/` (style et favicon), `tests/` (moteur et parcours), `docs/STORIES.md` (critères et preuves).

Historique : le jeu a d’abord été construit comme dépôt Git autonome. Il a été intégré au wiki le 30 septembre 2026 (story S12 du wiki) ; l’ancien dépôt, avec son historique, est archivé localement dans `.sauvegardes/`, hors Git.
