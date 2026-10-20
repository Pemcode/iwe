import json
import shutil
from pathlib import Path

import pytest

HTML = """<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Préchauffage</title><style>.demo { color: red; }</style></head><body>
<h1>Préchauffage</h1><section id="intro"><h2>Comprendre le préchauffage</h2>
<p>Une explication.</p><a href="#calcul">Calcul</a></section>
<section id="calcul"><h2>Le t<sub>8/5</sub> en pratique</h2>
<input id="temperature" type="range"><p id="valeur"></p></section>
<script>document.getElementById('valeur').textContent = 'Animation active';</script>
</body></html>"""


@pytest.fixture
def project(tmp_path):
    (tmp_path / "Thermique").mkdir()
    (tmp_path / "Thermique" / "introduction.html").write_text(HTML, encoding="utf-8")
    data = {
        "version": 2,
        "matieres": [{"id": "thermique", "titre": "Thermique", "description": "Une nouvelle matière."}],
        "cours": [{"id": "th-01", "matiere": "thermique", "repere": "Cours 01", "ordre": 1,
                   "titre": "Préchauffage", "fichier": "Thermique/introduction.html",
                   "statut": "disponible", "mots_cles": ["ZAT", "HAZ"], "prerequis_conseilles": []}],
        "parcours": []
    }
    save_catalogue(tmp_path, data)
    return tmp_path, data


def save_catalogue(root, data):
    (root / "catalogue-cours.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


APP_HTML = """<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Quiz du préchauffage</title>
<link rel="stylesheet" href="assets/app.css"><script defer src="js/app.js"></script></head>
<body><nav><a href="#accueil">Accueil</a> <a href="#jouer">Jouer</a></nav><main id="ecran">Chargement…</main></body></html>"""
APP_JS = """addEventListener('DOMContentLoaded', () => {
  const show = () => { document.getElementById('ecran').textContent = location.hash === '#jouer' ? 'Partie en cours' : 'Prêt à jouer'; };
  addEventListener('hashchange', show); show();
});"""


def add_application(root, data, **changes):
    """Une petite application à routes internes (#jouer), avec des fichiers à ne jamais publier."""
    folder = root / "applications" / "quiz"
    for sub in ("js", "assets", "tests"):
        (folder / sub).mkdir(parents=True, exist_ok=True)
    (folder / "index.html").write_text(APP_HTML, encoding="utf-8")
    (folder / "js/app.js").write_text(APP_JS, encoding="utf-8")
    (folder / "assets/app.css").write_text("main { font-weight: 700; }", encoding="utf-8")
    (folder / "tests/interne.test.cjs").write_text("// test local, jamais publié", encoding="utf-8")
    (folder / "NOTES.md").write_text("Notes de développement", encoding="utf-8")
    app = {"id": "quiz-thermique", "titre": "Quiz du préchauffage", "genre": "Jeu d’entraînement",
           "matiere": "thermique", "statut": "disponible", "ordre": 1,
           "description": "S’entraîner au préchauffage en jouant.",
           "source": "applications/quiz", "entree": "index.html",
           "fichiers": ["index.html", "js/app.js", "assets/app.css"],
           "publication": "Thermique/quiz", "cours_lies": ["th-01"],
           "mots_cles": ["jeu", "préchauffage"], "ressources": ["quiz"]}
    app.update(changes)
    data.setdefault("applications", []).append(app)
    save_catalogue(root, data)
    return app


def add_planning(project):
    root, catalogue = project
    (root / "Planning").mkdir()
    (root / "Planning/source.pdf").write_bytes(b"%PDF-1.4\nfixture")
    plan = {
        "version": 1, "phase_reference": "pre-rentree",
        "sources": [{"id": "source", "titre": "Planning source", "fichier": "Planning/source.pdf"}],
        "themes": [{"id": "thermique", "titre": "Thermique"}, {"id": "examens", "titre": "Examens"}],
        "phases": [
            {"id": "pre-rentree", "titre": "Pré-rentrée IWE1", "debut": "2026-09-23", "fin": "2026-10-02", "source": "source"},
            {"id": "formation", "titre": "Formation DU", "debut": "2026-10-05", "fin": "2027-02-26", "source": "source"}],
        "sujets": [
            {"id": "chauffer", "titre": "Traitements thermiques", "theme": "thermique", "code": "2.8", "supports": [{"cours": "th-01", "ancre": "calcul"}]},
            {"id": "sans-support", "titre": "Notion à documenter", "theme": "thermique", "supports": []},
            {"id": "examen", "titre": "Examen matériaux", "theme": "examens", "supports": []}],
        "seances": [
            {"id": "s1", "phase": "pre-rentree", "date": "2026-09-23", "sujet": "chauffer", "horaire": "08:00–12:30"},
            {"id": "s2", "phase": "pre-rentree", "date": "2026-09-28", "sujet": "chauffer", "horaire": "08:00–11:25"},
            {"id": "s3", "phase": "pre-rentree", "date": "2026-09-28", "sujet": "sans-support"},
            {"id": "s4", "phase": "formation", "date": "2027-01-12", "sujet": "examen", "horaire": "10:15–12:00"}]}
    (root / "planning-formation.json").write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
    return root, catalogue, plan


@pytest.fixture
def planning_project(project):
    return add_planning(project)


REPOSITORY = Path(__file__).resolve().parents[1]


def copy_real_project(destination, planning=False):
    """Copier les seules entrées du build réel, sans toucher aux sources locales."""
    from wiki.maintenance import build_inputs
    data = json.loads((REPOSITORY / "catalogue-cours.json").read_text(encoding="utf-8"))
    plan = json.loads((REPOSITORY / "planning-formation.json").read_text(encoding="utf-8")) if planning else None
    for name in sorted(build_inputs(data, plan)):
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(REPOSITORY / name, target)
    return data, plan
