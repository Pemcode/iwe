"""S50 : rejoindre une matière par son module, sur ordinateur et téléphone."""
import pytest
from playwright.sync_api import expect

from conftest import save_catalogue
from test_journeys import site


@pytest.fixture
def project(project):
    root, data = project
    data["matieres"][0]["module"] = "materiaux"
    save_catalogue(root, data)
    return root, data


def test_module_links_fold_and_mobile_drawer(site):
    page, base = site
    page.set_viewport_size({"width": 1366, "height": 768})
    page.goto(base)
    module = page.locator("section.wiki-module").filter(has=page.get_by_role("heading", name="Matériaux"))
    module.get_by_role("link", name="Thermique").click()
    expect(page).to_have_url(base + "matieres/thermique.html")
    nav = page.get_by_role("navigation", name="Navigation du wiki")
    expect(nav.get_by_role("heading", name="Matériaux")).to_be_visible()
    page.get_by_role("button", name="Replier le menu").click()
    expect(nav.get_by_role("heading", name="Matériaux")).to_be_hidden()
    page.get_by_role("button", name="Déplier le menu").click()
    nav.get_by_role("link", name="Préchauffage", exact=True).click()
    expect(page).to_have_url(base + "Thermique/introduction.html")
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_role("button", name="Menu", exact=True).click()
    expect(nav.get_by_role("heading", name="Matériaux")).to_be_visible()
    nav.get_by_role("link", name="Thermique", exact=True).click()
    expect(page).to_have_url(base + "matieres/thermique.html")
    expect(nav).to_be_hidden()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
