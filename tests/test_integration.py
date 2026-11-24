"""Préparer un cours avec un contexte court et une livraison explicite (S46)."""
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from conftest import HTML
from wiki.catalogue import CatalogueError


def snapshot(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob('*') if p.is_file()}


def delivery(root):
    source = root / 'Assemblage/nouveau.html'
    source.parent.mkdir()
    source.write_text(HTML, encoding='utf-8')
    return {
        'version': 1,
        'cours': {'id': 'asm-01', 'titre': 'Assembler', 'matiere': 'assemblage',
                  'fichier': 'Assemblage/nouveau.html', 'url': 'Assemblage/01-assembler.html',
                  'prerequis_conseilles': ['th-01'], 'mots_cles': ['soudage'],
                  'ressources': ['cours', 'simulations']},
        'nouvelle_matiere': {'titre': 'Assemblage', 'description': 'Comprendre les assemblages.'},
        'sujets': [{'id': 'sans-support'}, {'id': 'chauffer', 'ancre': 'calcul'}],
    }


def test_context_is_focused_and_read_only(planning_project):
    from wiki.integration import context
    root, _, _ = planning_project
    before = snapshot(root)
    result = context(root, 'th-01')
    assert result['cours']['id'] == 'th-01'
    assert {'ancre': 'calcul', 'titre': 'Le t8/5 en pratique'} in result['cours']['sections']
    assert [t['id'] for t in result['sujets']] == ['chauffer']
    assert len(result['sha256']) == 64
    encoded = json.dumps(result)
    assert '<script>' not in encoded and '_source' not in encoded and 'base64' not in encoded
    assert snapshot(root) == before
    with pytest.raises(CatalogueError, match='inconnu'):
        context(root, 'absent')


def test_cli_context_and_default_validation_are_read_only(planning_project):
    root, _, _ = planning_project
    card = delivery(root)
    manifest = root / 'livraison.json'
    manifest.write_text(json.dumps(card), encoding='utf-8')
    before = snapshot(root)
    env = dict(os.environ, PYTHONPATH=str(Path(__file__).resolve().parents[1]), PYTHONIOENCODING='cp1252')
    for command in [('contexte', 'th-01'), ('integrer', str(manifest))]:
        result = subprocess.run([sys.executable, '-m', 'wiki', *command],
                                cwd=root, env=env, capture_output=True)
        assert result.returncode == 0, result.stderr.decode('utf-8', errors='replace')
        if command[0] == 'contexte':
            assert json.loads(result.stdout)['cours']['id'] == 'th-01'
    assert snapshot(root) == before


@pytest.mark.parametrize('changed', ['catalogue-cours.json', 'Assemblage/nouveau.html'])
def test_concurrent_edit_is_preserved_and_blocks_registration(planning_project, monkeypatch, changed):
    from wiki.integration import integrate
    from wiki import maintenance
    root, _, _ = planning_project
    card = delivery(root)
    real_validate = maintenance.validate_candidate
    before = snapshot(root)

    def edit_during_validation(*args, **kwargs):
        real_validate(*args, **kwargs)
        (root / changed).write_bytes(before[changed] + b'\n')

    monkeypatch.setattr(maintenance, 'validate_candidate', edit_during_validation)
    with pytest.raises(CatalogueError, match='changé'):
        integrate(root, card, apply=True)
    expected = dict(before)
    expected[changed] += b'\n'
    assert snapshot(root) == expected


def test_preview_then_apply_preserves_sources_and_existing_supports(planning_project, tmp_path):
    from wiki.integration import integrate
    root, _, plan = planning_project
    card = delivery(root)
    before = snapshot(root)
    preview = tmp_path.parent / (tmp_path.name + '-preview')
    result = integrate(root, card, preview=preview)
    assert result['url'] == card['cours']['url']
    assert snapshot(root) == before
    assert (preview / '_site' / result['url']).is_file()
    page = (preview / '_site' / result['url']).read_text(encoding='utf-8')
    assert "Animation active" in page and 'introduction.html' in page
    assert (preview / '_site/assets/recherche.json').is_file()
    integrate(root, card, apply=True)
    actual = json.loads((root / 'catalogue-cours.json').read_text(encoding='utf-8'))
    added = next(c for c in actual['cours'] if c['id'] == 'asm-01')
    assert added['prerequis_conseilles'] == ['th-01']
    assert added['ressources'] == ['cours', 'simulations']
    assert actual['matieres'][-1]['description'] == 'Comprendre les assemblages.'
    updated = json.loads((root / 'planning-formation.json').read_text(encoding='utf-8'))
    assert updated['seances'] == plan['seances']
    assert updated['sujets'][0]['supports'] == [*plan['sujets'][0]['supports'], {'cours': 'asm-01', 'ancre': 'calcul'}]
    assert (root / card['cours']['fichier']).read_bytes() == before[card['cours']['fichier']]
    integrate(root, card, apply=True)
    assert json.loads((root / 'planning-formation.json').read_text(encoding='utf-8')) == updated


@pytest.mark.parametrize('failure', ['anchor', 'prerequisite', 'typo', 'url', 'source', 'preview', 'sha256'])
def test_invalid_delivery_never_writes_metadata(planning_project, failure):
    from wiki.integration import integrate
    root, _, _ = planning_project
    card = delivery(root)
    options = {'apply': True}
    if failure == 'anchor':
        card['sujets'][1]['ancre'] = 'absente'
    elif failure == 'prerequisite':
        card['cours']['prerequis_conseilles'] = ['inconnu']
    elif failure == 'typo':
        card['cours']['prerequis'] = ['th-01']
    elif failure == 'url':
        card['cours'].update(id='th-01', url='Thermique/renomme.html')
    elif failure == 'source':
        card['cours']['fichier'] = 'Planning/source.pdf'
    elif failure == 'preview':
        options['preview'] = root / '_site'
    else:
        card['sha256'] = '0' * 64
    before = snapshot(root)
    with pytest.raises(CatalogueError):
        integrate(root, card, **options)
    assert snapshot(root) == before
