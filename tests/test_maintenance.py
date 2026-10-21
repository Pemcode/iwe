"""Parcours d'intégration et publication : vrais fichiers et dépôts Git locaux."""
import json
import subprocess

import pytest

from conftest import HTML, add_application, save_catalogue
from wiki.build import build, validate_site
from wiki.catalogue import CatalogueError, load_catalogue
from wiki.maintenance import register, publish


def read_json(root, name="catalogue-cours.json"):
    return json.loads((root / name).read_text(encoding="utf-8"))


def new_source(root, name="Thermique/nouveau.html", content=HTML):
    path = root / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return name


def test_register_new_subject_with_resources_and_planning(planning_project):
    root, _, _ = planning_project
    source = new_source(root, "Assemblage/demonstration.html", HTML.replace("</body>", '<img src="schema.svg" alt="Schéma"></body>'))
    (root / "Assemblage/schema.svg").write_text('<svg xmlns="http://www.w3.org/2000/svg"/>')
    before = (root / source).read_bytes()
    register(root, source, ident="asm-01", title="Assembler", subject="assemblage",
             subject_title="Assemblage", topics=["sans-support"], assets=["Assemblage/schema.svg"])
    data = load_catalogue(root)
    added = data["cours"][-1]
    assert added["url"] == "Assemblage/asm-01.html"
    assert added["matiere"] == "assemblage"
    assert (root / source).read_bytes() == before
    assert read_json(root, "planning-formation.json")["sujets"][1]["supports"] == [{"cours": "asm-01"}]
    output = build(root)
    assert (output / "Assemblage/schema.svg").is_file()
    assert "asm-01.html" in (output / "matieres/assemblage.html").read_text(encoding="utf-8")
    assert "Assemblage/asm-01.html" in (output / "planning.html").read_text(encoding="utf-8")
    assert validate_site(output) > 0


def test_activate_upcoming_course_keeps_identity_and_links(planning_project):
    root, data, plan = planning_project
    upcoming = dict(id="th-02", titre="Suite", matiere="thermique", ordre=2, repere="Cours 02",
                    statut="a_venir", url="Thermique/02-suite.html", prerequis_conseilles=["th-01"])
    data["cours"].append(upcoming)
    save_catalogue(root, data)
    plan["sujets"][0]["supports"].append({"cours": "th-02"})
    (root / "planning-formation.json").write_text(json.dumps(plan), encoding="utf-8")
    source = new_source(root)
    register(root, source, ident="th-02")
    added = read_json(root)["cours"][-1]
    assert added["url"] == upcoming["url"]
    assert added["titre"] == "Suite"
    assert added["prerequis_conseilles"] == ["th-01"]
    assert added["statut"] == "disponible"
    assert read_json(root, "planning-formation.json") == plan
    assert len(read_json(root)["cours"]) == 2


def test_pdf_has_shareable_page_and_original_download(planning_project):
    root, _, _ = planning_project
    pdf = root / "Thermique/Fiche élèves.pdf"
    pdf.write_bytes(b"%PDF-1.4\nDocument de test")
    register(root, pdf, ident="th-fiche", title="Fiche de synthèse", subject="thermique", topics=["chauffer"])
    added = read_json(root)["cours"][-1]
    assert added["fichiers_associes"] == ["Thermique/Fiche élèves.pdf"]
    output = build(root)
    page = (output / added["url"]).read_text(encoding="utf-8")
    assert "Télécharger le PDF" in page
    assert "Copier le lien" in page
    assert (output / added["fichiers_associes"][0]).read_bytes() == pdf.read_bytes()
    assert any(row["cours_id"] == "th-fiche" for row in read_json(output, "assets/recherche.json"))
    assert added["url"] in (output / "planning.html").read_text(encoding="utf-8")
    assert validate_site(output) > 0


