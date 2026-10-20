"""Laboratoire 3D : sentir l'élément, le cercle et les cas de soudage par la manipulation."""
from playwright.sync_api import expect
from test_browser import page, server

PAINTED = """c => { const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let n=0; for(let i=3;i<d.length;i+=16) if(d[i]>0) n++; return n; }"""


def open_lab(page):
    page.get_by_role('link', name='Laboratoire', exact=True).click()
    expect(page.locator('#element-3d')).to_be_visible()


def test_element_is_drawn_and_orbits_by_drag_keyboard_and_preset_view(page):
    open_lab(page)
    canvas = page.locator('#element-3d')
    assert canvas.evaluate(PAINTED) > 500
    expect(canvas).to_have_attribute('role', 'img')
    yaw = float(canvas.get_attribute('data-yaw'))
    box = canvas.bounding_box()
    page.mouse.move(box['x'] + 25, box['y'] + 25)
    page.mouse.down()
    page.mouse.move(box['x'] + 125, box['y'] + 55, steps=6)
    page.mouse.up()
    assert abs(float(canvas.get_attribute('data-yaw')) - yaw) > 20
    before = float(canvas.get_attribute('data-pitch'))
    canvas.focus()
    page.keyboard.press('ArrowDown')
    assert float(canvas.get_attribute('data-pitch')) != before
    page.emulate_media(reduced_motion='reduce')
    page.get_by_role('button', name='Vue de face').click()
    expect(canvas).to_have_attribute('data-yaw', '0.0')
    expect(canvas).to_have_attribute('data-pitch', '0.0')


def test_traction_shows_poisson_contraction_and_real_scale_hides_it(page):
    open_lab(page)
    page.get_by_role('button', name='Traction', exact=True).click()
    strains = page.locator('#lab-hud')
    expect(strains).to_contain_text('εx = 571,43 µε')
    expect(strains).to_contain_text('εy = −171,43 µε')
    expect(strains).to_contain_text('εz = −171,43 µε')
    expect(page.locator('#element-3d-desc')).to_contain_text('amplifiée')
    page.get_by_role('button', name='Échelle réelle').click()
    expect(page.locator('#amp-badge')).to_contain_text('× 1')
    expect(page.locator('#element-3d-desc')).to_contain_text('échelle réelle')


def test_align_on_principal_directions_cancels_shear(page):
    page.emulate_media(reduced_motion='reduce')
    open_lab(page)
    page.get_by_role('button', name='Aligner sur les directions principales').click()
    expect(page.get_by_label('Angle en degrés')).to_have_value('18.43')
    expect(page.locator('#rotated-values')).to_contain_text('τ signé = 0 MPa')
    expect(page.locator('#rotated-values')).to_contain_text('σn = 130 MPa')


def test_dragging_the_mohr_point_turns_the_facet(page):
    open_lab(page)
    svg = page.locator('#mohr-svg').bounding_box()
    circle = page.locator('#mohr-svg circle.mohr-circle').first
    cx, cy, r = (float(circle.get_attribute(a)) for a in ('cx', 'cy', 'r'))
    handle = page.locator('#mohr-svg .mohr-handle').bounding_box()
    page.mouse.move(handle['x'] + handle['width'] / 2, handle['y'] + handle['height'] / 2)
    page.mouse.down()
    page.mouse.move(svg['x'] + cx + r * 0.3, svg['y'] + cy - r * 0.9, steps=4)
    page.mouse.move(svg['x'] + cx, svg['y'] + cy - r, steps=4)
    page.mouse.up()
    angle = float(page.get_by_label('Angle en degrés').input_value())
    assert abs(angle + 26.57) < 1.5, angle
    expect(page.locator('#rotated-values')).to_contain_text('τ signé = 50 MPa')


def test_arbitrary_facet_in_three_dimensions_reaches_absolute_max_shear(page):
    open_lab(page)
    page.locator('#lab-mode').select_option('three')
    for key, value in [('x', '150'), ('y', '75'), ('z', '0'), ('xy', '0'), ('xz', '0'), ('yz', '0')]:
        page.locator(f'#lab-{key}').fill(value)
    page.get_by_label('Angle en degrés').fill('0')
    page.get_by_label('Élévation ψ (degrés)').fill('45')
    expect(page.locator('#rotated-values')).to_contain_text('|τ| = 75 MPa')
    expect(page.locator('#mohr-svg .admissible')).to_have_count(1)


def test_restrained_bar_heats_into_stress_and_full_restraint_is_hydrostatic(page):
    open_lab(page)
    page.locator('#lab-mode').select_option('thermal')
    page.get_by_label('Échauffement ΔT (K)').fill('100')
    page.get_by_role('radio', name='Bridée selon x', exact=True).check()
    expect(page.locator('.value-cell').filter(has_text='σ3').locator('b')).to_have_text('−252')
    page.get_by_role('radio', name='Bridée selon x, y et z').check()
    expect(page.locator('.value-cell').filter(has_text='σVM').locator('b')).to_have_text('0')
    expect(page.locator('.value-cell').filter(has_text='Contrainte moyenne').locator('b')).to_have_text('−630')


def test_fillet_weld_check_reads_throat_stresses_on_the_facet(page):
    open_lab(page)
    page.get_by_role('button', name='Cordon d’angle', exact=True).click()
    page.get_by_label('Angle en degrés').fill('45')
    panel = page.locator('#weld-panel')
    expect(panel).to_contain_text('σ⊥ = 100 MPa')
    expect(panel).to_contain_text('τ⊥ = −80 MPa')
    expect(panel).to_contain_text('0,445')
    expect(panel).to_contain_text('0,296')


def test_every_lab_mode_fits_a_small_phone_without_script_errors(page):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_viewport_size({'width': 320, 'height': 740})
    open_lab(page)
    for mode in ['stress', 'strain', 'three', 'strainThree', 'thermal']:
        page.locator('#lab-mode').select_option(mode)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), mode
        assert page.locator('#element-3d').evaluate(PAINTED) > 300, mode
    assert not errors
