"""La progression des anciens cours Inox accompagne leur renumérotation (S35)."""
from playwright.sync_api import expect
from test_carte_publiee import published_map


def test_existing_inox_checklists_move_once_without_checking_new_introductions(published_map):
    browser, base = published_map
    context=browser.new_context()
    context.add_init_script("""if (!sessionStorage.seeded) {
        localStorage.setItem('inox-cours1-check','["1"]');
        localStorage.setItem('inox-cours2-check','["2"]');
        sessionStorage.seeded='yes';
    }""")
    page=context.new_page()
    page.goto(base+'Inox/01-ce-qui-fait-un-inox.html')
    expect(page.locator('#checklist input[data-c="b1"]')).not_to_be_checked()
    page.locator('#checklist input[data-c="b3"]').check()
    page.goto(base+'Inox/01-carte-dangers-fissurations.html')
    expect(page.locator('#checklist input[data-c="1"]')).to_be_checked()
    expect(page.locator('#checklist input[data-c="3"]')).not_to_be_checked()
    page.goto(base+'Inox/02-sigma-sensibilisation-rochage.html')
    expect(page.locator('#checklist input[data-c="2"]')).to_be_checked()
    page.goto(base+'Inox/01-ce-qui-fait-un-inox.html')
    expect(page.locator('#checklist input[data-c="b3"]')).to_be_checked()
    context.close()
