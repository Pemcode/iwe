"""Applications d’entraînement : accessibles depuis le wiki, sans en devenir le centre."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import shutil
import threading

import pytest
from playwright.sync_api import expect, sync_playwright

from conftest import add_application, copy_real_project
from test_journeys import OFFLINE_ANALYTICS
from wiki.build import build

PAINTED = """c => { const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let n=0; for(let i=3;i<d.length;i+=16) if(d[i]>0) n++; return n; }"""


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve(output, hosting, mount_name):
    mount = hosting / mount_name if mount_name else hosting
    shutil.copytree(output, mount)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(hosting)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server, f"http://127.0.0.1:{server.server_port}/" + (mount_name + "/" if mount_name else "")


@pytest.fixture(params=["", "promo"])
def app_site(project, request):
    root, data = project
    add_application(root, data)
    server, base = serve(build(root), root / "hosting", request.param)
    with sync_playwright() as p:
        browser = p.chromium.launch(args=OFFLINE_ANALYTICS)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.set_default_timeout(4000)
        yield page, base
        browser.close()
    server.shutdown()
    server.server_close()


def test_application_opens_from_its_subject_and_returns_to_the_wiki(app_site):
    page, base = app_site
    page.goto(base + "matieres/thermique.html")
    training = page.locator("section").filter(has=page.get_by_role("heading", name="S’entraîner"))
    training.get_by_role("link", name="Quiz du préchauffage").click()
    expect(page.locator("#ecran")).to_have_text("Prêt à jouer")
    page.get_by_role("link", name="Jouer", exact=True).click()
    expect(page.locator("#ecran")).to_have_text("Partie en cours")
    page.get_by_role("button", name="Menu", exact=True).click()
    page.get_by_role("navigation", name="Navigation du wiki").get_by_role("link", name="Thermique", exact=True).click()
    expect(page.get_by_role("heading", level=1)).to_have_text("Thermique")
    page.goto(base + "index.html")
    page.get_by_label("Rechercher une notion, un cours ou une section").fill("quiz")
    result = page.locator("#wiki-results li").filter(has_text="Quiz du préchauffage")
    expect(result).to_contain_text("Application interactive")


def test_real_game_is_playable_under_the_published_subpath(tmp_path):
    copy_real_project(tmp_path)
    server, base = serve(build(tmp_path), tmp_path / "hosting", "iwe")
    errors = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(args=OFFLINE_ANALYTICS)
            page = browser.new_page(viewport={"width": 390, "height": 844})
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base + "matieres/rdm.html")
            page.get_by_role("link", name="Mohr Forge").click()
            expect(page.get_by_role("link", name="Histoire", exact=True)).to_be_visible()
            page.get_by_role("link", name="Histoire", exact=True).click()
            expect(page.locator(".episode-card")).to_have_count(12)
            page.get_by_role("link", name="Laboratoire", exact=True).click()
            expect(page.locator("#element-3d")).to_be_visible()
            assert page.locator("#element-3d").evaluate(PAINTED) > 300
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.get_by_role("button", name="Menu", exact=True).click()
            page.get_by_role("navigation", name="Navigation du wiki").get_by_role("link", name="Résistance des matériaux", exact=True).click()
            expect(page.get_by_role("heading", level=1)).to_have_text("Résistance des matériaux")
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
    assert not errors
