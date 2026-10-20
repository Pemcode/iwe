"""Guide de l’assistant : accès, état de l’appareil et questions d’exemple, à la racine et sous /promo/ (S26)."""
import pytest
from playwright.sync_api import expect

from test_chat_widget import OpenRouter, menu, panel
from test_journeys import site

QUESTION = "Pourquoi préchauffe-t-on certains aciers avant soudage ?"


@pytest.fixture
def chat(site):
    page, base = site
    return page, base, OpenRouter(page)


def test_home_page_leads_to_a_guide_that_fits_a_phone(site):
    page, base = site
    page.goto(base)
    page.get_by_role("link", name="Réviser avec l’assistant IA").click()
    expect(page).to_have_url(base + "assistant.html")
    expect(page.get_by_role("heading", level=1)).to_have_text("Réviser avec l’assistant IA")
    steps = page.locator(".guide-step > h2")
    expect(steps).to_have_count(6)
    expect(steps.first).to_contain_text("Créer votre compte OpenRouter")
    page.get_by_role("navigation", name="Étapes du guide").get_by_role("link", name="Se connecter depuis le wiki").click()
    expect(page).to_have_url(base + "assistant.html#etape-3")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def test_panel_entry_reaches_the_guide_from_a_course(site):
    page, base = site
    page.goto(base + "Thermique/introduction.html")
    page.get_by_role("button", name="Menu", exact=True).click()
    page.get_by_role("navigation", name="Navigation du wiki").get_by_role("link", name="Assistant IA").click()
    expect(page).to_have_url(base + "assistant.html")


def test_guide_shows_the_device_state_and_opens_the_assistant(chat):
    page, base, _ = chat
    page.goto(base + "assistant.html")
    expect(page.get_by_text("Cet appareil n’est pas encore connecté.")).to_be_visible()
    expect(page.get_by_text("Cet appareil est connecté à OpenRouter.")).to_be_hidden()
    page.get_by_role("button", name="Ouvrir l’assistant", exact=True).click()
    expect(panel(page).get_by_role("button", name="Se connecter avec OpenRouter")).to_be_visible()


def test_example_question_is_placed_in_the_chat_without_being_sent(chat):
    page, base, api = chat
    page.add_init_script("localStorage.setItem('polywe_chat_key', 'sk-or-v1-test')")
    page.goto(base + "assistant.html#etape-5")
    expect(page.get_by_text("Cet appareil est connecté à OpenRouter.")).to_be_visible()
    page.get_by_role("button", name=QUESTION).click()
    box = panel(page).get_by_label("Votre question")
    expect(box).to_have_value(QUESTION)
    expect(box).to_be_focused()
    page.wait_for_timeout(200)
    assert api.requests == [], "rien n’est envoyé avant validation"


def test_example_question_leaves_the_instructions_editor_for_the_question_box(chat):
    page, base, api = chat
    page.set_viewport_size({"width": 1366, "height": 768})
    page.add_init_script("localStorage.setItem('polywe_chat_key', 'sk-or-v1-test')")
    page.goto(base + "assistant.html#etape-5")
    page.get_by_role("button", name="Ouvrir l’assistant", exact=True).click()
    menu(page, "Consignes")
    expect(panel(page).get_by_label("Consignes de l’assistant")).to_be_visible()
    page.get_by_role("button", name=QUESTION).click()
    box = panel(page).get_by_label("Votre question")
    expect(box).to_be_visible()
    expect(box).to_have_value(QUESTION)
    expect(box).to_be_focused()
    assert api.requests == []


def test_chat_login_screen_links_to_the_guide(chat):
    page, base, _ = chat
    page.goto(base + "Thermique/introduction.html")
    page.get_by_role("button", name="Chat", exact=True).click()
    guide = panel(page).get_by_role("link", name="guide pas à pas")
    expect(guide).to_have_attribute("href", base + "assistant.html")
    guide.click()
    expect(page).to_have_url(base + "assistant.html")
