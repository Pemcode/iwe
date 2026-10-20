"""Parcours de l'élève dans la carte, dans un vrai Chromium, sans réseau ni service extérieur."""
import functools
import http.server
import os
import re
import threading
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

import pytest

playwright = pytest.importorskip("playwright.sync_api")
from playwright.sync_api import expect, sync_playwright  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
CAPTURES = os.environ.get("CARTE_CAPTURES")


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="module")
def server():
    handler = functools.partial(Quiet, directory=str(REPO))
    service = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=service.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{service.server_port}/applications/carte-notions/index.html"
    service.shutdown()
    service.server_close()


@pytest.fixture(scope="module")
def browser():
    with sync_playwright() as pw:
        chromium = pw.chromium.launch()
        yield chromium
        chromium.close()


def open_map(browser, url, width=1440, height=900, init=None):
    context = browser.new_context(viewport={"width": width, "height": height})
    if init:
        context.add_init_script(init)
    page = context.new_page()
    page.errors = []
    page.on("pageerror", lambda e: page.errors.append(str(e)))
    page.on("console", lambda m: page.errors.append(m.text) if m.type == "error" else None)
    page.goto(url)
    page.wait_for_function("window.carte && window.carte.pret")
    return page


@pytest.fixture
def page(browser, server):
    page = open_map(browser, server)
    yield page
    assert page.errors == []
    page.context.close()


def heading(page):
    return page.locator("#fiche-titre")


def test_search_opens_the_card_and_neighbours_lead_further(page):
    page.locator("#toile").focus()
    page.keyboard.press("/")
    expect(page.locator("#recherche")).to_be_focused()
    page.keyboard.type("ferite")
    expect(page.locator("#suggestions [role=option]").first).to_contain_text("Ferrite")
    page.keyboard.press("Enter")
    expect(heading(page)).to_have_text("Ferrite")
    expect(page.locator("#fiche .definition").first).to_be_visible()
    neighbour = page.locator("#fiche .voisin-aller", has_text=re.compile(r"^Perlite"))
    expect(neighbour).to_be_visible()
    neighbour.click()
    expect(heading(page)).to_have_text("Perlite")
    assert page.evaluate("location.hash") == "#notion=perlite"
    page.keyboard.press("Escape")
    expect(page.locator("#fiche")).to_be_hidden()


def test_revision_links_open_real_course_sections(page):
    page.evaluate("carte.selectionner('martensite')")
    links = page.locator("#fiche .reviser a")
    expect(links.first).to_be_visible()
    for index in range(min(3, links.count())):
        href = links.nth(index).get_attribute("href")
        target = urlsplit(urljoin(page.url, href))
        path = REPO / unquote(target.path).lstrip("/")
        assert path.is_file(), href
        assert f'id="{unquote(target.fragment)}"' in path.read_text(encoding="utf-8")
        assert links.nth(index).get_attribute("target") == "_blank"


def test_zoom_buttons_wheel_and_fit(page):
    start = page.evaluate("carte.camera().k")
    page.locator("#zoom-plus").click()
    page.wait_for_function(f"carte.camera().k > {start} * 1.3")
    page.locator("#recadrer").click()
    page.wait_for_function(f"Math.abs(carte.camera().k - {start}) < {start} * 0.02")
    page.mouse.move(700, 450)
    page.mouse.wheel(0, -400)
    page.wait_for_function(f"carte.camera().k > {start} * 1.2")


def test_clicking_a_notion_on_the_map_opens_its_card(page):
    page.evaluate("carte.selectionner('martensite')")
    page.wait_for_function("!carte.etat().enVol")
    page.keyboard.press("Escape")
    x, y = page.evaluate("carte.ecranDe('martensite')")
    page.mouse.click(x, y)
    expect(heading(page)).to_have_text("Martensite")


