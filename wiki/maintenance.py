"""Intégration guidée et publication des seuls contenus déclarés, sans dépendance runtime."""
from datetime import date
from html import escape
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unicodedata

from .build import build, link
from .catalogue import CatalogueError, relative_path, source_file

DOCUMENTS = {".pdf": "PDF", ".docx": "Word", ".pptx": "PowerPoint", ".xlsx": "Excel"}
CATALOGUE = "catalogue-cours.json"
PLANNING = "planning-formation.json"
ACTIONS = "https://github.com/Pemcode/iwe/actions"
SITE = "https://pemcode.github.io/iwe/"


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError) as exc:
        raise CatalogueError(f"Fichier JSON illisible : {path.name} ({exc})") from exc


def json_text(data):
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def local_path(root, value):
    path = Path(str(value).strip().strip('"'))
    path = path if path.is_absolute() else root / path
    try:
        name = path.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        raise CatalogueError("Déposez d’abord le fichier dans un dossier de matière du projet.") from None
    relative_path(name)
    source_file(root, name)
    if name.split("/")[0].casefold() == "planning":
        raise CatalogueError("Les PDF de Planning restent locaux. Leur publication nécessite une décision distincte.")
    if (root / ".git").exists():
        ignored = subprocess.run(["git", "check-ignore", "--", name], cwd=root, capture_output=True)
        if ignored.returncode == 0:
            raise CatalogueError(f"Fichier exclu de Git, non publiable par cette routine : {name}")
    return name


def content_files(data, plan):
    """Liste positive partagée entre validation en copie et publication Git."""
    files = {CATALOGUE}
    for course in data["cours"]:
        if course["statut"] == "disponible":
            files.add(course["fichier"])
            files.update(course.get("fichiers_associes", []))
    if plan is not None:
        files.add(PLANNING)
        files.update(s["fichier"] for s in plan["sources"] if s.get("publier", False))
    return files


def build_inputs(data, plan):
    """Entrées du build : contenus publiables et code déclaré des applications.

    Le code des applications n’appartient pas aux contenus : `publier` ne l’embarque pas,
    mais un site candidat doit l’inclure pour être validé complet."""
    files = content_files(data, plan)
    for app in data.get("applications", []):
        if app.get("statut") == "disponible":
            files.update(f"{app['source']}/{name}" for name in app.get("fichiers", []))
    return files


def validate_candidate(root, data, plan, new_files):
    # Le build candidat ne touche ni les sources ni l’aperçu courant.
    with TemporaryDirectory(prefix="iwe-validation-") as directory:
        candidate = Path(directory)
        metadata = {CATALOGUE: json_text(data)}
        if plan is not None:
            metadata[PLANNING] = json_text(plan)
        for name in build_inputs(data, plan):
            relative_path(name)
            target = candidate / name
            target.parent.mkdir(parents=True, exist_ok=True)
            if name in metadata:
                target.write_text(metadata[name], encoding="utf-8")
            elif name in new_files:
                target.write_text(new_files[name], encoding="utf-8")
            else:
                shutil.copyfile(source_file(root, name), target)
        build(candidate)


