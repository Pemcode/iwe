import copy
import json
import re

import pytest

from conftest import add_application, save_catalogue
from wiki.build import build, validate_site
from wiki.catalogue import CatalogueError


def test_build_supports_new_subject_and_preserves_source(project):
    root, data = project
    source = root / data["cours"][0]["fichier"]
    before = source.read_bytes()
    output = build(root)
    assert source.read_bytes() == before
    assert (output / "index.html").is_file()
    subject = (output / "matieres/thermique.html").read_text(encoding="utf-8")
    assert "Thermique" in subject
    assert "../Thermique/introduction.html" in subject
    page = (output / "Thermique/introduction.html").read_text(encoding="utf-8")
    assert 'aria-label="Navigation du wiki"' in page
    assert "../matieres/thermique.html" in page
    assert "../index.html" in page
    for tag in ("script", "style"):
        for original in re.findall(r"<" + tag + r"\b[^>]*>.*?</" + tag + ">", before.decode(), re.S):
            assert original in page
    assert validate_site(output) > 0


def test_planned_and_draft_courses_are_never_published(project):
    root, data = project
    for ident, status in (("th-02", "a_venir"), ("secret", "brouillon")):
        course = copy.deepcopy(data["cours"][0])
        course.update(id=ident, titre=ident, statut=status, ordre=2, fichier="Thermique/"+ident+".html")
        (root / course["fichier"]).write_text("Ne pas publier", encoding="utf-8")
        data["cours"].append(course)
    (root / "notes-privees.txt").write_text("Privé", encoding="utf-8")
    save_catalogue(root, data)
    output = build(root)
    subject = (output / "matieres/thermique.html").read_text(encoding="utf-8")
    assert "À venir" in subject and "th-02" in subject
    assert "secret" not in subject
    assert not (output / "Thermique/th-02.html").exists()
    assert not (output / "Thermique/secret.html").exists()
    assert not (output / "notes-privees.txt").exists()
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    assert all(row["cours_id"] == "th-01" for row in index)


def test_build_uses_published_url_not_source_filename(project):
    root, data = project
    data["cours"][0]["url"] = "Thermique/stable.html"
    save_catalogue(root, data)
    output = build(root)
    assert (output / "Thermique/stable.html").is_file()
    assert not (output / "Thermique/introduction.html").exists()
    assert "../Thermique/stable.html" in (output / "matieres/thermique.html").read_text(encoding="utf-8")


def test_rebuild_removes_unpublished_courses(project):
    root, data = project
    output = build(root)
    data["cours"][0]["statut"] = "brouillon"
    save_catalogue(root, data)
    build(root)
    assert not (output / "Thermique/introduction.html").exists()


def test_build_is_deterministic(project):
    root, _ = project
    output = build(root)
    first = {p.relative_to(output): p.read_bytes() for p in output.rglob("*") if p.is_file()}
    build(root)
    assert first == {p.relative_to(output): p.read_bytes() for p in output.rglob("*") if p.is_file()}


def test_unmarked_output_is_never_deleted(project):
    root, _ = project
    output = root / "_site"
    output.mkdir()
    valuable = output / "important.txt"
    valuable.write_text("À conserver", encoding="utf-8")
    with pytest.raises(CatalogueError, match="sortie"):
        build(root)
    assert valuable.read_text(encoding="utf-8") == "À conserver"


@pytest.mark.parametrize("link", ['<a href="#absent">Lien</a>', '<img src="inconnu.png">'])
def test_broken_local_links_block_build(project, link):
    root, data = project
    source = root / data["cours"][0]["fichier"]
    source.write_text(source.read_text(encoding="utf-8").replace("</body>", link+"</body>"), encoding="utf-8")
    with pytest.raises(CatalogueError, match="lien"):
        build(root)


def test_declared_assets_are_copied(project):
    root, data = project
    image = root / "Thermique/schema.svg"
    image.write_text('<svg xmlns="http://www.w3.org/2000/svg"></svg>', encoding="utf-8")
    source = root / data["cours"][0]["fichier"]
    source.write_text(source.read_text(encoding="utf-8").replace("</body>", '<img src="schema.svg" alt="Schéma"></body>'), encoding="utf-8")
    data["cours"][0]["fichiers_associes"] = ["Thermique/schema.svg"]
    save_catalogue(root, data)
    assert (build(root) / "Thermique/schema.svg").read_bytes() == image.read_bytes()


