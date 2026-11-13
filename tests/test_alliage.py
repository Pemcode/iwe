"""Retrouver la série transversale Alliage depuis la matière et le planning (S45)."""
import json

from conftest import REPOSITORY, copy_real_project
from wiki.build import build, link
from wiki.catalogue import CourseHTML


def test_alliage_series_is_reachable_from_topics_and_search(tmp_path):
    catalogue = json.loads((REPOSITORY / "catalogue-cours.json").read_text(encoding="utf-8"))
    courses = {course["id"]: course for course in catalogue["cours"]}
    assert {"alliage-01", "alliage-02"} <= courses.keys(), "Les deux cours Alliage doivent être inscrits."
    _, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)

    def page(url):
        parsed = CourseHTML()
        parsed.feed((output / url).read_text(encoding="utf-8"))
        return parsed

    urls = ["Alliage/01-elements-aciers.html", "Alliage/02-elements-inox.html"]
    search = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    excerpts = (output / "assets/chat-extraits.json").read_text(encoding="utf-8")
    for number, url in enumerate(urls, 1):
        ident = f"alliage-{number:02}"
        assert courses[ident]["url"] == url
        assert "../" + url in page("matieres/alliage.html").links
        assert url in page("planning.html").links
        for chapter in range(1, 7):
            assert any(row["cours_id"] == ident and row["url"] == f"{url}#c{chapter}" for row in search)
            assert f"{ident}-c{chapter}".upper() in excerpts
        for prerequisite in courses[ident]["prerequis_conseilles"]:
            assert link(url, courses[prerequisite]["url"]) in page(url).links
    assert link(urls[0], urls[1]) in page(urls[0]).links
    assert link(urls[1], urls[0]) in page(urls[1]).links
    topics = {topic["id"]: topic["supports"] for topic in plan["sujets"]}
    for topic in ("2-9-aciers-carbone", "2-10-aciers-a-haute-resistance"):
        assert {"cours": "alliage-01"} in topics[topic]
    assert {"cours": "alliage-02"} in topics["2-15-aciers-inoxydables"]
    for topic, ident, anchor in [
        ("2-13-acier-cryogenique", "alliage-01", "c6"),
        ("2-13-acier-cryogenique", "alliage-02", "c2"),
        ("2-4-classification-des-aciers", "alliage-01", "c1"),
        ("2-6-fissuration", "alliage-01", "c5"),
    ]:
        assert {"cours": ident, "ancre": anchor} in topics[topic]
        assert f"{courses[ident]['url']}#{anchor}" in page("planning.html").links
