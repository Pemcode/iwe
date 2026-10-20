"""Génère les données de la carte des notions à partir des cours du wiki.

    uv run --group carte python applications/carte-notions/scripts/generer_carte.py [--sources-locales] [--recalculer]
                                                                                   [--rapport FICHIER] [--temoins id ...]

Écrit data/carte-data.js (lu par la page, y compris en file://) et data/positions.json (mémoire de la disposition).
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE.parent
sys.path.insert(0, str(HERE))

from carte_disposition import layout  # noqa: E402
from carte_graphe import REPO, analyse, build_vocabulary, read_courses  # noqa: E402

KINDS = {"notion": "n", "sigle": "s", "norme": "o", "designation": "d"}
TEMOINS = ["ferrite", "martensite", "hydrogene", "courbe-de-wohler", "flux-de-soudage", "flux-de-brasage", "prechauffage",
           "zat", "essai-charpy", "mouillage", "phase-sigma", "carbone-equivalent", "cercle-de-mohr", "loi-de-paris",
           "fluage", "fissuration-a-chaud"]


def read_json(path, default):
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else default


def generate(root=REPO, data_dir=APP / "data", local=False, recalculate=False):
    """Calcule la carte, met à jour la mémoire des positions et écrit les données de la page."""
    curation = read_json(data_dir / "vocabulaire.json", {})
    corpus = read_courses(root, local=local, curation=curation)
    graph = analyse(corpus, build_vocabulary(corpus, curation))
    memory = {} if recalculate else read_json(data_dir / "positions.json", {})
    ids = [n["id"] for n in graph["notions"]]
    edges = [(l["a"], l["b"], l["s"]) for l in graph["liens"]]
    groups = [n["continent"] for n in graph["notions"]]
    flat, flat_scale = layout(ids, edges, 2, memory.get("2d"), memory.get("echelle2d"), groups)
    deep, deep_scale = layout(ids, edges, 3, memory.get("3d"), memory.get("echelle3d"), groups)
    # Une notion absente de cette version garde sa place pour le jour où elle revient (mode catalogue ou local).
    memory = {"version": 1, "echelle2d": round(flat_scale, 6), "echelle3d": round(deep_scale, 6),
              "2d": dict(sorted({**memory.get("2d", {}), **flat}.items())),
              "3d": dict(sorted({**memory.get("3d", {}), **deep}.items()))}
    subjects = {s["id"]: i for i, s in enumerate(graph["matieres"])}
    course_index = {c["id"]: i for i, c in enumerate(graph["cours"])}
    data = {
        "version": 1, "mode": graph["mode"], "passages": graph["passages"],
        "matieres": graph["matieres"],
        "cours": [{"id": c["id"], "titre": c["titre"], "m": subjects[c["matiere"]], "url": c["url"], "fichier": c["fichier"],
                   "s": c["sections"]} for c in graph["cours"]],
        "continents": [{"nom": c["nom"], "taille": c["taille"], "m": subjects.get(c["matiere"])} for c in graph["continents"]],
        "notions": [{"id": n["id"], "l": n["label"], "k": KINDS[n["kind"]], "a": n["aliases"],
                     "d": [[t, course_index[course]] for t, course in n["definitions"] if course in course_index],
                     "f": n["freq"], "m": [[subjects[s], count] for s, count in n["matieres"] if s in subjects],
                     "h": 1 if n["carrefour"] else 0, "c": n["continent"], "p": n["poids"], "r": n["refs"],
                     "x": flat[n["id"]], "z": deep[n["id"]]} for n in graph["notions"]],
        "liens": [[l["a"], l["b"], l["s"], l["n"], l["def"], 1 if l["faible"] else 0, l["preuves"]] for l in graph["liens"]],
    }
    data_dir.mkdir(parents=True, exist_ok=True)
    body = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    (data_dir / "carte-data.js").write_text(
        "/* Généré par scripts/generer_carte.py à partir des cours du wiki : ne pas modifier à la main. */\n"
        "(function (root) {\n  var data = " + body + ";\n"
        "  if (typeof module === 'object' && module.exports) module.exports = data; else root.CARTE_NOTIONS = data;\n"
        "})(typeof globalThis !== 'undefined' ? globalThis : this);\n", encoding="utf-8")
    (data_dir / "positions.json").write_text(json.dumps(memory, ensure_ascii=False, indent=0, sort_keys=False) + "\n",
                                             encoding="utf-8")
    return data, corpus["avertissements"]


def report(data, temoins):
    """Statistiques et voisins des notions témoins, à relire avant de construire l'interface."""
    notions, links = data["notions"], data["liens"]
    lines = [f"# Carte des notions : rapport ({data['mode']})", "",
             f"- {len(data['cours'])} cours, {data['passages']} passages, {len(notions)} notions, {len(links)} liens",
             f"- {sum(n['h'] for n in notions)} carrefours (notions présentes dans trois matières ou plus)", "",
             "## Continents", ""]
    for c in data["continents"]:
        subject = data["matieres"][c["m"]]["titre"] if c["m"] is not None else "—"
        lines.append(f"- **{c['nom']}** : {c['taille']} notions, surtout {subject}")
    neighbours = {i: [] for i in range(len(notions))}
    for a, b, s, n, d, weak, _ in links:
        neighbours[a].append((s, b, n, d, weak))
        neighbours[b].append((s, a, n, d, weak))
    index = {n["id"]: i for i, n in enumerate(notions)}
    lines += ["", "## Voisins des notions témoins", "",
              "📖 : la définition de l'une cite l'autre · n : passages communs · ~ : lien faible (même section)", ""]
    for ident in temoins:
        if ident not in index:
            lines += [f"### {ident} : absente", ""]
            continue
        i = index[ident]
        node = notions[i]
        subjects = ", ".join(f"{data['matieres'][m]['titre']} ({c})" for m, c in node["m"][:4])
        lines += [f"### {node['l']}", "", f"{node['f']} passages · {subjects}" + (" · carrefour" if node["h"] else ""), ""]
        for s, j, n, d, weak in sorted(neighbours[i], key=lambda x: -x[0])[:12]:
            lines.append(f"- {notions[j]['l']} — {s:.2f} · n = {n}{' · 📖' if d else ''}{' · ~' if weak else ''}")
        lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Générer les données de la carte des notions")
    parser.add_argument("--sources-locales", action="store_true", help="Inclure les cours de Cours/ pas encore au catalogue")
    parser.add_argument("--recalculer", action="store_true", help="Oublier les positions mémorisées (carte entièrement neuve)")
    parser.add_argument("--rapport", type=Path, help="Écrire le rapport des voisins dans ce fichier Markdown")
    parser.add_argument("--temoins", nargs="*", default=TEMOINS)
    args = parser.parse_args()
    data, warnings = generate(local=args.sources_locales, recalculate=args.recalculer)
    for warning in warnings:
        print("Avertissement :", warning)
    print(f"Carte générée ({data['mode']}) : {len(data['notions'])} notions, {len(data['liens'])} liens, "
          f"{len(data['continents'])} continents, {len(data['cours'])} cours.")
    if args.rapport:
        args.rapport.write_text(report(data, args.temoins), encoding="utf-8")
        print("Rapport :", args.rapport)


if __name__ == "__main__":
    main()
