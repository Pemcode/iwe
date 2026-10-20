"""Assistant de révision : extraits publiés pour le chat et widget présent partout (S25)."""
import copy
import json

from conftest import add_application, add_planning, save_catalogue
from wiki.build import ASSETS, build


def read_extracts(output):
    return {row["id"]: row for row in json.loads((output / "assets/chat-extraits.json").read_text(encoding="utf-8"))}


def test_extracts_give_each_section_a_stable_id_and_its_readable_text(project):
    root, _ = project
    rows = read_extracts(build(root))
    assert set(rows) == {"TH-01-INTRO", "TH-01-CALCUL"}
    intro = rows["TH-01-INTRO"]
    assert intro["url"] == "Thermique/introduction.html#intro"
    assert intro["titre"] == "Comprendre le préchauffage"
    assert intro["cours"] == "Préchauffage" and intro["matiere"] == "Thermique"
    assert intro["mots_cles"] == ["ZAT", "HAZ"]
    # Les blocs restent séparés, les indices restent collés au symbole.
    assert intro["texte"].splitlines()[:2] == ["Comprendre le préchauffage", "Une explication."]
    assert rows["TH-01-CALCUL"]["texte"].startswith("Le t8/5 en pratique")
    published = json.dumps(list(rows.values()), ensure_ascii=False)
    assert "Animation active" not in published, "le texte des scripts n’est pas un extrait"
    assert ".demo" not in published, "le texte des styles n’est pas un extrait"


def test_extracts_ignore_drafts_planned_courses_drawings_quiz_and_checklist(project):
    root, data = project
    source = root / data["cours"][0]["fichier"]
    source.write_text(source.read_text(encoding="utf-8").replace(
        "<p>Une explication.</p>", '<p>Une explication.</p><svg><text>Étiquette du schéma</text></svg>').replace(
        "</body>", '<section id="quiz-s"><h2>Quiz</h2><p>Question générée</p></section>'
                   '<section id="check"><h2>Suis-je prêt ?</h2><p>Je sais préchauffer.</p></section></body>'), encoding="utf-8")
    for ident, status in (("th-02", "a_venir"), ("secret", "brouillon")):
        course = copy.deepcopy(data["cours"][0])
        course.update(id=ident, titre=ident, statut=status, ordre=2, fichier=f"Thermique/{ident}.html")
        (root / course["fichier"]).write_text('<html><head></head><body><section id="c1"><h2>Note privée</h2>'
                                              '<p>Brouillon confidentiel</p></section></body></html>', encoding="utf-8")
        data["cours"].append(course)
    save_catalogue(root, data)
    output = build(root)
    text = (output / "assets/chat-extraits.json").read_text(encoding="utf-8")
    assert "Brouillon confidentiel" not in text and "Note privée" not in text
    assert "Étiquette du schéma" not in text
    assert "Question générée" not in text and "Je sais préchauffer" not in text, "quiz et check-list n’apportent pas de contenu"
    assert set(read_extracts(output)) == {"TH-01-INTRO", "TH-01-CALCUL"}


def test_chat_widget_is_loaded_once_on_every_kind_of_page(project):
    root, data, _ = add_planning(project)
    add_application(root, data)
    data["parcours"] = [{"id": "lier", "titre": "Relier", "etapes": [{"cours": "th-01", "ancre": "calcul"}]}]
    save_catalogue(root, data)
    output = build(root)
    pages = {"index.html": "assets/", "planning.html": "assets/", "matieres/thermique.html": "../assets/",
             "parcours/lier.html": "../assets/", "Thermique/introduction.html": "../assets/",
             "Thermique/quiz/index.html": "../../assets/"}
    for page, prefix in pages.items():
        html = (output / page).read_text(encoding="utf-8")
        tag = f'<script id="wiki-chat" defer src="{prefix}chat-widget.js"></script>'
        assert html.count(tag) == 1, page
        assert html.index(tag) < html.index("</head>"), page
    for asset in ("chat-widget.js", "chat-widget.css"):
        assert (output / "assets" / asset).read_bytes() == (ASSETS / asset).read_bytes()
