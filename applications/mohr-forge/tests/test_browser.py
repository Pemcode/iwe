"""User journeys, real Chromium; no network or external services."""
import functools
import http.server
import threading
from pathlib import Path

import pytest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def server():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT.parent))
    service = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=service.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{service.server_port}/{ROOT.name}/"
    service.shutdown()
    service.server_close()


@pytest.fixture
def page(server):
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.goto(server)
        yield page
        browser.close()


def solve(page, answers):
    for i, answer in enumerate(answers):
        field = page.locator(f'[name="a{i}"]')
        if field.evaluate("el => el.tagName") == "SELECT":
            field.select_option(str(answer))
        else:
            field.fill(str(answer).replace(".", ","))


def test_first_mission_wrong_answer_hint_reward_and_reload(page):
    page.get_by_role("button", name="Continuer l’aventure").click()
    expect(page.get_by_role("heading", name="Une matrice à compléter")).to_be_visible()
    page.locator('[name="a0"]').fill("-30")
    page.get_by_role("button", name="Vérifier ma réponse").click()
    expect(page.locator("#feedback")).to_contain_text("À retravailler")
    page.get_by_role("button", name="Un indice").click()
    page.locator('[name="a0"]').fill("30")
    page.get_by_role("button", name="Vérifier ma réponse").click()
    expect(page.locator("#feedback")).to_contain_text("Défi validé")
    assert page.locator("#xp").inner_text() == "85 XP"
    page.reload()
    assert page.locator("#xp").inner_text() == "85 XP"
    expect(page.locator("#feedback")).to_contain_text("Déjà maîtrisé")


def test_full_campaign_unlocks_exam_then_partial_grade(page):
    for idx in range(24):
        page.evaluate("id => { location.hash = '#atelier/' + id }", idx)
        expect(page.locator("#answer-form")).to_be_visible()
        answers = page.evaluate("id => Curriculum.exercise(id).fields.map(f => f.answer)", idx)
        solve(page, answers)
        page.get_by_role("button", name="Vérifier ma réponse").click()
        expect(page.locator("#feedback")).to_contain_text("Défi validé")
    assert page.locator("#xp").inner_text() == "2400 XP"
    page.get_by_role("link", name="Examen", exact=True).click()
    page.get_by_role("button", name="Commencer l’examen blanc").click()
    for dossier in range(3):
        answers = page.evaluate("n => Curriculum.exam(0)[n].fields.map(f => f.answer)", dossier)
        if dossier == 0:
            answers[0] = "0"
        solve(page, answers)
        if dossier < 2:
            page.get_by_role("button", name="Dossier suivant").click()
    page.get_by_role("button", name="Rendre ma copie").click()
    expect(page.locator("#exam-result")).to_contain_text("17 / 18")
    expect(page.locator("#exam-result")).to_contain_text("94")
    expect(page.get_by_role("button", name="Imprimer le bilan")).to_be_visible()


def test_lab_rotation_strain_3d_and_no_mobile_overflow(page):
    page.get_by_role("link", name="Laboratoire", exact=True).click()
    page.locator("#lab-mode").select_option("stress")
    for key, value in [("x", "100"), ("y", "0"), ("xy", "0")]:
        page.locator(f'#lab-{key}').fill(value)
        page.locator(f'#lab-{key}').dispatch_event("change")
    page.locator("#angle").fill("45")
    expect(page.locator("#rotated-values")).to_contain_text("−50")
    page.locator("#lab-mode").select_option("strain")
    expect(page.locator("#lab-results")).to_contain_text("γmax")
    page.locator("#lab-mode").select_option("three")
    assert page.locator("#mohr-svg circle.mohr-circle").count() == 3
    for route in ["#campagne", "#atelier/0", "#laboratoire", "#examen", "#carnet"]:
        page.set_viewport_size({"width": 390, "height": 844})
        page.evaluate("route => location.hash = route", route)
        page.wait_for_timeout(70)
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), route
    ROOT.joinpath("artifacts").mkdir(exist_ok=True)
    page.screenshot(path=str(ROOT / "artifacts/mobile-carnet.png"), full_page=True)


def test_locked_route_and_corrupt_storage_and_file_launch(page):
    page.evaluate("location.hash = '#atelier/12'")
    expect(page.locator("main")).to_contain_text("Atelier verrouillé")
    page.evaluate("localStorage.setItem('mohr-forge-v1', '{broken')")
    page.reload()
    expect(page.locator("#xp")).to_contain_text("0 XP")
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto((ROOT / "index.html").as_uri())
    expect(page.get_by_role("button", name="Continuer l’aventure")).to_be_visible()
    assert not errors
