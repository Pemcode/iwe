"""Vues synchronisées de Fluage 2 dans la lecture paysage (S43)."""
import pytest
from playwright.sync_api import expect
from test_tth_publiee import site_publie


@pytest.mark.parametrize("prefix", ["", "iwe/"])
def test_synchronized_views_keep_their_controls_and_mobile_order(site_publie, prefix):
    browser, base = site_publie
    context = browser.new_context(viewport={"width": 390, "height": 844})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + prefix + "Fluage/02-endommagement-duree-de-vie.html")
    page.wait_for_function("document.querySelector('#m1a').getAttribute('viewBox')")
    original = page.locator(".lab").evaluate_all("labs => labs.map(lab => [...lab.children].map(el => el.id || el.className))")
    for folded in (False, True):
        page.set_viewport_size({"width": 1366, "height": 768})
        if folded:
            page.get_by_role("button", name="Replier le menu").click()
        for i in range(1, 8):
            lab = page.locator(f"#m{i}")
            expect(lab).to_have_class("lab wiki-lab-split")
            lab.scroll_into_view_if_needed()
            page.wait_for_timeout(180)  # Redessin du cours après le changement de largeur.
            figures = lab.locator(".lab-figs").bounding_box()
            controls = lab.locator(".ctrl").first.bounding_box()
            assert figures["x"] + figures["width"] <= controls["x"] + 1
            assert controls["y"] < figures["y"] + figures["height"]
            assert lab.bounding_box()["height"] <= 768, f"m{i} dépasse la hauteur de lecture"
            expect(lab.locator(".lab-figs > svg")).to_have_count(2)
            forward = lab.locator('[data-a="fwd"]')
            slider = lab.locator("#m5C" if i == 5 else f"#m{i}u")
            before = slider.input_value()
            forward.click()
            assert slider.input_value() != before
            lab.locator('[data-a="back"]').click()
            assert slider.input_value() == before
            lab.locator('[data-a="start"]').click()
            assert slider.input_value() == slider.get_attribute("min")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.set_viewport_size({"width": 390, "height": 844})
        expect(page.locator(".wiki-lab-split")).to_have_count(0)
        assert page.locator(".lab").evaluate_all("labs => labs.map(lab => [...lab.children].map(el => el.id || el.className))") == original
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert not errors
    context.close()
