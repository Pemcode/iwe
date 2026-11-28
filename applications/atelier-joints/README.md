# Atelier des joints

Entraînement à la lecture et à l'écriture des symboles de soudage (ISO 2553:2019), de la fourche et des tolérances générales (ISO 13920:2023), pour la préparation de l'IWE. L'application complète les deux cours de la matière Conception : `conception-01` (types de joints et préparations) et `conception-02` (symboles et tolérances).

## Ce qu'on y fait

- **Cinq niveaux** : symboles élémentaires ; côté flèche et côté opposé (systèmes A et B) ; symboles supplémentaires ; cotes ; fourche et tolérances.
- **Deux modes par niveau** :
  - *Décoder* : un QCM illustré, à partir d'un symbole, d'une coupe ou d'une fourche à lire ;
  - *Coder* : composer le symbole avec un outil (palette, place, symboles supplémentaires, cotes, fourche), avec aperçu en direct.
- **Séries de dix questions** : 8/10 donne une étoile, 9/10 deux, 10/10 trois. Une série validée débloque le niveau suivant.
- **Révision espacée** : chaque question manquée devient une carte de Leitner. Les cinq boîtes sont revues après 0, 1, 3, 7 et 14 jours ; une carte réussie en boîte 5 est maîtrisée.
- **Examen blanc** : 20 questions, quatre par niveau, sans correction avant la fin, avec un bilan par compétence. Il s'ouvre quand les cinq niveaux sont validés en Décoder, ou en accès libre (dans l'aide).
- Chaque correction renvoie vers la section du cours à revoir (`#cN`).

Les exercices sont générés à partir d'une graine : ils sont en nombre illimité, reproductibles, et une carte de révision rejoue exactement la question manquée.

## Ouvrir l'aperçu

Depuis la racine du dépôt :

```powershell
uv run python -m http.server 8000 --bind 127.0.0.1
```

Ouvrir <http://127.0.0.1:8000/applications/atelier-joints/>. Servir la racine du dépôt permet aux liens « Revoir » de retrouver les fichiers de `Cours/`. Une fois publiée, l'application reçoit du générateur la balise `wiki-racine` et pointe vers les URL publiées.

## Organisation

| Fichier | Rôle |
| --- | --- |
| `js/coupe.js` | coupes de joints paramétriques (chanfreins ISO 9692-1, gorges ISO 17659), tracé SVG |
| `js/symbole.js` | symboles ISO 2553 en systèmes A et B : primitives, tracé, lecture en français |
| `js/generateur.js` | exercices des cinq niveaux, correction, aperçu des réponses du mode Coder |
| `js/progression.js` | étoiles, déblocage, examen, sauvegarde tolérante |
| `js/leitner.js` | révision espacée (cinq boîtes) |
| `js/app.js` | interface : parcours, séries, outils, révision, examen, aide |

Les modules s'exécutent aussi sous Node (motif UMD) : moteurs et générateur se testent sans navigateur. Il n'y a aucune bibliothèque externe ; les polices Google sont facultatives. `coupe.js` et `symbole.js` sont recopiés dans les manipulations des cours Conception. Toute correction se fait ici, puis on réassemble les cours (voir la compétence de rédaction).

## Règles et sources

- ISO 2553:2019 :
  - système A : trait continu côté flèche, trait discontinu côté opposé, trait discontinu de préférence dessous et omis pour les soudures symétriques ;
  - système B : dessous côté flèche, dessus côté opposé ;
  - cotes de section à gauche, de longueur à droite ; Z des soudures alternées ; fourche ouverte ou fermée ;
  - ligne repère brisée réservée aux bouts à bout de tôles, hors T.
- ISO 13920:2023 : les questions n'utilisent que trois tranches du tableau 1, qui sont redonnées dans l'énoncé.
- ISO 4063:2023 (procédés), ISO 5817:2023 (niveaux B, C, D), ISO 6947:2020 (positions).

Les exercices sont des cas d'école ; la norme, le plan et le DMOS font foi.

## Vérifier

```powershell
node --test applications/atelier-joints/tests/*.test.cjs
uv run --group browser pytest applications/atelier-joints -q
```

- Tests Node :
  - aires des coupes contre les formules fermées ;
  - règles ISO 2553 sur les primitives des symboles ;
  - générateur : chaque item est reproductible, ses options sont distinctes, il a une seule bonne réponse, la réponse attendue du mode Coder est acceptée et une réponse voisine refusée ;
  - progression et révision.
- Parcours Chromium :
  - série parfaite et déblocage ;
  - erreur, puis révision ;
  - les cinq outils Coder remplis comme un élève ;
  - examen ;
  - clavier ;
  - liens vers les cours ;
  - stockage corrompu ou indisponible ;
  - mise en page à cinq largeurs en clair et en sombre : pas de débordement, textes SVG dans leur cadre, réponses visibles à 1366 × 768.

Clés de stockage du navigateur : `atelier-joints-progression`, `atelier-joints-revision`, `atelier-joints-theme`.
