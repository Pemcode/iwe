"""La fin de la série Fluage est accessible sans altérer les sources (S42)."""
import json
import re
from pathlib import Path

from conftest import copy_real_project
from wiki.build import build, link
from wiki.catalogue import CourseHTML


def test_fluage_02_continues_series_from_planning_search_and_citations(tmp_path):
    data, plan = copy_real_project(tmp_path, planning=True)
    output = build(tmp_path)
    url = 'Fluage/02-endommagement-duree-de-vie.html'
    previous = 'Fluage/01-courbe-mecanismes.html'
    assert (output / url).is_file(), 'Le cours 2 de fluage livré doit être publié.'
    courses = {c['id']: c for c in data['cours']}
    course = courses['fluage-02']
    assert course['url'] == url
    assert course['prerequis_conseilles'] == ['fluage-01', 'rupture-01']
    assert course['ordre'] == 2 and course['repere'] == 'Cours 02'

    def page(path):
        parsed = CourseHTML()
        parsed.feed((output / path).read_text(encoding='utf-8'))
        return parsed

    assert '../' + url in page('matieres/fluage.html').links
    assert Path(url).name in page(previous).links
    assert Path(previous).name in page(url).links
    assert url in page('planning.html').links
    topics = {t['id']: t['supports'] for t in plan['sujets']}
    for topic in ('2-7-ruptures-et-differents-types-de-rupture', '2-12-acier-resistant-au-fluage'):
        assert {'cours': 'fluage-02'} in topics[topic]
    rows = json.loads((output / 'assets/recherche.json').read_text(encoding='utf-8'))
    excerpts = (output / 'assets/chat-extraits.json').read_text(encoding='utf-8')
    for n in range(1, 8):
        assert any(row['cours_id'] == 'fluage-02' and row['url'] == f'{url}#c{n}' for row in rows)
        assert f'FLUAGE-02-C{n}' in excerpts
    for ident in ('fluage-01', 'fluage-02'):
        source = (tmp_path / courses[ident]['fichier']).read_text(encoding='utf-8-sig')
        built = (output / courses[ident]['url']).read_text(encoding='utf-8')
        parsed = CourseHTML()
        parsed.feed(source)
        assert parsed.ids <= page(courses[ident]['url']).ids
        scripts = re.findall(r'<script\b[^>]*>.*?</script>', source, re.S)
        assert scripts and all(script in built for script in scripts)
    for prerequisite in course['prerequis_conseilles']:
        assert link(url, courses[prerequisite]['url']) in page(url).links
    assert not any(s.get('publier', False) for s in plan['sources'])
