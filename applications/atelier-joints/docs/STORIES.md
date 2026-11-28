# Stories — Atelier des joints

## A01 — S'entraîner à lire et écrire les symboles de soudage

En tant qu'élève DU/IWE, je m'entraîne autant que je veux à lire et à écrire les symboles ISO 2553, la fourche et les tolérances de l'ISO 13920. Je progresse par niveaux, et mes erreurs reviennent jusqu'à ce que je les maîtrise.

Critères observables :
- Cinq niveaux, chacun jouable en Décoder (QCM illustré) et en Coder (outil de composition avec aperçu).
- Les exercices sont générés : reproductibles par leur graine, avec des options distinctes et une seule bonne réponse.
- Le mode Coder accepte la réponse attendue et refuse une réponse voisine.
- La correction est immédiate, expliquée, et renvoie vers la section du cours.
- Une série de 10 réussie à 8 au moins débloque le niveau suivant ; les étoiles gardent le meilleur résultat.
- Les erreurs passent en révision espacée (cinq boîtes, 0, 1, 3, 7 et 14 jours) ; une pastille dans la navigation compte les cartes dues.
- L'examen blanc compte 20 questions, quatre par niveau. Il ne corrige qu'à la fin, donne un bilan par compétence et envoie les erreurs en révision. Il s'ouvre quand les cinq niveaux sont validés en Décoder, ou en accès libre.
- La sauvegarde est locale, tolère des données corrompues, et un avis s'affiche si le stockage est indisponible.
- L'application s'utilise au clavier (touches 1 à 4), en clair et en sombre, sans débordement de 360 à 1 440 px ; à 1 366 × 768, les réponses tiennent sur l'écran.

Validation du 27 novembre 2026 (Claude, lot 3 de la série Conception) :

- RED exécuté : `node --test applications/atelier-joints/tests/*.test.cjs` échoue sur deux suites, faute des modules `generateur.js` et `progression.js` (« Cannot find module »). Les 24 tests existants des moteurs restent verts.
- GREEN : 42 tests Node, à savoir :
  - 11 tests des coupes ;
  - 15 tests des symboles, dont deux ajoutés pendant le lot : trait discontinu forcé pour l'aperçu vide, fourche qui ne chevauche pas les cotes ;
  - 9 tests du générateur, sur 160 graines par niveau et par mode ;
  - 8 tests de progression et de révision.

  Un premier GREEN a échoué sur un test trop strict (espace insécable avant « mm ») ; le test a été corrigé, pas le générateur.
- Parcours Chromium (`uv run --group browser pytest applications/atelier-joints`) : 22 tests verts. Ils couvrent la série parfaite et le déblocage, la révision, les cinq outils Coder, l'examen, le clavier, les liens vers les cours, le stockage corrompu ou indisponible, et la mise en page à 5 largeurs × 2 thèmes. Le premier passage a révélé un défaut réel : la navigation attendait l'événement `hashchange`, asynchrone, et un clic rapide agissait sur l'écran précédent. Elle est maintenant synchrone (`history.pushState`), le retour arrière restant géré.
- Captures examinées : parcours, question Décoder et correction, cinq outils Coder, examen et bilan, révision, aide, téléphone en sombre.
- Passe UI/UX finale dans un site construit à blanc, hors du dépôt : cours Conception intégrés et application déclarée au catalogue.
  - Contrôles :
    - liens « Revoir » valides jusqu'à l'ancre ;
    - panneau du wiki ouvert et replié ;
    - aucun débordement de 360 à 1 440 px, en clair et en sombre ;
    - aucune erreur JavaScript de l'application.
  - Deux corrections :
    - espaces insécables de la typographie française, posés à l'insertion de tout texte affiché (un « ; » tombait en début de ligne) ;
    - marge basse pour que la dernière commande d'un écran ne passe pas sous les boutons flottants « Chat » et « Menu » du wiki.
  - Les 42 tests Node et les 22 parcours Chromium restent verts.
- Pas de publication : l'entrée du catalogue est proposée à Codex dans `docs/A_INTEGRER.md`.
