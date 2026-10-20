"""Interface terminal de la routine de mise à jour."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

from .build import build
from .catalogue import CatalogueError
from .maintenance import CATALOGUE, PLANNING, read_json, register, slug, prepare, publish


def ask(label, default=""):
    answer = input(f"{label}" + (f" [{default}]" if default else "") + " : ").strip()
    return answer or default


def choose(label, items, extra=None):
    print(f"\n{label}")
    for index, (ident, title) in enumerate(items, 1):
        print(f"  {index}. {title} ({ident})")
    if extra is not None:
        print(f"  0. {extra}")
    while True:
        answer = ask("Numéro", "0" if extra is not None else "")
        if extra is not None and answer == "0":
            return None
        if answer.isdigit() and 1 <= int(answer) <= len(items):
            return items[int(answer) - 1][0]
        print("Choisissez un numéro de la liste.")


def add_guided(root):
    data = read_json(root / CATALOGUE)
    source = ask("Fichier dans le projet (chemin relatif ou Copier en tant que chemin dans l’Explorateur)")
    if not source:
        print("Ajout annulé.")
        return
    ident = choose("Compléter un support déjà annoncé ?", [(c["id"], c["titre"]) for c in data["cours"] if c["statut"] != "disponible"], "Créer un nouveau support")
    existing = next((c for c in data["cours"] if c["id"] == ident), None)
    subject_title = None
    if existing:
        title = existing["titre"]
        subject = existing["matiere"]
        print(f"Identifiant, titre, prérequis et adresse conservés : {ident} · {title}")
    else:
        title = ask("Titre affiché", Path(source.strip('"')).stem)
        ident = ask("Identifiant stable", slug(title))
        if any(c["id"] == ident for c in data["cours"]):
            raise CatalogueError("Cet identifiant existe. Pour une correction, modifiez son fichier existant puis publiez.")
        subject = choose("Matière", [(s["id"], s["titre"]) for s in data["matieres"]], "Créer une matière")
        if subject is None:
            subject_title = ask("Nom de la nouvelle matière")
            subject = ask("Identifiant de la matière", slug(subject_title))
    keywords = [s.strip() for s in ask("Mots-clés facultatifs, séparés par des virgules").split(",") if s.strip()]
    assets = [s.strip().strip('"') for s in ask("Fichiers associés au HTML (images/CSS/JS), séparés par ; — Entrée si autonome").split(";") if s.strip()]
    topics = []
    if (root / PLANNING).exists():
        plan = read_json(root / PLANNING)
        linked = [t["titre"] for t in plan["sujets"] if any(s["cours"] == ident for s in t["supports"])]
        if linked:
            print("Déjà relié au planning : " + ", ".join(linked))
        while True:
            query = ask("Relier au planning : mot du sujet ou code IWE (Entrée pour terminer)")
            if not query:
                break
            matches = [(t["id"], (t.get("code", "") + " " + t["titre"]).strip()) for t in plan["sujets"]
                       if slug(query) in slug(t.get("code", "") + " " + t["titre"])]
            if not matches:
                print("Aucun sujet trouvé. Essayez un autre mot ; aucune date n’est déduite automatiquement.")
                continue
            topic = choose("Sujet du planning", matches, "Chercher autrement")
            if topic and topic not in topics:
                topics.append(topic)
                print("Sujet ajouté. Vous pouvez en choisir un autre.")
    print(f"\nSupport : {title}\nIdentifiant : {ident}\nMatière : {subject}\nFichier : {source}")
    print("Il sera disponible à la prochaine publication publique. Le site candidat est vérifié avant enregistrement.")
    if ask("Enregistrer ? oui/non", "non").lower() != "oui":
        print("Ajout annulé.")
        return
    course = register(root, source, ident=ident, title=title, subject=subject, subject_title=subject_title,
                      topics=topics, assets=assets, keywords=keywords if keywords else None)
    print(f"Enregistré et validé : {course['url']}\nVous pouvez maintenant ouvrir l’aperçu, puis publier.")


def preview(root, port=8000):
    output = build(root)
    handler = partial(SimpleHTTPRequestHandler, directory=str(output))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as server:
        url = f"http://127.0.0.1:{server.server_port}/"
        print(f"Aperçu : {url}\nCtrl+C pour arrêter. Relancez l’aperçu après une modification.", flush=True)
        webbrowser.open(url)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nAperçu arrêté.")


def menu(root):
    while True:
        print("\nPolyWE — Mettre à jour les supports\n1. Ajouter un cours ou document\n2. Vérifier la mise à jour\n3. Ouvrir l’aperçu local\n4. Publier sur GitHub Pages\n0. Quitter")
        choice = ask("Choix", "0")
        if choice == "0":
            return
        action = {"1": add_guided, "2": prepare, "3": preview, "4": publish}.get(choice)
        if action is None:
            print("Choisissez un numéro du menu.")
            continue
        try:
            action(root)
        except (CatalogueError, OSError) as exc:
            print(f"Erreur : {exc}")