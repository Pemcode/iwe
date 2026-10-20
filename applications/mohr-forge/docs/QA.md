# Contrôle QA et améliorations UI/UX — 30 septembre 2026

Périmètre : campagne, exercices, laboratoire de contraintes/déformations, examen et bilan. La passe porte sur le fonctionnement et l’ergonomie ; les équations et le contenu normatif n’ont pas été modifiés.

## Corrections livrées

| Observation | Résultat |
| --- | --- |
| Le lien « Aller au contenu » changeait la route en `#main` et affichait l’accueil. | Le lien conserve la page et place le focus sur son contenu. |
| Valider le troisième défi avant les deux premiers conduisait vers l’atelier suivant verrouillé. | « Défi suivant » mène au prochain défi non résolu accessible ; l’examen n’est proposé qu’une fois le parcours terminé. |
| Le retour après erreur pouvait rester hors de l’écran du téléphone. | La correction est amenée dans la zone visible. Chaque champ porte un état textuel associé par `aria-describedby`, et « Corriger mes réponses » revient à la première erreur. |
| Le changement de dossier d’examen perdait le focus clavier. | Le titre reçoit le focus ; le titre de l’onglet reflète aussi la page ou le dossier. |
| Le graphique réduit à partir d’un grand SVG rendait les graduations minuscules sur mobile. | Le tracé utilise la largeur réelle disponible, des graduations moins nombreuses sur petit écran et une légende HTML qui se réorganise. Les échelles x/y restent identiques. |
| Un tenseur nul superposait cinq étiquettes « 0 ». | L’axe utilise une plage neutre avec des graduations distinctes. |
| Le curseur n’acceptait que des degrés entiers. | Un champ d’angle accepte point ou virgule, se synchronise avec le curseur au centième de degré et signale les valeurs hors de −90° à +90°. |
| Les champs et préréglages étaient petits au toucher. | Champs mobiles à 16 px, cibles de 44 px, contour de focus visible autour des champs, retours à la ligne adaptés aux petits écrans et notes du bilan sans coupure. |

## Vérifications exécutées

- **11 tests Node réussis** : mécanique, progression, contenu et références numériques indépendantes de l’examen.
- **17 tests pytest réussis**, dont 15 parcours Chromium et deux tests du build. Sept parcours de régression ont été ajoutés pendant cette passe après reproduction des défauts ou de la fonctionnalité manquante.
- **64 vues contrôlées** à 320, 390, 768 et 1440 px : pages principales à la racine et sous un sous-chemin, laboratoires 3D, trois dossiers d’examen et bilan. Aucun débordement horizontal de page, aucune erreur JavaScript ni ressource HTTP en erreur observés.
- Inspection visuelle des captures du laboratoire sur ordinateur et petit téléphone, et du bilan d’examen mobile.
- Build de sept ressources déclarées dans `dist/`. Captures et données fictives de QA restent dans `artifacts/`, ignoré par Git.

Le contrôle du navigateur intégré n’a pas pu démarrer dans cet environnement Windows (`CryptUnprotectData`). Les parcours et captures ont donc été réalisés avec Chromium local via Playwright. Un défaut d’initialisation des données fictives du script de capture a été corrigé : changer seulement le fragment d’URL ne rechargeait pas l’état enregistré avant l’examen.

Ces vérifications ciblées ne constituent pas un audit exhaustif WCAG ni un essai sur tous les navigateurs ou appareils physiques.

## Reproduire

Depuis la racine du dépôt PolyWE, où le jeu est intégré depuis le 30 septembre 2026 :

```powershell
node --test applications/mohr-forge/tests/*.test.cjs
uv run --group browser pytest applications/mohr-forge/tests
uv run python -m wiki build
uv run --group browser python applications/mohr-forge/scripts/visual_check.py
```

Les passes ci-dessous mentionnent l’ancien artefact autonome `dist/` : il est remplacé par la publication du wiki à `RDM/mohr-forge/`.


## Affichage des matrices — J03

Les matrices sont maintenant des tableaux de coefficients nommés et encadrés de crochets, avec leur symbole et leur unité à l’extérieur. Ce rendu couvre les défis, les fiches de rappel, le Carnet, le laboratoire, les dossiers d’examen et le bilan imprimé. Les valeurs proviennent de cellules structurées, sans découpage de chaînes numériques à virgule. L’export texte garde trois lignes distinctes pour les tenseurs 3D ; les modèles dans le plan gardent deux lignes et deux colonnes.

Validation complémentaire : cinq cas navigateur ajoutés après reproduction RED. La suite finale compte **11 tests Node et 22 tests pytest réussis**. Contrôle renouvelé de **64 vues** aux quatre largeurs, à la racine et sous un sous-chemin ; aucun débordement de page ni erreur JS/HTTP. Les contrôles ciblés vérifient également les neuf positions, le coefficient inconnu, les coefficients négatifs avec virgule, l’absence de défilement interne pour les matrices testées à 320 px, l’impression et l’export texte. Les captures de la première mission à 1440 et 320 px ont été inspectées visuellement. Les calculs, les réponses attendues et la progression sont conservés.


## Laboratoire 3D et mode histoire — J04 et J05

Objectif : faire sentir contraintes et déformations par la manipulation, sans quitter le cadre élastique, isotrope et HPP du jeu.

| Décision | Raison |
| --- | --- |
| Rendu 3D natif sur canevas, projection orthographique | Aucune dépendance, fonctionnement en `file://`, longueurs de flèches comparables quelle que soit la profondeur. |
| Échelles des flèches et de la déformée figées, réajustées seulement en cas de débordement | Augmenter la charge allonge les flèches et accentue la déformée : l’amplitude se ressent au lieu d’être normalisée. |
| Forme initiale en pointillés, facteur d’amplification affiché, bouton « Échelle réelle » | Rendre visible l’hypothèse des petites perturbations plutôt que la cacher. |
| Point de Mohr, poignée *n* et orbite manipulables au doigt | Manipulation directe ; curseurs et saisies précises restent disponibles au clavier. |
| Surcouches non interactives transparentes au pointeur | Le badge d’amplification ne bloque plus l’orbite. |
| Épisodes : mission et objectifs à gauche, instruments et commandes au-dessus du banc d’essai | Objectif, commande et effet visibles ensemble sur ordinateur ; sur téléphone, suivi d’objectif fixé en bas et commandes juste après la vue 3D. |
| Seules les commandes utiles à l’épisode | Réduire la charge cognitive et guider la découverte. |

Vérifications : 25 tests Node, 35 tests pytest dont 33 parcours Chromium, build de 11 fichiers, 84 vues contrôlées aux quatre largeurs à la racine et sous un sous-chemin, dont le hub et le premier épisode. Captures inspectées : laboratoire dans ses cinq modes à 1440 px, laboratoire à 768, 390 et 320 px, hub et six épisodes.

Limites connues : le canevas n’est testé que sur son dessin effectif, pas au pixel près ; une description textuelle mise à jour en direct le double pour les lecteurs d’écran. Sur écran tactile, le glisser sur la vue 3D fait tourner l’élément : on fait défiler la page en dehors de la scène. Le cordon d’angle reprend l’hypothèse de contraintes uniformes sur la gorge de la méthode directionnelle, avec des paramètres imposés. Le bridage thermique reste élastique à propriétés constantes : il explique l’origine des contraintes résiduelles sans les calculer. Ces contrôles ne constituent ni un audit WCAG complet ni un essai sur appareils physiques.
