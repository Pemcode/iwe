"""Vocabulaire de la carte : découpage des glossaires des cours et reconnaissance des notions dans le texte.

Une entrée de glossaire (dt, dd) peut regrouper plusieurs termes, des symboles, des normes ou des sigles.
`parse_entry` en tire des notions typées ; `Matcher` les retrouve dans le texte des cours, sans tenir compte
des accents, de la casse et du pluriel simple, sauf pour les sigles écrits en capitales.
"""
import hashlib
import re
import unicodedata
from dataclasses import dataclass, field
from html.parser import HTMLParser

GREEK = {"α": "alpha", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon", "ζ": "zeta", "η": "eta", "θ": "theta",
         "ι": "iota", "κ": "kappa", "λ": "lambda", "μ": "mu", "ν": "nu", "ξ": "xi", "π": "pi", "ρ": "rho", "σ": "sigma",
         "ς": "sigma", "τ": "tau", "υ": "upsilon", "φ": "phi", "χ": "chi", "ψ": "psi", "ω": "omega"}
LIGATURES = {"œ": "oe", "Œ": "OE", "æ": "ae", "Æ": "AE"}
TOKEN = re.compile(r"[^\W_]+")
# Organismes et sigles trop généraux : présents partout, ils ne relient rien.
ORGANISMS = {"ISO", "EN", "AWS", "ASTM", "API", "ASME", "WRC", "IIW", "IWE", "TWI", "IMOA", "ECCC", "BS", "IEC", "NACE",
             "DIN", "AFNOR", "CEN", "AISI", "NF"}
UNITS = {"mpa", "gpa", "kpa", "pa", "bar", "mbar", "kn", "mn", "ppm", "µm", "μm", "nm", "mm", "hz", "kgf", "mpy", "°c", "tr/min"}
MATH = {"log", "ln", "exp", "sin", "cos", "tan", "cosh", "sinh", "coth", "e", "π", "atan", "atanh", "tanh", "arctan"}
MATH_CHARS = set("∫√∂Σ∝≈≫≪≲⟹⟺□⊥·/+−±×÷→←↔∞∑∏⌈⌉∧")
NORM = re.compile(r"^(?P<org>ISO/TR|ISO/TS|ISO|NF EN|EN|ASTM|AWS|ASME|API|BS|IEC|NACE|DIN)\s+(?P<code>[A-Z]{0,3}\s?\d[\w.\-]*(?:-\d+)*)")
NORM_NUMBER = re.compile(r"^[A-Z]?\d+(?:\.\d+)*(?:-\d+)*$")
ROMAN = re.compile(r"^[IVX]+$")
PREPOSITIONS = ("à ", "de ", "d'", "d’", "du ", "des ", "en ", "sous ", "par ", "au ")
INVERTED = re.compile(r"^(?P<noun>.+?)\s+(?P<prep>de|d'|d’|du|des|en|sous|à|au)$")
# « Austénitique (acier) » → « acier austénitique » : un seul nom générique entre parenthèses.
NOUN_HEADS = {"acier", "aciers", "méthode", "domaine", "fonte", "alliage", "essai", "zone", "traitement", "régime", "procédé",
              "phase", "courbe", "diagramme", "loi", "modèle", "critère", "paramètre", "facteur", "coefficient", "classes", "classe", "matrice", "abaque"}
FORMULA = re.compile(r"^(?:[A-Z][a-z]?[0-9₀-₉]*)+$")
NOUN_SUFFIXES = ("tion", "sion", "ment", "age", "ure", "ité", "isme", "eur", "ance", "ence", "ie", "ude", "ose", "iste")
# Une lettre grecque finale fait partie du nom : phase σ, boucle γ, ferrite δ.
GREEK_NAME_HEADS = {"phase", "boucle", "carbure"}
STOP = {"de", "du", "des", "d", "à", "a", "au", "aux", "la", "le", "les", "l", "en", "et", "par", "pour", "sur", "sous",
        "of", "and", "the", "for", "in", "on"}


def _fold(text):
    for a, b in LIGATURES.items():
        text = text.replace(a, b)
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c))


def token_key(token):
    """Forme de comparaison d'un mot : sans accents ni casse, lettres grecques nommées, pluriel simple retiré."""
    key = _fold(token).casefold()
    key = "".join(GREEK.get(c, c) for c in key)
    if len(key) > 3 and key.endswith("s") and not key.endswith("ss"):
        key = key[:-1]
    elif key.endswith("eaux"):
        key = key[:-1]
    return key


def is_greek(char):
    return unicodedata.name(char, "").startswith("GREEK")