def test_deep_link_theme_memory_and_blocked_storage(browser, server):
    page = open_map(browser, server + "#notion=martensite")
    expect(heading(page)).to_have_text("Martensite")
    page.locator("#bouton-theme").click()
    assert page.evaluate("document.documentElement.dataset.theme") == "papier"
    page.reload()
    page.wait_for_function("window.carte && window.carte.pret")
    assert page.evaluate("document.documentElement.dataset.theme") == "papier"
    assert page.errors == []
    page.context.close()
    blocked = "Object.defineProperty(window, 'localStorage', {get() { throw new Error('bloqué'); }});"
    page = open_map(browser, server, init=blocked)
    page.evaluate("carte.selectionner('ferrite')")
    expect(heading(page)).to_have_text("Ferrite")
    page.locator("#bouton-theme").click()
    assert page.errors == []
    page.context.close()


def test_subject_filters_and_hubs(page):
    chip = page.locator("#legende [data-matiere='brasage']")
    chip.click()
    expect(chip).to_have_attribute("aria-pressed", "false")
    assert "brasage" in page.evaluate("carte.etat().matieresMasquees")
    page.locator("#legende [data-carrefours]").click()
    assert page.evaluate("carte.etat().carrefours") is True


def test_whole_map_is_reachable_with_the_keyboard(page):
    page.evaluate("carte.selectionner('zat')")
    first = page.locator("#fiche .voisin-aller").first
    first.focus()
    name = first.inner_text().split("\n")[0]
    page.keyboard.press("Enter")
    expect(heading(page)).to_have_text(name)


@pytest.mark.parametrize("width,height", [(360, 740), (390, 844), (768, 1024), (1280, 800), (1366, 768), (1440, 900)])
@pytest.mark.parametrize("theme", ["nuit", "papier"])
def test_layout_fits_every_screen_in_both_themes(browser, server, width, height, theme):
    init = f"try {{ localStorage.setItem('carte-notions-theme', '{theme}'); localStorage.setItem('carte-notions-accueil', 'vu'); }} catch (e) {{}}"
    page = open_map(browser, server, width, height, init)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    expect(page.locator("#recherche")).to_be_visible()
    page.evaluate("carte.selectionner('ferrite')")
    page.wait_for_function("!carte.etat().enVol")
    box = page.locator("#fiche").bounding_box()
    assert box["x"] >= 0 and box["x"] + box["width"] <= width + 0.5 and box["y"] + box["height"] <= height + 0.5
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    x, y = page.evaluate("carte.ecranDe('ferrite')")
    zone = page.evaluate("carte.zoneVisible()")
    assert zone["x"] <= x <= zone["x"] + zone["w"] and zone["y"] <= y <= zone["y"] + zone["h"]
    if CAPTURES:
        page.screenshot(path=str(Path(CAPTURES) / f"carte-{theme}-{width}x{height}.png"))
        page.keyboard.press("Escape")
        page.locator("#recadrer").click()
        page.wait_for_function("!carte.etat().enVol")
        page.screenshot(path=str(Path(CAPTURES) / f"carte-{theme}-{width}x{height}-vue.png"))
    assert page.errors == []
    page.context.close()

@pytest.mark.parametrize("width,height", [(390, 844), (1366, 768)])
def test_labels_stay_inside_the_map_while_panning(browser, server, width, height):
    page = open_map(browser, server, width, height,
                    "localStorage.setItem('carte-notions-accueil', 'vu')")
    # Observe the rectangles actually drawn, without changing the camera or placement.
    page.evaluate("""() => {
        const original = Rendu2D.Rendu2D.prototype.etiqueter;
        Rendu2D.Rendu2D.prototype.etiqueter = function(...args) {
            original.apply(this, args);
            window.drawnLabels = [...this.iles, ...this.etiquettes].map(e => e.rect);
        };
    }""")
    page.locator("#toile").focus()
    for key in ["ArrowUp"] * 5 + ["ArrowDown"] * 10:
        page.keyboard.press(key)
        rectangles = page.evaluate("() => { carte.ecranDe('ferrite'); return drawnLabels; }")
        assert all(0 <= r[0] <= r[2] <= width and 0 <= r[1] <= r[3] <= height
                   for r in rectangles), (key, rectangles)
    assert page.errors == []
    page.context.close()
