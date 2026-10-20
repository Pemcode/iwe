"""Suggestions : saisie, accès direct et clavier, à la racine et sous /promo/ (S22)."""
import json

import pytest
from playwright.sync_api import expect

from test_journeys import site


@pytest.fixture
def project(project):
    root, data = project
    source = root / "Thermique/brasage.html"
    source.write_text(
        '<!doctype html><html lang="fr"><head><title>Brasage</title></head><body>'
        '<h1>Brasage : procédés</h1>'
        + ''.join(f'<section id="c{i}"><h2>Brasage : méthode {i}</h2></section>' for i in range(1, 12))
        + '<section id="capillarite"><h2>Capillarité et mouillage</h2></section></body></html>',
        encoding="utf-8",
    )
    data["cours"].append({
        "id": "br-01", "matiere": "thermique", "repere": "Cours 02", "ordre": 2,
        "titre": "Brasage : procédés", "fichier": "Thermique/brasage.html",
        "statut": "disponible", "mots_cles": ["assemblage", "brasure"], "prerequis_conseilles": [],
    })
    (root / "catalogue-cours.json").write_text(json.dumps(data), encoding="utf-8")
    return root, data


def open_search(page, base, *, mobile=False):
    if not mobile:
        page.set_viewport_size({"width": 1366, "height": 768})
    page.goto(base + "Thermique/introduction.html")
    if mobile:
        page.get_by_role("button", name="Menu", exact=True).click()
    return page.get_by_label("Rechercher dans le wiki", exact=True)


def test_typing_suggests_courses_and_sections_and_opens_direct_link(site):
    page, base = site
    query = open_search(page, base)
    query.fill("bra")
    choices = page.get_by_role("listbox", name="Suggestions de recherche")
    expect(choices).to_be_visible()
    expect(choices.get_by_role("option", name="Brasage : procédés · Cours complet", exact=False)).to_be_visible()
    expect(choices.get_by_role("option", name="Brasage : méthode 1 ·", exact=False)).to_be_visible()
    assert choices.get_by_role("option").count() <= 8
    assert page.url == base + "Thermique/introduction.html"
    choices.get_by_role("option", name="Brasage : méthode 1 ·", exact=False).click()
    expect(page).to_have_url(base + "Thermique/brasage.html#c1")


def test_accents_fragments_multiple_terms_and_keywords(site):
    page, base = site
    query = open_search(page, base)
    choices = page.get_by_role("listbox", name="Suggestions de recherche")
    for text, expected in [("B", "Brasage : procédés"), ("RAS", "Brasage : procédés"),
                           ("CAPILLARITE bra", "Capillarité et mouillage"), ("HAZ", "Préchauffage")]:
        query.fill(text)
        expect(choices.get_by_role("option").first).to_contain_text(expected)
    query.fill("aucune-notion-xyz")
    expect(page.locator("#wiki-suggest-status")).to_contain_text("Aucun résultat")
    expect(choices.get_by_role("option")).to_have_count(0)
    query.fill("")
    expect(query).to_have_attribute("aria-expanded", "false")
    expect(choices).to_be_hidden()


def test_keyboard_selection_escape_and_full_search(site):
    page, base = site
    query = open_search(page, base)
    query.fill("capillarite")
    expect(query).to_have_attribute("aria-expanded", "true")
    query.press("ArrowDown")
    expect(page.get_by_role("option", selected=True)).to_contain_text("Capillarité")
    expect(query).to_be_focused()
    query.press("Enter")
    expect(page).to_have_url(base + "Thermique/brasage.html#capillarite")
    query = page.get_by_label("Rechercher dans le wiki", exact=True)
    query.fill("bra")
    expect(query).to_have_attribute("aria-expanded", "true")
    query.press("ArrowUp")
    expect(page.get_by_role("listbox", name="Suggestions de recherche").get_by_role("option").last).to_have_attribute("aria-selected", "true")
    query.press("Escape")
    expect(query).to_have_attribute("aria-expanded", "false")
    assert query.get_attribute("aria-activedescendant") is None
    query.press("Enter")
    expect(page).to_have_url(base + "index.html?q=bra#rechercher")
    expect(page.locator("#wiki-results li").first).to_be_visible()


