"""Parcours du contenu publié : les liens partagés restent utilisables."""
import json
import re
from pathlib import Path

from conftest import copy_real_project
from wiki.build import build, link
from wiki.catalogue import CourseHTML


RDM_04_URL = "RDM/04-directions-principales-mohr.html"


def test_rdm_04_is_reachable_from_subject_previous_course_search_and_route(tmp_path):
    # Construire le catalogue réel dans une copie, sans toucher aux sources locales.
    copy_real_project(tmp_path)
    output = build(tmp_path)
    assert (output / RDM_04_URL).is_file(), "Le cours RDM 04 doit être publié."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    assert "../" + RDM_04_URL in page("matieres/rdm.html").links
    assert "04-directions-principales-mohr.html" in page("RDM/03-tenseur-deformations.html").links
    assert "03-tenseur-deformations.html" in page(RDM_04_URL).links
    assert "c4" in page(RDM_04_URL).ids
    assert "../" + RDM_04_URL + "#c4" in page("parcours/contraintes-residuelles.html").links
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    assert any(row["url"] == RDM_04_URL + "#c4" and "tricercle" in row["titre"].lower() for row in index)


def test_rdm_05_to_07_continue_series_and_are_reachable_from_planning(tmp_path):
    copy_real_project(tmp_path, planning=True)
    originals = {p.relative_to(tmp_path).as_posix(): p.read_bytes() for p in tmp_path.rglob("*") if p.is_file()}
    output = build(tmp_path)
    urls = {
        "rdm-05": "RDM/05-hooke-criteres-resistance.html",
        "rdm-06": "RDM/06-torseur-cohesion.html",
        "rdm-07": "RDM/07-diagrammes-sollicitations.html",
    }
    for url in urls.values():
        assert (output / url).is_file(), f"Le nouveau cours doit être publié : {url}"

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    subject = page("matieres/rdm.html")
    sequence = [RDM_04_URL, *urls.values()]
    for first, second in zip(sequence, sequence[1:]):
        assert Path(second).name in page(first).links
        assert Path(first).name in page(second).links
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    for ident, url, word in (("rdm-05", urls["rdm-05"], "von Mises"),
                            ("rdm-06", urls["rdm-06"], "cohésion"),
                            ("rdm-07", urls["rdm-07"], "charges réparties")):
        assert "../" + url in subject.links
        assert url in page("planning.html").links
        assert any(row["cours_id"] == ident and row["type"] == "section" and word in row["titre"] for row in index)
    plan = json.loads((tmp_path / "planning-formation.json").read_text(encoding="utf-8"))
    topics = {t["id"]: t for t in plan["sujets"]}
    rdm = topics["3-2-notions-fondamentales-de-rdm"]["supports"]
    assert {"rdm-05", "rdm-06", "rdm-07"} <= {s["cours"] for s in rdm}
    assert {"cours": "rdm-05", "ancre": "c6"} in topics["3-8-fatigue"]["supports"]
    assert urls["rdm-05"] + "#c6" in page("planning.html").links
    assert urls["rdm-06"] + "#c2" in page("planning.html").links
    assert urls["rdm-07"] + "#c5" in page("planning.html").links
    assert all((tmp_path / name).read_bytes() == original for name, original in originals.items())


MOHR_FORGE = "RDM/mohr-forge/index.html"


def test_mohr_forge_is_published_with_rdm_without_taking_the_home_page(tmp_path):
    copy_real_project(tmp_path)
    output = build(tmp_path)
    game = output / "RDM/mohr-forge"
    for name in ("index.html", "assets/style.css", "js/scene3d.js", "js/story.js", "js/lab.js"):
        assert (game / name).is_file(), name
    assert not (game / "tests").exists() and not (game / "docs").exists() and not (output / "applications").exists()

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    assert "../" + MOHR_FORGE in page("matieres/rdm.html").links
    for url in ("RDM/02-tenseur-contraintes.html", "RDM/03-tenseur-deformations.html", RDM_04_URL, "RDM/05-hooke-criteres-resistance.html"):
        assert "mohr-forge/index.html" in page(url).links, url
    assert "mohr-forge/index.html" not in page("RDM/07-diagrammes-sollicitations.html").links
    assert not any("mohr-forge" in link for link in page("index.html").links)
    assert "../../matieres/rdm.html" in page(MOHR_FORGE).links
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    assert any(row["type"] == "application" and row["url"] == MOHR_FORGE and "Mohr" in row["mots_cles"] for row in index)


