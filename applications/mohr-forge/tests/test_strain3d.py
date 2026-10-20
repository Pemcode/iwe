from playwright.sync_api import expect
from test_browser import page, server


def test_strain_tricircle_preserves_factor_two_in_three_dimensions(page):
    page.get_by_role('link', name='Laboratoire', exact=True).click()
    page.locator('#lab-mode').select_option('strainThree')
    page.get_by_role('button', name='Cisaillement', exact=True).click()
    assert page.locator('#mohr-svg circle.mohr-circle').count() == 3
    expect(page.locator('#lab-results')).to_contain_text('ε1')
    expect(page.locator('#lab-results')).to_contain_text('γmax 3D')
    gamma = page.locator('.value-cell').filter(has_text='γmax 3D')
    expect(gamma).to_contain_text('600')
    page.get_by_role('button', name='Isotrope', exact=True).click()
    expect(page.locator('.value-cell').filter(has_text='γmax 3D').locator('b')).to_have_text('0')
    expect(page.locator('.value-cell').filter(has_text='Trace ε').locator('b')).to_have_text('1\u202f800')
