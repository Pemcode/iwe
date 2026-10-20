"""Vocabulaire : découpage des glossaires et reconnaissance des notions dans le texte."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

from carte_vocabulaire import Matcher, glossary_entries, parse_entry  # noqa: E402


def labels(dt, dd="déf."):
    return [(t.label, t.kind) for t in parse_entry(dt, dd)]


def test_symbols_units_and_math_are_dropped():
    assert labels("R_e, R_m") == []
    assert labels("ε, ε̇, ε̇_min") == []
    assert labels("MPa, GPa, kN, MN") == []
    assert labels("log, ln, exp") == []
    assert labels("da/dN") == []


def test_grouped_entry_pairs_each_term_with_its_definition():
    terms = parse_entry("Anode, cathode", "Le métal qui se dissout ; celui où l'oxygène est réduit.")
    assert [(t.label, t.definition) for t in terms] == [
        ("Anode", "Le métal qui se dissout."), ("Cathode", "Celui où l'oxygène est réduit.")]
    shared = parse_entry("Martensite, bainite", "Deux constituants de trempe.")
    assert [t.definition for t in shared] == ["Deux constituants de trempe."] * 2


def test_named_laws_ellipses_and_qualifiers():
    assert labels("Norton (loi de)") == [("Loi de Norton", "notion")]
    assert labels("Arrhenius (loi d')") == [("Loi d'Arrhenius", "notion")]
    assert labels("Austénitique (acier)") == [("Acier austénitique", "notion")]
    assert labels("Courbe conventionnelle, rationnelle") == [("Courbe conventionnelle", "notion"), ("Courbe rationnelle", "notion")]
    assert labels("Enrobage à froid, à chaud") == [("Enrobage à froid", "notion"), ("Enrobage à chaud", "notion")]
    assert labels("Martensite (en lattes, revenue, fraîche)") == [("Martensite", "notion")]
    assert labels("σ (phase sigma)") == [("Phase sigma", "notion")]
    fissuration = parse_entry("Fissuration à froid (FAF)", "déf.")[0]
    assert fissuration.label == "Fissuration à froid" and "FAF" in fissuration.aliases


def test_trailing_symbols_are_display_aliases_but_phase_letters_stay():
    energy = parse_entry("Énergie de soudage Q", "déf.")[0]
    assert energy.label == "Énergie de soudage" and energy.aliases == ["Q"]
    assert labels("Carbone équivalent CE") == [("Carbone équivalent", "notion")]
    assert parse_entry("Carbone équivalent CE", "déf.")[0].aliases == ["CE"]
    assert labels("Ferrite δ") == [("Ferrite δ", "notion")]
    assert labels("Phase σ") == [("Phase σ", "notion")]


def test_norms_acronyms_and_designations_are_typed():
    assert labels("ISO 6506-1, 6507-1, 6508-1") == [("ISO 6506-1", "norme"), ("ISO 6507-1", "norme"), ("ISO 6508-1", "norme")]
    assert labels("ISO 6892-1, -2, -3") == [("ISO 6892-1", "norme"), ("ISO 6892-2", "norme"), ("ISO 6892-3", "norme")]
    assert labels("ASTM A48, A536") == [("ASTM A48", "norme"), ("ASTM A536", "norme")]
    assert labels("ZAT") == [("ZAT", "sigle")]
    assert labels("P91") == [("P91", "designation")]
    assert labels("ISO 945-1, nodularité") == [("ISO 945-1", "norme"), ("Nodularité", "notion")]


def test_glossary_parser_reads_only_gloss_lists():
    html = """<section id="c1"><dl><dt>Hors</dt><dd>non</dd></dl></section>
    <section id="gloss"><dl class="gloss"><dt>Cr<sub>eq</sub>, Ni<sub>eq</sub></dt><dd>Équivalents.</dd>
    <dt>Ferrite</dt><dd>Fer <i>α</i> cubique centré.</dd></dl></section>"""
    assert glossary_entries(html) == [("Cr_eq, Ni_eq", "Équivalents."), ("Ferrite", "Fer α cubique centré.")]


def test_matching_ignores_accents_case_and_plural_but_not_acronyms():
    m = Matcher()
    m.add("austenite", "Austénite")
    m.add("zat", "ZAT")
    m.add("ce", "CE")
    m.add("joint-de-grains", "Joint de grains")
    m.add("phase-sigma", "Phase sigma")
    found = m.find("Les AUSTENITES de la ZAT : ce joint de grain précipite la phase σ et CE monte.")
    assert found == ["austenite", "zat", "joint-de-grains", "phase-sigma", "ce"]


def test_longest_expression_wins_without_overlap():
    m = Matcher()
    m.add("ferrite", "Ferrite")
    m.add("ferrite-delta", "Ferrite δ")
    m.add("fissuration-a-chaud", "Fissuration à chaud")
    m.add("fissuration", "Fissuration")
    assert m.find("La ferrite delta limite la fissuration à chaud ; la ferrite reste.") == [
        "ferrite-delta", "fissuration-a-chaud", "ferrite"]
    m.add("loi-d-arrhenius", "Loi d'Arrhenius")
    m.add("hall-petch", "Loi de Hall-Petch")
    assert m.find("Selon la loi d’Arrhenius puis la loi de Hall–Petch, l'ferrite.") == ["loi-d-arrhenius", "hall-petch", "ferrite"]
