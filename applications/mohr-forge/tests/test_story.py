"""Mode histoire : épisodes réussis par la manipulation, progression enregistrée."""
import re

from playwright.sync_api import expect
from test_browser import page, server


def seed_story(page, count):
    page.evaluate("""n => {
      const p=Story.fresh(); Story.episodes.slice(0,n).forEach(e=>Story.complete(p,e.id,3));
      localStorage.setItem('mohr-forge-story-v1',JSON.stringify(p));
    }""", count)
    page.reload()


def goto(page, route):
    page.goto(page.url.split('#')[0] + '#' + route)


def test_hub_presents_three_acts_and_locks_the_sequel(page):
    page.get_by_role('link', name='Histoire', exact=True).click()
    expect(page.locator('.act')).to_have_count(3)
    cards = page.locator('.episode-card')
    expect(cards).to_have_count(12)
    expect(cards.nth(0)).to_be_enabled()
    expect(cards.nth(1)).to_be_disabled()
    cards.nth(0).click()
    expect(page.get_by_role('heading', name='L’éprouvette de qualification')).to_be_visible()


def test_first_episode_is_won_by_manipulation_then_saved(page):
    goto(page, 'histoire/1')
    tracker = page.locator('#quest-tracker')
    expect(tracker).to_contain_text('σx = 200 MPa')
    expect(page.locator('#lab-y')).to_have_count(0)
    page.locator('#lab-x').fill('200')
    expect(page.locator('.goal').nth(0)).to_have_class(re.compile(r'\bdone\b'))
    expect(tracker).to_contain_text('1 ‰')
    page.locator('#lab-x').fill('210')
    page.get_by_role('button', name='Échelle réelle').click()
    success = page.locator('#episode-success')
    expect(success).to_be_visible()
    expect(success).to_contain_text('★★★')
    expect(success).to_contain_text('HPP')
    expect(page.locator('#xp')).to_have_text('80 XP')
    page.reload()
    goto(page, 'histoire')
    expect(page.locator('.episode-card').nth(1)).to_be_enabled()
    expect(page.locator('.episode-card').nth(0)).to_contain_text('★★★')


def test_hint_costs_a_star_and_the_factor_two_trap_is_explained(page):
    seed_story(page, 4)
    goto(page, 'histoire/5')
    page.get_by_role('button', name='Un indice').click()
    expect(page.locator('#story-hint')).to_be_visible()
    page.locator('#lab-xy').fill('1000')
    expect(page.locator('#quest-feedback')).to_contain_text('γ/2')
    page.locator('#lab-xy').fill('500')
    page.locator('#lab-omega').fill('-500')
    expect(page.locator('#episode-success')).to_contain_text('★★')
    expect(page.locator('#episode-success')).not_to_contain_text('★★★')
    expect(page.locator('#xp')).to_have_text(f'{4 * 80 + 65} XP')


def test_locked_episode_and_corrupt_story_save_recover(page):
    goto(page, 'histoire/3')
    expect(page.locator('main')).to_contain_text('Épisode verrouillé')
    page.evaluate("localStorage.setItem('mohr-forge-story-v1', '{broken')")
    page.reload()
    goto(page, 'histoire')
    expect(page.locator('.episode-card').nth(0)).to_be_enabled()
    expect(page.locator('#xp')).to_have_text('0 XP')


def test_story_tracker_stays_visible_on_phones_without_overflow(page):
    for width in (390, 320):
        page.set_viewport_size({'width': width, 'height': 760})
        goto(page, 'histoire/1')
        tracker = page.locator('#quest-tracker')
        expect(tracker).to_be_visible()
        page.locator('#lab-x').scroll_into_view_if_needed()
        box = tracker.bounding_box()
        assert box['y'] + box['height'] <= 760 and box['y'] >= 0
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
