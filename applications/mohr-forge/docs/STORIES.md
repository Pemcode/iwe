# Stories — Mohr Forge

## J01 — Apprendre puis résoudre un dossier de soudage

En tant qu’élève DU/IWE, je manipule les tenseurs et les cercles de Mohr,
puis je résous seul des dossiers contextualisés de niveau examen.

Critères observables :
- Application statique française, utilisable par double-clic, à la racine et sous un sous-chemin.
- Huit étapes progressives, trois défis par étape, explications, indices et correction détaillée.
- Déblocage par maîtrise, XP non cumulables par répétition, badges et sauvegarde locale résiliente.
- Laboratoire : tenseur symétrique 2D/3D, rotation, cercle et tricercle ; distinction γ/2.
- Calculs vérifiés sur traction, compression, cisaillement, hydrostatique, tenseur 3D couplé et déformations.
- Examen débloqué après le parcours, variantes, notation partielle, bilan et reprise des notions faibles.
- Cas industriels reconstruits avec hypothèses explicites ; sources officielles et éditions identifiées.
- Deux critères distincts pour les soudures d’angle ; qualité ISO 5817 distincte de la résistance.
- Tests des parcours, erreurs de saisie, persistance, examen et affichage mobile.

Validation du 30 septembre 2026 — livré localement dans un dépôt autonome.

- RED exécuté : modules `mechanics.js` et `progression.js` absents (deux échecs Node), puis module pédagogique absent. Parcours Chromium en échec sur le bouton de démarrage inexistant. Build en échec sur le module `scripts.build` absent.
- GREEN : 11 tests Node (calculs, cas de référence indépendants, progression, contenu et examen) et 10 tests pytest, dont huit parcours Chromium et deux contrôles du build. Le parcours complet résout les 24 défis, débloque l’examen et vérifie une copie partiellement correcte (17/18).
- Extension des déformations 3D : RED sur l’option de laboratoire absente, puis GREEN sur le tricercle, γmax égal à deux fois le rayon et la dilatation isotrope sans cisaillement.
- Installation finale exécutée : `uv sync --locked --group browser`. L’installation initiale a rencontré un verrou OneDrive ; environnement généré recréé en mode copie, puis installation et tests dans l’environnement propre du jeu réussis.
- Commandes finales : `node --test tests/*.test.cjs`, `uv run --group browser pytest -q`, `uv run python scripts/build.py`, `uv run --group browser python scripts/visual_check.py`.
- Artefact de sept fichiers explicitement déclarés dans `dist/`. Vérification de 24 vues à 1440 et 390 px, à la racine et sous un sous-chemin ; aucun débordement, aucune erreur JavaScript ou ressource HTTP en erreur. Inspection visuelle des captures de l’accueil, d’un exercice et des laboratoires 3D, notamment des déformations sur téléphone.
- Ouverture directe `file://` vérifiée. Sauvegarde après rechargement, stockage indisponible, données corrompues, export/import et reprise de copie testés. Les captures et le rapport d’audit restent ignorés dans `artifacts/`.
- Pas de publication réseau. Aucun contenu du wiki ni PDF de planning dans l’artefact. Sources normatives datées et limites scientifiques documentées dans le Carnet et le README ; aucune qualification officielle revendiquée.

## J02 — Une navigation fluide et un laboratoire lisible sur mobile

En tant que joueur, je poursuis mon apprentissage sans impasse, au clavier comme sur téléphone.

Critères observables :
- Le lien d’évitement conserve la page courante et amène le focus au contenu.
- Après un défi validé hors ordre, la suite propose un défi accessible encore à résoudre.
- Les retours de correction sont visibles, associés aux champs et permettent de revenir à la première erreur.
- Aucune page ne déborde à 320 px ; les champs mobiles ont une police d’au moins 16 px et les préréglages du laboratoire une cible de 44 px.
- Les graduations de Mohr restent lisibles sans étirer les cercles ; le tenseur nul ne superpose pas plusieurs étiquettes zéro.
- L’angle peut être saisi précisément, y compris avec une virgule, et reste synchronisé avec le curseur.
- Chaque dossier d’examen reçoit un titre et un focus cohérents lors de la navigation au clavier.

