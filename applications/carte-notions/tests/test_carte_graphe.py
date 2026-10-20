"""Graphe des notions : lecture du corpus, co-occurrences, liens de définition et preuves."""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from carte_graphe import analyse, build_vocabulary, read_courses  # noqa: E402


def course_html(paragraphs, glossary=(), extra=""):
    chapters = "".join(f'<section id="c{i}"><h2>Chapitre {i}</h2>{"".join(f"<p>{p}</p>" for p in ps)}</section>'
                       for i, ps in enumerate(paragraphs, 1))
    gloss = "".join(f"<dt>{dt}</dt><dd>{dd}</dd>" for dt, dd in glossary)
    return (f"<!doctype html><html><head><title>T</title></head><body>{chapters}{extra}"
            f'<section id="gloss"><h2>Glossaire</h2><dl class="gloss">{gloss}</dl></section></body></html>')


@pytest.fixture
def project(tmp_path):
    def make(courses, local=()):
        catalogue = {"matieres": [{"id": "metallurgie", "titre": "Métallurgie"}, {"id": "procedes", "titre": "Procédés"}],
                     "cours": [], "parcours": [], "applications": []}
        for ident, subject, html, status in courses:
            path = tmp_path / "Cours" / subject / f"{ident}.html"
            path.parent.mkdir(parents=True, exist_ok=True)
            if html is not None:
                path.write_text(html, encoding="utf-8")
            catalogue["cours"].append({"id": ident, "matiere": subject, "titre": f"Cours {ident}", "statut": status,
                                       "fichier": f"Cours/{subject}/{ident}.html", "url": f"{subject}/{ident}.html",
                                       "mots_cles": [], "ordre": 1})
        for relative, html in local:
            path = tmp_path / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(html, encoding="utf-8")
        (tmp_path / "catalogue-cours.json").write_text(json.dumps(catalogue), encoding="utf-8")
        return tmp_path
    return make


def edge(graph, a, b):
    ids = {n["id"]: i for i, n in enumerate(graph["notions"])}
    i, j = sorted((ids[a], ids[b]))
    return next((e for e in graph["liens"] if (e["a"], e["b"]) == (i, j)), None)


GLOSSARY = [("Ferrite", "Fer cubique centré."), ("Austénite", "Fer cubique à faces centrées, voir ferrite."),
            ("Acier", "Alliage fer-carbone."), ("Bainite", "Constituant de trempe."), ("Martensite", "Constituant de trempe.")]


def test_frequent_word_does_not_dominate_npmi(project):
    paragraphs = [["La ferrite et l'austénite de cet acier."] * 3, ["Acier et bainite."] * 3,
                  ["Acier et martensite."] * 3, ["Acier seul."] * 3, ["La ferrite de l'acier."], ["L'austénite de l'acier."]]
    root = project([("met-01", "metallurgie", course_html(paragraphs, GLOSSARY), "disponible")])
    corpus = read_courses(root)
    graph = analyse(corpus, build_vocabulary(corpus, {}), {"chunk_words": 1})
    strong, weak = edge(graph, "ferrite", "austenite"), edge(graph, "ferrite", "acier")
    assert strong and strong["n"] == 3
    assert weak is None or weak["s"] < strong["s"]


def test_glossary_quiz_and_checklist_never_create_cooccurrences(project):
    extra = ('<section id="quiz-s"><h2>Quiz</h2><p>Bainite et martensite.</p></section>'
             '<section id="check"><h2>Check</h2><p>Bainite et martensite.</p></section>')
    html = course_html([["La bainite."], ["La martensite."]], GLOSSARY + [("Bainite, martensite", "Bainite et martensite.")], extra)
    root = project([("met-01", "metallurgie", html, "disponible")])
    corpus = read_courses(root)
    graph = analyse(corpus, build_vocabulary(corpus, {}), {"chunk_words": 1})
    link = edge(graph, "bainite", "martensite")
    assert link is None or link["n"] == 0


def test_definition_links_and_evidence_point_to_real_sections(project):
    html = course_html([["La ferrite et l'austénite."] * 2, ["Rien."]], GLOSSARY)
    root = project([("met-01", "metallurgie", html, "disponible")])
    corpus = read_courses(root)
    graph = analyse(corpus, build_vocabulary(corpus, {}), {"chunk_words": 1})
    link = edge(graph, "ferrite", "austenite")
    assert link["def"] and link["n"] == 2
    course = graph["cours"][link["preuves"][0][0]]
    assert course["sections"][link["preuves"][0][1]][0] == "c1"
    for notion in graph["notions"]:
        for course_index, section_index, count in notion["refs"]:
            assert graph["cours"][course_index]["sections"][section_index][0] not in {"gloss", "quiz-s", "check"}


def test_meaning_of_an_acronym_depends_on_the_subject(project):
    met = course_html([["Le réseau CC de la ferrite."] * 2], [("CC, CFC", "Cubique centré ; cubique à faces centrées.")] + GLOSSARY)
    proc = course_html([["Le poste délivre du CC à l'électrode."] * 2], [("CC", "Courant continu."), ("Électrode", "Baguette.")])
    root = project([("met-01", "metallurgie", met, "disponible"), ("proc-01", "procedes", proc, "disponible")])
    corpus = read_courses(root)
    curation = {"sens": {"CC": [{"libelle": "Courant continu", "matieres": ["procedes"]}, {"libelle": "Cubique centré", "matieres": ["*"]}]}}
    graph = analyse(corpus, build_vocabulary(corpus, curation), {"chunk_words": 1})
    labels = {n["label"]: n for n in graph["notions"]}
    assert "Courant continu" in labels and "Cubique centré" in labels and "CC" not in labels
    assert labels["Courant continu"]["matieres"][0][0] == "procedes"
    assert labels["Cubique centré"]["matieres"][0][0] == "metallurgie"


def test_only_available_catalogued_courses_unless_local_sources(project):
    good = course_html([["La ferrite et l'austénite."] * 2], GLOSSARY)
    root = project([("met-01", "metallurgie", good, "disponible"), ("met-02", "metallurgie", good, "brouillon"),
                    ("met-03", "metallurgie", None, "disponible")],
                   local=[("Cours/CrMo/CrMo, cours 1 _ chaleur et fluage.html", good)])
    corpus = read_courses(root)
    assert [c["id"] for c in corpus["cours"]] == ["met-01"] and corpus["mode"] == "catalogue"
    assert any("met-03" in w for w in corpus["avertissements"])
    local = read_courses(root, local=True)
    assert local["mode"] == "local"
    added = [c for c in local["cours"] if c["url"] is None]
    assert [(c["titre"], c["matiere"]) for c in added] == [("Chaleur et fluage", "crmo")]
    assert {m["id"] for m in local["matieres"]} >= {"metallurgie", "crmo"}
