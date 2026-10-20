import copy
import json

import pytest

from conftest import save_catalogue
from wiki.build import build, validate_site
from wiki.catalogue import CatalogueError, load_catalogue
from wiki.planning import load_planning


def save(root, plan):
    (root / "planning-formation.json").write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")


def test_timeline_builds_real_links_and_only_declared_pdf(planning_project):
    root, _, plan = planning_project
    plan["sources"][0]["publier"] = True
    save(root, plan)
    (root / "Planning/non-declare.pdf").write_bytes(b"not published")
    output = build(root)
    html = (output / "planning.html").read_text(encoding="utf-8")
    for expected in ('id="semaine-2026-40"', 'id="semaine-2027-02"', 'Thermique/introduction.html#calcul', 'Planning/source.pdf', '08:00–11:25', 'Notion à documenter'):
        assert expected in html
    assert (output / "Planning/source.pdf").is_file()
    assert not (output / "Planning/non-declare.pdf").exists()
    assert 'planning.html' in (output / 'index.html').read_text(encoding='utf-8')
    assert '../planning.html' in (output / 'Thermique/introduction.html').read_text(encoding='utf-8')
    assert validate_site(output) > 0


@pytest.mark.parametrize("error", ["date", "phase", "sujet", "cours", "ancre", "pdf", "pdf-absent", "doublon", "periode"])
def test_invalid_planning_blocks_build(planning_project, error):
    root, _, plan = planning_project
    if error == "date": plan["seances"][0]["date"] = "2026-02-30"
    if error == "phase": plan["seances"][0]["phase"] = "absente"
    if error == "sujet": plan["seances"][0]["sujet"] = "absent"
    if error == "cours": plan["sujets"][0]["supports"][0]["cours"] = "absent"
    if error == "ancre": plan["sujets"][0]["supports"][0]["ancre"] = "absente"
    if error == "pdf": plan["sources"][0]["fichier"] = "../prive.pdf"
    if error == "pdf-absent": plan["sources"][0].update(fichier="Planning/absent.pdf", publier=True)
    if error == "doublon": plan["seances"].append(copy.deepcopy(plan["seances"][0]))
    if error == "periode": plan["seances"][0]["date"] = "2027-09-23"
    save(root, plan)
    with pytest.raises(CatalogueError):
        build(root)


def test_planned_course_becomes_available_without_editing_planning(planning_project):
    root, catalogue, _ = planning_project
    catalogue["cours"][0]["statut"] = "a_venir"
    save_catalogue(root, catalogue)
    output = build(root)
    html = (output / "planning.html").read_text(encoding="utf-8")
    assert 'Thermique/introduction.html' not in html
    assert 'À venir' in html
    catalogue["cours"][0]["statut"] = "disponible"
    save_catalogue(root, catalogue)
    build(root)
    assert 'Thermique/introduction.html#calcul' in (output / "planning.html").read_text(encoding="utf-8")
    catalogue["cours"][0].update(statut="brouillon", titre="Contenu privé")
    save_catalogue(root, catalogue)
    build(root)
    html = (output / "planning.html").read_text(encoding="utf-8")
    assert 'Contenu privé' not in html and 'Thermique/introduction.html' not in html


def test_planning_is_optional_for_a_catalogue_without_schedule(project):
    root, _ = project
    assert load_planning(root, load_catalogue(root)) is None


def test_source_pdfs_stay_local_without_explicit_publication(planning_project):
    root, _, plan = planning_project
    output = build(root)
    assert not (output / "Planning/source.pdf").exists()
    html = (output / "planning.html").read_text(encoding="utf-8")
    assert 'href="Planning/source.pdf"' not in html
    assert 'Planning source' in html
    # La transcription suffit à la CI, sans les documents sources locaux.
    (root / "Planning/source.pdf").unlink()
    build(root)