def test_phone_escape_keeps_drawer_open_and_click_navigates(site):
    page, base = site
    query = open_search(page, base, mobile=True)
    query.fill("bra")
    expect(query).to_have_attribute("aria-expanded", "true")
    query.press("Escape")
    expect(query).to_have_attribute("aria-expanded", "false")
    expect(page.get_by_role("navigation", name="Navigation du wiki")).to_be_visible()
    query.fill("capillarite")
    page.get_by_role("listbox", name="Suggestions de recherche").get_by_role("option").first.click()
    expect(page).to_have_url(base + "Thermique/brasage.html#capillarite")
    expect(page.get_by_role("navigation", name="Navigation du wiki")).to_be_hidden()
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_full_results_link_and_shared_index(site):
    page, base = site
    requests = []
    page.on("request", lambda request: requests.append(request.url) if request.url.endswith("recherche.json") else None)
    query = open_search(page, base)
    query.fill("bra")
    page.get_by_role("link", name="Voir tous les résultats").click()
    expect(page).to_have_url(base + "index.html?q=bra#rechercher")
    expect(page.locator("#wiki-results li").first).to_be_visible()
    query = page.get_by_label("Rechercher dans le wiki", exact=True)
    query.fill("capillarite")
    expect(page.get_by_role("listbox", name="Suggestions de recherche").get_by_role("option").first).to_contain_text("Capillarité")
    assert len(requests) == 2, "un seul chargement de l’index par page, partagé avec la recherche complète"
    page.get_by_role("heading", name="Une notion en tête ?").click()
    expect(query).to_have_attribute("aria-expanded", "false")
    query.focus()
    expect(query).to_have_attribute("aria-expanded", "true")
    query.press("Tab")
    expect(page.get_by_role("link", name="Voir tous les résultats")).to_be_focused()
    page.keyboard.press("Tab")
    expect(query).to_have_attribute("aria-expanded", "false")


def test_failed_index_retries_and_latest_query_wins(site):
    page, base = site
    page.route("**/assets/recherche.json", lambda route: route.fulfill(status=503, body="Indisponible"))
    query = open_search(page, base)
    query.fill("bra")
    expect(page.locator("#wiki-suggest-status")).to_contain_text("indisponible")
    page.unroute("**/assets/recherche.json")
    pending = []
    page.route("**/assets/recherche.json", lambda route: pending.append(route))
    with page.expect_request("**/assets/recherche.json"):
        query.fill("capillarite")
    expect(query).to_have_attribute("aria-busy", "true")
    query.fill("HAZ")
    assert pending
    pending.pop().continue_()
    expect(page.get_by_role("listbox", name="Suggestions de recherche").get_by_role("option").first).to_contain_text("Préchauffage")
    query.fill("")
    expect(query).to_have_attribute("aria-expanded", "false")


def test_clearing_query_during_loading_does_not_reopen_suggestions(site):
    page, base = site
    pending = []
    page.route("**/assets/recherche.json", lambda route: pending.append(route))
    query = open_search(page, base)
    with page.expect_request("**/assets/recherche.json"):
        query.fill("bra")
    expect(query).to_have_attribute("aria-busy", "true")
    query.fill("")
    with page.expect_response("**/assets/recherche.json"):
        pending.pop().continue_()
    expect(query).to_have_attribute("aria-expanded", "false")
    expect(page.get_by_role("listbox")).to_be_hidden()


def test_new_query_returns_to_top_of_scrolled_suggestions(site):
    page, base = site
    page.set_viewport_size({"width": 390, "height": 420})
    query = open_search(page, base, mobile=True)
    query.fill("bra")
    expect(query).to_have_attribute("aria-busy", "false")
    query.press("ArrowUp")
    query.fill("br")
    expect(query).to_have_attribute("aria-busy", "false")
    popup = page.locator(".wiki-suggestions").bounding_box()
    hint = page.locator("#wiki-suggest-status").bounding_box()
    assert hint["y"] >= popup["y"], "une nouvelle saisie doit montrer le début de sa liste"
