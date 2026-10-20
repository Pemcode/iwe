"""Du document enregistré à son téléchargement et au partage mobile."""
import pytest
from playwright.sync_api import expect

from conftest import add_planning
from test_journeys import site
from wiki.maintenance import register


@pytest.fixture
def project(project):
    root, data, _ = add_planning(project)
    (root / "Thermique/Fiche élèves.pdf").write_bytes(b"%PDF-1.4\nSupport fictif")
    register(root, "Thermique/Fiche élèves.pdf", ident="th-fiche", title="Fiche de synthèse thermique",
             subject="thermique", topics=["sans-support"])
    return root, data


def test_document_from_planning_download_and_share(site, tmp_path):
    page, base = site
    page.add_init_script("Object.defineProperty(navigator, 'clipboard', {value: {writeText: async text => {window.copied = text;}}});")
    page.goto(base + "planning.html#semaine-2026-40")
    page.get_by_role("link", name="Fiche de synthèse thermique", exact=True).first.click()
    expect(page).to_have_url(base + "Supports/th-fiche.html")
    expect(page.get_by_role("heading", name="Fiche de synthèse thermique", exact=True)).to_be_visible()
    with page.expect_download() as download_info:
        page.get_by_role("link", name="Télécharger le PDF", exact=True).click()
    download = download_info.value
    assert download.suggested_filename == "Fiche élèves.pdf"
    target = tmp_path / "download.pdf"
    download.save_as(target)
    assert target.read_bytes() == b"%PDF-1.4\nSupport fictif"
    page.get_by_role("button", name="Menu", exact=True).click()
    page.get_by_role("button", name="Copier le lien", exact=True).click()
    expect(page.locator("#wiki-share-status")).to_have_text("Lien copié.")
    assert page.evaluate("window.copied") == base + "Supports/th-fiche.html"
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.get_by_role("link", name="Thermique", exact=True).click()
    expect(page.get_by_role("link", name="Fiche de synthèse thermique", exact=True)).to_be_visible()