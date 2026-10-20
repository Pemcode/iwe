import pytest
from playwright.sync_api import expect
from test_journeys import site
from conftest import add_planning


@pytest.fixture
def project(project):
    root, catalogue, _ = add_planning(project)
    return root, catalogue


def today(page, when="2026-09-28T10:00:00+02:00"):
    page.add_init_script("const NativeDate=Date; window.Date=class extends NativeDate {constructor(...args){super(...(args.length?args:["+repr(when)+"]));} static now(){return new NativeDate("+repr(when)+").valueOf();}};")


def test_current_week_filters_and_opens_course(site):
    page, base = site
    today(page)
    page.goto(base+"planning.html")
    expect(page.get_by_label("Période", exact=True)).to_have_value("pre-rentree")
    expect(page.locator('#semaine-2026-40')).to_have_attribute('data-current', 'true')
    page.get_by_label("Avec supports disponibles").check()
    expect(page.get_by_text("Notion à documenter", exact=True)).to_be_hidden()
    page.locator('#semaine-2026-40').get_by_role('link', name='Le t8/5 en pratique', exact=True).click()
    expect(page).to_have_url(base+'Thermique/introduction.html#calcul')


def test_shared_future_week_overrides_current_phase(site):
    page, base = site
    today(page)
    page.goto(base+'planning.html#semaine-2027-02')
    expect(page.get_by_label('Période', exact=True)).to_have_value('formation')
    expect(page.get_by_text('Examen matériaux', exact=True)).to_be_visible()
    page.get_by_role('button',name='Cette semaine',exact=True).click()
    expect(page.locator('#semaine-2026-40')).to_have_attribute('data-current','true')
    expect(page.get_by_label('Période', exact=True)).to_have_value('pre-rentree')


def test_filter_empty_state_and_reload(site):
    page, base = site
    today(page)
    page.goto(base+'planning.html?phase=formation&matiere=examens&supports=1')
    expect(page.locator('#planning-status')).to_contain_text('Aucune séance')
    page.get_by_label('Avec supports disponibles').uncheck()
    expect(page.get_by_text('Examen matériaux', exact=True)).to_be_visible()
    page.reload()
    expect(page.get_by_label('Matière', exact=True)).to_have_value('examens')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')


def test_date_after_planning_does_not_invent_current_week(site):
    page, base = site
    today(page, '2028-03-01T10:00:00+01:00')
    page.goto(base+'planning.html')
    expect(page.get_by_role('button',name='Cette semaine',exact=True)).to_be_disabled()
    expect(page.locator('[data-current="true"]')).to_have_count(0)
    expect(page.get_by_label('Période', exact=True)).to_have_value('')