Validation du 30 septembre 2026 : RED exécuté sur les parcours de navigation, correction mobile, taille des contrôles et saisie d’angle, puis sur les graduations nulles et le focus de dossier isolés. GREEN : sept nouvelles régressions passent ; suite complète de 11 tests Node et 17 tests pytest verte. Build validé. Contrôle de 64 vues sur quatre largeurs (320/390/768/1440), sans débordement ni erreur JS/HTTP. Rendus du laboratoire et du bilan inspectés visuellement. Détails, limites et procédure dans [QA.md](QA.md).

## J03 — Lire les matrices par lignes et colonnes

En tant que joueur, je repère immédiatement la position de chaque composante du tenseur.

Critères observables :
- Les matrices des énoncés, de l’examen et du bilan présentent trois lignes et trois colonnes entre crochets, avec symbole et unité à l’extérieur.
- Le coefficient inconnu conserve sa place et les valeurs restent identiques ; la notation française des nombres est conservée.
- Les rappels et le laboratoire utilisent le même rendu ; les modèles dans le plan conservent leurs dimensions 2 × 2.
- Les matrices restent lisibles à 320 px, à l’impression et dans le bilan texte exporté.
- Les coefficients sont accessibles comme cellules d’un tableau nommé.

Validation du 30 septembre 2026 : RED exécuté sur la première mission (tableau de matrice absent). GREEN : cinq nouveaux cas navigateur vérifient les positions des coefficients, les dimensions, les rappels 2D/3D, les décimales négatives du laboratoire, le bilan imprimé et son export texte. Suite complète : 11 tests Node et 22 tests pytest réussis. Build de sept fichiers validé ; 64 vues contrôlées sans débordement de page ni erreur JS/HTTP. Captures ordinateur et téléphone de 320 px inspectées visuellement. Le contrôle ciblé confirme aussi que les matrices testées tiennent entièrement dans leur conteneur.

## J04 — Sentir la matière dans un laboratoire 3D

En tant qu’élève, je manipule un élément de matière en 3D et je vois immédiatement les efforts sur ses faces, sa déformée et le point correspondant sur le cercle de Mohr.

Critères observables :
- Un élément cubique en 3D, orientable par glisser, au clavier et par vues prédéfinies, affiche les composantes du tenseur dans le repère tourné : traction sortante, compression rentrante, cisaillements dans le plan des faces.
- La déformée suit la loi de Hooke (ou le tenseur ε saisi), amplifiée avec un facteur affiché ; l’échelle réelle montre que la déformée est invisible (HPP) ; la forme initiale reste visible en pointillés.
- La facette étudiée porte le vecteur contrainte T = σ·n et ses composantes normale et tangentielle ; « Aligner » oriente l’élément sur les directions principales, où le cisaillement disparaît.
- Le point du cercle de Mohr se déplace au doigt ou à la souris ; les faces x′ et y′ sont repérées ; en 3D, une normale quelconque (azimut, élévation) donne un point dans la zone entre les trois cercles.
- Un mode « bridage thermique » calcule les contraintes d’une dilatation empêchée selon une, deux ou trois directions ; un contrôle de cordon d’angle EN 1993-1-8 lit σ⊥, τ⊥, τ∥ sur la facette.
- Les contrôles existants (saisie, préréglages, angle précis, matrices, résultats) restent disponibles ; aucune page ne déborde à 320 px.

Validation du 30 septembre 2026.

