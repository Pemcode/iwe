"""Validation du planning et frise statique reliée aux supports éditoriaux."""
from collections import defaultdict
from datetime import date, timedelta
from html import escape as h
import json
from pathlib import Path
import re

from .catalogue import CatalogueError, relative_path, source_file


def index(items, label, title=True):
    if not isinstance(items, list):
        raise CatalogueError(f"planning : liste attendue ({label})")
    result = {}
    for item in items:
        ident = item.get("id") if isinstance(item, dict) else None
        if not isinstance(ident, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", ident) or ident in result:
            raise CatalogueError(f"planning : identifiant invalide ou doublon ({label}) : {ident}")
        if title and (not isinstance(item.get("titre"), str) or not item["titre"].strip()):
            raise CatalogueError(f"planning : titre manquant ({ident})")
        result[ident] = item
    return result


def day(value):
    try:
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError
        return parsed
    except (ValueError, TypeError):
        raise CatalogueError(f"planning : date ISO invalide : {value}") from None


def load_planning(root, catalogue):
    root = Path(root)
    path = root / "planning-formation.json"
    if not path.exists():
        return None
    try:
        plan = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise CatalogueError(f"planning illisible : {exc}") from exc
    if not isinstance(plan, dict) or plan.get("version") != 1:
        raise CatalogueError("planning : version 1 attendue")
    sources = index(plan.get("sources"), "sources")
    phases = index(plan.get("phases"), "phases")
    themes = index(plan.get("themes"), "matières")
    topics = index(plan.get("sujets"), "sujets")
    index(plan.get("seances"), "séances", title=False)
    if plan.get("phase_reference") not in phases:
        raise CatalogueError("planning : phase de référence inconnue")
    for source in sources.values():
        filename = relative_path(source.get("fichier"))
        if Path(filename).suffix.lower() != ".pdf" or type(source.get("publier", False)) is not bool:
            raise CatalogueError("planning : source PDF et publication booléenne attendues")
        if source.get("publier", False):
            source_file(root, filename)
    for phase in phases.values():
        if day(phase.get("debut")) > day(phase.get("fin")) or phase.get("source") not in sources:
            raise CatalogueError(f"planning : période ou source invalide ({phase['id']})")
    courses = {c["id"]: c for c in catalogue["cours"]}
    for topic in topics.values():
        if topic.get("theme") not in themes or not isinstance(topic.get("supports"), list):
            raise CatalogueError(f"planning : matière ou supports invalides ({topic['id']})")
        for support in topic["supports"]:
            course = courses.get(support.get("cours")) if isinstance(support, dict) else None
            if not course:
                raise CatalogueError(f"planning : cours inconnu ({topic['id']})")
            if course["statut"] == "disponible" and support.get("ancre") and support["ancre"] not in course["_ids"]:
                raise CatalogueError(f"planning : ancre absente ({topic['id']})")
    for event in plan["seances"]:
        when = day(event.get("date"))
        phase = phases.get(event.get("phase"))
        if not phase or event.get("sujet") not in topics:
            raise CatalogueError(f"planning : phase ou sujet inconnu ({event['id']})")
        if not day(phase["debut"]) <= when <= day(phase["fin"]):
            raise CatalogueError(f"planning : séance hors période ({event['id']})")
        for field in ("horaire", "intervenant", "note"):
            if field in event and not isinstance(event[field], str):
                raise CatalogueError(f"planning : texte attendu ({event['id']}.{field})")
    return plan


MONTHS = ('', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre')
DAYS = ('Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche')


def label(value, weekday=False):
    when = day(value) if isinstance(value, str) else value
    return (DAYS[when.weekday()]+' ' if weekday else '')+f"{when.day} {MONTHS[when.month]} {when.year}"


def weeks(plan):
    grouped = defaultdict(list)
    for event in sorted(plan['seances'], key=lambda e: (e['date'], e.get('horaire', ''))):
        when = day(event['date'])
        start = when - timedelta(days=when.weekday())
        grouped[(event['phase'], start)].append(event)
    return sorted(grouped.items(), key=lambda item: item[0][1])


def render_planning(plan, catalogue, link):
    courses = {c['id']: c for c in catalogue['cours']}
    topics = {t['id']: t for t in plan['sujets']}
    themes = {t['id']: t for t in plan['themes']}
    phases = {p['id']: p for p in plan['phases']}
    sources = {s['id']: s for s in plan['sources']}

    def event_card(event):
        topic = topics[event['sujet']]
        entries = [(s, courses[s['cours']]) for s in topic['supports'] if courses[s['cours']]['statut'] != 'brouillon']
        ready = [(s, c) for s, c in entries if c['statut'] == 'disponible']
        links = []
        for support, course in entries:
            if course['statut'] == 'a_venir':
                links.append(f'<li class="planning-pending">{h(course["titre"])} <span>À venir</span></li>')
            else:
                anchor = support.get('ancre', '')
                title = next((s['titre'] for s in course['sections'] if s['ancre'] == anchor), course['titre'])
                url = link('planning.html', course['url'], anchor)
                links.append(f'<li><a href="{url}">{h(title)}</a><small>{h(course.get("repere", "Cours"))}</small></li>')
        if links:
            count = f"{len(ready)} support{'s' if len(ready) != 1 else ''} disponible{'s' if len(ready) != 1 else ''}"
            if len(entries) > len(ready): count += f" · {len(entries)-len(ready)} à venir"
            resources = f'<details class="planning-supports" open><summary>{count}</summary><ul>{"".join(links)}</ul></details>'
        elif topic['theme'] not in {'pratique', 'reperes', 'examens'}:
            resources = '<p class="planning-missing">Support pas encore disponible</p>'
        else:
            resources = ''
        meta = ' · '.join(h(event[k]) for k in ('horaire', 'intervenant') if event.get(k))
        note = f'<p>{h(event["note"])}</p>' if event.get('note') else ''
        code = f'<span class="planning-code">{h(topic["code"])}</span> ' if topic.get('code') else ''
        return f'''<article class="planning-event" data-theme="{h(topic['theme'])}" data-supports="{len(ready)}">
<p class="planning-event-meta">{code}{h(themes[topic['theme']]['titre'])}</p>
<h4>{h(topic['titre'])}</h4><p class="planning-time">{meta}</p>{note}{resources}</article>'''

    week_html = defaultdict(list)
    for (phase_id, start), events in weeks(plan):
        end = start+timedelta(days=6)
        year, number, _ = start.isocalendar()
        ident = f'semaine-{year}-{number:02}'
        grouped_days = defaultdict(list)
        periods = defaultdict(list)
        for event in events:
            if 'horaire' not in event:
                periods[event['sujet']].append(event)
            else:
                grouped_days[(event['date'], event['date'])].append(event)
        for period in periods.values():
            grouped_days[(period[0]['date'], period[-1]['date'])].append(period[0])
        days_html = []
        for (first, last), entries in sorted(grouped_days.items()):
            daytitle = label(first, True) if first == last else f'Du {label(first)} au {label(last)}'
            days_html.append(f'<div class="planning-day" data-date="{first}"><h3>{daytitle}<span class="planning-today" hidden>Aujourd’hui</span></h3><div class="planning-events">{"".join(event_card(e) for e in entries)}</div></div>')
        names = list(dict.fromkeys(themes[topics[e['sujet']]['theme']]['titre'] for e in events))
        week_html[phase_id].append(f'''<details class="planning-week" id="{ident}" data-phase="{phase_id}" data-start="{start}" data-end="{end}" {'open' if phase_id == plan['phase_reference'] else ''}>
<summary><span class="planning-week-no">S{number:02}</span><span><strong>{label(start)} — {label(end)}</strong><small>{h(' · '.join(names))}</small></span><span class="planning-week-current" hidden>Cette semaine</span></summary>
<div class="planning-week-content"><a class="planning-permalink" href="#{ident}">Lien vers cette semaine ↗</a>{''.join(days_html)}</div></details>''')
    sections = []
    phase_cards = []
    for phase in plan['phases']:
        ident = phase['id']
        source = sources[phase['source']]
        if source.get('publier', False):
            source_label = f'<a href="{link("planning.html", source["fichier"])}">Planning source · PDF ↗</a>'
        else:
            source_label = f'<span class="planning-source-note">Source : {h(source["titre"])}</span>'
        phase_cards.append(f'<a href="?phase={ident}#phase-{ident}" class="planning-phase-card"><span class="wiki-eyebrow">{label(phase["debut"])} — {label(phase["fin"])}</span><strong>{h(phase["titre"])}</strong><span>{h(phase.get("description", ""))}</span></a>')
        sections.append(f'''<section class="planning-phase" id="phase-{ident}" data-phase="{ident}" data-start="{phase['debut']}" data-end="{phase['fin']}"><div class="planning-phase-heading"><h2>{h(phase['titre'])}</h2>{source_label}</div><div class="planning-spine">{''.join(week_html[ident])}</div></section>''')
    options = lambda items: ''.join(f'<option value="{h(p["id"])}">{h(p["titre"])}</option>' for p in items)
    return f'''<div id="planning" data-reference="{h(plan['phase_reference'])}">
<section class="planning-hero"><div><p class="wiki-eyebrow">DU Ingénierie du soudage · {min(p["debut"] for p in plan["phases"])[:4]}–{max(p["fin"] for p in plan["phases"])[:4]}</p><h1>Le fil de la<br><em>formation.</em></h1><p class="wiki-lead">Une semaine, une matière, les supports pour réviser. Retrouvez les cours au rythme de la promo.</p></div><aside class="planning-position"><span class="wiki-eyebrow">Votre repère</span><strong id="planning-position-title">{h(phases[plan['phase_reference']]['titre'])}</strong><p id="planning-position-text">Du {label(plan['phases'][0]['debut'])} au {label(plan['phases'][-1]['fin'])}.</p><a id="planning-current-link" class="planning-current-link" hidden>Ouvrir ma semaine →</a><a href="?phase=&amp;matiere=examens">Voir les examens à préparer ↗</a></aside></section>
<nav class="planning-phase-cards" aria-label="Étapes de la formation">{''.join(phase_cards)}</nav>
<form class="planning-filters" id="planning-filters" hidden><div><label for="planning-phase">Période</label><select id="planning-phase"><option value="">Toute la formation</option>{options(plan['phases'])}</select></div><div><label for="planning-theme">Matière</label><select id="planning-theme"><option value="">Toutes les matières</option>{options(plan['themes'])}</select></div><label class="planning-check"><input id="planning-ready" type="checkbox"> Avec supports disponibles</label><button type="button" id="planning-now">Cette semaine</button><button type="reset" class="planning-reset">Tout afficher</button></form>
<p id="planning-status" role="status">Séances regroupées par semaine. Ouvrez une semaine pour retrouver ses supports.</p>
<p class="planning-explainer">Les supports sont rapprochés par thème : le planning ne répartit pas les fiches du wiki entre les séances. Les pauses peuvent être incluses dans les plages affichées.</p>
<noscript><p>La frise et ses liens sont consultables sans JavaScript. Les filtres et le repère de la semaine actuelle nécessitent JavaScript.</p></noscript>
<div class="planning-timeline">{''.join(sections)}</div>
<details class="planning-sources"><summary>À propos des plannings</summary><p>Vue DU Ingénierie du soudage : les créneaux réservés aux MAT5 seuls sont écartés selon la légende du planning annuel. Les groupes de pratique et périodes en entreprise restent ceux du document ; aucune affectation individuelle n’est supposée.</p><p>Le planning annuel est prévisionnel. Une case vide n’est pas interprétée comme une séance libre. Les références ci-dessus identifient les documents de formation utilisés pour cette transcription.</p></details></div>'''
