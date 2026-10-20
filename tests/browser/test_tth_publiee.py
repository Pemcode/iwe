"""Ouvrir le laboratoire des traitements thermiques depuis le menu, puis rejoindre un cours (S37)."""
import functools
import http.server
import shutil
import threading
import pytest
from playwright.sync_api import sync_playwright, expect
from conftest import copy_real_project
from wiki.build import build
from test_journeys import OFFLINE_ANALYTICS


@pytest.fixture(scope='module')
def site_publie(tmp_path_factory):
    root = tmp_path_factory.mktemp('tth-publie')
    copy_real_project(root, planning=True)
    output = build(root)
    host = root / 'hosting'
    shutil.copytree(output, host)
    shutil.copytree(output, host / 'iwe')

    class Silencieux(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass
    service = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Silencieux, directory=str(host)))
    threading.Thread(target=service.serve_forever, daemon=True).start()
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=OFFLINE_ANALYTICS)
        yield browser, f'http://127.0.0.1:{service.server_port}/'
        browser.close()
    service.shutdown()
    service.server_close()


@pytest.mark.parametrize('prefix', ['', 'iwe/'])
@pytest.mark.parametrize('width,height', [(390, 844), (1366, 768)])
def test_menu_vers_le_laboratoire_puis_vers_un_cours(site_publie, prefix, width, height):
    browser, base = site_publie
    base += prefix
    context = browser.new_context(viewport={'width': width, 'height': height})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base)
    if width < 1000:
        page.locator('[data-wiki-panel=open]').click()
    shortcuts = page.locator('.wiki-panel-quick a').all_text_contents()
    assert shortcuts.index('Traitements thermiques') == shortcuts.index('Carte des notions') + 1
    page.locator('.wiki-panel-quick').get_by_role('link', name='Traitements thermiques').click()
    page.wait_for_function('window.labo && labo.pret')
    expect(page).to_have_url(base + 'traitements-thermiques/index.html#trempe-revenu-42crmo4')
    for ouvert in ([False, True] if width >= 1000 else [False]):
        if ouvert:
            page.locator('[data-wiki-panel=fold]').click()
        page.evaluate('labo.aller(0.5)')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        toile = page.locator('#toile').bounding_box()
        if width >= 1000:
            panneau = page.locator('#wiki-panel').bounding_box()
            assert toile['x'] >= panneau['x'] + panneau['width'] - 1, 'la toile passe sous le menu'
            assert page.evaluate('document.documentElement.scrollHeight <= innerHeight + 1'), 'lecture paysage : pas de défilement'
            assert toile['height'] >= 300
    # Un lien « Pour réviser » ouvre la bonne section du cours publié.
    page.get_by_role('tab', name='En savoir plus').click()
    with page.expect_popup() as opened:
        page.locator('#volet-savoir ul.reviser a').first.click()
    course = opened.value
    course.wait_for_load_state('domcontentloaded')
    assert course.url.startswith(base) and '/Cours/' not in course.url
    assert course.evaluate('!!document.getElementById(decodeURIComponent(location.hash.slice(1)))')
    course.close()
    if width < 1000:
        page.locator('[data-wiki-panel=open]').click()
        expect(page.locator('.wiki-panel-quick a[aria-current=page]')).to_have_text('Traitements thermiques')
        page.locator('[data-wiki-panel=close]').first.click()
    assert errors == []
    context.close()


def test_le_cours_lie_propose_le_laboratoire(site_publie):
    browser, base = site_publie
    page = browser.new_page(viewport={'width': 1366, 'height': 768})
    page.goto(base + 'Metallurgie/03-martensite-traitements-thermiques-soudage.html')
    lien = page.locator('.wiki-training-link a', has_text='Traitements thermiques')
    expect(lien).to_have_attribute('href', '../traitements-thermiques/index.html')
    lien.click()
    page.wait_for_function('window.labo && labo.pret')
    page.close()
