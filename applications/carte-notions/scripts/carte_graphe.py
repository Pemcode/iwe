"""Graphe des notions : lecture des cours, vocabulaire fusionné, co-occurrences pondérées par la NPMI, continents.

Deux notions sont reliées quand les cours les évoquent dans les mêmes passages, ou quand la définition de l'une
cite l'autre. Chaque lien garde ses preuves (nombre de passages communs, sections) pour être expliqué à l'élève.
"""
import hashlib
import json
import math
import re
import sys
from collections import Counter, defaultdict
from itertools import combinations
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))

from wiki.build import SectionText  # noqa: E402
from wiki.catalogue import CourseHTML  # noqa: E402

from carte_vocabulaire import (Matcher, Term, acronym_expansion, glossary_entries, kind_of, parse_entry,  # noqa: E402
                               registry_key, slugify, symbolic, tokens)

# Glossaire, quiz et check-list rapprochent des mots sans les relier : jamais dans les co-occurrences.
SKIPPED = {"gloss", "quiz-s", "check"}
DEFAULTS = {"chunk_words": 40, "k": 6, "max_degree": 18, "min_shared": 2, "def_bonus": 0.2, "def_only": 0.12,
            "section_weight": 0.4, "hub_subjects": 3}


def _npmi(n_ab, n_a, n_b, total):
    """PMI normalisée dans [-1, 1] : 1 si les deux notions ne vont jamais l'une sans l'autre, 0 si indépendantes."""
    p_ab = n_ab / total
    if not n_ab or p_ab >= 1:
        return 0.0
    return math.log(n_ab * total / (n_a * n_b)) / -math.log(p_ab)


def _course_title(path):
    stem = path.stem
    title = stem.split(" _ ", 1)[1] if " _ " in stem else stem
    return title[:1].upper() + title[1:]


def read_courses(root, local=False, curation=None):
    """Cours lus : les cours disponibles du catalogue dont le fichier existe ; avec `local`, aussi les fichiers
    de Cours/ que le catalogue ne référence pas encore (aperçu, jamais publié tel quel)."""
    root = Path(root)
    curation = curation or {}
    catalogue = json.loads((root / "catalogue-cours.json").read_text(encoding="utf-8"))
    subjects = [{"id": m["id"], "titre": m["titre"]} for m in catalogue["matieres"]]
    courses, warnings = [], []
    referenced = set()
    folder_subject = {}
    for course in catalogue["cours"]:
        referenced.add(course["fichier"])
        folder_subject.setdefault(str(Path(course["fichier"]).parent).replace("\\", "/"), course["matiere"])
        if course.get("statut") != "disponible":
            continue
        path = root / course["fichier"]
        if not path.is_file():
            warnings.append(f"{course['id']} : fichier introuvable, cours ignoré ({course['fichier']})")
            continue
        courses.append({"id": course["id"], "titre": course["titre"], "matiere": course["matiere"], "url": course["url"],
                        "fichier": course["fichier"], "mots_cles": list(course.get("mots_cles", [])),
                        "_html": path.read_text(encoding="utf-8")})
    if local:
        known = {s["id"] for s in subjects}
        names = curation.get("matieres", {})
        for path in sorted((root / "Cours").rglob("*.html")):
            relative = path.relative_to(root).as_posix()
            if relative in referenced:
                continue
            folder = str(Path(relative).parent).replace("\\", "/")
            subject = folder_subject.get(folder) or slugify(Path(folder).name)
            if subject not in known:
                subjects.append({"id": subject, "titre": names.get(subject, Path(folder).name)})
                known.add(subject)
            ident = "local-" + hashlib.md5(relative.encode("utf-8")).hexdigest()[:8]
            courses.append({"id": ident, "titre": _course_title(path), "matiere": subject, "url": None, "fichier": relative,
                            "mots_cles": [], "_html": path.read_text(encoding="utf-8")})
    used = {c["matiere"] for c in courses}
    return {"mode": "local" if local else "catalogue", "matieres": [s for s in subjects if s["id"] in used],
            "cours": courses, "avertissements": warnings}


