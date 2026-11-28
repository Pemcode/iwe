"""S50 : retrouver chaque matière sous son module, y compris les matières futures."""
import copy
import re

import pytest

from conftest import save_catalogue
from wiki.build import build
from wiki.catalogue import CatalogueError, CourseHTML


def test_home_and_panel_group_subjects_without_losing_unclassified_ones(project):
    root, data = project
    template = data["cours"][0]
    data["matieres"] = []
    data["cours"] = []
    labels = ["Procédés", "Matériaux", "Conception et calcul", "Contrôle et fabrication", "Autres"]
    for ident, module in [("p", "procedes"), ("m", "materiaux"), ("c", "conception"),
                          ("f", "fabrication"), ("absent", None), ("futur", "inconnu")]:
        subject = {"id": ident, "titre": "Matière " + ident}
        if module is not None:
            subject["module"] = module
        data["matieres"].append(subject)
        course = copy.deepcopy(template)
        course.update(id=ident + "-01", matiere=ident, fichier=f"Thermique/{ident}.html", url=f"Thermique/{ident}.html")
        (root / course["fichier"]).write_text((root / "Thermique/introduction.html").read_text(encoding="utf-8"), encoding="utf-8")
        data["cours"].append(course)
    data["matieres"].reverse()  # L'ordre des modules ne dépend pas de celui du JSON.
    data["matieres"].append({"id": "vide", "titre": "À rédiger", "module": "procedes"})
    save_catalogue(root, data)
    output = build(root)
    for filename in ("index.html", "matieres/p.html", "Thermique/p.html"):
        html = (output / filename).read_text(encoding="utf-8")
        panel = re.search(r'<nav class="wiki-panel-nav".*?</nav>', html, re.S).group()
        headings = re.findall(r'<h[23][^>]*>(.*?)</h[23]>', panel)
        assert headings == labels, "Le menu doit présenter les modules dans l'ordre pédagogique."
        assert "À rédiger" not in panel
        for ident in ("p", "m", "c", "f", "absent", "futur"):
            assert f"Matière {ident}</span>" in panel
    home = (output / "index.html").read_text(encoding="utf-8")
    modules = re.findall(r'<section class="wiki-module".*?</section>', home, re.S)
    assert len(modules) == 5
    for section, title, identifiers in zip(modules, labels, [("p",), ("m",), ("c",), ("f",), ("futur", "absent")]):
        assert re.search(r'<h3[^>]*>(.*?)</h3>', section).group(1) == title
        parsed = CourseHTML()
        parsed.feed(section)
        assert parsed.links == [f"matieres/{ident}.html" for ident in identifiers]


def test_invalid_module_is_reported_as_catalogue_error(project):
    root, data = project
    data["matieres"][0]["module"] = ["procedes"]
    save_catalogue(root, data)
    with pytest.raises(CatalogueError, match="module texte attendu"):
        build(root)