def register(root, source, *, ident, title=None, subject=None, subject_title=None,
             topics=(), assets=(), keywords=None):
    """Inscrire ou activer un support ; aucun octet source existant n’est modifié."""
    root = Path(root).resolve()
    name = local_path(root, source)
    suffix = Path(name).suffix.lower()
    if suffix not in {".html", *DOCUMENTS}:
        raise CatalogueError("Formats acceptés : HTML, PDF, DOCX, PPTX, XLSX.")
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", ident):
        raise CatalogueError("Identifiant attendu : minuscules, chiffres et tirets.")
    original = {CATALOGUE: (root / CATALOGUE).read_bytes()}
    data = read_json(root / CATALOGUE)
    plan = read_json(root / PLANNING) if (root / PLANNING).exists() else None
    if plan is not None:
        original[PLANNING] = (root / PLANNING).read_bytes()
    course = next((c for c in data["cours"] if c["id"] == ident), None)
    is_new = course is None
    if is_new:
        if not title or not subject:
            raise CatalogueError("Le titre et la matière sont requis pour un nouveau support.")
        order = max((c["ordre"] for c in data["cours"] if c["matiere"] == subject), default=0) + 1
        course = {"id": ident, "titre": title, "matiere": subject, "ordre": order,
                  "repere": f"Cours {order:02}" if suffix == ".html" else "Document",
                  "prerequis_conseilles": [], "mots_cles": [], "ressources": [], "fichiers_associes": []}
        data["cours"].append(course)
    if not is_new and course["statut"] == "disponible" and not course.get("url"):
        course["url"] = course["fichier"]
    if subject:
        course["matiere"] = subject
    if title:
        course["titre"] = title
    if not any(s["id"] == course["matiere"] for s in data["matieres"]):
        if not subject_title:
            raise CatalogueError("Donnez un titre à la nouvelle matière.")
        data["matieres"].append({"id": course["matiere"], "titre": subject_title, "description": ""})
    associated = list(dict.fromkeys([*course.get("fichiers_associes", []), *(local_path(root, p) for p in assets)]))
    new_files = {}
    if suffix == ".html":
        course["fichier"] = name
        if not course.get("url"):
            parent = Path(name).parent.as_posix()
            course["url"] = f"{parent if parent != '.' else 'Supports'}/{ident}.html"
        if not course.get("ressources"):
            course["ressources"] = ["cours"]
    else:
        wrapper = f"Supports/{ident}.html"
        if (root / wrapper).exists():
            raise CatalogueError(f"La page {wrapper} existe déjà. Pour corriger le document, remplacez son fichier puis publiez.")
        format_name = DOCUMENTS[suffix]
        current = course.get("url") or wrapper
        new_files[wrapper] = f'''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(course['titre'])}</title></head><body class="wiki-shell">
<main class="wiki-main"><p class="wiki-eyebrow">Document · {format_name}</p><h1>{escape(course['titre'])}</h1>
<section id="document"><h2>Consulter le document</h2>
<p>Retrouvez le support complet dans le fichier {format_name}.</p>
<p><a href="{link(current, name)}">Ouvrir le document ({format_name}) ↗</a></p>
<p><a href="{link(current, name)}" download>Télécharger le {format_name}</a></p></section></main>
</body></html>'''
        course.update(fichier=wrapper, url=current, ressources=[f"document {format_name}"])
        associated = list(dict.fromkeys([*associated, name]))
    course["fichiers_associes"] = associated
    course["statut"] = "disponible"
    if keywords is not None:
        course["mots_cles"] = list(keywords)
    for topic_id in topics:
        topic = next((t for t in plan["sujets"] if t["id"] == topic_id), None) if plan else None
        if topic is None:
            raise CatalogueError(f"Sujet de planning inconnu : {topic_id}")
        if not any(s["cours"] == ident for s in topic["supports"]):
            topic["supports"].append({"cours": ident})
    data["date_inventaire"] = date.today().isoformat()
    for target in [CATALOGUE, PLANNING, *new_files]:
        if not (root / target).resolve().is_relative_to(root):
            raise CatalogueError(f"Destination extérieure au projet : {target}")
    validate_candidate(root, data, plan, new_files)
    writes = {CATALOGUE: json_text(data), **new_files}
    if plan is not None and plan != json.loads(original[PLANNING].decode("utf-8-sig")):
        writes[PLANNING] = json_text(plan)
    # Refuser une modification concurrente plutôt que réécrire un JSON devenu périmé.
    if any((root / p).read_bytes() != value for p, value in original.items()):
        raise CatalogueError("Les métadonnées ont changé pendant la validation. Relancez l’ajout.")
    written = []
    try:
        for name, text in writes.items():
            target = root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            # Mode exclusif pour une nouvelle page ; ne jamais écraser une source.
            with target.open("x" if name in new_files else "w", encoding="utf-8", newline="\n") as stream:
                written.append(name)
                stream.write(text)
    except OSError:
        for name in written:
            if name in original:
                (root / name).write_bytes(original[name])
            else:
                (root / name).unlink()
        raise
    return course


def git(root, *args, check=True):
    result = subprocess.run(["git", *args], cwd=root, capture_output=True, text=True, encoding="utf-8")
    if check and result.returncode:
        raise CatalogueError(f"Git : {result.stderr.strip() or result.stdout.strip()}")
    return result