class _Union:
    def __init__(self):
        self.parent = {}

    def find(self, key):
        self.parent.setdefault(key, key)
        while self.parent[key] != key:
            self.parent[key] = self.parent[self.parent[key]]
            key = self.parent[key]
        return key

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[max(ra, rb)] = min(ra, rb)


def matchable(form):
    return sum(c.isalnum() for c in form) >= 2 and not symbolic(form) and bool(tokens(form))


def build_vocabulary(corpus, curation):
    """Notions fusionnées entre cours, avec leurs formes reconnaissables et un repère par matière."""
    excluded = {registry_key(x) for x in curation.get("exclusions", [])}
    renames = {registry_key(k): v for k, v in curation.get("renommer", {}).items()}
    senses = {registry_key(k): v for k, v in curation.get("sens", {}).items()}
    raw = []  # (Term, cours, matière, source, formes réservées à une matière)
    for course in corpus["cours"]:
        for dt, dd in glossary_entries(course["_html"]):
            raw += [(t, course["id"], course["matiere"], "glossaire") for t in parse_entry(dt, dd)]
        for keyword in course["mots_cles"]:
            raw += [(t, course["id"], course["matiere"], "mot-cle") for t in parse_entry(keyword, "")]
    for label in curation.get("ajouts", []):
        raw += [(t, None, None, "ajout") for t in parse_entry(label, "")]

    union, entries, scoped = _Union(), [], defaultdict(set)  # scoped[forme] = {(matière ou *, libellé du sens)}
    for term, course, subject, source in raw:
        key = registry_key(term.label)
        if key in renames:
            term = Term(renames[key], kind_of(renames[key]), term.aliases, term.definition)
            key = registry_key(term.label)
        if key in excluded or not key:
            continue
        reserved = None
        if key in senses:
            choice = next((s for s in senses[key] if subject in s["matieres"]), None) \
                or next((s for s in senses[key] if "*" in s["matieres"]), None)
            if choice is None or not choice.get("libelle"):
                continue
            for s in senses[key]:
                for m in s["matieres"]:
                    scoped[term.label].add((m, s["libelle"]))
            reserved = term.label
            term = Term(choice["libelle"], "notion", [a for a in term.aliases], term.definition)
            key = registry_key(term.label)
        forms = {term.label} | {a for a in term.aliases if matchable(a)}
        if term.kind == "sigle" and term.definition:
            expansion = acronym_expansion(term.label, term.definition)
            if expansion and len(expansion.split()) >= 2:
                forms.add(expansion)
                term.aliases.append(expansion)
        for form in forms:
            if registry_key(form) not in excluded:
                union.union(key, registry_key(form))
        entries.append((term, course, subject, source, forms, reserved))
    canonical = {}
    for label, aliases in curation.get("fusions", {}).items():
        canonical[registry_key(label)] = label
        for alias in aliases:
            union.union(registry_key(label), registry_key(alias))
            entries.append((Term(alias, kind_of(alias)), None, None, "fusion", {alias}, None))
    # Une forme réservée à un sens (« CC ») ne relie pas les notions entre elles.
    for form in scoped:
        union.parent.pop(registry_key(form), None)

    groups = defaultdict(list)
    for entry in entries:
        groups[union.find(registry_key(entry[0].label))].append(entry)
    notions, taken = [], set()
    for root_key in sorted(groups, key=lambda k: json.dumps(k, ensure_ascii=False)):
        group = groups[root_key]
        label = next((canonical[registry_key(t.label)] for t, *_ in group if registry_key(t.label) in canonical), None)
        if label is None:
            votes = Counter(t.label for t, c, s, src, *_ in group if src == "glossaire") or Counter(t.label for t, *_ in group)
            label = sorted(votes, key=lambda x: (-votes[x], kind_of(x) != "notion", len(x), x))[0]
        ident = slugify(label)
        if ident in taken:
            ident = f"{ident}-{kind_of(label)}"
        if ident in taken:
            ident = f"{ident}-{hashlib.md5(repr(root_key).encode()).hexdigest()[:4]}"
        taken.add(ident)
        definitions, seen = [], set()
        for t, course, *_ in group:
            if t.definition and t.definition not in seen and course:
                definitions.append((t.definition, course))
                seen.add(t.definition)
        forms = set()
        aliases = []
        for t, course, subject, source, fs, reserved in group:
            forms |= {f for f in fs if f != reserved}
            for a in [t.label, *t.aliases]:
                if a != label and a not in aliases and a not in scoped:
                    aliases.append(a)
        reserved = sorted({r for *_, r in group if r})
        notions.append({"id": ident, "label": label, "kind": kind_of(label), "aliases": aliases, "forms": sorted(forms),
                        "reserved": reserved, "definitions": definitions,
                        "subjects_defined": sorted({s for _, _, s, *_ in group if s})})

    subjects = [s["id"] for s in corpus["matieres"]]
    matchers = {}
    for subject in subjects:
        matcher = Matcher()
        for notion in notions:
            for form in notion["forms"]:
                if matchable(form):
                    matcher.add(notion["id"], form)
            for form in notion["reserved"]:
                pairs = scoped[form]
                mine = next((lab for m, lab in pairs if m == subject), None) or next((lab for m, lab in pairs if m == "*"), None)
                if mine == notion["label"]:
                    matcher.add(notion["id"], form)
        matchers[subject] = matcher
    return {"notions": notions, "matchers": matchers}


