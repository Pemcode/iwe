"""Construction d'un site statique à partir des seuls contenus déclarés."""
import json
import posixpath
import re
import shutil
from html import escape as h
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

from .catalogue import CatalogueError, CourseHTML, load_catalogue
from .guide import TITLE as GUIDE_TITLE, render_guide
from .planning import load_planning, render_planning

ASSETS = Path(__file__).resolve().parent.parent / "assets"
MARKER = "wiki-iwe-generated\n"
# Jeton public du site pemcode.github.io, fourni par le propriétaire.
CLOUDFLARE_BEACON = """<!-- Cloudflare Web Analytics --><script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "265001f8626c4f3e82d7f823d55a1c33"}'></script><!-- End Cloudflare Web Analytics -->"""


def link(current, target, anchor=""):
    relative = posixpath.relpath(target, posixpath.dirname(current) or ".")
    return quote(relative, safe="/-._~") + ("#" + quote(anchor, safe="-._~") if anchor else "")


def write(output, name, text):
    target = output / name
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.suffix.lower() == ".html":
        text = re.sub(r"</body\s*>", lambda m: CLOUDFLARE_BEACON + "\n" + m.group(0), text, count=1, flags=re.I)
    target.write_text(text, encoding="utf-8")


# Pictogrammes du panneau : traits simples qui suivent la couleur du texte.
ICONS = {
    "home": '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5.5h4V20"/>',
    "calendar": '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
    "search": '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    "subjects": '<path d="M4 5.5c2.7-1 5.4-1 8 .8 2.6-1.8 5.3-1.8 8-.8v13c-2.7-1-5.4-1-8 .8-2.6-1.8-5.3-1.8-8-.8z"/><path d="M12 6.3v13"/>',
    "routes": '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    "fold": '<path d="m14.5 6-6 6 6 6"/><path d="M19 5v14"/>',
    "close": '<path d="m6 6 12 12M18 6 6 18"/>',
    "menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "map": '<circle cx="5" cy="6" r="2"/><circle cx="18" cy="5" r="2"/><circle cx="11" cy="18" r="3"/><path d="m6 8 4 7M16 7l-4 8M7 6h9"/>',
    "cycle": '<path d="M3.5 3.5v17h17"/><path d="M6 17.5 9.5 7h4.5l1.5 10.5"/><path d="m15.5 17.5 1.5-4h3"/>',
    "chat": '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z"/><path d="M8 10h8M8 13h5"/>',
}


def icon(name):
    return (f'<svg class="wiki-ico" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" '
            f'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{ICONS[name]}</svg>')


def runtime(current):
    """Feuille et scripts communs à toutes les pages publiées : interface du wiki et assistant de révision (S25)."""
    return (f'<link rel="stylesheet" href="{link(current, "assets/wiki.css")}"><script id="wiki-runtime" defer src="{link(current, "assets/wiki.js")}"></script>'
            f'<script id="wiki-chat" defer src="{link(current, "assets/chat-widget.js")}"></script>')


# Texte lisible des sections pour l’assistant : sans code, dessins ni commandes ; un bloc par ligne.
TEXT_HIDDEN = {"script", "style", "svg", "noscript", "template", "button", "select", "textarea"}
TEXT_BLOCKS = {"address", "article", "aside", "blockquote", "br", "caption", "dd", "details", "div", "dl", "dt", "figcaption", "figure",
               "footer", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section", "summary",
               "table", "td", "th", "tr", "ul"}
# Le quiz est généré par le script du cours et la check-list n’énonce que des objectifs : rien à citer.
CHAT_SKIPPED = {"quiz-s", "check"}