def is_strict(token):
    """Un sigle en capitales se compare tel quel : « CE » n'est pas « ce »."""
    return any(c.isupper() for c in token) and not any(c.islower() for c in token)


def tokens(text):
    return [(m.group(0), token_key(m.group(0))) for m in TOKEN.finditer(text)]


def registry_key(label):
    """Identité d'une notion entre cours : mots normalisés, sigles gardés en capitales."""
    return tuple(orig if is_strict(orig) else key for orig, key in tokens(label))


def slugify(label):
    text = "".join(GREEK.get(c, c) for c in _fold(label).casefold())
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-") or hashlib.md5(label.encode()).hexdigest()[:8]


def capitalize(text):
    return text[:1].upper() + text[1:] if text[:1].islower() else text


def clean(text):
    return " ".join(text.replace(" ", " ").replace(" ", " ").split())


@dataclass
class Term:
    label: str
    kind: str = "notion"
    aliases: list = field(default_factory=list)
    definition: str = ""


class GlossaryParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.rows = []
        self._depth = 0
        self._tag = None
        self._buf = []

    def handle_starttag(self, tag, attrs):
        if tag == "dl" and "gloss" in (dict(attrs).get("class") or "").split():
            self._depth += 1
        elif self._depth and tag in ("dt", "dd"):
            self._tag, self._buf = tag, []
        elif self._depth and self._tag and tag == "sub":
            self._buf.append("_")

    def handle_endtag(self, tag):
        if tag == "dl" and self._depth:
            self._depth -= 1
        elif self._depth and tag == self._tag:
            self.rows.append((tag, clean("".join(self._buf))))
            self._tag = None

    def handle_data(self, data):
        if self._tag:
            self._buf.append(data)


def glossary_entries(html):
    """Paires (terme, définition) des listes <dl class="gloss"> d'une page."""
    parser = GlossaryParser()
    parser.feed(html)
    entries, current = [], None
    for tag, text in parser.rows:
        if tag == "dt":
            current = text
        elif current is not None:
            entries.append((current, text))
            current = None
    return entries


def split_top(text, sep):
    """Découpe au séparateur hors parenthèses."""
    parts, depth, start, i = [], 0, 0, 0
    while i < len(text):
        c = text[i]
        if c == "(":
            depth += 1
        elif c == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and text.startswith(sep, i):
            parts.append(text[start:i])
            start = i + len(sep)
            i = start
            continue
        i += 1
    parts.append(text[start:])
    return [p.strip() for p in parts if p.strip()]


def is_symbol_token(token):
    if "_" in token or any(c in MATH_CHARS for c in token):
        return True
    if any(is_greek(c) for c in token):
        return True
    letters = [c for c in token if c.isalpha()]
    return len(letters) <= 1 or token[:1].isdigit()


def symbolic(label):
    """Symbole, unité, notation mathématique ou fragment trop court pour être une notion."""
    if not label or label.casefold() in UNITS or label in MATH or label.casefold() in MATH:
        return True
    if not any(c.isalpha() for c in label):
        return True
    if "_" in label or any(c in MATH_CHARS for c in label):
        return True
    if re.sub(r"\d", "", token_key(label)) in MATH or token_key(label) in GREEK.values():
        return True
    words = label.split()
    if words and words[0] in ORGANISMS and not NORM.match(label):
        return True
    if len(words) == 1:
        word = words[0]
        if ROMAN.fullmatch(word):
            return True
        if any(is_greek(c) for c in word):
            return True
        if word[:1].isdigit() and len(word) >= 4 and any(c.isalpha() for c in word) and sum(c.isdigit() for c in word) >= 2:
            return False
        if len(word) <= 2 and not (word.isupper() and word.isalpha()):
            return True
        if is_symbol_token(word) and not (len(word) >= 3 and sum(c.isalpha() for c in word) >= 1 and word[:1].isalpha()):
            return True
        if len(word) <= 3 and word.islower():
            return True
    return False


def kind_of(label):
    if NORM.match(label):
        return "norme"
    words = label.split()
    lower_words = [w for w in words if sum(c.islower() for c in w) >= 4]
    if any(c.isdigit() for c in label) and not lower_words:
        return "designation"
    upper = sum(c.isupper() for c in label)
    if upper >= 2 and len(words) <= 2 and all(sum(c.islower() for c in w) <= 1 for w in words):
        return "sigle"
    return "notion"


def _definition(text):
    text = text.strip().rstrip(" .;")
    return capitalize(text) + "." if text else ""


def _nounish(word):
    """« normalisation », « rupture » sont des noms ; « pure », « grise » des adjectifs."""
    return len(word) >= 6 and word.lower().endswith(NOUN_SUFFIXES)


