"""Contexte ciblé et fiche de livraison locale, sans appel à un modèle."""
from hashlib import sha256
from pathlib import Path

from .catalogue import CatalogueError, load_catalogue, source_file
from .maintenance import register, local_path
from .planning import load_planning


def context(root, ident):
    root = Path(root).resolve()
    data = load_catalogue(root)
    course = next((c for c in data['cours'] if c['id'] == ident), None)
    if course is None:
        raise CatalogueError(f'Cours inconnu : {ident}')
    plan = load_planning(root, data)

    def brief(c):
        fields = ('id', 'titre', 'statut', 'url', 'ordre')
        return {k: c[k] for k in fields if k in c}

    return {
        'cours': {k: v for k, v in course.items() if not k.startswith('_')},
        'sha256': sha256(source_file(root, course['fichier']).read_bytes()).hexdigest()
                  if course['statut'] == 'disponible' else None,
        'matiere': next(m for m in data['matieres'] if m['id'] == course['matiere']),
        'serie': [brief(c) for c in sorted(data['cours'], key=lambda c: (c['ordre'], c['id']))
                  if c['matiere'] == course['matiere']],
        'prerequis': [brief(c) for c in data['cours'] if c['id'] in course['prerequis_conseilles']],
        'sujets': [{k: v for k, v in t.items() if k != 'supports'} |
                   {'supports': [s for s in t['supports'] if s['cours'] == ident]}
                   for t in (plan['sujets'] if plan else [])
                   if any(s['cours'] == ident for s in t['supports'])],
    }


def fields(value, allowed, required, label):
    if not isinstance(value, dict):
        raise CatalogueError(f'Objet attendu : {label}')
    unknown, missing = set(value) - set(allowed), set(required) - set(value)
    if unknown or missing:
        raise CatalogueError(f'{label} : champs inconnus {sorted(unknown)}, champs manquants {sorted(missing)}')


def text_fields(value, keys, label):
    for key in keys:
        if key in value and (not isinstance(value[key], str) or not value[key].strip()):
            raise CatalogueError(f'Texte non vide attendu : {label}.{key}')


def integrate(root, card, *, apply=False, preview=None):
    fields(card, ('version', 'cours', 'nouvelle_matiere', 'sujets', 'sha256'), ('version', 'cours'), 'fiche')
    if type(card['version']) is not int or card['version'] != 1:
        raise CatalogueError('La fiche doit utiliser la version 1.')
    course = card['cours']
    strings = ('id', 'fichier', 'titre', 'matiere', 'url')
    lists = ('prerequis_conseilles', 'mots_cles', 'ressources', 'fichiers_associes')
    fields(course, (*strings, *lists), strings, 'cours')
    text_fields(course, strings, 'cours')
    for key in lists:
        if key in course and (not isinstance(course[key], list) or
                              any(not isinstance(v, str) or not v.strip() for v in course[key])):
            raise CatalogueError(f'Liste de textes non vides attendue : cours.{key}')
    subject = card.get('nouvelle_matiere', {})
    fields(subject, ('titre', 'description'), (), 'nouvelle_matiere')
    text_fields(subject, ('titre', 'description'), 'nouvelle_matiere')
    topics = card.get('sujets', [])
    if not isinstance(topics, list):
        raise CatalogueError('Liste attendue : sujets')
    for topic in topics:
        fields(topic, ('id', 'ancre'), ('id',), 'sujet')
        text_fields(topic, ('id', 'ancre'), 'sujet')
    root = Path(root).resolve()
    name = local_path(root, course['fichier'])
    # La fiche concerne les cours HTML ; les documents gardent la routine ajouter.
    if Path(name).suffix.lower() != '.html':
        raise CatalogueError('La fiche d’intégration attend un cours HTML.')
    if 'sha256' in card and card['sha256'] != sha256(source_file(root, name).read_bytes()).hexdigest():
        raise CatalogueError('Le cours ne correspond plus à l’empreinte sha256 de la fiche.')
    return register(root, name, ident=course['id'], title=course['titre'], subject=course['matiere'],
                    url=course['url'], subject_title=subject.get('titre'),
                    subject_description=subject.get('description'),
                    prerequisites=course.get('prerequis_conseilles'), keywords=course.get('mots_cles'),
                    resources=course.get('ressources'), assets=course.get('fichiers_associes', []),
                    topic_links=topics, apply=apply, preview=preview)