def test_rdm_08_is_reachable_and_preserves_the_interactive_source(tmp_path):
    data, _ = copy_real_project(tmp_path)
    output = build(tmp_path)
    url = "RDM/08-caracteristiques-sections.html"
    assert (output / url).is_file(), "Le cours RDM 08 doit être publié."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    assert "../" + url in page("matieres/rdm.html").links
    assert Path(url).name in page("RDM/07-diagrammes-sollicitations.html").links
    published = page(url)
    for prerequisite in ("04-directions-principales-mohr.html", "06-torseur-cohesion.html", "07-diagrammes-sollicitations.html"):
        assert prerequisite in published.links
    assert "#c3" in published.links
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    assert any(row["url"] == url + "#c3" and "Huygens" in row["titre"] for row in index)

    source_path = next(c["fichier"] for c in data["cours"] if c["id"] == "rdm-08")
    source_bytes = (tmp_path / source_path).read_bytes()
    assert source_bytes == (Path(__file__).resolve().parents[1] / source_path).read_bytes()
    source = source_bytes.decode("utf-8")
    original = CourseHTML()
    original.feed(source)
    assert original.ids <= published.ids
    html = (output / url).read_text(encoding="utf-8")
    scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
    assert scripts and all(script in html for script in scripts)


def test_relocated_sources_preserve_existing_bookmarks_and_scripts(tmp_path):
    data, _ = copy_real_project(tmp_path, planning=True)
    migrated_ids = {"met-base", "met-01", "met-02", "met-03"} | {f"rdm-{n:02}" for n in range(1, 9)}
    existing = [c for c in data["cours"] if c["id"] in migrated_ids and c["statut"] == "disponible"]
    originals = {c["id"]: (tmp_path / c["fichier"]).read_bytes() for c in existing}
    output = build(tmp_path)
    shared = ["Metallurgie/00-diagramme-plomb-etain.html", "Metallurgie/01-fer-carbone.html#s3",
              "Metallurgie/03-martensite-traitements-thermiques-soudage.html#s6",
              "RDM/04-directions-principales-mohr.html#c4", "RDM/08-caracteristiques-sections.html#c3"]
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    indexed = {row["url"] for row in index}
    for bookmark in shared:
        assert bookmark in indexed
        path, _, anchor = bookmark.partition("#")
        parser = CourseHTML()
        parser.feed((output / path).read_text(encoding="utf-8"))
        assert not anchor or anchor in parser.ids
    for course in existing:
        assert course["fichier"].startswith("Cours/")
        assert not (output / course["fichier"]).is_file()
        assert (tmp_path / course["fichier"]).read_bytes() == originals[course["id"]]
        published = (output / course["url"]).read_text(encoding="utf-8")
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", originals[course["id"]].decode("utf-8-sig"), flags=re.S)
        assert scripts and all(script in published for script in scripts)
    assert (output / MOHR_FORGE).is_file()
    assert not (output / "Cours/RDM").exists()
    assert not (output / "Cours/Metallurgie").exists()


