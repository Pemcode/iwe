"""Lire la fin de la série Cr-Mo depuis le sujet 2.22, à la racine et sous /iwe/ (S44)."""
import pytest
from playwright.sync_api import expect
from test_tth_publiee import site_publie


@pytest.mark.parametrize("prefix", ["", "iwe/"])
@pytest.mark.parametrize("width,height", [(390, 844), (1366, 768)])
def test_heterogeneous_topic_opens_main_course_and_complete_series(site_publie, prefix, width, height):
    browser, base = site_publie
    base += prefix
    context = browser.new_context(viewport={"width": width, "height": height})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base + "planning.html#semaine-2026-48")
    event = page.locator(".planning-event").filter(has=page.get_by_role("heading", name="Soudage hétéro", exact=True))
    links = event.locator(".planning-supports a")
    expect(links.first).to_have_attribute("href", "CrMo/05-assemblages-heterogenes.html")
    expect(links.nth(1)).to_have_attribute("href", "Inox/01-carte-dangers-fissurations.html#c1")
    links.first.click()
    expect(page).to_have_url(base + "CrMo/05-assemblages-heterogenes.html")

    for number, count in [(5, 5), (4, 6)]:
        expect(page.locator(".lab")).to_have_count(count)
        page.wait_for_function("[...document.querySelectorAll('.lab svg')].every(svg => svg.children.length)")
        if width < 1000:
            page.get_by_role("button", name="Menu", exact=True).click()
            expect(page.locator("#wiki-panel")).to_be_visible()
            expect(page.locator('.wiki-toc a[href="#c5"]')).to_be_visible()
            page.keyboard.press("Escape")
        else:
            for folded in (False, True):
                if folded:
                    page.get_by_role("button", name="Replier le menu", exact=True).click()
                for lab in page.locator(".lab").all():
                    expect(lab).to_have_class("lab wiki-lab-split")
                    assert lab.bounding_box()["height"] <= 768, lab.get_attribute("id")
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            page.get_by_role("button", name="Déplier le menu", exact=True).click()

        for forward in page.locator('.lab [data-a="fwd"]').all():
            lab = forward.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' lab ')]")
            lab.locator('[data-a="start"]').click()
            initial = lab.locator("svg").evaluate_all("svgs => svgs.map(svg => svg.innerHTML).join('')")
            forward.click()
            assert lab.locator("svg").evaluate_all("svgs => svgs.map(svg => svg.innerHTML).join('')") != initial
            lab.locator('[data-a="start"]').click()
            assert lab.locator("svg").evaluate_all("svgs => svgs.map(svg => svg.innerHTML).join('')") == initial
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        if width < 1000:
            page.get_by_role("button", name="Menu", exact=True).click()
        page.locator('.wiki-here-pager a[rel="prev"]').click()
    expect(page).to_have_url(base + "CrMo/03-souder-crmo-pieges-joint.html")
    if width < 1000:
        page.get_by_role("button", name="Menu", exact=True).click()
    page.locator('.wiki-here-pager a[rel="next"]').click()
    expect(page).to_have_url(base + "CrMo/04-souder-crmo-pratique.html")
    assert not errors
    context.close()