@pytest.mark.skipif(__import__("os").name != "nt", reason="Attribut lecture seule des dossiers Windows/OneDrive")
def test_rebuild_tolerates_readonly_generated_directories(project):
    import stat
    root, _ = project
    output = build(root)
    asset_dir = output / "assets"
    asset_dir.chmod(stat.S_IREAD)
    try:
        build(root)
        assert (output / "index.html").is_file()
    finally:
        if asset_dir.exists():
            asset_dir.chmod(stat.S_IREAD | stat.S_IWRITE)


def test_application_is_published_from_declared_files_with_the_wiki_bar(project):
    root, data = project
    add_application(root, data)
    sources = {p: p.read_bytes() for p in (root / "applications").rglob("*") if p.is_file()}
    output = build(root)
    base = output / "Thermique/quiz"
    assert sorted(p.relative_to(base).as_posix() for p in base.rglob("*") if p.is_file()) == ["assets/app.css", "index.html", "js/app.js"]
    assert not (output / "applications").exists()
    assert {p: p.read_bytes() for p in sources} == sources
    page = (base / "index.html").read_text(encoding="utf-8")
    assert 'aria-label="Navigation du wiki"' in page
    assert "../../index.html" in page and "../../matieres/thermique.html" in page
    assert '<script defer src="js/app.js"></script>' in page and 'href="#jouer"' in page
    # Les routes internes (#jouer) ne sont pas des ancres de section : le contrôle des liens les accepte.
    assert validate_site(output) > 0


def test_application_is_reachable_without_taking_the_home_page(project):
    root, data = project
    add_application(root, data)
    output = build(root)
    home = (output / "index.html").read_text(encoding="utf-8")
    assert "quiz/index.html" not in home
    assert "1 application" in home
    subject = (output / "matieres/thermique.html").read_text(encoding="utf-8")
    assert "S’entraîner" in subject and "../Thermique/quiz/index.html" in subject
    course = (output / "Thermique/introduction.html").read_text(encoding="utf-8")
    assert "quiz/index.html" in course
    rows = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    app = [row for row in rows if row["type"] == "application"]
    assert [(row["titre"], row["url"]) for row in app] == [("Quiz du préchauffage", "Thermique/quiz/index.html")]


def test_draft_and_planned_applications_are_never_linked(project):
    root, data = project
    add_application(root, data, id="brouillon-jeu", titre="Brouillon secret", statut="brouillon", publication="Thermique/secret")
    add_application(root, data, id="jeu-futur", titre="Jeu futur", statut="a_venir", publication="Thermique/futur")
    output = build(root)
    subject = (output / "matieres/thermique.html").read_text(encoding="utf-8")
    assert "Brouillon secret" not in subject and not (output / "Thermique/secret").exists()
    assert "Jeu futur" in subject and "À venir" in subject and not (output / "Thermique/futur").exists()
    assert "futur/index.html" not in subject


def test_cloudflare_beacon_on_generated_pages_without_changing_sources(planning_project):
    root, data, _ = planning_project
    add_application(root, data)
    sources = {p: p.read_bytes() for p in root.rglob("*.html")}
    for _ in range(2):
        output = build(root)
        pages = list(output.rglob("*.html"))
        assert (output / "planning.html") in pages
        assert (output / "Thermique/quiz/index.html") in pages
        for page in pages:
            html = page.read_text(encoding="utf-8")
            scripts = re.findall(r"<script\b[^>]*data-cf-beacon[^>]*></script>", html)
            assert len(scripts) == 1, page
            assert 'type="module"' in scripts[0]
            assert 'src="https://static.cloudflareinsights.com/beacon.min.js"' in scripts[0]
            assert '265001f8626c4f3e82d7f823d55a1c33' in scripts[0]
            assert html.index(scripts[0]) < html.lower().rindex("</body>")
        assert all(p.read_bytes() == before for p, before in sources.items())
        assert 'data-cf-beacon' not in (output / "assets/recherche.json").read_text(encoding="utf-8")
