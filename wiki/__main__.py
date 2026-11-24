import argparse
import sys
from pathlib import Path

from .build import build
from .catalogue import CatalogueError, load_catalogue
from .planning import load_planning
from .maintenance import prepare, publish, register, read_json, json_text, PLANNING, slug
from .routine import menu, add_guided, preview
from .integration import context, integrate


def main():
    parser = argparse.ArgumentParser(description="Construire et mettre à jour le wiki IWE")
    commands = parser.add_subparsers(dest="command")
    for name, help_text in (("check", "Contrôler les données"), ("build", "Construire le site"),
                            ("gerer", "Ouvrir le menu de mise à jour"), ("preparer", "Tester et construire"),
                            ("publier", "Vérifier puis publier les contenus sur GitHub")):
        commands.add_parser(name, help=help_text)
    add = commands.add_parser("ajouter", help="Enregistrer un support ; assistant si aucun fichier indiqué")
    add.add_argument("fichier", nargs="?")
    add.add_argument("--id", dest="ident")
    add.add_argument("--titre", dest="title")
    add.add_argument("--matiere", dest="subject")
    add.add_argument("--nouvelle-matiere", dest="subject_title", help="Titre d’une nouvelle matière")
    add.add_argument("--sujet", dest="topics", action="append", default=[], help="Identifiant de sujet du planning ; répétable")
    add.add_argument("--ressource", dest="assets", action="append", default=[], help="Fichier associé à publier ; répétable")
    add.add_argument("--mot-cle", dest="keywords", action="append")
    show = commands.add_parser("apercu", help="Construire et ouvrir un aperçu local")
    show.add_argument("--port", type=int, default=8000)
    topics = commands.add_parser("sujets", help="Lister les sujets du planning")
    topics.add_argument("filtre", nargs="?", default="")
    focused = commands.add_parser("contexte", help="Lire les seules métadonnées et sections utiles à un cours")
    focused.add_argument("ident")
    delivery = commands.add_parser("integrer", help="Valider une fiche JSON de cours sans modifier le dépôt")
    delivery.add_argument("fiche", type=Path)
    delivery.add_argument("--appliquer", action="store_true", help="Enregistrer les métadonnées après validation")
    delivery.add_argument("--apercu", type=Path, help="Nouveau dossier extérieur au dépôt pour conserver le site candidat")
    args = parser.parse_args()
    if args.command in {"contexte", "integrer"}:
        # JSON et comptes rendus lisibles aussi dans les pipes Windows CP1252.
        for stream in (sys.stdout, sys.stderr):
            if hasattr(stream, "reconfigure"):
                stream.reconfigure(encoding="utf-8")
    root = Path.cwd()
    try:
        if args.command == "check":
            data = load_catalogue(root)
            plan = load_planning(root, data)
            if plan:
                print(f"Planning valide : {len(plan['seances'])} séances et périodes.")
            available = [c for c in data["cours"] if c["statut"] == "disponible"]
            apps = sum(a["statut"] == "disponible" for a in data["applications"])
            print(f"Catalogue valide : {len(available)} cours disponibles, {sum(len(c['sections']) for c in available)} sections, {apps} application{'s' if apps > 1 else ''}.")
        elif args.command == "build":
            print(f"Site construit et liens contrôlés : {build(root)}")
        elif args.command == "ajouter":
            if args.fichier is None:
                add_guided(root)
            else:
                if not args.ident:
                    parser.error("ajouter FICHIER nécessite --id (ou lancez ajouter sans argument pour l’assistant)")
                course = register(root, args.fichier, ident=args.ident, title=args.title, subject=args.subject,
                                  subject_title=args.subject_title, topics=args.topics, assets=args.assets, keywords=args.keywords)
                print(f"Support enregistré et validé : {course['url']}")
        elif args.command == "contexte":
            print(json_text(context(root, args.ident)), end="")
        elif args.command == "integrer":
            course = integrate(root, read_json(args.fiche), apply=args.appliquer, preview=args.apercu)
            print(f"{'Enregistré' if args.appliquer else 'Validé sans enregistrement'} : {course['id']} → {course['url']}")
            if args.apercu:
                print(f"Aperçu : {args.apercu.resolve() / '_site'}")
        elif args.command == "preparer":
            prepare(root)
        elif args.command == "publier":
            publish(root)
        elif args.command == "apercu":
            preview(root, args.port)
        elif args.command == "sujets":
            plan = read_json(root / PLANNING)
            for topic in plan["sujets"]:
                label = f"{topic.get('code', '')} {topic['titre']}"
                if slug(args.filtre) in slug(label):
                    print(f"{topic['id']} : {label.strip()}")
        else:
            menu(root)
    except (CatalogueError, OSError) as exc:
        parser.exit(1, f"Erreur : {exc}\n")
    except (KeyboardInterrupt, EOFError):
        parser.exit(1, "\nOpération interrompue.\n")


if __name__ == "__main__":
    main()