def _sections(course):
    titles = CourseHTML()
    titles.feed(course["_html"])
    text = SectionText()
    text.feed(course["_html"])
    texts = text.texts()
    order = [s["ancre"] for s in titles.sections if s["ancre"] in texts]
    order += [a for a in texts if a not in order]
    names = {s["ancre"]: s["titre"] for s in titles.sections}
    return [(a, names.get(a, a), texts[a]) for a in order if a not in SKIPPED]


def _chunks(text, words):
    buffer, count = [], 0
    for line in text.split("\n"):
        buffer.append(line)
        count += len(line.split())
        if count >= words:
            yield " ".join(buffer)
            buffer, count = [], 0
    if buffer:
        yield " ".join(buffer)


def louvain(n, edges, resolution=1.0):
    """Communautés par optimisation de la modularité (Blondel et al., 2008), ordre déterministe."""
    partition = list(range(n))
    adj = [defaultdict(float) for _ in range(n)]
    for a, b, w in edges:
        adj[a][b] += w
        adj[b][a] += w
    while True:
        size = len(adj)
        degree = [sum(nb.values()) for nb in adj]
        m2 = sum(degree) or 1.0
        community = list(range(size))
        total = degree[:]
        moved, improved = True, False
        while moved:
            moved = False
            for node in range(size):
                current = community[node]
                links = defaultdict(float)
                for other, w in adj[node].items():
                    if other != node:
                        links[community[other]] += w
                total[current] -= degree[node]
                best, gain = current, links.get(current, 0.0) - resolution * total[current] * degree[node] / m2
                for comm in sorted(links):
                    g = links[comm] - resolution * total[comm] * degree[node] / m2
                    if g > gain + 1e-12:
                        best, gain = comm, g
                total[best] += degree[node]
                if best != current:
                    community[node] = best
                    moved = improved = True
        if not improved:
            break
        renumber = {c: i for i, c in enumerate(sorted(set(community)))}
        partition = [renumber[community[p]] for p in partition]
        new = [defaultdict(float) for _ in renumber]
        for node in range(size):
            for other, w in adj[node].items():
                new[renumber[community[node]]][renumber[community[other]]] += w
        adj = new
    return partition


