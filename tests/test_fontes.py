"""Accès à la série Fontes complète depuis le wiki (S30)."""
import json
import re
from pathlib import Path

from conftest import copy_real_project
from wiki.build import build, link
from wiki.catalogue import CourseHTML


def test_fontes_02_to_04_complete_series_from_planning_and_search(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    urls = ["Fontes/01-graphite-cementite-metallurgie.html",
            "Fontes/02-familles-nuances-designations-traitements.html",
            "Fontes/03-soudage-metallurgie-joint.html",
            "Fontes/04-soudage-pratique.html"]
    assert all((output / url).is_file() for url in urls), "Les quatre cours Fontes doivent être publiés."

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding="utf-8"))
        return parsed

    courses = {c["id"]: c for c in data["cours"]}
    topic = next(t for t in plan["sujets"] if t["id"] == "2-17-fontes")
    search = json.loads((output / "assets/recherche.json").read_text(encoding="utf-8"))
    excerpts = (output / "assets/chat-extraits.json").read_text(encoding="utf-8")
    assert "matieres/fontes.html" in page("index.html").links
    for previous, following in zip(urls, urls[1:]):
        assert Path(following).name in page(previous).links
        assert Path(previous).name in page(following).links
    for n, url in enumerate(urls, 1):
        ident = f"fontes-{n:02}"
        assert "../" + url in page("matieres/fontes.html").links
        assert url in page("planning.html").links
        assert {"cours": ident} in topic["supports"]
        if n == 1:
            continue
        assert f"fontes-{n-1:02}" in courses[ident]["prerequis_conseilles"]
        for prerequisite in courses[ident]["prerequis_conseilles"]:
            assert link(url, courses[prerequisite]["url"]) in page(url).links
        for chapter in range(1, 8 if n == 4 else 7):
            assert any(row["cours_id"] == ident and row["type"] == "section"
                       and row["url"] == f"{url}#c{chapter}" for row in search)
            assert f"FONTES-{n:02}-C{chapter}" in excerpts
        source_path = courses[ident]["fichier"]
        source_bytes = (tmp_path / source_path).read_bytes()
        assert source_bytes == (Path(__file__).resolve().parents[1] / source_path).read_bytes()
        source = source_bytes.decode("utf-8-sig")
        original = CourseHTML()
        original.feed(source)
        assert original.ids <= page(url).ids
        scripts = re.findall(r"<script\b[^>]*>.*?</script>", source, flags=re.S)
        published = (output / url).read_text(encoding="utf-8")
        assert scripts and all(script in published for script in scripts)
    assert not any(row["cours_id"] == "fontes-05" for row in search)
    assert not (output / "Cours").exists()
    assert not any(source.get("publier", False) for source in plan["sources"])
