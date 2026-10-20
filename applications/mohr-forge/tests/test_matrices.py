"""Matrix positions, dimensions and readability across the learning journey."""
import pytest
from playwright.sync_api import expect
from test_browser import page, server


def unlock(page):
    page.evaluate("""() => {
        const p=Progression.fresh();
        for(let i=0;i<24;i++) Progression.complete(p,i,3);
        localStorage.setItem('mohr-forge-v1',JSON.stringify(p));
    }""")
    page.reload()


def check_matrix(table, rows):
    expect(table).to_be_visible()
    expect(table.get_by_role('row')).to_have_count(len(rows))
    for i, values in enumerate(rows):
        cells = table.get_by_role('row').nth(i).get_by_role('cell')
        expect(cells).to_have_text(values)
        boxes = cells.evaluate_all('els => els.map(el => ({x: el.getBoundingClientRect().x, y: el.getBoundingClientRect().y}))')
        assert len({round(b['y']) for b in boxes}) == 1
        assert len({round(b['x']) for b in boxes}) == len(values)
    positions = table.get_by_role('row').evaluate_all('els => els.map(el => el.getBoundingClientRect().y)')
    assert all(a < b for a, b in zip(positions, positions[1:]))
    assert table.locator('xpath=../..').evaluate('el => el.scrollWidth <= el.clientWidth')


@pytest.mark.parametrize('mission,rows', [
    (0, [['120', '30', '0'], ['?', '40', '0'], ['0', '0', '0']]),
    (2, [['120', '30', '0'], ['30', '40', '0'], ['0', '0', '0']]),
    (16, [['100', '20', '20'], ['20', '100', '20'], ['20', '20', '100']]),
])
def test_mission_matrices_keep_positions_on_small_phone(page, mission, rows):
    unlock(page)
    page.set_viewport_size({'width': 320, 'height': 740})
    page.goto(page.url.split('#')[0] + f'#atelier/{mission}')
    table = page.locator('.context').get_by_role('table', name='Matrice σ')
    check_matrix(table, rows)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    expect(page.locator('.context')).to_contain_text('MPa')
    if mission == 0:
        page.get_by_label('Composante σyx manquante (MPa)').fill('30')
        page.get_by_role('button', name='Vérifier ma réponse').click()
        expect(page.locator('#feedback')).to_contain_text('Bien joué')


def test_exam_report_and_text_export_keep_matrix(page, tmp_path):
    unlock(page)
    page.goto(page.url.split('#')[0] + '#examen')
    page.get_by_role('button', name='Commencer l’examen blanc').click()
    rows = [['160', '40', '0'], ['40', '100', '0'], ['0', '0', '40']]
    check_matrix(page.get_by_role('table', name='Matrice σ'), rows)
    for _ in range(2):
        page.get_by_role('button', name='Dossier suivant').click()
    page.get_by_role('button', name='Rendre ma copie').click()
    page.emulate_media(media='print')
    check_matrix(page.get_by_role('table', name='Matrice σ'), rows)
    page.emulate_media(media='screen')
    with page.expect_download() as download:
        page.get_by_role('button', name='Exporter le bilan').click()
    saved = tmp_path / 'bilan.txt'
    download.value.save_as(saved)
    text = saved.read_text(encoding='utf-8')
    assert 'σ =\n[ 160  40  0 ]\n[ 40  100  0 ]\n[ 0  0  40 ] MPa' in text
    assert '[object Object]' not in text and '<table' not in text


def test_notebook_and_live_lab_preserve_2d_and_3d_dimensions(page):
    page.set_viewport_size({'width': 320, 'height': 740})
    page.get_by_role('link', name='Carnet', exact=True).click()
    page.get_by_text('Lire la matière · aide-mémoire', exact=True).click()
    check_matrix(page.get_by_role('table', name='Matrice σ'), [
        ['σx', 'τxy', 'τxz'], ['τxy', 'σy', 'τyz'], ['τxz', 'τyz', 'σz']])
    page.get_by_text('Mesurer la déformation · aide-mémoire', exact=True).click()
    check_matrix(page.get_by_role('table', name='Matrice ε'), [['εx', 'γxy/2'], ['γxy/2', 'εy']])
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.get_by_role('link', name='Laboratoire', exact=True).click()
    check_matrix(page.get_by_role('table', name='Matrice σ'), [['120', '30'], ['30', '40']])
    page.locator('#lab-mode').select_option('three')
    page.locator('#lab-z').fill('0')
    page.locator('#lab-xz').fill('-12,5')
    check_matrix(page.get_by_role('table', name='Matrice σ'), [
        ['120', '30', '−12,5'], ['30', '40', '0'], ['−12,5', '0', '0']])
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