def analyse(corpus, vocab, params=None):
    """Statistiques des notions dans les passages des cours, liens retenus et continents."""
    p = {**DEFAULTS, **(params or {})}
    notions = vocab["notions"]
    index = {n["id"]: i for i, n in enumerate(notions)}
    freq, pair = Counter(), Counter()
    pair_sections, term_sections = defaultdict(Counter), defaultdict(Counter)
    term_subjects = defaultdict(Counter)
    section_terms = defaultdict(set)
    courses, total = [], 0
    for ci, course in enumerate(corpus["cours"]):
        sections = _sections(course)
        courses.append({"id": course["id"], "titre": course["titre"], "matiere": course["matiere"], "url": course["url"],
                        "fichier": course["fichier"], "sections": [[a, t] for a, t, _ in sections]})
        matcher = vocab["matchers"][course["matiere"]]
        for si, (_, _, text) in enumerate(sections):
            for chunk in _chunks(text, p["chunk_words"]):
                total += 1
                found = [index[i] for i in matcher.find(chunk)]
                present = sorted(set(found))
                for t in present:
                    freq[t] += 1
                    term_subjects[t][course["matiere"]] += 1
                for t, c in Counter(found).items():
                    term_sections[t][(ci, si)] += c
                section_terms[(ci, si)].update(present)
                for a, b in combinations(present, 2):
                    pair[(a, b)] += 1
                    pair_sections[(a, b)][(ci, si)] += 1

    cites = defaultdict(set)
    subject_of = {c["id"]: c["matiere"] for c in corpus["cours"]}
    for i, notion in enumerate(notions):
        for text, course in notion["definitions"]:
            matcher = vocab["matchers"].get(subject_of.get(course))
            if matcher:
                cites[i] |= {index[j] for j in matcher.find(text) if index[j] != i}

    candidates = {}
    for (a, b), n_ab in pair.items():
        npmi = _npmi(n_ab, freq[a], freq[b], total)
        if n_ab >= p["min_shared"] and npmi > 0:
            candidates[(a, b)] = npmi * n_ab / (n_ab + 3)
    # Même section, passages différents : un lien thématique plus lâche (loi de Paris et propagation).
    section_freq = Counter(t for terms in section_terms.values() for t in terms)
    section_pair = Counter(pr for terms in section_terms.values() for pr in combinations(sorted(terms), 2))
    for (a, b), m in section_pair.items():
        npmi = _npmi(m, section_freq[a], section_freq[b], len(section_terms))
        if m >= p["min_shared"] and npmi > 0:
            candidates[(a, b)] = candidates.get((a, b), 0.0) + p["section_weight"] * npmi * m / (m + 2)
    # Le bonus de définition compte une fois par paire, que la citation soit simple ou réciproque ;
    # une citation que le texte des cours ne confirme jamais pèse moins qu'une co-occurrence réelle.
    for key in {(min(a, b), max(a, b)) for a, targets in cites.items() for b in targets}:
        candidates[key] = candidates[key] + p["def_bonus"] if key in candidates else p["def_only"]

    by_node = defaultdict(list)
    for (a, b), s in candidates.items():
        by_node[a].append((s, b))
        by_node[b].append((s, a))
    kept = set()
    for node, items in by_node.items():
        for s, other in sorted(items, key=lambda x: (-x[0], x[1]))[:p["k"]]:
            kept.add((min(node, other), max(node, other)))
    union, spanning = _Union(), set()
    for (a, b), s in sorted(candidates.items(), key=lambda x: (-x[1], x[0])):
        if union.find(a) != union.find(b):
            union.union(a, b)
            spanning.add((a, b))
    # Un moyeu garde ses liens les plus forts : au-delà du plafond, les plus faibles tombent (sauf l'arbre couvrant).
    degree = Counter(x for e in kept for x in e)
    for a, b in sorted(kept - spanning, key=lambda e: (candidates[e], e)):
        if degree[a] > p["max_degree"] or degree[b] > p["max_degree"]:
            kept.discard((a, b))
            degree[a] -= 1
            degree[b] -= 1
    kept |= spanning
    # Une notion sans voisin direct se rattache aux notions des mêmes sections (lien faible).
    weak = {}
    term_secs = {t: set(secs) for t, secs in term_sections.items()}
    linked = {x for e in kept for x in e}
    for t in sorted(term_secs):
        if t in linked:
            continue
        scores = Counter()
        for sec in term_secs[t]:
            for other in section_terms[sec]:
                if other != t:
                    scores[other] += 1
        best = sorted(scores, key=lambda o: (-scores[o] / len(term_secs[t] | term_secs.get(o, set())), o))[:2]
        for other in best:
            jaccard = scores[other] / len(term_secs[t] | term_secs.get(other, set()))
            key = (min(t, other), max(t, other))
            weak[key] = 0.05 * jaccard
            kept.add(key)

    alive = sorted({x for e in kept for x in e})
    remap = {old: new for new, old in enumerate(alive)}
    links = []
    for a, b in sorted(kept):
        s = candidates.get((a, b), weak.get((a, b), 0.0))
        evidence = [list(sec) for sec, _ in sorted(pair_sections.get((a, b), {}).items(), key=lambda x: (-x[1], x[0]))[:3]]
        links.append({"a": remap[a], "b": remap[b], "s": round(s, 4), "n": pair.get((a, b), 0),
                      "def": (1 if b in cites[a] else 0) | (2 if a in cites[b] else 0), "faible": (a, b) in weak,
                      "preuves": evidence})
    degree = Counter()
    for link in links:
        degree[link["a"]] += link["s"]
        degree[link["b"]] += link["s"]
    out = []
    for old in alive:
        notion = notions[old]
        subjects = sorted(term_subjects[old].items(), key=lambda x: (-x[1], x[0]))
        if not subjects:
            subjects = [(s, 0) for s in notion["subjects_defined"]]
        refs = sorted(term_sections[old].items(), key=lambda x: (-x[1], x[0]))[:6]
        out.append({"id": notion["id"], "label": notion["label"], "kind": notion["kind"], "aliases": notion["aliases"],
                    "definitions": [[t, c] for t, c in notion["definitions"]], "freq": freq[old],
                    "matieres": [list(x) for x in subjects],
                    "carrefour": sum(1 for _, c in subjects if c >= 2) >= p["hub_subjects"],
                    "refs": [[ci, si, c] for (ci, si), c in refs]})
    for i, notion in enumerate(out):
        notion["poids"] = round(degree[i] * math.log(2 + notion["freq"]), 4)
    partition = louvain(len(out), [(l["a"], l["b"], max(l["s"], 1e-3)) for l in links])
    continents = _continents(out, links, partition)
    for notion, comm in zip(out, continents["partition"]):
        notion["continent"] = continents["map"][comm]
    return {"mode": corpus["mode"], "matieres": corpus["matieres"], "cours": courses, "notions": out, "liens": links,
            "continents": continents["list"], "passages": total}


