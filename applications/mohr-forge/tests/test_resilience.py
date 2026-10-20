from playwright.sync_api import expect
from test_browser import page, server, solve


def test_exam_survives_reload_and_bad_answer_is_not_lost(page):
    page.evaluate("""() => {
      const p=Progression.fresh(); for(let i=0;i<24;i++)Progression.complete(p,i,3);
      localStorage.setItem('mohr-forge-v1',JSON.stringify(p));
    }""")
    page.reload()
    page.get_by_role('link', name='Examen', exact=True).click()
    page.get_by_role('button', name='Commencer l’examen blanc').click()
    page.locator('[name="a0"]').fill('123,4')
    page.get_by_role('button', name='Dossier suivant').click()
    page.reload()
    expect(page.get_by_role('heading', name='Dossier B · Rosette sur une tôle soudée')).to_be_visible()
    page.get_by_role('button', name='Dossier précédent').click()
    expect(page.locator('[name="a0"]')).to_have_value('123,4')


def test_storage_unavailable_keeps_game_playable(page):
    page.add_init_script("Object.defineProperty(window, 'localStorage', {get(){throw Error('blocked')}})")
    page.reload()
    expect(page.locator('#storage-notice')).to_be_visible()
    page.get_by_role('button', name='Continuer l’aventure').click()
    solve(page, [30])
    page.get_by_role('button', name='Vérifier ma réponse').click()
    expect(page.locator('#feedback')).to_contain_text('Défi validé')


def test_progress_export_and_import_validation(page, tmp_path):
    page.get_by_role('link', name='Carnet', exact=True).click()
    with page.expect_download() as pending:
        page.get_by_role('button', name='Exporter la progression').click()
    export = tmp_path / 'progress.json'
    pending.value.save_as(export)
    assert '"version": 1' in export.read_text(encoding='utf-8')
    invalid = tmp_path / 'invalid.json'
    invalid.write_text('{"version":1,"stars":{"0":999}}', encoding='utf-8')
    page.locator('#import-progress').set_input_files(str(invalid))
    expect(page.locator('#import-message')).to_contain_text('Format de progression non reconnu')
    page.on('dialog', lambda dialog: dialog.accept())
    page.locator('#import-progress').set_input_files(str(export))
    expect(page.locator('#toast')).to_contain_text('Progression importée')
