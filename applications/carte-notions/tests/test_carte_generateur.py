"""Générateur : données complètes pour la page, reproductibles, et mémoire des positions conservée."""
import json
import shutil
import sys
from pathlib import Path

import pytest

pytest.importorskip("numpy")
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from generer_carte import generate  # noqa: E402
from test_carte_graphe import GLOSSARY, course_html, project  # noqa: E402,F401

PARAGRAPHS = [["La ferrite et l'austénite de l'acier."] * 3, ["La bainite et la martensite après trempe."] * 3,
              ["La martensite et l'austénite."] * 2, ["La perlite et la ferrite."] * 2]
EXTRA = GLOSSARY + [("Trempe", "Refroidissement rapide qui donne de la martensite."), ("Perlite", "Ferrite et cémentite.")]


def load(data_dir):
    text = (data_dir / "carte-data.js").read_text(encoding="utf-8")
    return json.loads(text[text.index("var data = ") + 11:text.index(";\n  if (typeof module")])


def test_generated_data_is_complete_and_reproducible(project, tmp_path):
    root = project([("met-01", "metallurgie", course_html(PARAGRAPHS, EXTRA), "disponible")])
    first, second = tmp_path / "un", tmp_path / "deux"
    generate(root, first, recalculate=True)
    generate(root, second, recalculate=True)
    assert (first / "carte-data.js").read_text(encoding="utf-8") == (second / "carte-data.js").read_text(encoding="utf-8")
    data = load(first)
    assert data["mode"] == "catalogue" and data["notions"]
    for notion in data["notions"]:
        assert len(notion["x"]) == 2 and len(notion["z"]) == 3
        for course, section, _ in notion["r"]:
            assert data["cours"][course]["s"][section][0].startswith("c")
    assert all(0 <= a < len(data["notions"]) and 0 <= b < len(data["notions"]) for a, b, *_ in data["liens"])


def test_positions_memory_survives_a_regeneration(project, tmp_path):
    root = project([("met-01", "metallurgie", course_html(PARAGRAPHS, EXTRA), "disponible")])
    data_dir = tmp_path / "data"
    generate(root, data_dir, recalculate=True)
    before = {n["id"]: n["x"] for n in load(data_dir)["notions"]}
    generate(root, data_dir)
    after = {n["id"]: n["x"] for n in load(data_dir)["notions"]}
    assert max(abs(a - b) for k in before for a, b in zip(before[k], after[k])) < 0.02
    memory = json.loads((data_dir / "positions.json").read_text(encoding="utf-8"))
    assert set(before) <= set(memory["2d"]) and memory["echelle2d"] > 0