- RED exécuté : `node --test tests/lab3d.test.cjs` échoue sur les modules `labmodel.js` et `scene3d.js` absents ; les huit parcours Chromium de `tests/test_lab3d.py` échouent faute de vue `#element-3d`.
- GREEN : dix tests Node (vecteurs propres et base directe, repère tourné, facette quelconque dans la zone des trois cercles, Hooke inverse, dilatation empêchée, alignement principal, modèle du laboratoire, échelles, projection) et huit parcours Chromium (orbite à la souris, au clavier et par vue prédéfinie ; effet Poisson et échelle réelle ; alignement principal ; glisser du point de Mohr ; facette 3D à τmax ; bridage thermique ; cordon d’angle ; cinq modes à 320 px sans erreur).
- Défauts révélés et corrigés pendant le GREEN : le badge d’amplification interceptait le glisser (surcouches rendues transparentes au pointeur) ; l’empilement mobile débordait à 390 px (éléments étirés en colonne).
- Régressions existantes conservées : saisie d’angle avec virgule, matrices 2 × 2 et 3 × 3, tricercle des déformations, graduations du tenseur nul, contrôles mobiles. Le test du lien d’évitement attend désormais l’affichage du laboratoire avant l’appui : le rendu plus lourd rendait l’enchaînement du test instable ; le focus reste bien sur le contenu, vérifié à part.

## J05 — Vivre la mécanique des milieux continus en mode histoire

En tant qu’élève, je progresse dans un récit d’atelier où chaque épisode me fait découvrir une notion par la manipulation.

Critères observables :
- Douze épisodes en trois actes : contraintes et facettes, déformations et HPP, 3D et cordon soudé ; chacun avec un briefing, des objectifs vérifiés en direct, un indice et un débrief.
- Seules les commandes utiles à l’épisode sont proposées ; l’objectif courant reste visible pendant la manipulation, y compris sur téléphone.
- Un épisode réussi rapporte des étoiles et des XP non cumulables, débloque le suivant et reste enregistré après rechargement ; une sauvegarde corrompue repart proprement.
- Chaque épisode est réalisable : une solution de référence satisfait tous les objectifs, alors que l’état initial ne les satisfait pas.
- Cas concrets de soudage avec paramètres donnés : éprouvette de qualification, gousset, rosette, pièce épaisse, barre bridée, virole, cordon d’angle.

Validation du 30 septembre 2026.

- RED exécuté : `node --test tests/story.test.cjs` échoue sur le module `story.js` absent ; les cinq parcours de `tests/test_story.py` échouent (onglet « Histoire » et suivi `#quest-tracker` introuvables).
- GREEN : quatre tests Node (douze épisodes réalisables par leur solution de référence et non atteints au départ ; objectifs séquentiels acquis ; piège du facteur 2 signalé ; déblocage, étoiles, XP non cumulables et sauvegarde robuste) et cinq parcours Chromium (hub et verrous ; épisode 1 réussi par manipulation, XP et rechargement ; indice à deux étoiles et piège γ/2 ; épisode verrouillé et sauvegarde corrompue ; suivi visible sur téléphone sans débordement).
- Inspection visuelle des captures du hub, des épisodes 1, 5, 6, 8, 9 et 12 sur ordinateur et de l’épisode 1 sur téléphone. Corrigés après inspection : collision de la classe `.mission` avec les cartes d’atelier (briefing illisible), commandes déplacées au-dessus du banc d’essai, étiquettes et poignée qui se chevauchaient, unité µε mise en capitales grecques.
- Commandes finales : `node --test tests/*.test.cjs` (25 réussis), `uv run --group browser pytest -q` (35 réussis), `uv run python scripts/build.py` (11 fichiers déclarés), `uv run --group browser python scripts/visual_check.py` (84 vues, aucun débordement ni erreur JS/HTTP). Ouverture directe `file://` du laboratoire et d’un épisode vérifiée sans erreur.

## J06 — Jouer depuis le wiki PolyWE

Le jeu est intégré au dépôt et à GitHub Pages ; critères et preuves dans la story S12 du wiki (`docs/STORIES.md` à la racine). Le build autonome (`scripts/build.py`, `dist/`) et sa CI sont remplacés par le générateur et la CI du wiki. Les tests du jeu se lancent depuis la racine du dépôt.

Régression ajoutée à l’intégration : avec des polices de repli larges (Verdana, DejaVu Sans), la navigation débordait à 320 px. RED sur `test_wide_fallback_fonts_do_not_overflow_small_phones`, puis GREEN après retour à la ligne de la navigation sur petit écran. Suite du jeu : 25 tests Node et 34 parcours Chromium.