class SectionText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pieces = {}
        self._sections = []
        self._hidden = 0

    def _add(self, text):
        current = next((x for x in reversed(self._sections) if x), None)
        if current and not self._hidden:
            self.pieces.setdefault(current, []).append(text)

    def handle_starttag(self, tag, attrs):
        if tag in TEXT_HIDDEN:
            self._hidden += 1
        elif tag in TEXT_BLOCKS:
            self._add("\n")
        if tag == "section":
            self._sections.append(dict(attrs).get("id"))

    def handle_startendtag(self, tag, attrs):
        if tag in TEXT_BLOCKS:
            self._add("\n")

    def handle_endtag(self, tag):
        if tag in TEXT_HIDDEN:
            self._hidden = max(0, self._hidden - 1)
        elif tag in TEXT_BLOCKS:
            self._add("\n")
        if tag == "section" and self._sections:
            self._sections.pop()

    def handle_data(self, data):
        self._add(data)

    def texts(self):
        return {ident: "\n".join(line for line in (" ".join(raw.split()) for raw in "".join(pieces).split("\n")) if line)
                for ident, pieces in self.pieces.items()}


def chat_rows(course, subject):
    """Extraits envoyés par l’assistant : une ligne par section, identifiant stable COURS-ANCRE (RDM-04-C3)."""
    parser = SectionText()
    parser.feed(course["_source"])
    texts = parser.texts()
    rows = []
    for section in course["sections"]:
        if texts.get(section["ancre"]) and section["ancre"] not in CHAT_SKIPPED:
            rows.append({"id": f'{course["id"]}-{section["ancre"]}'.upper(), "cours": course["titre"], "matiere": subject["titre"],
                         "mots_cles": course["mots_cles"], "titre": section["titre"],
                         "url": link("index.html", course["url"], section["ancre"]), "texte": texts[section["ancre"]]})
    return rows


def short_title(course, subject):
    """Sous la matière « Brasage… », le panneau affiche « Procédés… » plutôt que « Brasage : procédés… »."""
    head, sep, rest = course["titre"].partition(" : ")
    if sep and rest and head.casefold() in subject["titre"].casefold():
        return rest[:1].upper() + rest[1:]
    return course["titre"]


def panel_start(folded=False):
    """Juste après <body> : l’état du panneau est appliqué avant l’affichage et avant les scripts des cours."""
    state = 'd.classList.add("wiki-replie")' if folded else 'if(localStorage.getItem("wiki-panneau")==="replie")d.classList.add("wiki-replie")'
    return ('<script>(function(){var d=document.documentElement;d.classList.add("wiki-avec-panneau");'
            f'try{{{state}}}catch(e){{}}}})();</script><a class="wiki-skip" href="#wiki-panel">Aller au menu du wiki</a>')


def course_storage_migration(course):
    """Les anciens cours Inox 1/2 deviennent 3/4 ; ne pas perdre leurs cases cochées.

    Les introductions utilisent b1…b10 et f1…f10 : seuls les anciens codes
    numériques sont déplacés. La source éditoriale reste intacte.
    """
    if course["id"] not in {"inox-01", "inox-02", "inox-03", "inox-04"}:
        return ""
    return """<script>(function(){try{
var flag="inox-check-migration-20261018";
if(localStorage.getItem(flag))return;
[[1,3],[2,4]].forEach(function(pair){
var from="inox-cours"+pair[0]+"-check",to="inox-cours"+pair[1]+"-check";
var before=JSON.parse(localStorage.getItem(from)||"[]"),after=JSON.parse(localStorage.getItem(to)||"[]");
if(!Array.isArray(before)||!Array.isArray(after))return;
var legacy=before.filter(function(v){return /^(?:[1-9]|10)$/.test(String(v));});
if(!legacy.length)return;
localStorage.setItem(to,JSON.stringify(Array.from(new Set(after.concat(legacy)))));
localStorage.setItem(from,JSON.stringify(before.filter(function(v){return legacy.indexOf(v)<0;})));
});
localStorage.setItem(flag,"1");
}catch(e){}})();</script>"""


