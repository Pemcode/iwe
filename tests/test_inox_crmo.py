"""Intégration des inox réorganisés et des Cr-Mo, avec liens historiques conservés (S35)."""
import json
import re
from pathlib import Path
from conftest import copy_real_project, REPOSITORY
from wiki.build import build, link
from wiki.catalogue import CourseHTML

EXPECTED = {
    'inox-03': ('Inox/01-ce-qui-fait-un-inox.html', 1, 6),
    'inox-04': ('Inox/02-familles-inox.html', 2, 6),
    'inox-01': ('Inox/01-carte-dangers-fissurations.html', 3, 7),
    'inox-02': ('Inox/02-sigma-sensibilisation-rochage.html', 4, 6),
    'crmo-01': ('CrMo/01-chaleur-pression-fluage.html', 1, 6),
    'crmo-02': ('CrMo/02-metallurgie-chrome-molybdene-carbures.html', 2, 6),
    'crmo-03': ('CrMo/03-souder-crmo-pieges-joint.html', 3, 6),
}

def test_series_are_available_in_order_with_stable_historical_links(tmp_path):
    catalogue = json.loads((REPOSITORY / 'catalogue-cours.json').read_text(encoding='utf-8'))
    courses = {c['id']: c for c in catalogue['cours']}
    assert EXPECTED.keys() <= courses.keys(), 'Les cinq nouveaux cours doivent être inscrits.'
    data, plan = copy_real_project(tmp_path, planning=True)
    out = build(tmp_path)
    def page(url):
        p = CourseHTML(); p.feed((out / url).read_text(encoding='utf-8')); return p
    rows = json.loads((out / 'assets/recherche.json').read_text(encoding='utf-8'))
    excerpts = (out / 'assets/chat-extraits.json').read_text(encoding='utf-8')
    topics = {t['id']: t['supports'] for t in plan['sujets']}
    for ident, (url, order, count) in EXPECTED.items():
        c = courses[ident]
        assert c['url'] == url and c['ordre'] == order
        assert c['repere'] == f'Cours {order:02}'
        assert '../' + url in page(f"matieres/{c['matiere']}.html").links
        assert url in page('planning.html').links
        topic = '2-15-aciers-inoxydables' if c['matiere'] == 'inox' else '2-12-acier-resistant-au-fluage'
        assert {'cours': ident} in topics[topic]
        source = (REPOSITORY / c['fichier']).read_text(encoding='utf-8-sig')
        parsed = CourseHTML(); parsed.feed(source)
        assert parsed.ids <= page(url).ids
        built = (out / url).read_text(encoding='utf-8')
        assert all(s in built for s in re.findall(r'<script\b[^>]*>.*?</script>', source, re.S))
        for n in range(1, count + 1):
            assert any(r['cours_id'] == ident and r['url'] == f'{url}#c{n}' for r in rows)
            assert f'{ident}-c{n}'.upper() in excerpts
        for prerequisite in c['prerequis_conseilles']:
            assert link(url, courses[prerequisite]['url']) in page(url).links
    for series in [('inox-03','inox-04','inox-01','inox-02'), ('crmo-01','crmo-02','crmo-03')]:
        for a,b in zip(series,series[1:]):
            assert link(courses[a]['url'],courses[b]['url']) in page(courses[a]['url']).links
            assert link(courses[b]['url'],courses[a]['url']) in page(courses[b]['url']).links
    assert {'cours':'fluage-01'} in topics['2-12-acier-resistant-au-fluage']
    assert not any(r['cours_id'] in ('crmo-04','crmo-05') for r in rows)
    assert not any(s.get('publier', False) for s in plan['sources'])
