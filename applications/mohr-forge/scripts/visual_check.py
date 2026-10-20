"""Audit the game as published by the wiki: captures, JS errors and assets, at root and under /iwe/."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
import shutil
import sys
import tempfile

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = ROOT.parents[1]
sys.path.insert(0, str(REPOSITORY))
from wiki.build import build  # noqa: E402  (le jeu est publié par le générateur du wiki)

ARTIFACTS = ROOT / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
GAME = 'RDM/mohr-forge/index.html'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


hosting = Path(tempfile.mkdtemp(prefix='mohr-forge-qa-'))
site = build(REPOSITORY)
for mount in ('racine', 'iwe'):
    shutil.copytree(site, hosting / mount)
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(hosting)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
report = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for width, height in [(1440, 1000), (768, 1024), (390, 844), (320, 740)]:
            page = browser.new_page(viewport={'width': width, 'height': height})
            errors = []
            bad_responses = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.on('response', lambda r: bad_responses.append(r.url) if r.status >= 400 else None)
            for mount in ('racine', 'iwe'):
                for route in ['campagne', 'atelier/0', 'laboratoire', 'histoire', 'histoire/1', 'examen', 'carnet']:
                    page.goto(f'{origin}/{mount}/{GAME}#{route}')
                    page.wait_for_timeout(100)
                    overflow = page.evaluate('document.documentElement.scrollWidth > innerWidth')
                    assert not overflow, (mount, route, width)
                    assert page.get_by_role('navigation', name='Navigation du wiki').count() == 1
                    if mount == 'iwe':
                        page.screenshot(path=str(ARTIFACTS / f'{route.replace("/", "-")}-{width}.png'), full_page=True)
                    report.append({'mount': mount, 'route': route, 'width': width, 'overflow': overflow})
            base = f'{origin}/iwe/{GAME}'
            page.goto(base + '#laboratoire')
            for mode in ['three', 'strainThree', 'thermal']:
                page.locator('#lab-mode').select_option(mode)
                if mode != 'thermal':
                    page.locator('#angle').fill('35')
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                page.screenshot(path=str(ARTIFACTS / f'{mode}-{width}.png'), full_page=True)
                report.append({'mount': 'iwe', 'route': 'laboratoire/' + mode, 'width': width, 'overflow': False})
            # Seed a completed course to inspect the active exam and its report at every width.
            page.evaluate("""() => {
                const p=Progression.fresh();for(let i=0;i<24;i++)Progression.complete(p,i,3);
                localStorage.setItem('mohr-forge-v1',JSON.stringify(p));
                localStorage.setItem('mohr-forge-exam-v1',JSON.stringify({
                    version:1,seed:0,index:0,started:Date.now(),submitted:false,
                    answers:Curriculum.exam(0).map(q=>q.fields.map(f=>String(f.answer)))
                }));
            }""")
            page.goto(base + '#examen')
            page.reload()  # A hash-only navigation does not rehydrate the seeded storage.
            for dossier in range(3):
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), ('exam', dossier, width)
                report.append({'mount': 'iwe', 'route': f'examen/dossier-{dossier+1}', 'width': width, 'overflow': False})
                if dossier == 0:
                    page.screenshot(path=str(ARTIFACTS / f'examen-actif-{width}.png'), full_page=True)
                page.get_by_role('button', name='Dossier suivant' if dossier < 2 else 'Rendre ma copie').click()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), ('exam-result', width)
            page.screenshot(path=str(ARTIFACTS / f'examen-bilan-{width}.png'), full_page=True)
            report.append({'mount': 'iwe', 'route': 'examen/bilan', 'width': width, 'overflow': False})
            assert not errors, errors
            assert not bad_responses, bad_responses
            page.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
    shutil.rmtree(hosting, ignore_errors=True)
(ARTIFACTS / 'visual-audit.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
print(f'{len(report)} vues verifiees : aucun debordement, aucune erreur JS ou ressource en erreur.')
