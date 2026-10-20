from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import shutil
import threading

import pytest
from playwright.sync_api import expect, sync_playwright

from wiki.build import build


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


# La mesure d’audience Cloudflare (S27) est un script externe : son domaine ne se résout pas dans les navigateurs de test.
# Les parcours ne dépendent donc pas du réseau, sans interception qui ralentirait les autres requêtes.
OFFLINE_ANALYTICS = ["--host-resolver-rules=MAP static.cloudflareinsights.com ~NOTFOUND"]


@pytest.fixture(params=["", "promo"])
def site(project, request):
    root, _ = project
    output = build(root)
    hosting = root / "hosting"
    mount = hosting / request.param if request.param else hosting
    shutil.copytree(output, mount)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(hosting)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    with sync_playwright() as p:
        browser = p.chromium.launch(args=OFFLINE_ANALYTICS)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.set_default_timeout(4000)
        yield page, f"http://127.0.0.1:{server.server_port}/" + (request.param+"/" if request.param else "")
        browser.close()
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


def test_find_unaccented_notion_and_open_exact_section(site):
    page, base = site
    page.goto(base)
    page.get_by_label("Rechercher une notion, un cours ou une section").fill("prechauffage")
    page.get_by_role("button", name="Rechercher", exact=True).click()
    result = page.locator("#wiki-results").get_by_role("link", name="Comprendre le préchauffage", exact=True)
    expect(result).to_be_visible()
    result.click()
    expect(page).to_have_url(base+"Thermique/introduction.html#intro")
    expect(page.get_by_text("Animation active", exact=True)).to_be_visible()
    page.get_by_role("button", name="Menu", exact=True).click()
    page.get_by_role("link", name="Thermique", exact=True).click()
    expect(page).to_have_url(base+"matieres/thermique.html")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_copy_and_share_include_current_section(site):
    page, base = site
    page.add_init_script("""Object.defineProperty(navigator, 'clipboard', {value: {writeText: async text => {window.copied = text;}}});
    Object.defineProperty(navigator, 'share', {value: async data => {window.shared = data;}});""")
    page.goto(base+"Thermique/introduction.html#calcul")
    page.get_by_role("button", name="Menu", exact=True).click()
    page.get_by_role("button", name="Copier le lien", exact=True).click()
    expect(page.locator("#wiki-share-status")).to_have_text("Lien copié.")
    assert page.evaluate("window.copied") == base+"Thermique/introduction.html#calcul"
    page.get_by_role("button", name="Partager", exact=True).click()
    page.wait_for_function("window.shared !== undefined")
    shared = page.evaluate("window.shared")
    assert shared["url"] == base+"Thermique/introduction.html#calcul"
    assert "Le t8/5 en pratique" in shared["text"]


def test_no_results_and_query_restoration(site):
    page, base = site
    page.goto(base+"?q=introuvable")
    expect(page.get_by_role("searchbox")).to_have_value("introuvable")
    expect(page.locator("#wiki-search-status")).to_contain_text("Aucun résultat")
    page.get_by_role("searchbox").fill("HAZ")
    page.get_by_role("button", name="Rechercher", exact=True).click()
    expect(page.locator("#wiki-results li").first).to_be_visible()
    page.reload()
    expect(page.get_by_role("searchbox")).to_have_value("HAZ")


def test_copy_fallback_without_clipboard(site):
    page, base = site
    page.add_init_script("Object.defineProperty(navigator, 'clipboard', {value: undefined});")
    page.goto(base+"Thermique/introduction.html#intro")
    page.get_by_role("button", name="Menu", exact=True).click()
    page.get_by_role("button", name="Copier le lien", exact=True).click()
    expect(page.get_by_role("textbox", name="Lien à copier", exact=True)).to_have_value(base+"Thermique/introduction.html#intro")


def test_share_section_without_preexisting_hash(site):
    page, base = site
    page.add_init_script("Object.defineProperty(navigator, 'share', {value: async data => {window.shared = data;}});")
    page.goto(base+"Thermique/introduction.html")
    page.locator("#calcul").get_by_role("button", name="Partager cette section", exact=True).click()
    page.wait_for_function("window.shared !== undefined")
    assert page.evaluate("window.shared.url") == base+"Thermique/introduction.html#calcul"