def panel(current, site, here=None):
    """Panneau latéral commun à toutes les pages : marque, recherche, page courante, matières et parcours.

    Il est placé en fin de document : le contenu vient d’abord au clavier et pour les lecteurs d’écran,
    la feuille de style l’affiche à gauche, ouvert, replié en rail ou en tiroir selon la largeur."""
    here = here or {}

    def mark(target):
        return ' aria-current="page"' if target == current else ""

    home = link(current, "index.html")
    quick = [(home, "home", "Accueil", mark("index.html"), "")]
    if site["planning"]:
        quick.append((link(current, "planning.html"), "calendar", "Planning", mark("planning.html"), ""))
    quick.append((link(current, "assistant.html"), "chat", "Assistant IA", mark("assistant.html"), ""))
    for app in site.get("explorations", []):
        quick.append((link(current, app["url"]), app["raccourci"], h(app["titre"]), mark(app["url"]), ""))
    quick += [(link(current, "index.html", "rechercher"), "search", "Rechercher", "", " wiki-rail-only"),
              (link(current, "index.html", "matieres"), "subjects", "Matières", "", " wiki-rail-only")]
    if site["routes"]:
        quick.append((link(current, "index.html", "parcours"), "routes", "Parcours", "", " wiki-rail-only"))
    shortcuts = "".join(f'<li class="wiki-quick{extra}"><a href="{href}" title="{label}"{attr}>{icon(name)}<span class="wiki-panel-text">{label}</span></a></li>'
                        for href, name, label, attr, extra in quick)

    context = ""
    if here.get("subject"):
        subject = here["subject"]
        context = f'<div class="wiki-panel-here"><a class="wiki-here-subject" href="{link(current, "matieres/" + subject["id"] + ".html")}">{h(subject["titre"])}</a>'
        context += f'<p class="wiki-here-title"><span>{h(here["repere"])}</span>{h(here["titre"])}</p>'
        if here.get("sections"):
            items = []
            for section in here["sections"]:
                number = re.fullmatch(r"c(\d+)", section["ancre"])
                num = f'<span class="wiki-toc-num" aria-hidden="true">{number.group(1)}</span>' if number else ""
                items.append(f'<li><a href="#{quote(section["ancre"])}">{num}<span>{h(section["titre"])}</span></a></li>')
            context += f'<p class="wiki-panel-label">Sommaire</p><ol class="wiki-toc">{"".join(items)}</ol>'
        pager = []
        for key, rel, label, arrow in (("previous", "prev", "Précédent", "←"), ("next", "next", "Suivant", "→")):
            other = here.get(key)
            if other:
                text = f'<span aria-hidden="true">{arrow}</span> {label}' if rel == "prev" else f'{label} <span aria-hidden="true">{arrow}</span>'
                pager.append(f'<a rel="{rel}" href="{link(current, other["url"])}" title="{h(other["titre"])}">{text}<span class="wiki-sr"> : {h(other["titre"])}</span></a>')
        if pager:
            context += f'<p class="wiki-here-pager">{"".join(pager)}</p>'
        context += "</div>"

    groups = []
    for subject, courses in site["subjects"]:
        overview = "matieres/" + subject["id"] + ".html"
        is_here = here.get("subject", {}).get("id") == subject["id"] or current == overview
        entries = [f'<li><a href="{link(current, overview)}"{mark(overview)}>Vue d’ensemble<span class="wiki-sr"> : {h(subject["titre"])}</span></a></li>']
        for course in courses:
            entries.append(f'<li><a href="{link(current, course["url"])}"{mark(course["url"])}><span class="wiki-num" aria-hidden="true">{course["ordre"]:02d}</span><span>{h(short_title(course, subject))}</span></a></li>')
        groups.append(f'<li><details{" open" if is_here else ""}><summary><span>{h(subject["titre"])}</span><span class="wiki-count" aria-hidden="true">{len(courses)}</span></summary><ul>{"".join(entries)}</ul></details></li>')
    routes = ""
    if site["routes"]:
        on_route = current.startswith("parcours/")
        items = "".join(f'<li><a href="{link(current, "parcours/" + route["id"] + ".html")}"{mark("parcours/" + route["id"] + ".html")}><span>{h(route["titre"])}</span></a></li>' for route in site["routes"])
        routes = (f'<p class="wiki-panel-label">Parcours</p><ul class="wiki-panel-groups"><li><details{" open" if on_route else ""}><summary><span>Faire le lien avec le soudage</span>'
                  f'<span class="wiki-count" aria-hidden="true">{len(site["routes"])}</span></summary><ul>{items}</ul></details></li></ul>')

    return f"""<aside class="wiki-panel" id="wiki-panel" aria-label="Menu du wiki" tabindex="-1">
<div class="wiki-panel-head"><a class="wiki-brand" href="{home}" title="Révisions IWE"><span class="wiki-mark" aria-hidden="true">W</span><span class="wiki-panel-text">Révisions IWE</span></a>
<button type="button" class="wiki-panel-fold" data-wiki-panel="fold" aria-controls="wiki-panel" title="Replier ou déplier le menu">{icon("fold")}<span class="wiki-sr wiki-if-open">Replier le menu</span><span class="wiki-sr wiki-if-folded">Déplier le menu</span></button>
<button type="button" class="wiki-panel-close" data-wiki-panel="close" title="Fermer le menu">{icon("close")}<span class="wiki-sr">Fermer le menu</span></button></div>
<div class="wiki-panel-scroll">
<form class="wiki-panel-search" role="search" action="{link(current, "index.html", "rechercher")}" method="get"><label class="wiki-sr" for="wiki-panel-query">Rechercher dans le wiki</label>{icon("search")}<input id="wiki-panel-query" name="q" type="search" placeholder="Rechercher une notion…" autocomplete="off"></form>
<nav class="wiki-panel-nav" aria-label="Navigation du wiki"><ul class="wiki-panel-quick">{shortcuts}</ul>
{context}<p class="wiki-panel-label">Matières</p><ul class="wiki-panel-groups">{"".join(groups)}</ul>{routes}</nav>
</div>
<div class="wiki-panel-share"><div class="wiki-actions"><button type="button" data-wiki-share="native">Partager</button><button type="button" data-wiki-share="copy">Copier le lien</button></div>
<span class="wiki-status" role="status" id="wiki-share-status"></span>
<label class="wiki-copy-fallback" hidden>Lien à copier<input readonly aria-label="Lien à copier"></label></div>
</aside>
<button type="button" class="wiki-menu-button" data-wiki-panel="open" aria-controls="wiki-panel" aria-expanded="false">{icon("menu")}<span>Menu</span></button>
<div class="wiki-backdrop" data-wiki-panel="close" hidden></div>"""


