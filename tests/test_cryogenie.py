"""Trouver le cours de cryogénie depuis le planning et poursuivre ses prérequis (S47)."""
import json
import re

from conftest import REPOSITORY, copy_real_project
from wiki.build import build, link
from wiki.catalogue import CourseHTML


def test_cryogenic_course_is_main_support_and_reachable_from_search(tmp_path):
    catalogue = json.loads((REPOSITORY / "catalogue-cours.json").read_text(encoding="utf-8"))
    courses = {course["id"]: course for course in catalogue["cours"]}
    assert "cryogenie-01" in courses, "Le cours de cryogénie doit être inscrit."
    _, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    course = courses["cryogenie-01"]
    url = "Cryogenie/01-aciers-cryogeniques.html"
    assert course["url"] == url

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    assert "../" + url in page("matieres/cryogenie.html").links
    assert url in page("planning.html").links
    topics = {topic["id"]: topic["supports"] for topic in plan["sujets"]}
    assert topics["2-13-acier-cryogenique"] == [
        {"cours": "cryogenie-01"}, {"cours": "inox-04", "ancre": "c4"},
        {"cours": "alliage-01", "ancre": "c6"}, {"cours": "alliage-02", "ancre": "c2"},
    ]
    assert topics["2-22-soudage-hetero"][0] == {"cours": "crmo-05"}
    for topic, anchor in [("2-22-soudage-hetero", "c4"),
                          ("2-22-soudage-hetero", "c5"),
                          ("2-23-essais-des-soudures", "c5")]:
        assert {"cours": "cryogenie-01", "ancre": anchor} in topics[topic]
        assert f"{url}#{anchor}" in page("planning.html").links
    for prerequisite in ("rupture-02", "alliage-01", "inox-01"):
        assert link(url, courses[prerequisite]["url"]) in page(url).links

    search = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    excerpts = (output / "assets/chat-extraits.json").read_text(encoding="utf-8")
    for chapter in range(1, 6):
        assert any(row["cours_id"] == "cryogenie-01" and row["url"] == f"{url}#c{chapter}" for row in search)
        assert f"CRYOGENIE-01-C{chapter}" in excerpts
    source = (REPOSITORY / course["fichier"]).read_text(encoding="utf-8")
    built = (output / url).read_text(encoding="utf-8")
    for script in re.findall(r"<script\b[^>]*>.*?</script>", source, re.S):
        assert script in built, "L’intégration doit conserver les scripts du cours."
