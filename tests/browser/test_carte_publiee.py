"""Explorer la carte publiée depuis le menu, puis rejoindre un cours (S36)."""
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
def published_map(tmp_path_factory):
    root=tmp_path_factory.mktemp('carte-publiee')
    copy_real_project(root, planning=True)
    output=build(root)
    host=root/'hosting'
    shutil.copytree(output, host)
    shutil.copytree(output, host/'iwe')
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self,*args): pass
    service=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(host)))
    threading.Thread(target=service.serve_forever,daemon=True).start()
    with sync_playwright() as pw:
        browser=pw.chromium.launch(args=OFFLINE_ANALYTICS)
        yield browser, f'http://127.0.0.1:{service.server_port}/'
        browser.close()
    service.shutdown();service.server_close()

@pytest.mark.parametrize('prefix',['','iwe/'])
@pytest.mark.parametrize('width,height',[(390,844),(1366,768)])
@pytest.mark.parametrize('theme',['nuit','papier'])
def test_menu_to_map_to_course(published_map,prefix,width,height,theme):
    browser,base=published_map;base+=prefix
    context=browser.new_context(viewport={'width':width,'height':height})
    context.add_init_script(f"localStorage.setItem('carte-notions-accueil','vu');localStorage.setItem('carte-notions-theme','{theme}')")
    page=context.new_page();errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base)
    if width<1000:page.locator('[data-wiki-panel=open]').click()
    shortcuts=page.locator('.wiki-panel-quick a').all_text_contents()
    assert shortcuts.index('Carte des notions') == shortcuts.index('Assistant IA')+1
    page.locator('.wiki-panel-quick').get_by_role('link',name='Carte des notions').click()
    page.wait_for_function('window.carte && carte.pret')
    expect(page).to_have_url(base+'carte-notions/index.html')
    assert page.evaluate('CARTE_NOTIONS.mode') == 'catalogue'
    page.locator('#recadrer').click()
    page.wait_for_function('!carte.etat().enVol')
    for expanded in ([False,True] if width>=1000 else [False]):
        if expanded:page.locator('[data-wiki-panel=fold]').click()
        page.locator('#recherche').fill('martensite')
        page.locator('#recherche').press('Enter')
        page.wait_for_function('!carte.etat().enVol')
        expect(page.locator('#fiche-titre')).to_have_text('Martensite')
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        canvas=page.locator('#toile').bounding_box()
        panel=page.locator('#wiki-panel').bounding_box()
        if width>=1000:
            assert canvas['x'] >= panel['x']+panel['width']-1
        # Actual mouse hit after conversion from canvas coordinates to viewport coordinates.
        x,y=page.evaluate("carte.ecranDe('martensite')")
        zone=page.evaluate('carte.zoneVisible()')
        assert zone['x']<=x<=zone['x']+zone['w'] and zone['y']<=y<=zone['y']+zone['h']
        page.keyboard.press('Escape')
        page.mouse.click(canvas['x']+x,canvas['y']+y)
        expect(page.locator('#fiche-titre')).to_have_text('Martensite')
        with page.expect_popup() as opened:
            page.locator('#fiche .reviser a').first.click()
        course=opened.value;course.wait_for_load_state('domcontentloaded')
        assert course.url.startswith(base) and '/Cours/' not in course.url
        assert course.evaluate('!!document.getElementById(decodeURIComponent(location.hash.slice(1)))')
        course.close()
    if width<1000:
        page.locator('[data-wiki-panel=open]').click()
        expect(page.locator('.wiki-panel-quick a[aria-current=page]')).to_have_text('Carte des notions')
        page.locator('[data-wiki-panel=close]').first.click()
    assert errors==[]
    context.close()

def test_map_labels_avoid_fixed_panels(published_map):
    browser, base = published_map
    context=browser.new_context(viewport={'width':1366,'height':768})
    context.add_init_script("localStorage.setItem('carte-notions-accueil','vu')")
    page=context.new_page();page.goto(base+'carte-notions/index.html')
    page.wait_for_function('window.carte && carte.pret')
    conflicts=page.evaluate("""() => {
        const original=Rendu2D.Rendu2D.prototype.etiqueter;
        let labels=[];
        Rendu2D.Rendu2D.prototype.etiqueter=function(...args){
            original.apply(this,args);labels=[...this.iles,...this.etiquettes].map(e=>e.rect);
        };
        carte.ecranDe('ferrite');
        const canvas=document.getElementById('toile').getBoundingClientRect();
        const panels=['#legende','#marque','.recherche','.outils','.navigation-carte']
            .map(s=>document.querySelector(s)).filter(p=>p.getClientRects().length)
            .map(p=>{const r=p.getBoundingClientRect();return [r.left-canvas.left,r.top-canvas.top,r.right-canvas.left,r.bottom-canvas.top]});
        return labels.filter(r=>panels.some(p=>r[0]<p[2]&&r[2]>p[0]&&r[1]<p[3]&&r[3]>p[1]));
    }""")
    assert conflicts == [], 'Une étiquette est cachée sous un panneau fixe.'
    context.close()
