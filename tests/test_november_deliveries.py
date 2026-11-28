"""S49 : rejoindre les nouveaux supports depuis le planning et poursuivre la révision."""
import json
import re

from conftest import REPOSITORY, copy_real_project
from wiki.build import build, link
from wiki.catalogue import CourseHTML


DELIVERIES = {
    "conception-01": ("3-3-conception-des-joints", 6),
    "conception-02": ("3-3-conception-des-joints", 6),
    "fondamentaux-02": ("1-5-source-de-courant", 6),
    "fondamentaux-03": ("1-5-source-de-courant", 5),
    "arc-gaz-01": ("1-6-soudage-arc-gaz", 5),
    "arc-gaz-02": ("1-7-soudage-tig", 5),
    "arc-gaz-03": ("1-8-mig", 5),
    "arc-gaz-04": ("1-8-mig", 5),
    "arc-gaz-05": ("1-12-plasma", 5),
    "procedes-avances-01": ("1-11-soudage-resistance", 5),
    "procedes-avances-02": ("1-12-laser", 5),
    "procedes-avances-03": ("1-12-soudage-friction", 5),
    "flamme-coupage-02": ("1-13-coupage", 5),
}


def test_delivered_courses_planning_search_prerequisites_and_training(tmp_path):
    data = json.loads((REPOSITORY / "catalogue-cours.json").read_text(encoding="utf-8"))
    courses = {c["id"]: c for c in data["cours"]}
    assert DELIVERIES.keys() <= courses.keys(), "Inscrire les treize cours livrés."
    _, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)

    def page(url):
        parsed = CourseHTML()
        parsed.feed((output / url).read_text(encoding="utf-8"))
        return parsed

    search = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    excerpts = (output / "assets/chat-extraits.json").read_text(encoding="utf-8")
    topics = {t["id"]: t["supports"] for t in plan["sujets"]}
    for ident, (topic, chapters) in DELIVERIES.items():
        course = courses[ident]
        url = course["url"]
        assert course["statut"] == "disponible"
        assert course["ordre"] == int(ident[-2:])
        assert course["repere"] == f"Cours {ident[-2:]}"
        assert {"cours": ident} in topics[topic]
        assert url in page("planning.html").links
        assert "../" + url in page(f"matieres/{course['matiere']}.html").links
        for prerequisite in course["prerequis_conseilles"]:
            assert link(url, courses[prerequisite]["url"]) in page(url).links
        for chapter in range(1, chapters + 1):
            assert any(row["cours_id"] == ident and row["url"] == f"{url}#c{chapter}" for row in search)
            assert f"{ident}-c{chapter}".upper() in excerpts
        source = (REPOSITORY / course["fichier"]).read_text(encoding="utf-8")
        built = (output / url).read_text(encoding="utf-8")
        assert all(script in built for script in re.findall(r"<script\b[^>]*>.*?</script>", source, re.S))
    for topic, principal in [("1-7-soudage-tig", "arc-gaz-02"), ("1-8-mig", "arc-gaz-03"),
                             ("1-12-laser", "procedes-avances-02"), ("3-3-conception-des-joints", "conception-01")]:
        assert topics[topic][0] == {"cours": principal}
    app = next(a for a in data["applications"] if a["id"] == "atelier-joints")
    app_url = app["publication"] + "/index.html"
    assert "../" + app_url in page("matieres/conception.html").links
    for ident in ("conception-01", "conception-02"):
        assert link(courses[ident]["url"], app_url) in page(courses[ident]["url"]).links
    assert {p.relative_to(output / app["publication"]).as_posix() for p in (output / app["publication"]).rglob("*") if p.is_file()} == set(app["fichiers"])
    assert any(row["cours_id"] == "atelier-joints" and row["url"] == app_url for row in search)