def _ellipsis(part, first):
    """« Courbe conventionnelle, rationnelle » : le second terme reprend le nom du premier."""
    words = first.split()
    if len(words) < 2 or kind_of(first) != "notion" or words[0].lower() in STOP | {"sur", "avec", "sans"}:
        return part
    lowered = part[:1].lower() + part[1:]
    for prep in PREPOSITIONS:
        if lowered.startswith(prep):
            at = first.lower().rfind(" " + prep)
            prefix = first[:at] if at > 0 else words[0]
            return prefix + " " + lowered
    single = part.split()
    if len(single) == 1 and part.islower() and not _nounish(part) and not is_symbol_token(part):
        return words[0] + " " + part
    return part


def _parenthesis(part):
    """Gère « Norton (loi de) », « Austénitique (acier) », « σ (phase sigma) », « … (FAF) ». Rend (libellé, alias)."""
    m = re.match(r"^(?P<head>.*?)\s*\((?P<paren>[^()]*)\)\s*(?P<tail>.*)$", part)
    if not m:
        return part, []
    head, paren, tail = m.group("head").strip(), clean(m.group("paren")), m.group("tail").strip()
    if tail:
        head = f"{head} {tail}"
    inverted = INVERTED.match(paren)
    if inverted and "," not in paren:
        prep = inverted.group("prep")
        joint = prep if prep.endswith(("'", "’")) else prep + " "
        return f"{inverted.group('noun')} {joint}{_common(head)}", []
    if paren.split()[0].lower() in ("de", "des", "du", "d'", "d’") if paren else False:
        return f"{head} {paren}", []
    if is_symbol_token(head) or symbolic(head):
        promotable = (not paren.lower().startswith(("ou ", "ex.", "ex :", "par ex", "cf", "voir")) and "," not in paren
                      and sum(c.isalpha() for c in paren) >= 6 and not paren.isupper())
        return (paren, [head]) if promotable else (head, [])
    if re.fullmatch(r"[A-Z][A-Z0-9\-]{1,7}", paren):
        return head, [paren]
    if re.fullmatch(r"[A-Z]", paren):
        return head, [paren]
    if " " not in paren and paren.lower() in NOUN_HEADS:
        return f"{paren} {head if is_strict(head) or _common(head) == head else _common(head)}", []
    if " " not in paren and paren.islower():
        if paren.endswith("ing") or "w" in paren or "k" in paren or len(paren) < 5:
            return head, [paren]
        if not _nounish(paren):
            return f"{head} {paren}", []
    return head, []


def _common(head):
    """Dans « Austénite (anciens grains d') », le nom commun perd sa majuscule ; « Norton » la garde."""
    words = head.split()
    common = (words[0].lower().endswith(NOUN_SUFFIXES + ("ite", "ier", "ente", "ype", "que", "aire"))
              or any(w.islower() and w not in STOP for w in words[1:]) or (len(words) > 1 and ROMAN.fullmatch(words[-1])))
    return head[:1].lower() + head[1:] if common else head


def _strip_trailing(label, aliases):
    """« Énergie de soudage Q » → alias Q ; « Carbone équivalent CE » → alias CE ; « Phase σ » reste entier."""
    if re.search(r"\b(?:ISO/TR|ISO|EN|ASTM|AWS)\s+\d", label) and not NORM.match(label):
        return label
    words = label.split()
    while len(words) > 1:
        last = words[-1]
        if ROMAN.fullmatch(last) or words[-2].lower() in STOP | {"et", "ou", "%"}:
            break
        greek = any(is_greek(c) for c in last)
        if len(last) == 1 and greek and words[-2].lower() in GREEK_NAME_HEADS | {"ferrite"} and (words[-2].lower() != "ferrite" or last == "δ"):
            break
        underscore = "_" in last or any(c in MATH_CHARS for c in last) or last[:1].isdigit()
        single = len([c for c in last if c.isalpha()]) <= 1
        acronym = re.fullmatch(r"[A-Z][A-Z0-9]{1,4}", last) is not None
        short = len(last) <= 3 and last[:1].isupper() and not last.isupper()
        lower_single = single and last.islower()
        formula = FORMULA.fullmatch(last) is not None and any(c.isdigit() or "₀" <= c <= "₉" for c in last)
        if underscore or greek or lower_single or formula or ((single or acronym or short) and len(words) > 2):
            aliases.insert(0, last)
            words.pop()
            continue
        break
    return " ".join(words)


