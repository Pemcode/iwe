"""Parcourir la série Construction depuis le planning, puis ses prérequis (S48)."""
import json
import re

from conftest import REPOSITORY, copy_real_project
from wiki.build import build, link
from wiki.catalogue import CourseHTML


def test_construction_series_is_main_support_and_reachable_from_search(tmp_path):
    catalogue = json.loads((REPOSITORY / "catalogue-cours.json").read_text(encoding="utf-8"))
    courses = {course["id"]: course for course in catalogue["cours"]}
    assert {"construction-01", "construction-02"} <= courses.keys(), "Les deux cours Construction doivent être inscrits."
    _, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)

    def page(url):
        parsed = CourseHTML()
        parsed.feed((output / url).read_text(encoding="utf-8"))
        return parsed

    urls = ["Construction/01-aciers-non-allies.html", "Construction/02-aciers-hle.html"]
    search = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    excerpts = (output / "assets/chat-extraits.json").read_text(encoding="utf-8")
    topics = {topic["id"]: topic["supports"] for topic in plan["sujets"]}
    for number, (url, topic, prerequisites) in enumerate(zip(urls, [
        "2-9-aciers-carbone", "2-10-aciers-a-haute-resistance",
    ], [
        ["met-01", "alliage-01", "rupture-02", "met-03"],
        ["construction-01", "met-03", "alliage-01"],
    ]), 1):
        ident = f"construction-{number:02}"
        assert courses[ident]["url"] == url
        assert "../" + url in page("matieres/construction.html").links
        assert url in page("planning.html").links
        assert topics[topic][0] == {"cours": ident}
        assert {"cours": "alliage-01"} in topics[topic]
        for prerequisite in prerequisites:
            assert link(url, courses[prerequisite]["url"]) in page(url).links
        for chapter in range(1, 6):
            assert any(row["cours_id"] == ident and row["url"] == f"{url}#c{chapter}" for row in search)
            assert f"{ident}-c{chapter}".upper() in excerpts
        source = (REPOSITORY / courses[ident]["fichier"]).read_text(encoding="utf-8")
        built = (output / url).read_text(encoding="utf-8")
        for script in re.findall(r"<script\b[^>]*>.*?</script>", source, re.S):
            assert script in built, "Les scripts du cours doivent être conservés."
    assert link(urls[0], urls[1]) in page(urls[0]).links
    assert link(urls[1], urls[0]) in page(urls[1]).links
    for anchor in ("c1", "c5"):
        assert {"cours": "construction-02", "ancre": anchor} in topics["2-11-appl-aciers"]
        assert f"{urls[1]}#{anchor}" in page("planning.html").links
