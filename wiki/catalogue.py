"""Lecture du catalogue et extraction des sections depuis les sources actuelles."""
import json
import re
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath


class CatalogueError(ValueError):
    pass


class CourseHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.sections = []
        self.links = []
        self.meta = {}
        self._parents = []
        self._heading = None
        self._seen = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        for attr in ("href", "src", "poster"):
            if attrs.get(attr):
                self.links.append(attrs[attr])
        if tag == "meta" and attrs.get("name"):
            self.meta[attrs["name"]] = attrs.get("content") or ""
        if tag == "section":
            self._parents.append(attrs.get("id"))
        if tag in ("h2", "h3"):
            anchor = attrs.get("id") or next((x for x in reversed(self._parents) if x), None)
            self._heading = [tag, anchor, []]

    def handle_endtag(self, tag):
        if self._heading and self._heading[0] == tag:
            _, anchor, pieces = self._heading
            title = " ".join("".join(pieces).split())
            title = re.sub(r"^\d+\s*(?=[A-ZÀ-Ü])", "", title)
            if anchor and anchor not in self._seen and title:
                self.sections.append({"ancre": anchor, "titre": title})
                self._seen.add(anchor)
            self._heading = None
        if tag == "section" and self._parents:
            self._parents.pop()

    def handle_data(self, data):
        if self._heading:
            self._heading[2].append(data)


def relative_path(relative):
    if not isinstance(relative, str) or not relative or "\\" in relative:
        raise CatalogueError(f"chemin invalide : {relative!r}")
    parts = PurePosixPath(relative).parts
    if (PurePosixPath(relative).is_absolute() or ":" in relative or ".." in parts
            or "?" in relative or "#" in relative or any(p.startswith(".") for p in parts)
            or parts[0] in {"_site", "wiki", "tests", "docs", "assets", "matieres", "parcours"}):
        raise CatalogueError(f"chemin réservé ou extérieur au projet : {relative}")
    return relative


def source_file(root, relative):
    relative_path(relative)
    resolved = (root / relative).resolve()
    if not resolved.is_relative_to(root.resolve()):
        raise CatalogueError(f"chemin extérieur au projet : {relative}")
    if not resolved.is_file():
        raise CatalogueError(f"fichier introuvable : {relative}")
    return resolved


