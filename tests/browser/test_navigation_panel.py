"""Panneau latéral repliable et lecture paysage des cours (S21)."""
import pytest
from playwright.sync_api import expect

from test_journeys import site

LAB = """<div class="lab" id="m1"><p class="lab-h">Manipulation 1 : refroidir un cordon</p>
<p class="lab-sub">Règle l’énergie de soudage et observe la courbe de refroidissement.</p>
<div class="btns"><button class="btn" type="button">Acier S355</button><button class="btn" type="button">Inox</button></div>
<div class="ctrl"><label for="m1e">Énergie</label><input type="range" id="m1e"><output>1,0 kJ/mm</output></div>
<svg id="m1svg" viewBox="0 0 640 300" role="img" aria-label="Courbe de refroidissement"><rect x="1" y="1" width="638" height="298" fill="none" stroke="currentColor"/></svg>
<div class="readout"><span>t8/5 = 6 s</span></div><p class="status">Refroidissement modéré.</p></div>"""

DESKTOP = {"width": 1366, "height": 768}


@pytest.fixture
def project(project):
    """Un cours assez long pour défiler, avec une manipulation typique des séries."""
    root, data = project
    source = root / data["cours"][0]["fichier"]
    html = source.read_text(encoding="utf-8")
    html = html.replace("<p>Une explication.</p>", '<p>Une explication.</p><div style="height:1400px"></div>')
    html = html.replace('<p id="valeur"></p>', '<p id="valeur"></p>' + LAB + '<div style="height:1400px"></div>')
    source.write_text(html, encoding="utf-8")
    return root, data


def panel(page):
    return page.get_by_role("navigation", name="Navigation du wiki")


def test_desktop_panel_replaces_the_top_banner_and_stays_folded(site):
    page, base = site
    page.set_viewport_size(DESKTOP)
    page.goto(base + "Thermique/introduction.html")
    nav = panel(page)
    expect(nav).to_be_visible()
    expect(nav.get_by_role("link", name="Thermique", exact=True)).to_be_visible()
    expect(nav.get_by_role("link", name="Le t8/5 en pratique", exact=True)).to_be_visible()
    box = page.locator("#wiki-panel").bounding_box()
    assert box["x"] == 0 and box["height"] >= DESKTOP["height"] - 1
    heading = page.get_by_role("heading", name="Préchauffage", level=1).bounding_box()
    assert heading["x"] >= box["width"], "le contenu commence à droite du panneau"
    assert heading["y"] < 120, "aucun bandeau ne repousse le contenu vers le bas"
    page.get_by_role("button", name="Replier le menu").click()
    expect(nav.get_by_role("link", name="Le t8/5 en pratique", exact=True)).to_be_hidden()
    assert page.locator("#wiki-panel").bounding_box()["width"] <= 72
    page.reload()
    expect(nav.get_by_role("link", name="Le t8/5 en pratique", exact=True)).to_be_hidden()
    page.get_by_role("button", name="Déplier le menu").click()
    expect(nav.get_by_role("link", name="Le t8/5 en pratique", exact=True)).to_be_visible()
    page.reload()
    expect(nav.get_by_role("link", name="Le t8/5 en pratique", exact=True)).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_panel_highlights_the_section_being_read(site):
    page, base = site
    page.set_viewport_size(DESKTOP)
    page.goto(base + "Thermique/introduction.html")
    nav = panel(page)
    expect(nav.get_by_role("link", name="Comprendre le préchauffage", exact=True)).to_have_attribute("aria-current", "location")
    nav.get_by_role("link", name="Le t8/5 en pratique", exact=True).click()
    expect(page).to_have_url(base + "Thermique/introduction.html#calcul")
    expect(nav.get_by_role("link", name="Le t8/5 en pratique", exact=True)).to_have_attribute("aria-current", "location")
    expect(nav.get_by_role("link", name="Comprendre le préchauffage", exact=True)).not_to_have_attribute("aria-current", "location")


def test_phone_drawer_opens_closes_and_follows_links(site):
    page, base = site
    page.goto(base + "Thermique/introduction.html")
    nav = panel(page)
    expect(nav).to_be_hidden()
    menu = page.get_by_role("button", name="Menu", exact=True)
    menu.click()
    expect(nav).to_be_visible()
    page.keyboard.press("Escape")
    expect(nav).to_be_hidden()
    expect(menu).to_be_focused()
    menu.click()
    page.get_by_role("button", name="Fermer le menu").click()
    expect(nav).to_be_hidden()
    menu.click()
    nav.get_by_role("link", name="Le t8/5 en pratique", exact=True).click()
    expect(page).to_have_url(base + "Thermique/introduction.html#calcul")
    expect(nav).to_be_hidden()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_subject_pages_open_courses_from_the_panel(site):
    page, base = site
    page.set_viewport_size(DESKTOP)
    page.goto(base)
    nav = panel(page)
    expect(nav.get_by_role("link", name="Accueil", exact=True)).to_have_attribute("aria-current", "page")
    nav.get_by_text("Thermique", exact=True).click()
    nav.get_by_role("link", name="Préchauffage", exact=True).click()
    expect(page).to_have_url(base + "Thermique/introduction.html")
    search = page.get_by_label("Rechercher dans le wiki", exact=True)
    search.fill("HAZ")
    search.press("Enter")
    expect(page.locator("#wiki-results li").first).to_be_visible()
    expect(page.get_by_label("Rechercher une notion, un cours ou une section")).to_have_value("HAZ")


def test_landscape_course_shows_a_manipulation_side_by_side(site):
    page, base = site
    page.set_viewport_size(DESKTOP)
    page.goto(base + "Thermique/introduction.html#m1")
    drawing = page.locator("#m1svg").bounding_box()
    controls = page.locator("#m1 .ctrl").bounding_box()
    status = page.locator("#m1 .status").bounding_box()
    assert drawing["x"] + drawing["width"] <= controls["x"] + 1, "schéma à gauche, réglages à droite"
    assert controls["y"] < drawing["y"] + drawing["height"], "réglages à côté du schéma"
    assert status["y"] >= drawing["y"] + drawing["height"] - 1 and status["x"] < controls["x"], "commentaire sous le schéma"
    lab = page.locator("#m1").bounding_box()
    assert lab["height"] <= DESKTOP["height"], "la manipulation tient sur un écran"
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.set_viewport_size({"width": 390, "height": 844})
    page.reload()
    drawing = page.locator("#m1svg").bounding_box()
    controls = page.locator("#m1 .ctrl").bounding_box()
    assert drawing["y"] >= controls["y"] + controls["height"] - 1, "sur téléphone, la présentation d’origine est conservée"
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