def _continents(notions, links, partition, minimum=6):
    """Regroupe les petites communautés dans leur voisine la plus liée, puis nomme chaque continent."""
    partition = partition[:]
    while True:
        sizes = Counter(partition)
        small = sorted((c for c, n in sizes.items() if n < minimum), key=lambda c: (sizes[c], c))
        if not small or len(sizes) == 1:
            break
        target = small[0]
        strength = Counter()
        for l in links:
            ca, cb = partition[l["a"]], partition[l["b"]]
            if ca == target and cb != target:
                strength[cb] += l["s"]
            elif cb == target and ca != target:
                strength[ca] += l["s"]
        if not strength:
            biggest = max(sizes, key=lambda c: (sizes[c], -c))
            if biggest == target:
                break
            strength[biggest] = 1
        into = max(strength, key=lambda c: (strength[c], -c))
        partition = [into if c == target else c for c in partition]
    order = sorted(set(partition), key=lambda c: (-Counter(partition)[c], c))
    remap = {c: i for i, c in enumerate(order)}
    result = []
    for c in order:
        members = [i for i, x in enumerate(partition) if x == c]
        # Le nom d'un continent vient de ses notions centrales et propres : liens surtout internes, poids élevé.
        inside, overall = Counter(), Counter()
        for l in links:
            for x, y in ((l["a"], l["b"]), (l["b"], l["a"])):
                overall[x] += l["s"]
                if partition[x] == partition[y]:
                    inside[x] += l["s"]
        top = sorted(members, key=lambda i: (-notions[i]["poids"] * (inside[i] / overall[i] if overall[i] else 0) ** 2,
                                             notions[i]["label"]))
        subjects = Counter()
        for i in members:
            for s, count in notions[i]["matieres"]:
                subjects[s] += count
        result.append({"nom": " · ".join(notions[i]["label"] for i in top[:2]), "taille": len(members),
                       "matiere": subjects.most_common(1)[0][0] if subjects else None})
    return {"list": result, "map": {c: remap[c] for c in set(partition)}, "partition": partition}