def shell(current, title, body, site, extra_head=""):
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{h(title)} · Révisions IWE</title>
<meta name="description" content="Cours interactifs et parcours de révision de la promo DU Ingénierie du soudage / IWE.">
<meta property="og:title" content="{h(title)} · Révisions IWE"><meta property="og:type" content="website">
{runtime(current)}{extra_head}</head>
<body class="wiki-shell">{panel_start()}
<main id="contenu" class="wiki-main">{body}</main>
<footer class="wiki-bottom">Supports de révision de la promo · DU Ingénierie du soudage · Polytech Nantes<br>Un complément aux cours et aux TD de la formation.</footer>
{panel(current, site)}</body></html>"""


def course_card(course, current):
    title = h(course["titre"])
    repere = h(course.get("repere", "Cours"))
    if course["statut"] == "a_venir":
        return f'<article class="wiki-card wiki-planned"><span class="wiki-eyebrow">{repere}</span><h3>{title}</h3><p class="wiki-tag">À venir</p></article>'
    url = link(current, course["url"])
    tags = " · ".join(course["ressources"])
    return f'<article class="wiki-card"><span class="wiki-eyebrow">{repere}</span><h3><a href="{url}">{title}</a></h3><p>{h(tags)}</p><span class="wiki-card-end">{len(course["sections"])} sections <span aria-hidden="true">↗</span></span></article>'


def app_card(app, current):
    title = h(app["titre"])
    genre = h(app.get("genre", "Application interactive"))
    description = f'<p>{h(app["description"])}</p>' if app.get("description") else ""
    if app["statut"] == "a_venir":
        return f'<article class="wiki-card wiki-app-card wiki-planned"><span class="wiki-eyebrow">{genre}</span><h3>{title}</h3>{description}<p class="wiki-tag">À venir</p></article>'
    tags = " · ".join(app["ressources"])
    return f'<article class="wiki-card wiki-app-card"><span class="wiki-eyebrow">{genre}</span><h3><a href="{link(current, app["url"])}">{title}</a></h3>{description}<span class="wiki-card-end">{h(tags)} <span aria-hidden="true">↗</span></span></article>'


def app_page(app, subject, site):
    """Copie publiée d'une application : panneau du wiki ajouté (replié au départ), source et routes internes intactes."""
    current = app["url"]
    head = (f'{runtime(current)}<meta name="wiki-racine" content="{link(current, "index.html").removesuffix("index.html")}"><meta name="wiki-application" content="{h(app["id"])}"><meta name="wiki-course-title" content="{h(app["titre"])}">')
    here = {"subject": subject, "repere": app.get("genre", "Application interactive"), "titre": app["titre"]}
    html = re.sub(r"</head\s*>", lambda _: head + '\n</head>', app["_source"], count=1, flags=re.I)
    html = re.sub(r"(<body\b[^>]*>)", lambda m: m.group(1) + '\n' + panel_start(folded=True), html, count=1, flags=re.I)
    return re.sub(r"</body\s*>", lambda _: panel(current, site, here) + '\n</body>', html, count=1, flags=re.I)