def names(result):
    return set(filter(None, result.stdout.split("\0")))


def changes(root, allowed):
    modified = names(git(root, "diff", "--name-only", "-z", "HEAD"))
    untracked = names(git(root, "ls-files", "--others", "--exclude-standard", "-z"))
    return sorted((modified | untracked) & allowed), sorted(modified - allowed)


def prepare(root):
    print("Vérification des tests…", flush=True)
    result = subprocess.run([sys.executable, "-m", "pytest", "-q"], cwd=root)
    if result.returncode:
        raise CatalogueError("Tests en échec : aucune publication. Corrigez l’erreur puis relancez.")
    print(f"Site construit, liens contrôlés : {build(root)}")
    if (root / ".git").exists():
        plan = read_json(root / PLANNING) if (root / PLANNING).exists() else None
        pending, others = changes(root, content_files(read_json(root / CATALOGUE), plan))
        print("Contenus modifiés :")
        for name in pending:
            print(f"  {name}")
        if not pending:
            print("  Aucun fichier de contenu modifié.")
        if others:
            print("Modifications hors contenu à traiter séparément : " + ", ".join(others))
    print("Aperçu : uv run python -m wiki apercu\nPublication : uv run python -m wiki publier")


def publish(root, *, confirm=input):
    root = Path(root).resolve()
    prepare(root)
    if git(root, "branch", "--show-current").stdout.strip() != "main":
        raise CatalogueError("La routine publie depuis main. Terminez d’abord le travail sur votre branche.")
    if git(root, "diff", "--cached", "--quiet", check=False).returncode:
        raise CatalogueError("Des fichiers sont déjà dans l’index Git. Traitez cette sélection avant de publier.")
    data = read_json(root / CATALOGUE)
    plan = read_json(root / PLANNING) if (root / PLANNING).exists() else None
    allowed = content_files(data, plan)
    pending, others = changes(root, allowed)
    if others:
        raise CatalogueError("Modifications hors contenu à traiter séparément : " + ", ".join(others))
    git(root, "fetch", "origin", "main")
    if git(root, "merge-base", "--is-ancestor", "origin/main", "HEAD", check=False).returncode:
        raise CatalogueError("GitHub contient des commits absents localement. Synchronisez avec git pull --ff-only avant de republier.")
    ahead = names(git(root, "diff", "--name-only", "-z", "origin/main", "HEAD"))
    # Vérifier chaque commit, pas seulement le diff final (un fichier privé ajouté
    # puis retiré resterait public dans l’historique).
    committed = names(git(root, "log", "--format=", "--name-only", "-z", "origin/main..HEAD"))
    committed = {p.lstrip("\n") for p in committed if p.strip()}
    if committed - allowed:
        raise CatalogueError("Des commits locaux contiennent des fichiers hors contenu. Publiez-les via le circuit de développement.")
    count = int(git(root, "rev-list", "--count", "origin/main..HEAD").stdout.strip())
    if not pending and not count:
        print("Aucune mise à jour à publier.")
        return
    print("\nFichiers concernés par la publication publique :")
    for name in sorted(set(pending) | ahead | committed):
        print(f"  {name}")
    print(f"{count} commit(s) local(aux) en attente. Le déploiement sera contrôlé par GitHub Actions.")
    if confirm("Tapez publier pour envoyer sur GitHub (Entrée = annuler) : ").strip().lower() != "publier":
        print("Publication annulée ; les fichiers locaux sont conservés.")
        return
    if pending:
        git(root, "add", "--", *(f":(literal){p}" for p in pending))
        try:
            git(root, "commit", "-m", f"Mettre à jour les supports ({date.today().isoformat()})")
        except CatalogueError:
            git(root, "reset", "--quiet", "HEAD", "--", *(f":(literal){p}" for p in pending))
            raise
    try:
        git(root, "push", "origin", "HEAD:main")
    except CatalogueError as exc:
        raise CatalogueError(f"{exc}\nLe commit reste local. Après résolution, relancez publier pour réessayer sans recréer le commit.") from exc
    print(f"Envoyé sur GitHub. Déploiement Pages en cours de vérification : {ACTIONS}\nSite après succès du déploiement : {SITE}")