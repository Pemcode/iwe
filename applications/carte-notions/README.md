# Carte des notions

Application de révision : recherche d’une notion, exploration de ses voisines et accès aux sections de cours qui expliquent leur association. Le graphe montre des rapprochements dans les textes, pas des relations de causalité ni une validation scientifique indépendante.

## Ouvrir l’aperçu

Depuis la racine du dépôt :

```powershell
uv run python -m http.server 8000 --bind 127.0.0.1
```

Ouvrir <http://127.0.0.1:8000/applications/carte-notions/>. Servir la racine du dépôt permet aux liens de révision de retrouver les fichiers de `Cours/`.

La version publiée est accessible par « Carte des notions », sous « Assistant IA » dans le menu du wiki, à `carte-notions/index.html`. Les données présentes sont générées en **mode catalogue** : seuls les cours disponibles et déclarés sont utilisés. Les fichiers publiés sont explicitement listés dans `catalogue-cours.json` ; scripts Python, tests et mémoire des positions ne sont pas déployés.

## Regénérer les données

```powershell
uv run --group carte python applications/carte-notions/scripts/generer_carte.py
```

Par défaut, seuls les cours disponibles du catalogue dont la source existe sont utilisés. `--sources-locales` est réservé aux aperçus privés : ne pas publier ces données. Lire les avertissements : une source absente ne doit pas être ignorée lors d’une préparation de publication. `--rapport CHEMIN` écrit un rapport de voisinage pour relecture. `--recalculer` oublie les positions précédentes ; ne l’utiliser que pour refaire volontairement la disposition.

Le vocabulaire est extrait des glossaires et des mots-clés, puis ajusté par `data/vocabulaire.json`. Les positions sont conservées dans `data/positions.json`. Le fichier `data/carte-data.js` est généré, pas édité manuellement.

## Vérifier

```powershell
uv run --group browser --group carte pytest applications/carte-notions -q
node --test applications/carte-notions/tests/*.test.cjs
```

Installer Chromium au besoin avec `uv run --group browser playwright install chromium`. Pour enregistrer les captures de la matrice de tailles, définir `CARTE_CAPTURES` vers un dossier temporaire hors dépôt avant les tests. Les stories et les résultats de contrôle sont dans `docs/STORIES.md` de cette application.

L’interface est en Canvas 2D, sans bibliothèque JavaScript externe. Les polices Google sont facultatives ; des polices de secours sont prévues. Les thèmes et l’accueil mémorisent seulement des préférences dans le navigateur. La recherche, les filtres et la navigation fonctionnent sans compte.

## Mettre à jour la carte publiée

Après intégration de cours, régénérer en mode catalogue, relire le rapport et committer les données mises à jour. Exécuter les tests ci-dessus et `uv run --group browser pytest tests/browser/test_carte_publiee.py`, puis construire le wiki. Les parcours de publication vérifient le panneau ouvert et replié, le tiroir mobile et les liens vers les chapitres à la racine et sous `/iwe/`.

Les liens restent relatifs grâce à la métadonnée `wiki-racine` fournie par le générateur. La surface du canevas réserve la place du menu ; les coordonnées des panneaux et de la caméra sont exprimées dans ce canevas.