def validate_site(output):
    output = Path(output).resolve()
    pages = {}
    for path in output.rglob("*.html"):
        parser = CourseHTML()
        parser.feed(path.read_text(encoding="utf-8"))
        pages[path.resolve()] = parser
    checked = 0
    for path, parser in pages.items():
        for raw in parser.links:
            url = urlsplit(raw)
            if url.scheme or url.netloc:
                continue
            if url.path.startswith("/"):
                raise CatalogueError(f"lien incompatible avec un sous-chemin Pages : {path.name} → {raw}")
            target = (path.parent / unquote(url.path)).resolve() if url.path else path
            if target.is_dir():
                target = target / "index.html"
            if not target.is_relative_to(output) or not target.is_file():
                raise CatalogueError(f"lien local introuvable : {path.name} → {raw}")
            # Dans une application, #laboratoire ou #histoire/2 sont des routes internes, pas des sections.
            routed = target in pages and "wiki-application" in pages[target].meta
            if url.fragment and target in pages and not routed and unquote(url.fragment) not in pages[target].ids:
                raise CatalogueError(f"lien vers une ancre absente : {path.name} → {raw}")
            checked += 1
    return checked


def build(root):
    root = Path(root).resolve()
    data = load_catalogue(root)
    plan = load_planning(root, data)
    output = root / "_site"
    # Ne nettoyer que notre sortie marquée, jamais un lien/jonction ou un dossier arbitraire.
    if output.is_symlink() or output.is_junction() or output.resolve() != root / "_site":
        raise CatalogueError("dossier de sortie non autorisé")
    if output.exists():
        marker = output / ".wiki-generated"
        if not marker.is_file() or marker.read_text(encoding="utf-8") != MARKER:
            raise CatalogueError("dossier de sortie existant sans marqueur du générateur")
        entries = list(output.rglob("*"))
        if any(p.is_symlink() or p.is_junction() or not p.resolve().is_relative_to(output) for p in entries):
            raise CatalogueError("lien ou jonction interdite dans la sortie")
        # OneDrive peut marquer les dossiers en lecture seule. Conserver les
        # répertoires et le marqueur ; retirer uniquement les fichiers générés.
        for entry in entries:
            if entry.is_file() and entry != marker:
                entry.unlink()
    output.mkdir(exist_ok=True)
    write(output, ".wiki-generated", MARKER)
    write(output, ".nojekyll", "")
    for asset in ("wiki.css", "wiki.js", "chat-widget.js", "chat-widget.css", "assistant.css") + (("planning.css", "planning.js") if plan else ()):
        target = output / "assets" / asset
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ASSETS / asset, target)
    courses = sorted((c for c in data["cours"] if c["statut"] != "brouillon"), key=lambda c: (c["ordre"], c["id"]))
    available = [c for c in courses if c["statut"] == "disponible"]
    by_id = {c["id"]: c for c in courses}
    # Les applications complètent une matière ; l'accueil reste organisé par matières.
    apps = sorted((a for a in data["applications"] if a["statut"] != "brouillon"), key=lambda a: (a["ordre"], a["id"]))
    live_apps = [a for a in apps if a["statut"] == "disponible"]
    for app in apps:
        if app.get("raccourci") and app["raccourci"] not in ICONS:
            raise CatalogueError(f"icône de raccourci inconnue : {app['id']} → {app['raccourci']}")
    subjects = [s for s in data["matieres"] if any(item["matiere"] == s["id"] for item in [*courses, *apps])]
    subject_by_id = {s["id"]: s for s in subjects}
    # Le panneau latéral liste les cours disponibles ; brouillons et cours à venir n’y figurent pas.
    # Seules les applications disponibles qui déclarent un raccourci y ont une entrée, sous l’assistant.
    site = {"planning": bool(plan), "routes": data["parcours"],
            "explorations": [a for a in live_apps if a.get("raccourci")],
            "subjects": [(s, [c for c in available if c["matiere"] == s["id"]]) for s in subjects]}
    subject_cards = []
    for subject in subjects:
        grouped = [c for c in courses if c["matiere"] == subject["id"]]
        count = sum(c["statut"] == "disponible" for c in grouped)
        current = f"matieres/{subject['id']}.html"
        cards = "".join(course_card(c, current) for c in grouped)
        subject_apps = [a for a in apps if a["matiere"] == subject["id"]]
        training = f'<section class="wiki-training" aria-labelledby="s-entrainer"><div class="wiki-section-title"><h2 id="s-entrainer">S’entraîner</h2><span>Jeux et applications interactives</span></div><div class="wiki-grid">{"".join(app_card(a, current) for a in subject_apps)}</div></section>' if subject_apps else ""
        body = f'<p class="wiki-eyebrow">Matière · {count} cours disponibles</p><h1>{h(subject["titre"])}</h1><p class="wiki-lead">{h(subject.get("description", ""))}</p><div class="wiki-grid">{cards}</div>{training}'
        write(output, current, shell(current, subject["titre"], body, site))
        playable = sum(a["statut"] == "disponible" for a in subject_apps)
        mention = f" · {playable} application{'s' if playable > 1 else ''}" if playable else ""
        subject_cards.append(f'<a class="wiki-subject" href="{current}"><span class="wiki-eyebrow">{count} cours disponibles{mention}</span><h3>{h(subject["titre"])}</h3><p>{h(subject.get("description", ""))}</p><span aria-hidden="true">Explorer →</span></a>')
    route_cards = []
    for route in data["parcours"]:
        current = f"parcours/{route['id']}.html"
        steps = []
        for step in route["etapes"]:
            course = by_id[step["cours"]]
            label = next((s["titre"] for s in course["sections"] if s["ancre"] == step["ancre"]), course["titre"])
            href = link(current, course["url"], step["ancre"])
            steps.append(f'<li><a href="{href}">{h(label)}</a><p>{h(subject_by_id[course["matiere"]]["titre"])} · {h(course.get("repere", ""))}</p></li>')
        body = f'<p class="wiki-eyebrow">Applications au soudage · {len(steps)} étapes</p><h1>{h(route["titre"])}</h1><p class="wiki-lead">{h(route.get("description", ""))}</p><ol class="wiki-steps">{"".join(steps)}</ol>'
        write(output, current, shell(current, route["titre"], body, site))
        route_cards.append(f'<article class="wiki-card"><span class="wiki-eyebrow">{len(steps)} étapes</span><h3><a href="{current}">{h(route["titre"])}</a></h3><p>{h(route.get("description", ""))}</p></article>')
    options = ''.join(f'<option value="{s["id"]}">{h(s["titre"])}</option>' for s in subjects)
    planning_teaser = '<a class="wiki-planning-teaser" href="planning.html"><span><strong>Suivre le fil de la formation</strong><small>Pré-rentrée, semaines de cours et examens : les supports au bon moment.</small></span><span aria-hidden="true">Explorer le planning →</span></a>' if plan else ""
    assistant_teaser = ('<a class="wiki-planning-teaser wiki-assistant-teaser" href="assistant.html"><span><strong>Réviser avec l’assistant IA</strong>'
                        '<small>Des réponses citées à partir des cours. Guide pas à pas : compte OpenRouter, connexion, première question.</small></span>'
                        '<span aria-hidden="true">Suivre le guide →</span></a>')
    total_sections = sum(len(c["sections"]) for c in available)
    body = f"""<section class="wiki-hero"><p class="wiki-eyebrow">Polytech Nantes · DU Ingénierie du soudage</p>
<h1>Comprendre.<br>Relier. <em>Réviser.</em></h1>
<p class="wiki-lead">Les cours interactifs de la promo, réunis pour préparer l’IWE. Suivez une matière ou retrouvez directement la notion qui vous intéresse.</p>
<p class="wiki-stats"><strong>{len(available)}</strong> cours <span> / </span><strong>{len(subjects)}</strong> matières <span> / </span><strong>{total_sections}</strong> sections</p></section>
<div class="wiki-teasers">{planning_teaser}{assistant_teaser}</div><section id="rechercher" class="wiki-search"><h2>Une notion en tête ?</h2><form id="wiki-search-form" role="search">
<label for="wiki-query">Rechercher une notion, un cours ou une section</label><div class="wiki-search-row"><input id="wiki-query" type="search" placeholder="Préchauffage, Mohr, règle du levier…" autocomplete="off">
<label class="wiki-sr" for="wiki-subject-filter">Filtrer par matière</label><select id="wiki-subject-filter"><option value="">Toutes les matières</option>{options}</select><button type="submit">Rechercher</button></div></form>
<p id="wiki-search-status" role="status">Explorez les matières ci-dessous ou recherchez un sujet précis.</p><ul id="wiki-results" class="wiki-results"></ul><noscript>La recherche nécessite JavaScript. Les matières et les cours restent accessibles ci-dessous.</noscript></section>
<section id="matieres"><div class="wiki-section-title"><h2>Avancer par matière</h2><span>Les bases, dans l’ordre</span></div><div class="wiki-grid">{''.join(subject_cards)}</div></section>
<section id="parcours"><div class="wiki-section-title"><h2>Faire le lien avec le soudage</h2><span>Des parcours entre les cours</span></div><div class="wiki-grid">{''.join(route_cards)}</div></section>"""
    write(output, "index.html", shell("index.html", "Accueil", body, site))
    write(output, "assistant.html", shell("assistant.html", GUIDE_TITLE, render_guide(), site,
                                          extra_head='<link rel="stylesheet" href="assets/assistant.css">'))
    if plan:
        for source in plan['sources']:
            if not source.get('publier', False):
                continue
            target = output / source['fichier']
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / source['fichier'], target)
        extra = '<link rel="stylesheet" href="assets/planning.css"><script defer src="assets/planning.js"></script>'
        write(output, 'planning.html', shell('planning.html', 'Planning de formation', render_planning(plan, data, link), site, extra_head=extra))
    search_rows = []
    extracts = []
    for course in available:
        current = course["url"]
        subject = subject_by_id[course["matiere"]]
        siblings = [c for c in available if c["matiere"] == course["matiere"]]
        position = siblings.index(course)
        previous_next = []
        for index, label in ((position-1, "← Cours précédent"), (position+1, "Cours suivant →")):
            if 0 <= index < len(siblings):
                other = siblings[index]
                previous_next.append(f'<a href="{link(current, other["url"])}">{label} : {h(other["titre"])}</a>')
        prerequisites = []
        for ident in course["prerequis_conseilles"]:
            prerequisite = by_id.get(ident)
            if prerequisite and prerequisite["statut"] == "disponible":
                prerequisites.append(f'<a href="{link(current, prerequisite["url"])}">{h(prerequisite["titre"])}</a>')
        here = {"subject": subject, "repere": course.get("repere", "Cours"), "titre": course["titre"], "sections": course["sections"],
                "previous": siblings[position-1] if position > 0 else None,
                "next": siblings[position+1] if position+1 < len(siblings) else None}
        footer = '<footer class="wiki-course-footer">'
        if prerequisites:
            footer += '<p>Prérequis conseillés : ' + ' · '.join(prerequisites) + '</p>'
        related = [a for a in live_apps if course["id"] in a["cours_lies"]]
        if related:
            footer += '<p class="wiki-training-link">S’entraîner : ' + ' · '.join(f'<a href="{link(current, a["url"])}">{h(a["titre"])}</a> <span>({h(a.get("genre", "Application interactive")).lower()})</span>' for a in related) + '</p>'
        footer += '<nav aria-label="Cours voisins">' + ''.join(previous_next) + '</nav></footer>'
        head = f'{runtime(current)}<meta property="og:title" content="{h(course["titre"])}"><meta name="wiki-course-title" content="{h(course["titre"])}">'
        html = re.sub(r"<title\b[^>]*>.*?</title>", lambda _: '<title>'+h(subject['titre']+' — '+course.get('repere','Cours')+' — '+course['titre'])+'</title>', course["_source"], count=1, flags=re.I | re.S)
        html = re.sub(r"</head\s*>", lambda _: head+'\n</head>', html, count=1, flags=re.I)
        html = re.sub(r"(<body\b[^>]*>)", lambda m: m.group(1)+'\n'+panel_start()+course_storage_migration(course), html, count=1, flags=re.I)
        html = re.sub(r"</body\s*>", lambda _: footer+'\n'+panel(current, site, here)+'\n</body>', html, count=1, flags=re.I)
        write(output, current, html)
        for asset in course['fichiers_associes']:
            dest = output / asset
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(root / asset, dest)
        common = {'cours_id': course['id'], 'cours': course['titre'], 'matiere': subject['id'], 'matiere_titre': subject['titre'], 'mots_cles': course['mots_cles'], 'ressources': course['ressources']}
        search_rows.append({**common, 'titre': course['titre'], 'url': link('index.html', current), 'type': 'cours'})
        for section in course['sections']:
            search_rows.append({**common, 'titre': section['titre'], 'url': link('index.html', current, section['ancre']), 'type': 'section'})
        extracts += chat_rows(course, subject)
    for app in live_apps:
        subject = subject_by_id[app["matiere"]]
        for source, target in app["_files"]:
            if target != app["url"]:
                (output / target).parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(root / source, output / target)
        write(output, app["url"], app_page(app, subject, site))
        search_rows.append({'cours_id': app['id'], 'cours': app['titre'], 'matiere': subject['id'], 'matiere_titre': subject['titre'],
                            'mots_cles': app['mots_cles'], 'ressources': app['ressources'], 'titre': app['titre'],
                            'url': link('index.html', app['url']), 'type': 'application'})
    write(output, 'assets/recherche.json', json.dumps(search_rows, ensure_ascii=False, indent=2)+'\n')
    write(output, 'assets/chat-extraits.json', json.dumps(extracts, ensure_ascii=False, separators=(',', ':'))+'\n')
    validate_site(output)
    return output