def test_fatigue_courses_are_reachable_from_subject_planning_and_search(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    urls = ["Fatigue/01-cycles-chargement.html", "Fatigue/02-courbe-wohler.html",
            "Fatigue/03-amorcage-fissures.html", "Fatigue/04-propagation-loi-paris.html"]
    assert (output / "matieres/fatigue.html").is_file(), "La matière fatigue doit être accessible."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    assert "matieres/fatigue.html" in page("index.html").links
    for first, second in zip(urls, urls[1:]):
        assert Path(second).name in page(first).links
        assert Path(first).name in page(second).links
    courses = {c["id"]: c for c in data["cours"]}
    topic = next(t for t in plan["sujets"] if t["id"] == "3-8-fatigue")
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    for n, (url, anchor) in enumerate(zip(urls, ["c3", "c5", "c5", "c4"]), 1):
        ident = f"fatigue-{n:02}"
        assert "../" + url in page("matieres/fatigue.html").links
        assert url in page("planning.html").links
        assert {"cours": ident} in topic["supports"]
        assert any(row["cours_id"] == ident and row["type"] == "section" and row["url"] == url + "#" + anchor for row in index)
        course = courses[ident]
        source = (tmp_path / course["fichier"]).read_text(encoding="utf-8-sig")
        parsed = CourseHTML()
        parsed.feed(source)
        assert parsed.ids <= page(url).ids
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
        published = (output / url).read_text(encoding="utf-8")
        assert scripts and all(script in published for script in scripts)
    assert "../RDM/04-directions-principales-mohr.html" in page(urls[2]).links
    assert "../RDM/05-hooke-criteres-resistance.html" in page(urls[2]).links
    assert urls[0] + "#c6" in page("planning.html").links
    assert urls[2] + "#c5" in page("planning.html").links
    for prerequisite in urls[:3]:
        assert Path(prerequisite).name in page(urls[3]).links
    assert urls[3] + "#c2" in page("planning.html").links
    assert urls[3] + "#c3" in page("planning.html").links


def test_rupture_series_is_reachable_and_preserves_interactive_sources(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    urls = ["Rupture/01-rupture-ductile-fragile.html", "Rupture/02-charpy-transition-ductile-fragile.html",
            "Rupture/03-defauts-fissures-facteur-k.html", "Rupture/04-tenacite-ctod-j-fad.html"]
    assert (output / "matieres/rupture.html").is_file(), "La matière Mécanique de la rupture doit être publiée."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    assert "matieres/rupture.html" in page("index.html").links
    for first, second in zip(urls, urls[1:]):
        assert Path(second).name in page(first).links
        assert Path(first).name in page(second).links
    courses = {c["id"]: c for c in data["cours"]}
    topics = {t["id"]: t for t in plan["sujets"]}
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    for n, (url, anchor) in enumerate(zip(urls, ["c3", "c1", "c5", "c6"]), 1):
        ident = f"rupture-{n:02}"
        assert "../" + url in page("matieres/rupture.html").links
        assert url in page("planning.html").links
        topic = "2-7-ruptures-et-differents-types-de-rupture" if n <= 2 else "3-11-introduction-a-la-mecanique-de-la-rupture"
        assert {"cours": ident} in topics[topic]["supports"]
        assert any(row["cours_id"] == ident and row["type"] == "section" and row["url"] == url + "#" + anchor for row in index)
        source = (tmp_path / courses[ident]["fichier"]).read_text(encoding="utf-8-sig")
        parsed = CourseHTML()
        parsed.feed(source)
        assert parsed.ids <= page(url).ids
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
        published = (output / url).read_text(encoding="utf-8")
        assert scripts and all(script in published for script in scripts)
        for prerequisite in courses[ident]["prerequis_conseilles"]:
            target = courses[prerequisite]["url"]
            relative = Path(target).name if target.startswith("Rupture/") else "../" + target
            assert relative in page(url).links
    assert {"cours": "rupture-02"} in topics["2-23-essais-des-materiaux"]["supports"]
    assert {"cours": "rupture-02", "ancre": "c6"} in topics["2-23-essais-des-soudures"]["supports"]
    assert urls[3] + "#c3" in page("planning.html").links
    assert {"cours": "fatigue-04", "ancre": "c3"} in topics["3-11-introduction-a-la-mecanique-de-la-rupture"]["supports"]
    assert not (output / "Cours").exists()


def test_fluage_and_brasage_are_reachable_with_their_declared_sources(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    expected = [
        ("fluage-01", "fluage", "Fluage/01-courbe-mecanismes.html", "c3", "2-12-acier-resistant-au-fluage"),
        ("brasage-01", "brasage", "Brasage/01-principes-mouillage-capillarite.html", "c3", "1-16-brasage"),
        ("brasage-02", "brasage", "Brasage/02-oxydes-flux-atmospheres-apports.html", "c2", "1-16-brasage"),
        ("brasage-03", "brasage", "Brasage/03-procedes-mode-operatoire.html", "c3", "1-16-brasage"),
        ("brasage-04", "brasage", "Brasage/04-conception-metaux-controle.html", "c6", "1-16-brasage"),
    ]
    assert all((output / url).is_file() for _, _, url, _, _ in expected), "Les nouveaux cours de fluage et brasage doivent être publiés."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    courses = {c["id"]: c for c in data["cours"]}
    topics = {t["id"]: t for t in plan["sujets"]}
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    for ident, subject, url, anchor, topic in expected:
        assert f"matieres/{subject}.html" in page("index.html").links
        assert "../" + url in page(f"matieres/{subject}.html").links
        assert url in page("planning.html").links
        assert {"cours": ident} in topics[topic]["supports"]
        assert any(row["cours_id"] == ident and row["url"] == url + "#" + anchor for row in index)
        source = (tmp_path / courses[ident]["fichier"]).read_text(encoding="utf-8-sig")
        parsed = CourseHTML()
        parsed.feed(source)
        assert parsed.ids <= page(url).ids
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
        html = (output / url).read_text(encoding="utf-8")
        assert scripts and all(script in html for script in scripts)
    assert "02-oxydes-flux-atmospheres-apports.html" in page(expected[1][2]).links
    assert "01-principes-mouillage-capillarite.html" in page(expected[2][2]).links
    assert "../Metallurgie/00-diagramme-plomb-etain.html" in page(expected[1][2]).links
    assert "../Rupture/01-rupture-ductile-fragile.html" in page(expected[0][2]).links
    assert not (output / "Cours").exists()

    brasage_urls = [row[2] for row in expected if row[1] == "brasage"]
    for previous, following in zip(brasage_urls, brasage_urls[1:]):
        assert Path(following).name in page(previous).links
        assert Path(previous).name in page(following).links
    for n in (3, 4):
        for prerequisite in brasage_urls[:n-1]:
            assert Path(prerequisite).name in page(brasage_urls[n-1]).links


def test_electrode_enrobee_series_is_reachable_and_preserves_sources(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    urls = ["ElectrodeEnrobee/01-procede-111-poste-soudage.html",
            "ElectrodeEnrobee/02-arc-reglages.html",
            "ElectrodeEnrobee/03-electrodes-enrobages-etuvage.html",
            "ElectrodeEnrobee/04-preparer-souder-111.html",
            "ElectrodeEnrobee/05-qualite-defauts-securite.html"]
    assert all((output / url).is_file() for url in urls), "Les cinq cours d’électrode enrobée doivent être publiés."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    subject = "matieres/electrode-enrobee.html"
    assert subject in page("index.html").links
    courses = {c["id"]: c for c in data["cours"]}
    topic = next(t for t in plan["sujets"] if t["id"] == "1-9-soudage-a-lelectrode-enrobee")
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    for n, url in enumerate(urls, 1):
        ident = f"electrode-enrobee-{n:02}"
        assert "../" + url in page(subject).links
        assert url in page("planning.html").links
        assert {"cours": ident} in topic["supports"]
        for anchor in ("c1", "c2", "c3", "c4", "c5", "c6"):
            assert any(row["cours_id"] == ident and row["type"] == "section"
                       and row["url"] == url + "#" + anchor for row in index)
        source_path = courses[ident]["fichier"]
        source_bytes = (tmp_path / source_path).read_bytes()
        assert source_bytes == (Path(__file__).resolve().parents[1] / source_path).read_bytes()
        source = source_bytes.decode("utf-8-sig")
        parsed = CourseHTML()
        parsed.feed(source)
        assert parsed.ids <= page(url).ids
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
        published = (output / url).read_text(encoding="utf-8")
        assert scripts and all(script in published for script in scripts)
    for previous, following in zip(urls, urls[1:]):
        assert Path(following).name in page(previous).links
        assert Path(previous).name in page(following).links
    for n, prerequisites in ((2, [1]), (3, [1, 2]), (4, [2, 3]), (5, [1, 2, 3, 4])):
        for prerequisite in prerequisites:
            assert Path(urls[prerequisite-1]).name in page(urls[n-1]).links
    assert not any(row["cours_id"] == "electrode-enrobee-06" for row in index)
    assert not (output / "Cours").exists()


def test_arc_submerge_series_is_reachable_and_preserves_sources(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    urls = ["ArcSubmerge/01-procede-12-installation.html",
            "ArcSubmerge/02-flux-fils-metal-depose.html",
            "ArcSubmerge/03-parametres-forme-cordon.html",
            "ArcSubmerge/04-preparer-varier-controler.html"]
    assert all((output / url).is_file() for url in urls), "Les quatre cours d’arc submergé doivent être publiés."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    subject = "matieres/arc-submerge.html"
    assert subject in page("index.html").links
    courses = {c["id"]: c for c in data["cours"]}
    topic = next(t for t in plan["sujets"] if t["id"] == "1-10-arc-submerge")
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    for n, url in enumerate(urls, 1):
        ident = f"arc-submerge-{n:02}"
        assert "../" + url in page(subject).links
        assert url in page("planning.html").links
        assert {"cours": ident} in topic["supports"]
        for anchor in ("c1", "c2", "c3", "c4", "c5", "c6"):
            assert any(row["cours_id"] == ident and row["type"] == "section"
                       and row["url"] == url + "#" + anchor for row in index)
        course_rows = [row for row in index if row["cours_id"] == ident]
        assert all("sous flux" in row["mots_cles"] and "SAW" in row["mots_cles"] for row in course_rows)
        source_path = courses[ident]["fichier"]
        source_bytes = (tmp_path / source_path).read_bytes()
        assert source_bytes == (Path(__file__).resolve().parents[1] / source_path).read_bytes()
        source = source_bytes.decode("utf-8-sig")
        parsed = CourseHTML()
        parsed.feed(source)
        assert parsed.ids <= page(url).ids
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
        published = (output / url).read_text(encoding="utf-8")
        assert scripts and all(script in published for script in scripts)
        for prerequisite in courses[ident]["prerequis_conseilles"]:
            assert link(url, courses[prerequisite]["url"]) in page(url).links
    for previous, following in zip(urls, urls[1:]):
        assert Path(following).name in page(previous).links
        assert Path(previous).name in page(following).links
    assert courses["arc-submerge-02"]["prerequis_conseilles"] == ["arc-submerge-01"]
    assert {"arc-submerge-01", "arc-submerge-02"} <= set(courses["arc-submerge-03"]["prerequis_conseilles"])
    assert not any(row["cours_id"] == "arc-submerge-05" for row in index)
    assert not (output / "Cours").exists()


def test_essais_series_links_materials_and_weld_testing_without_losing_existing_supports(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    urls = ["Essais/01-traction-courbe-grandeurs.html",
            "Essais/02-durete-empreinte-metal.html",
            "Essais/03-examens-metallographiques.html"]
    assert all((output / url).is_file() for url in urls), "Les trois cours d’essais doivent être publiés."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    subject = "matieres/essais.html"
    assert subject in page("index.html").links
    courses = {c["id"]: c for c in data["cours"]}
    topics = {t["id"]: t for t in plan["sujets"]}
    materials = topics["2-23-essais-des-materiaux"]["supports"]
    welds = topics["2-23-essais-des-soudures"]["supports"]
    assert {"cours": "rupture-02"} in materials
    assert {"cours": "rupture-02", "ancre": "c6"} in welds
    index = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    for n, url in enumerate(urls, 1):
        ident = f"essais-{n:02}"
        assert "../" + url in page(subject).links
        assert url in page("planning.html").links
        assert url + "#c6" in page("planning.html").links
        assert {"cours": ident} in materials
        assert {"cours": ident, "ancre": "c6"} in welds
        for anchor in ("c1", "c2", "c3", "c4", "c5", "c6"):
            assert any(row["cours_id"] == ident and row["url"] == url + "#" + anchor for row in index)
        source = (tmp_path / courses[ident]["fichier"]).read_text(encoding="utf-8-sig")
        parsed = CourseHTML()
        parsed.feed(source)
        assert parsed.ids <= page(url).ids
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
        published = (output / url).read_text(encoding="utf-8")
        assert scripts and all(script in published for script in scripts)
        for prerequisite in courses[ident]["prerequis_conseilles"]:
            assert link(url, courses[prerequisite]["url"]) in page(url).links
    for previous, following in zip(urls, urls[1:]):
        assert Path(following).name in page(previous).links
        assert Path(previous).name in page(following).links
    assert "electrode-enrobee-05" in courses["essais-03"]["prerequis_conseilles"]
    assert not (output / "Cours").exists()


def test_inox_and_fontes_are_reachable_with_targeted_planning_links(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    expected = {
        "inox-01": ("Inox/01-carte-dangers-fissurations.html", "inox", 7),
        "inox-02": ("Inox/02-sigma-sensibilisation-rochage.html", "inox", 6),
        "fontes-01": ("Fontes/01-graphite-cementite-metallurgie.html", "fontes", 6),
    }
    assert all((output / url).is_file() for url, _, _ in expected.values()), (
        "Les deux cours inox et le premier cours fontes doivent être publiés."
    )

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    courses = {c["id"]: c for c in data["cours"]}
    topics = {t["id"]: t["supports"] for t in plan["sujets"]}
    search = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    for ident, (url, subject, chapters) in expected.items():
        subject_url = f"matieres/{subject}.html"
        assert subject_url in page("index.html").links
        assert "../" + url in page(subject_url).links
        assert url in page("planning.html").links
        for n in range(1, chapters + 1):
            assert any(row["cours_id"] == ident and row["url"] == f"{url}#c{n}" for row in search)
        source_path = courses[ident]["fichier"]
        source_bytes = (tmp_path / source_path).read_bytes()
        assert source_bytes == (Path(__file__).resolve().parents[1] / source_path).read_bytes()
        source = source_bytes.decode("utf-8-sig")
        parsed = CourseHTML()
        parsed.feed(source)
        assert parsed.ids <= page(url).ids
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
        published = (output / url).read_text(encoding="utf-8")
        assert scripts and all(script in published for script in scripts)
        for prerequisite in courses[ident]["prerequis_conseilles"]:
            assert link(url, courses[prerequisite]["url"]) in page(url).links

    assert {"cours": "inox-01"} in topics["2-15-aciers-inoxydables"]
    assert {"cours": "inox-02"} in topics["2-15-aciers-inoxydables"]
    assert {"cours": "fontes-01"} in topics["2-17-fontes"]
    supplements = {
        "2-6-fissuration": [("inox-01", f"c{n}") for n in range(3, 7)],
        "2-22-soudage-hetero": [("inox-01", "c1")],
        "2-5-structure-du-joint-soude": [("inox-01", "c2")],
        "2-14-introduction-a-la-corrosion": [("inox-02", "c5"), ("inox-02", "c6")],
        "2-8-traitements-thermiques-des-materiaux": [("inox-02", "c3")],
    }
    for topic, references in supplements.items():
        for ident, anchor in references:
            assert {"cours": ident, "ancre": anchor} in topics[topic]
            assert courses[ident]["url"] + "#" + anchor in page("planning.html").links
    assert {"cours": "met-03", "ancre": "s6"} in topics["2-6-fissuration"]
    assert {"cours": "met-03", "ancre": "s4"} in topics["2-5-structure-du-joint-soude"]
    first, second = (expected[f"inox-{n:02}"][0] for n in (1, 2))
    assert Path(second).name in page(first).links
    assert Path(first).name in page(second).links
    assert "inox-01" in courses["inox-02"]["prerequis_conseilles"]
    assert not (output / "Cours").exists()
    assert not any(source.get("publier", False) for source in plan["sources"])