@pytest.mark.parametrize("failure", ["missing-link", "unknown-topic", "duplicate", "private-planning", "wrapper-exists"])
def test_failed_registration_leaves_sources_and_metadata_untouched(planning_project, failure):
    root, _, _ = planning_project
    source = new_source(root)
    options = dict(ident="th-02", title="Suite", subject="thermique")
    if failure == "missing-link":
        (root / source).write_text(HTML.replace("</body>", '<img src="absent.png"></body>'), encoding="utf-8")
    elif failure == "unknown-topic":
        options["topics"] = ["inconnu"]
    elif failure == "duplicate":
        source = "Thermique/introduction.html"
    elif failure == "private-planning":
        source = "Planning/source.pdf"
    else:
        source = "Thermique/doc.pdf"
        (root / source).write_bytes(b"%PDF-1.4")
        new_source(root, "Supports/th-02.html", "À préserver")
    before = {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}
    with pytest.raises(CatalogueError):
        register(root, source, **options)
    after = {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*") if p.is_file()}
    assert after == before


def git(root, *args):
    result = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, encoding="utf-8")
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()


@pytest.fixture
def repository(project, tmp_path):
    root, _ = project
    remote = tmp_path.parent / (tmp_path.name + "-remote.git")
    git(root, "init", "--bare", str(remote))
    git(root, "init", "-b", "main")
    git(root, "config", "user.name", "Test IWE")
    git(root, "config", "user.email", "test@example.invalid")
    (root / ".gitignore").write_text("_site/\nPlanning/\n", encoding="utf-8")
    git(root, "add", ".")
    git(root, "commit", "-m", "Initial")
    git(root, "remote", "add", "origin", str(remote))
    git(root, "push", "-u", "origin", "main")
    return root, remote


def test_publish_includes_only_declared_content_and_runs_checks(repository, monkeypatch, capsys):
    root, remote = repository
    source = new_source(root)
    register(root, source, ident="th-02", title="Suite", subject="thermique")
    (root / "notes-personnelles.txt").write_text("Ne pas publier")
    calls = []
    monkeypatch.setattr("wiki.maintenance.prepare", lambda root: calls.append("checked"))
    publish(root, confirm=lambda message: "publier")
    assert calls == ["checked"]
    message = capsys.readouterr().out
    assert "https://github.com/Pemcode/iwe/actions" in message
    assert "https://pemcode.github.io/iwe/" in message
    files = git(remote, "ls-tree", "-r", "--name-only", "main").splitlines()
    assert source in files
    assert "notes-personnelles.txt" not in files
    assert not any(p.startswith("_site/") for p in files)
    assert git(root, "rev-parse", "HEAD") == git(remote, "rev-parse", "main")


@pytest.mark.parametrize("problem", ["staged", "code-change", "ahead-code", "declined", "checks-failed"])
def test_publish_never_pushes_unreviewed_changes(repository, monkeypatch, problem):
    root, remote = repository
    initial = git(remote, "rev-parse", "main")
    source = root / "Thermique/introduction.html"
    source.write_text(HTML + "\n<!-- Correction -->", encoding="utf-8")
    monkeypatch.setattr("wiki.maintenance.prepare", lambda root: None)
    if problem == "staged":
        (root / "personnel.txt").write_text("Privé", encoding="utf-8")
        git(root, "add", "personnel.txt")
    elif problem in {"code-change", "ahead-code"}:
        (root / "script.py").write_text("print('nouveau')")
        git(root, "add", "script.py")
        git(root, "commit", "-m", "Code à relire")
        if problem == "code-change":
            git(root, "push", "origin", "main")
            initial = git(remote, "rev-parse", "main")
            (root / "script.py").write_text("print('modifié')")
    elif problem == "checks-failed":
        def failed(root):
            raise CatalogueError("Tests en échec")
        monkeypatch.setattr("wiki.maintenance.prepare", failed)
    index_before = git(root, "diff", "--cached")
    if problem == "declined":
        publish(root, confirm=lambda message: "non")
    else:
        with pytest.raises(CatalogueError):
            publish(root, confirm=lambda message: "publier")
    assert git(remote, "rev-parse", "main") == initial
    assert git(root, "diff", "--cached") == index_before


def test_retry_push_of_content_commit(repository, monkeypatch):
    root, remote = repository
    (root / "Thermique/introduction.html").write_text(HTML + "\n<!-- Correction -->", encoding="utf-8")
    git(root, "add", "Thermique/introduction.html")
    git(root, "commit", "-m", "Support corrigé, push à reprendre")
    monkeypatch.setattr("wiki.maintenance.prepare", lambda root: None)
    publish(root, confirm=lambda message: "publier")
    assert git(root, "rev-parse", "HEAD") == git(remote, "rev-parse", "main")

