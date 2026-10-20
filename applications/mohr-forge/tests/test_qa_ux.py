"""Regression journeys found during the UI/UX QA pass."""
from playwright.sync_api import expect
from test_browser import page, server, solve


def test_skip_link_keeps_current_page_and_keyboard_focus(page):
    page.get_by_role('link', name='Laboratoire', exact=True).click()
    expect(page.locator('#element-3d')).to_be_visible()
    page.keyboard.press('Control+Home')
    page.locator('.skip').focus()
    page.keyboard.press('Enter')
    expect(page).to_have_url(page.url.split('#')[0] + '#laboratoire')
    expect(page.locator('main')).to_be_focused()
    expect(page.locator('#lab-mode')).to_be_visible()


def test_out_of_order_challenge_continues_to_missing_challenge(page):
    page.get_by_role('button', name='Continuer l’aventure').click()
    page.get_by_role('button', name='03 · Défi 3').click()
    solve(page, [120, 30])
    page.get_by_role('button', name='Vérifier ma réponse').click()
    page.get_by_role('button', name='Défi suivant').click()
    expect(page.get_by_role('heading', name='Une matrice à compléter')).to_be_visible()


def test_mobile_feedback_is_readable_without_hunting_below_viewport(page):
    page.set_viewport_size({'width': 390, 'height': 844})
    page.emulate_media(reduced_motion='reduce')
    page.get_by_role('button', name='Continuer l’aventure').click()
    solve(page, [-30])
    page.get_by_role('button', name='Vérifier ma réponse').click()
    expect(page.locator('#feedback')).to_contain_text('À retravailler')
    assert page.locator('#feedback').evaluate('(el) => { const b=el.getBoundingClientRect(); return b.top >= 0 && b.top < innerHeight-80; }')
    expect(page.locator('[name="a0"]')).to_have_attribute('aria-describedby', 'answer-status-0')
    expect(page.locator('#answer-status-0')).to_contain_text('À revoir')
    page.get_by_role('button', name='Corriger mes réponses').click()
    expect(page.locator('[name="a0"]')).to_be_focused()


def test_small_mobile_controls_and_labels_remain_usable(page):
    page.set_viewport_size({'width': 320, 'height': 740})
    page.get_by_role('button', name='Continuer l’aventure').click()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.get_by_role('link', name='Laboratoire', exact=True).click()
    assert page.locator('#lab-x').evaluate('el => parseFloat(getComputedStyle(el).fontSize) >= 16')
    # Effective SVG label size after its viewBox is scaled to the phone viewport.
    assert page.locator('#mohr-svg text').evaluate_all('els => els.every(el => parseFloat(getComputedStyle(el).fontSize) * el.getScreenCTM().a >= 10)')
    assert page.get_by_role('button', name='Cisaillement', exact=True).bounding_box()['height'] >= 44


def test_angle_can_be_entered_precisely_with_french_decimal(page):
    page.get_by_role('link', name='Laboratoire', exact=True).click()
    page.get_by_label('Angle en degrés').fill('22,5')
    expect(page.locator('#angle')).to_have_value('22.5')
    page.locator('#angle').fill('-15.25')
    expect(page.get_by_label('Angle en degrés')).to_have_value('-15.25')


def test_zero_tensor_has_distinct_ticks(page):
    page.get_by_role('link', name='Laboratoire', exact=True).click()
    for key in ['x', 'y', 'xy']:
        page.locator('#lab-' + key).fill('0')
    ticks = page.locator('#mohr-svg text[text-anchor="middle"]').all_text_contents()
    assert len(ticks) >= 3 and len(ticks) == len(set(ticks))


def test_keyboard_exam_dossier_focus(page):
    page.evaluate("""() => {
      const p=Progression.fresh(); for(let i=0;i<24;i++)Progression.complete(p,i,3);
      localStorage.setItem('mohr-forge-v1',JSON.stringify(p));
    }""")
    page.reload()
    page.get_by_role('link', name='Examen', exact=True).click()
    page.get_by_role('button', name='Commencer l’examen blanc').click()
    expect(page.locator('h1')).to_be_focused()
    page.get_by_role('button', name='Dossier suivant').click()
    expect(page.locator('h1')).to_be_focused()
    expect(page).to_have_title('Dossier B · Rosette sur une tôle soudée — Mohr Forge')


WIDE_FONTS = """document.addEventListener('DOMContentLoaded', () => {
  const style = document.createElement('style');
  style.textContent = "*{font-family:Verdana,'DejaVu Sans',sans-serif!important}";
  document.head.append(style);
})"""


def test_wide_fallback_fonts_do_not_overflow_small_phones(page):
    # Les runners Linux et de nombreux Android remplacent Segoe UI par des polices plus larges.
    page.set_viewport_size({'width': 320, 'height': 740})
    page.add_init_script(WIDE_FONTS)
    for route in ['campagne', 'laboratoire', 'histoire', 'histoire/1', 'carnet']:
        page.goto(page.url.split('#')[0] + '#' + route)
        page.reload()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), route