def parse_entry(dt, dd):
    """Notions d'une entrée de glossaire, avec leur type et leur définition."""
    dt, dd = clean(dt.replace("«", " ").replace("»", " ")), clean(dd)
    raw_parts = split_top(dt.replace(" ; ", ", "), ", ")
    if len(raw_parts) > 1 and all(ROMAN.fullmatch(p) for p in raw_parts[1:]):
        base, _, first_roman = raw_parts[0].rpartition(" ")
        if base and ROMAN.fullmatch(first_roman):
            head, _, last = base.rpartition(" ")
            if last.endswith("s") and len(last) > 3:
                base = (head + " " if head else "") + last[:-1]
            raw_parts = [f"{base} {r}" for r in [first_roman, *raw_parts[1:]]]
    definitions = split_top(dd, " ; ")
    paired = len(raw_parts) > 1 and len(definitions) == len(raw_parts)
    # « Laplace, Jurin, Washburn (lois de) » : la parenthèse finale vaut pour chaque nom propre.
    shared = re.match(r"^(?P<name>[A-ZÀ-Ý][\w\-]+)\s*\((?P<paren>[^()]*\s(?:de|d'|d’))\)$", raw_parts[-1]) if raw_parts else None
    if shared and len(raw_parts) > 1 and all(re.fullmatch(r"[A-ZÀ-Ý][\w\-]+", p) for p in raw_parts[:-1]):
        paren = shared.group("paren")
        first, _, rest = paren.partition(" ")
        if first.endswith("s") and len(first) > 3:
            paren = first[:-1] + " " + rest
        raw_parts = [f"{p} ({paren})" for p in raw_parts[:-1]] + [f"{shared.group('name')} ({paren})"]
    terms, first_label, previous_norm = [], None, None
    for index, part in enumerate(raw_parts):
        definition = _definition(definitions[index]) if paired else dd
        part = part.rstrip("…").strip()
        if previous_norm:
            org, code, colon = previous_norm
            if re.fullmatch(r"-\d+", part) and re.search(r"-\d+$", code):
                part = f"{org} {re.sub(r'-\d+$', part, code)}"
            elif NORM_NUMBER.fullmatch(part):
                if colon:
                    continue
                part = f"{org} {part}"
        norm = NORM.match(part)
        if norm:
            code = norm.group("code").strip()
            previous_norm = (norm.group("org"), code, ":" in part)
            terms.append(Term(f"{norm.group('org')} {code}", "norme", [], definition))
            continue
        previous_norm = None
        label, aliases = _parenthesis(part)
        if first_label and index > 0:
            label = _ellipsis(label, first_label)
        label = _strip_trailing(clean(label), aliases)
        if index == 0 or first_label is None:
            first_label = label if not symbolic(label) else None
        if symbolic(label) or label.upper() in ORGANISMS or "+" in label or "−" in label:
            continue
        kind = kind_of(label)
        if kind == "notion":
            label = capitalize(label)
        terms.append(Term(label, kind, aliases, definition))
    return terms


def acronym_expansion(acronym, definition):
    """« ZAT » + « Zone affectée thermiquement : … » → « Zone affectée thermiquement »."""
    letters = [c for c in acronym if c.isalpha()]
    if not 2 <= len(letters) <= 6:
        return None
    head = re.split(r"[:;.(,]", re.sub(r"<[^>]+>", "", definition), maxsplit=1)[0]
    words = list(TOKEN.finditer(head))
    picked, i = [], 0
    for m in words:
        if i == len(letters):
            break
        word = m.group(0)
        if word.casefold() in STOP and not picked:
            continue
        if word.casefold() in STOP:
            continue
        if token_key(word)[:1] != token_key(letters[i])[:1]:
            return None
        picked.append(m)
        i += 1
    if i < len(letters) or not picked:
        return None
    return head[picked[0].start():picked[-1].end()]


class Matcher:
    """Retrouve les notions dans un texte : plus longue expression d'abord, sans chevauchement."""

    def __init__(self):
        self._first = {}

    def add(self, ident, form):
        toks = tokens(form)
        if not toks:
            return
        keys = tuple(k for _, k in toks)
        strict = tuple(o if is_strict(o) else None for o, _ in toks)
        bucket = self._first.setdefault(keys[0], [])
        if any(e[0] == keys and e[1] == strict for e in bucket):
            return
        bucket.append((keys, strict, ident))
        bucket.sort(key=lambda e: (-len(e[0]), sum(s is None for s in e[1])))

    def find(self, text):
        toks = tokens(text)
        keys = [k for _, k in toks]
        found, i = [], 0
        while i < len(toks):
            step = 1
            for cand_keys, strict, ident in self._first.get(keys[i], ()):
                n = len(cand_keys)
                if tuple(keys[i:i + n]) == cand_keys and all(s is None or s == toks[i + j][0] for j, s in enumerate(strict)):
                    found.append(ident)
                    step = n
                    break
            i += step
        return found
