"""Raccourcis du menu commun : les applications qui le demandent, sous l’assistant (S37)."""
import pytest
from conftest import add_application
from wiki.build import ICONS, build
from wiki.catalogue import CatalogueError, load_catalogue


def quick_links(output, url):
    html = (output / url).read_text(encoding='utf-8')
    return html.split('<ul class="wiki-panel-quick">')[1].split('</ul>')[0]


@pytest.mark.parametrize('status', ['disponible', 'a_venir', 'brouillon'])
def test_heat_treatment_lab_follows_the_map_in_the_menu(project, status):
    root, data = project
    add_application(root, data, id='carte-notions', titre='Carte des notions', ordre=2,
                    raccourci='map', publication='carte-notions')
    add_application(root, data, id='traitements-thermiques', titre='Traitements thermiques', ordre=3,
                    statut=status, raccourci='cycle', publication='traitements-thermiques')
    add_application(root, data)  # un jeu sans raccourci reste dans « S’entraîner » seulement
    output = build(root)
    for url in ['index.html', 'assistant.html', 'Thermique/introduction.html', 'carte-notions/index.html']:
        quick = quick_links(output, url)
        assert 'Quiz du préchauffage' not in quick
        assert ('Traitements thermiques' in quick) == (status == 'disponible')
        if status == 'disponible':
            assert quick.index('Assistant IA') < quick.index('Carte des notions') < quick.index('Traitements thermiques') < quick.index('Rechercher')
            prefix = '../' if '/' in url else ''
            entry = quick.split('Carte des notions')[-1].split('</li>')[1]
            assert f'href="{prefix}traitements-thermiques/index.html"' in entry
            assert ICONS['cycle'] in entry
    if status == 'disponible':
        lab = quick_links(output, 'traitements-thermiques/index.html')
        assert 'aria-current="page"' in lab.split('Carte des notions')[-1].split('</li>')[1]


def test_unknown_shortcut_icon_is_refused(project):
    root, data = project
    add_application(root, data, raccourci='fusee')
    with pytest.raises(CatalogueError, match='icône de raccourci inconnue'):
        build(root)


@pytest.mark.parametrize('value', ['', 3, ['map']])
def test_shortcut_must_name_an_icon(project, value):
    root, data = project
    add_application(root, data, raccourci=value)
    with pytest.raises(CatalogueError, match='raccourci'):
        load_catalogue(root)
