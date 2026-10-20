"""Observer et agrandir les photos du cours, hors ligne et dans le wiki (S33)."""
from functools import partial
from http.server import ThreadingHTTPServer
import threading
import json

import pytest
from playwright.sync_api import expect, sync_playwright

from conftest import copy_real_project
from test_journeys import QuietHandler
from wiki.build import build


@pytest.fixture(scope="module")
def photo_course(tmp_path_factory):
    root = tmp_path_factory.mktemp("photos")
    data, _ = copy_real_project(root, planning=True)
    course = next(c for c in data["cours"] if c["id"] == "essais-03")
    output = build(root)
    server = ThreadingHTTPServer(("127.0.0.1", 0), partial(QuietHandler, directory=str(root)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield root, course, f"http://127.0.0.1:{server.server_port}/{output.name}/"
    server.shutdown()
    server.server_close()
    thread.join(timeout=2)


@pytest.mark.parametrize("mode", ["autonome", "wiki"])
def test_observe_photos_offline_and_return_to_reading(photo_course, mode):
    root, course, base = photo_course
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--host-resolver-rules=MAP static.cloudflareinsights.com ~NOTFOUND"])
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        if mode == "autonome":
            context.set_offline(True)
            url = (root / course["fichier"]).as_uri()
        else:
            url = base + course["url"]
        page.goto(url, wait_until="domcontentloaded")
        context.set_offline(True)
        if mode == "wiki":
            expect(page.locator('#wiki-panel a[href$="#photo-viewer-title"]')).to_have_count(0)
        photos = page.locator("figure.course-photo")
        expect(photos).to_have_count(4)
        for photo in photos.all():
            photo.scroll_into_view_if_needed()
            picture = photo.locator("img")
            expect(picture).to_be_visible()
            expect(picture).to_have_js_property("complete", True)
            assert picture.evaluate("img => img.naturalWidth >= 900")
            assert picture.get_attribute("alt")
            expect(photo.locator(".photo-credit a").first).to_be_visible()
            opener = photo.get_by_role("button", name="Agrandir", exact=False)
            # Le contrôle appartient à l’image, sans repousser la légende.
            bounds = opener.bounding_box()
            picture_bounds = picture.bounding_box()
            assert bounds["x"] >= picture_bounds["x"] + picture_bounds["width"] - 60
            assert bounds["y"] >= picture_bounds["y"] + picture_bounds["height"] - max(60, picture_bounds["height"] * .2 + 40)
            assert bounds["x"] + bounds["width"] <= picture_bounds["x"] + picture_bounds["width"]
            assert bounds["y"] + bounds["height"] <= picture_bounds["y"] + picture_bounds["height"]
            assert not opener.inner_text().strip()
            expect(opener.locator("svg")).to_have_count(1)
            opener.focus()
            page.keyboard.press("Enter")
            viewer = page.get_by_role("dialog", name="Photographie agrandie")
            expect(viewer).to_be_visible()
            expect(viewer.locator("img")).to_have_attribute("alt", picture.get_attribute("alt"))
            expect(viewer.locator(".photo-credit")).to_be_visible()
            zoom = viewer.locator("#photo-zoom")
            zoom.click()
            expect(zoom).to_have_attribute("aria-pressed", "true")
            assert viewer.locator(".photo-viewer-stage").evaluate("el => el.scrollWidth > el.clientWidth")
            zoom.click()
            expect(zoom).to_have_attribute("aria-pressed", "false")
            page.keyboard.press("Escape")
            expect(viewer).not_to_be_visible()
            expect(opener).to_be_focused()
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        expect(page.locator("#photos-attaque")).to_contain_text("champs différents")
        page.locator("#photos-attaque").get_by_text("Voir les repères", exact=True).click()
        expect(page.locator("#photos-attaque details")).to_have_attribute("open", "")
        page.locator('#m6d button[data-k="pore"]').click()
        expect(page.locator("#m6msg")).to_contain_text("soufflure", ignore_case=True)
        assert not errors
        browser.close()


@pytest.fixture(scope="module")
def photo_browser():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--host-resolver-rules=MAP static.cloudflareinsights.com ~NOTFOUND"])
        yield browser
        browser.close()


@pytest.mark.parametrize("course_id, chapter", [
    ('met-01', 's3'),
    ('met-03', 's1'),
    ('rdm-03', 'c6'),
    ('fatigue-01', 'c6'),
    ('fatigue-04', 'c2'),
    ('rupture-01', 'c3'),
    ('rupture-02', 'c1'),
    ('essais-01', 'c4'),
    ('essais-02', 'c3'),
    ('fontes-01', 'c4'),
    ('fontes-02', 'c4'),
    ('brasage-03', 'c2'),
    ('electrode-enrobee-01', 'c6'),
    ('electrode-enrobee-03', 'c6'),
    ('arc-submerge-01', 'c1'),
    ('arc-submerge-02', 'c1'),
    ('arc-submerge-04', 'c3'),
])
def test_find_a_real_observation_in_existing_courses(photo_course, photo_browser, course_id, chapter):
    root, _, base = photo_course
    catalogue = json.loads((root / "catalogue-cours.json").read_text(encoding="utf-8"))
    course = next(c for c in catalogue["cours"] if c["id"] == course_id)
    context = photo_browser.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(base + course["url"] + "#" + chapter, wait_until="domcontentloaded")
    context.set_offline(True)
    expect(page.locator(f"#{chapter} figure.course-photo").first).to_be_visible()
    for photo in page.locator("figure.course-photo").all():
        photo.scroll_into_view_if_needed()
        picture = photo.locator("img")
        picture.evaluate("img => img.decode()")
        assert picture.evaluate("img => img.naturalWidth >= 450")
        assert picture.get_attribute("alt")
        expect(photo.locator(".photo-credit a").first).to_be_visible()
        opener = photo.get_by_role("button", name="Agrandir", exact=False)
        bounds, image_bounds = opener.bounding_box(), picture.bounding_box()
        for axis, size in [("x", "width"), ("y", "height")]:
            margin = 60 if axis == "x" else max(60, image_bounds[size] * .2 + 40)
            assert image_bounds[axis] + image_bounds[size] - margin <= bounds[axis]
            assert bounds[axis] + bounds[size] <= image_bounds[axis] + image_bounds[size] + 1
        assert not opener.inner_text().strip()
        opener.focus()
        page.keyboard.press("Enter")
        viewer = page.get_by_role("dialog", name="Photographie agrandie")
        expect(viewer).to_be_visible()
        expect(viewer.locator(".photo-credit")).to_be_visible()
        viewer.get_by_role("button", name="Taille réelle", exact=True).click()
        assert viewer.locator("img").evaluate("img => Math.abs(img.getBoundingClientRect().width - img.naturalWidth) < 1")
        page.keyboard.press("Escape")
        expect(viewer).not_to_be_visible()
        expect(opener).to_be_focused()
    observation = page.locator(f"#{chapter} .photo-question").first
    observation.get_by_text("Voir les repères", exact=True).click()
    expect(observation.locator("details")).to_have_attribute("open", "")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    assert not errors
    context.close()


@pytest.mark.parametrize("course_id, photo_id, footer_fraction", [
    ("rupture-01", "photo-cupules", 0.07),
    ("rupture-01", "photo-clivage", 0.13),
    ("essais-03", "photo-soudure", 0.15),
])
def test_zoom_button_leaves_the_scale_and_instrument_caption_clear(photo_course, photo_browser, course_id, photo_id, footer_fraction):
    root, _, _ = photo_course
    catalogue = json.loads((root / "catalogue-cours.json").read_text(encoding="utf-8"))
    course = next(c for c in catalogue["cours"] if c["id"] == course_id)
    context = photo_browser.new_context(viewport={"width": 390, "height": 844}, offline=True)
    page = context.new_page()
    page.goto((root / course["fichier"]).as_uri(), wait_until="domcontentloaded")
    figure = page.locator("#" + photo_id)
    figure.scroll_into_view_if_needed()
    figure.locator("img").evaluate("img => img.decode()")
    image = figure.locator("img").bounding_box()
    button = figure.locator(".photo-open").bounding_box()
    # Ces bandes contiennent les échelles et inscriptions de la source.
    assert button["y"] + button["height"] <= image["y"] + image["height"] * (1 - footer_fraction)
    context.close()