def test_guided_menu_activates_announced_course(planning_project, monkeypatch, capsys):
    from wiki.routine import menu
    root, data, _ = planning_project
    data["cours"].append(dict(id="th-02", titre="Suite", matiere="thermique", ordre=2,
                              repere="Cours 02", statut="a_venir", url="Thermique/02-suite.html"))
    save_catalogue(root, data)
    source = new_source(root)
    answers = iter(["1", source, "1", "", "", "", "oui", "0"])
    monkeypatch.setattr("builtins.input", lambda _: next(answers))
    menu(root)
    assert read_json(root)["cours"][-1]["statut"] == "disponible"
    assert "Thermique/02-suite.html" in capsys.readouterr().out


def test_network_failure_can_be_retried_without_duplicate_commit(repository, monkeypatch):
    import wiki.maintenance as maintenance
    root, remote = repository
    initial = git(remote, "rev-parse", "main")
    (root / "Thermique/introduction.html").write_text(HTML + "\n<!-- Correction -->", encoding="utf-8")
    monkeypatch.setattr(maintenance, "prepare", lambda root: None)
    real_git = maintenance.git
    def disconnected(root, *args, **kwargs):
        if args[0] == "push":
            raise CatalogueError("Réseau indisponible")
        return real_git(root, *args, **kwargs)
    monkeypatch.setattr(maintenance, "git", disconnected)
    with pytest.raises(CatalogueError, match="commit reste local"):
        publish(root, confirm=lambda _: "publier")
    local_commit = git(root, "rev-parse", "HEAD")
    assert local_commit != initial
    assert git(remote, "rev-parse", "main") == initial
    monkeypatch.setattr(maintenance, "git", real_git)
    publish(root, confirm=lambda _: "publier")
    assert git(remote, "rev-parse", "main") == local_commit
    assert git(root, "rev-parse", "HEAD") == local_commit


def test_publication_checks_full_commit_history(repository, monkeypatch):
    root, remote = repository
    initial = git(remote, "rev-parse", "main")
    (root / "personnel.txt").write_text("Confidentiel", encoding="utf-8")
    git(root, "add", "personnel.txt")
    git(root, "commit", "-m", "Ajout local")
    git(root, "rm", "personnel.txt")
    git(root, "commit", "-m", "Retrait local")
    monkeypatch.setattr("wiki.maintenance.prepare", lambda root: None)
    with pytest.raises(CatalogueError, match="commits locaux"):
        publish(root, confirm=lambda _: "publier")
    assert git(remote, "rev-parse", "main") == initial


def test_ignored_source_cannot_be_registered(repository):
    root, _ = repository
    (root / ".gitignore").write_text("_site/\nThermique/prive.pdf\n", encoding="utf-8")
    (root / "Thermique/prive.pdf").write_bytes(b"%PDF-1.4")
    before = (root / "catalogue-cours.json").read_bytes()
    with pytest.raises(CatalogueError, match="exclu de Git"):
        register(root, "Thermique/prive.pdf", ident="th-doc", title="Document", subject="thermique")
    assert (root / "catalogue-cours.json").read_bytes() == before

def test_replacing_source_preserves_implicit_published_url(project):
    root, _ = project
    source = new_source(root)
    register(root, source, ident="th-01")
    course = read_json(root)["cours"][0]
    assert course["fichier"] == source
    assert course["url"] == "Thermique/introduction.html"


def test_registration_validates_a_complete_candidate_with_its_applications(project):
    root, data = project
    add_application(root, data)
    source = new_source(root)
    register(root, source, ident="th-02", title="Suite", subject="thermique")
    output = build(root)
    assert (output / "Thermique/quiz/index.html").is_file()
    assert (output / "Thermique/th-02.html").is_file()


def test_publish_leaves_application_code_to_the_development_circuit(repository, monkeypatch):
    root, remote = repository
    add_application(root, read_json(root))
    git(root, "add", ".")
    git(root, "commit", "-m", "Application")
    git(root, "push", "origin", "main")
    initial = git(remote, "rev-parse", "main")
    (root / "applications/quiz/js/app.js").write_text("// évolution de code à relire", encoding="utf-8")
    monkeypatch.setattr("wiki.maintenance.prepare", lambda root: None)
    with pytest.raises(CatalogueError, match="hors contenu"):
        publish(root, confirm=lambda message: "publier")
    assert git(remote, "rev-parse", "main") == initial
