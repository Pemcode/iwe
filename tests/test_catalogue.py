import copy

import pytest

from conftest import add_application, save_catalogue
from wiki.catalogue import CatalogueError, load_catalogue


def test_new_subject_and_current_html_are_indexed(project):
    root, data = project
    # Une ancienne liste de sections ne doit pas figer l'index.
    data["cours"][0]["sections"] = [{"ancre": "obsolete", "titre": "Ancien titre"}]
    save_catalogue(root, data)
    course = load_catalogue(root)["cours"][0]
    assert course["matiere"] == "thermique"
    assert course["sections"] == [
        {"ancre": "intro", "titre": "Comprendre le préchauffage"},
        {"ancre": "calcul", "titre": "Le t8/5 en pratique"},
    ]


def test_planned_and_draft_courses_need_no_file(project):
    root, data = project
    for status in ("a_venir", "brouillon"):
        item = copy.deepcopy(data["cours"][0])
        item.update(id=status.replace("_", "-"), statut=status, ordre=2)
        item.pop("fichier")
        data["cours"].append(item)
    save_catalogue(root, data)
    assert len(load_catalogue(root)["cours"]) == 3


@pytest.mark.parametrize("change, message", [
    ({"fichier": "Thermique/manquant.html"}, "introuvable"),
    ({"fichier": "../dehors.html"}, "chemin"),
    ({"fichier": "/absolu.html"}, "chemin"),
    ({"matiere": "inconnue"}, "matière"),
    ({"statut": "presque"}, "statut"),
    ({"prerequis_conseilles": ["absent"]}, "prérequis"),
    ({"prerequis_conseilles": ["th-01"]}, "prérequis"),
    ({"id": "../echappement"}, "identifiant"),
    ({"ordre": "premier"}, "ordre"),
    ({"fichiers_associes": ["Thermique/manquant.css"]}, "introuvable"),
])
def test_invalid_entries_fail_with_actionable_message(project, change, message):
    root, data = project
    data["cours"][0].update(change)
    save_catalogue(root, data)
    with pytest.raises(CatalogueError, match=message):
        load_catalogue(root)


@pytest.mark.parametrize("kind", ["id", "fichier"])
def test_duplicate_course_identity_or_file_is_rejected(project, kind):
    root, data = project
    other = copy.deepcopy(data["cours"][0])
    if kind == "fichier":
        other["id"] = "th-02"
    data["cours"].append(other)
    save_catalogue(root, data)
    with pytest.raises(CatalogueError, match="doublon"):
        load_catalogue(root)


def test_learning_path_must_point_to_an_existing_section(project):
    root, data = project
    data["parcours"] = [{"id": "apprendre", "titre": "Apprendre", "etapes": [{"cours": "th-01", "ancre": "absente"}]}]
    save_catalogue(root, data)
    with pytest.raises(CatalogueError, match="ancre"):
        load_catalogue(root)


def test_published_url_is_stable_when_source_filename_changes(project):
    root, data = project
    original = root / data["cours"][0]["fichier"]
    original.rename(original.with_name("nouveau cours.html"))
    data["cours"][0].update(fichier="Thermique/nouveau cours.html", url="Thermique/introduction.html")
    save_catalogue(root, data)
    assert load_catalogue(root)["cours"][0]["url"] == "Thermique/introduction.html"


def test_published_url_cannot_escape_output(project):
    root, data = project
    data["cours"][0]["url"] = "../danger.html"
    save_catalogue(root, data)
    with pytest.raises(CatalogueError, match="chemin"):
        load_catalogue(root)


def test_application_is_declared_by_subject_with_a_stable_address(project):
    root, data = project
    add_application(root, data)
    app = load_catalogue(root)["applications"][0]
    assert app["matiere"] == "thermique"
    assert app["url"] == "Thermique/quiz/index.html"


@pytest.mark.parametrize("change, message", [
    ({"matiere": "inconnue"}, "matière"),
    ({"statut": "presque"}, "statut"),
    ({"fichiers": ["index.html", "js/absent.js"]}, "introuvable"),
    ({"fichiers": ["index.html", "../dehors.js"]}, "chemin"),
    ({"source": "../ailleurs"}, "chemin"),
    ({"publication": "assets/quiz"}, "chemin"),
    ({"publication": "../quiz"}, "chemin"),
    ({"entree": "absente.html"}, "entrée"),
    ({"cours_lies": ["absent"]}, "cours lié"),
    ({"id": "th-01"}, "doublon"),
])
def test_invalid_application_fails_with_actionable_message(project, change, message):
    root, data = project
    add_application(root, data, **change)
    with pytest.raises(CatalogueError, match=message):
        load_catalogue(root)


def test_application_cannot_overwrite_a_published_course(project):
    root, data = project
    add_application(root, data, publication="Thermique", entree="introduction.html", fichiers=["introduction.html"])
    (root / "applications/quiz/introduction.html").write_text("<html><head></head><body>Jeu</body></html>", encoding="utf-8")
    with pytest.raises(CatalogueError, match="doublon"):
        load_catalogue(root)


def test_planned_or_draft_application_needs_no_file(project):
    root, data = project
    for status in ("a_venir", "brouillon"):
        add_application(root, data, id="jeu-" + status.replace("_", "-"), statut=status,
                        source="applications/absente", fichiers=[], publication="Thermique/" + status.replace("_", "-"))
    assert [a["statut"] for a in load_catalogue(root)["applications"]] == ["a_venir", "brouillon"]
