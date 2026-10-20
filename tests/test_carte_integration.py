"""Accès à la carte dans le menu commun, seulement si elle est disponible (S36)."""
import pytest
from conftest import add_application
from wiki.build import build

@pytest.mark.parametrize('status', ['disponible', 'a_venir', 'brouillon'])
def test_map_shortcut_follows_assistant_and_respects_availability(project, status):
    root, data = project
    add_application(root, data, id='carte-notions', titre='Carte des notions', statut=status,
                    publication='carte-notions', raccourci='map')
    output = build(root)
    for url in ['index.html', 'assistant.html', 'Thermique/introduction.html']:
        html = (output / url).read_text(encoding='utf-8')
        quick = html.split('<ul class="wiki-panel-quick">')[1].split('</ul>')[0]
        assert ('Carte des notions' in quick) == (status == 'disponible')
        if status == 'disponible':
            assert quick.index('Assistant IA') < quick.index('Carte des notions') < quick.index('Rechercher')
            assert ('../' if '/' in url else '') + 'carte-notions/index.html' in quick
