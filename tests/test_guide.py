"""Guide pas à pas de l’assistant : page publiée et accès depuis l’accueil et le panneau de chaque page (S26)."""
import re

from wiki.build import build


def test_guide_page_has_six_anchored_steps_and_the_wiki_runtime(project):
    root, _ = project
    output = build(root)
    html = (output / "assistant.html").read_text(encoding="utf-8")
    assert "<h1>Réviser avec l’assistant IA</h1>" in html
    assert re.findall(r'id="(etape-\d)"', html) == [f"etape-{n}" for n in range(1, 7)]
    for anchor in ("confidentialite", "depannage"):
        assert f'id="{anchor}"' in html
    assert '<script id="wiki-chat" defer src="assets/chat-widget.js"></script>' in html
    assert '<link rel="stylesheet" href="assets/assistant.css">' in html
    assert 'href="https://openrouter.ai/"' in html
    assert html.count("data-chat-open") >= 3, "ouvrir l’assistant et préremplir des questions d’exemple"
    assert 'aria-label="Navigation du wiki"' in html
    assert (output / "assets/assistant.css").is_file()


def test_guide_is_reachable_from_the_home_page_and_from_the_panel_of_every_page(project):
    root, _ = project
    output = build(root)
    home = (output / "index.html").read_text(encoding="utf-8")
    assert re.search(r'<a class="[^"]*wiki-assistant-teaser[^"]*" href="assistant.html">', home)
    for page, href in {"index.html": "assistant.html", "matieres/thermique.html": "../assistant.html",
                       "Thermique/introduction.html": "../assistant.html"}.items():
        html = (output / page).read_text(encoding="utf-8")
        assert f'<a href="{href}" title="Assistant IA">' in html, page
    guide = (output / "assistant.html").read_text(encoding="utf-8")
    assert '<a href="assistant.html" title="Assistant IA" aria-current="page">' in guide