def _unique(items, label):
    result = set()
    for item in items:
        ident = item.get("id") if isinstance(item, dict) else None
        if not isinstance(ident, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", ident):
            raise CatalogueError(f"identifiant {label} invalide : {ident!r}")
        if ident in result:
            raise CatalogueError(f"doublon d'identifiant {label} : {ident}")
        result.add(ident)
        if not isinstance(item.get("titre"), str) or not item["titre"].strip():
            raise CatalogueError(f"titre manquant : {ident}")
    return result


def load_catalogue(root):
    root = Path(root).resolve()
    try:
        data = json.loads((root / "catalogue-cours.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise CatalogueError(f"catalogue illisible : {exc}") from exc
    if not isinstance(data, dict) or data.get("version") != 2:
        raise CatalogueError("Le catalogue doit utiliser la version 2.")
    for key in ("matieres", "cours", "parcours"):
        if not isinstance(data.get(key), list):
            raise CatalogueError(f"liste attendue : {key}")
    subjects = _unique(data["matieres"], "matière")
    identifiers = _unique(data["cours"], "cours")
    _unique(data["parcours"], "parcours")
    files = set()
    urls = set()
    for course in data["cours"]:
        ident = course["id"]
        if course.get("matiere") not in subjects:
            raise CatalogueError(f"matière inconnue : {ident}")
        if course.get("statut") not in {"disponible", "a_venir", "brouillon"}:
            raise CatalogueError(f"statut invalide : {ident}")
        if type(course.get("ordre")) is not int or course["ordre"] < 0:
            raise CatalogueError(f"ordre entier positif ou nul attendu : {ident}")
        for key in ("prerequis_conseilles", "mots_cles", "ressources", "fichiers_associes"):
            values = course.setdefault(key, [])
            if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
                raise CatalogueError(f"liste de textes attendue : {ident}.{key}")
        if any(p not in identifiers or p == ident for p in course["prerequis_conseilles"]):
            raise CatalogueError(f"prérequis inconnu ou circulaire direct : {ident}")
        course["sections"] = []
        if course["statut"] != "disponible":
            continue
        path = source_file(root, course.get("fichier"))
        if path.suffix.lower() != ".html":
            raise CatalogueError(f"un fichier HTML est requis : {ident}")
        if course["fichier"].casefold() in files:
            raise CatalogueError(f"doublon de fichier : {course['fichier']}")
        files.add(course["fichier"].casefold())
        url = relative_path(course.setdefault("url", course["fichier"]))
        if PurePosixPath(url).suffix != ".html" or len(PurePosixPath(url).parts) < 2:
            raise CatalogueError(f"chemin publié attendu : dossier/nom.html ({ident})")
        if url.casefold() in urls:
            raise CatalogueError(f"doublon de chemin publié : {url}")
        urls.add(url.casefold())
        for asset in course["fichiers_associes"]:
            source_file(root, asset)
        html = path.read_text(encoding="utf-8-sig")
        parsed = CourseHTML()
        parsed.feed(html)
        if not re.search(r"<head\b", html, re.I) or not re.search(r"<body\b", html, re.I):
            raise CatalogueError(f"page HTML complète attendue : {ident}")
        course["sections"] = parsed.sections
        course["_source"] = html
        course["_ids"] = parsed.ids
    load_applications(root, data, subjects, identifiers, urls)
    by_id = {c["id"]: c for c in data["cours"]}
    for route in data["parcours"]:
        if not isinstance(route.get("etapes"), list) or not route["etapes"]:
            raise CatalogueError(f"étapes manquantes : {route['id']}")
        for step in route["etapes"]:
            course = by_id.get(step.get("cours")) if isinstance(step, dict) else None
            if not course or course["statut"] != "disponible":
                raise CatalogueError(f"cours de parcours indisponible : {route['id']}")
            if step.get("ancre") not in course["_ids"]:
                raise CatalogueError(f"ancre de parcours inconnue : {route['id']} / {step.get('ancre')}")
    return data


def load_applications(root, data, subjects, courses, course_urls):
    """Applications interactives (jeux, simulateurs) : du code publié fichier par fichier."""
    applications = data.setdefault("applications", [])
    if not isinstance(applications, list):
        raise CatalogueError("liste attendue : applications")
    for ident in _unique(applications, "application"):
        if ident in courses:
            raise CatalogueError(f"doublon d'identifiant entre un cours et une application : {ident}")
    # Les fichiers associés des cours sont publiés à leur chemin source.
    published = set(course_urls) | {asset.casefold() for course in data["cours"]
                                     if course["statut"] == "disponible" for asset in course["fichiers_associes"]}
    for app in applications:
        ident = app["id"]
        if app.get("matiere") not in subjects:
            raise CatalogueError(f"matière inconnue : {ident}")
        if app.get("statut") not in {"disponible", "a_venir", "brouillon"}:
            raise CatalogueError(f"statut invalide : {ident}")
        if type(app.setdefault("ordre", 0)) is not int or app["ordre"] < 0:
            raise CatalogueError(f"ordre entier positif ou nul attendu : {ident}")
        for key in ("mots_cles", "ressources", "cours_lies", "fichiers"):
            values = app.setdefault(key, [])
            if not isinstance(values, list) or any(not isinstance(v, str) for v in values):
                raise CatalogueError(f"liste de textes attendue : {ident}.{key}")
        if any(course not in courses for course in app["cours_lies"]):
            raise CatalogueError(f"cours lié inconnu : {ident}")
        # Raccourci du menu commun : le nom de son pictogramme.
        if "raccourci" in app and (not isinstance(app["raccourci"], str) or not app["raccourci"]):
            raise CatalogueError(f"nom d'icône attendu pour le raccourci : {ident}")
        if app["statut"] != "disponible":
            continue
        source = relative_path(app.get("source"))
        if not (root / source).resolve().is_relative_to(root) or not (root / source).is_dir():
            raise CatalogueError(f"dossier d'application introuvable : {source}")
        publication = relative_path(app.get("publication"))
        if not app["fichiers"]:
            raise CatalogueError(f"fichiers à publier attendus : {ident}")
        entry = app.get("entree")
        if entry not in app["fichiers"] or PurePosixPath(entry).suffix.lower() != ".html":
            raise CatalogueError(f"entrée HTML à déclarer parmi les fichiers : {ident}")
        pairs = []
        for name in app["fichiers"]:
            origin = relative_path(f"{source}/{name}")
            source_file(root, origin)
            target = relative_path(f"{publication}/{name}")
            if target.casefold() in published:
                raise CatalogueError(f"doublon de chemin publié : {target}")
            published.add(target.casefold())
            pairs.append((origin, target))
        html = (root / source / entry).read_text(encoding="utf-8-sig")
        if not re.search(r"<head\b", html, re.I) or not re.search(r"<body\b", html, re.I):
            raise CatalogueError(f"page HTML complète attendue : {ident}")
        app["url"] = f"{publication}/{entry}"
        app["_files"] = pairs
        app["_source"] = html
