# Stories — Carte des notions

## C01 — Du corpus des cours au graphe des notions

En tant qu’élève DU/IWE, je veux que les notions des cours soient reliées quand les cours les évoquent ensemble, pour voir lesquelles vont de pair et pourquoi.

Critères observables :
- Le vocabulaire vient des glossaires des cours et des mots-clés du catalogue. Les symboles, unités et notations mathématiques sont écartés ; les sigles, normes et désignations sont gardés et typés.
- Une entrée groupée (« Anode, cathode ») donne une notion par terme, chacune avec sa définition quand le nombre de définitions concorde ; une ellipse (« Courbe conventionnelle, rationnelle ») est complétée ; une loi nommée (« Norton (loi de) ») devient « loi de Norton ».
- La reconnaissance dans le texte ignore accents, casse et pluriel simple, sauf pour les sigles (« CE » n’est pas « ce ») ; l’expression la plus longue l’emporte.
- Les liens viennent des paragraphes partagés (NPMI pondérée par le nombre d’occurrences communes) et des définitions qui citent une autre notion. Glossaire, quiz et check-list n’entrent pas dans les co-occurrences.
- Chaque lien garde ses preuves : nombre de passages communs et sections de référence existantes.
- Par défaut, seuls les cours `disponible` du catalogue dont le fichier existe sont lus. L’option `--sources-locales` ajoute les cours de `Cours/` pas encore intégrés et marque les données « aperçu local ».
- Deux exécutions donnent un résultat identique. Un nouveau cours ajoute des notions sans déplacer sensiblement les anciennes.
- Un rapport des voisins de notions témoins permet de valider la carte avant l’interface.

Validation du 18 octobre 2026 (étape 1, en attente de relecture du propriétaire) :
- RED exécuté : `carte_vocabulaire`, `carte_graphe` puis `carte_disposition` absents (erreurs de collecte pytest). Un échec intermédiaire sur le test des sens venait de la donnée de test (notion sans voisine, donc écartée à raison) : donnée enrichie, règle inchangée.
- GREEN : 18 tests (`uv run --group carte pytest applications/carte-notions/tests`) : découpage des glossaires, reconnaissance, NPMI sur corpus jouet, exclusions, sens selon la matière, modes catalogue et local, déterminisme, mémoire des positions, stabilité à l'ajout de notions.
- Corpus réel en aperçu local : 48 cours, 6 581 passages, 1 377 notions, 4 645 liens, 16 continents, génération en 54 s. Rapport des voisins relu : ferrite → perlite, austénite, ferrite δ, bainite, gammagène ; martensite → bainite, austénite, trempe, revenu ; hydrogène → fissuration à froid, postchauffage, étuvage.
- Disposition : la première version (forces seules) donnait une pelote ; les continents servent désormais de super-notions de départ, avec liens internes renforcés et cohésion douce. Aperçus capturés hors dépôt.

## C02 — Explorer la carte et lire ses étiquettes

En tant qu’élève, je recherche une notion, explore son voisinage et ouvre les sections de cours associées sur ordinateur ou téléphone.

- Recherche tolérant les fautes, sélection, voisins, filtres, zoom, déplacement, mini-carte, aide et thèmes nuit/papier fonctionnent au clavier et à la souris.
- Les fiches et la notion sélectionnée restent dans la zone disponible, aux six tailles de la matrice navigateur.
- Les étiquettes évitent les panneaux et restent entièrement dans le canevas pendant les déplacements ; les liens secondaires restent discrets en vue d’ensemble.
- Les références locales ouvrent de vrais fichiers et ancres ; le mode aperçu local reste clairement annoncé et ne déclenche aucune publication.
- Validation des données et parcours Chromium, captures visuelles et documentation de lancement.

Reprise du 18 octobre 2026 : les 37 tests Python/Chromium et les 10 tests Node existants passent avant les dernières corrections. Les preuves RED/GREEN de la création de l’interface ne figurent pas dans l’extrait transmis ; elles ne sont pas présumées.

Validation finale du 18 octobre 2026 :
- RED : les deux variantes de test_labels_stay_inside_the_map_while_panning échouent à 390 x 844 et 1366 x 768 sur des étiquettes hors canevas. GREEN après contrôle des quatre limites : deux variantes puis suite complète réussies.
- Liens faibles masqués en vue d’ensemble sous un zoom relatif de 1,7, conservés dans le voisinage sélectionné ou survolé. Données du graphe inchangées.
- uv run --group browser --group carte pytest applications/carte-notions -q : 39 tests réussis, dont 21 parcours Chromium. node --test applications/carte-notions/tests/*.test.cjs : 10 tests réussis.
- Les 48 fichiers et leurs 425 ancres référencées existent. Données : mode local, 1 377 notions, 4 645 liens.
- Captures hors dépôt aux six tailles de 360 à 1440 px, deux thèmes, sélection et vue d’ensemble. Inspection visuelle : vue nuit 1366 x 768, vue papier 390 x 844, fiche Hydrogène papier, accueil et aide. Parcours complémentaire suggestions, survol, aide et fiche sans erreur JavaScript.
- Mesure indicative via carte.ecranDe (qui redessine) : 18,4 ms par appel en vue d’ensemble, 0,41 ms en sélection ; ce n’est pas une mesure de fluidité sur un appareil utilisateur.
- README ajouté. Aucun cours, catalogue ou autre chantier modifié par la reprise ; aucun commit ni déploiement.

Limite d’intégration : wiki check échoue sur l’ancien chemin Inox du cours 1, absent pendant la réorganisation des cours. Le build global n’est pas validé dans cet état. Résoudre le catalogue et régénérer en mode catalogue avant publication ; la finition présente concerne l’aperçu local.

## C03 — Publication dans le wiki

Le 18 octobre 2026, le propriétaire demande l’intégration de la carte et la publication des cours locaux. Voir les stories S35 et S36 dans le document `docs/STORIES.md` à la racine : données régénérées en mode catalogue, accès sous Assistant IA, adaptation au panneau et au tiroir mobile, liens réels vers les cours construits et tests de régression. Les limites de l’aperçu local décrites en C01/C02 sont levées pour cette version publiée ; les futures générations avec `--sources-locales` restent réservées à l’aperçu privé.
