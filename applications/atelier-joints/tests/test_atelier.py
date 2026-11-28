"""Parcours de l'élève dans l'Atelier des joints, dans un vrai Chromium, sans réseau."""
import functools
import http.server
import json
import threading
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest

playwright = pytest.importorskip("playwright.sync_api")
from playwright.sync_api import expect, sync_playwright  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
CLE_PROG = "atelier-joints-progression"
LIBRE = json.dumps({"version": 1, "etoiles": {}, "libre": True, "examMeilleur": 0, "examTentatives": 0})


class Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="module")
def adresse():
    service = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Silencieux, directory=str(REPO)))
    threading.Thread(target=service.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{service.server_port}/applications/atelier-joints/index.html"
    service.shutdown()
    service.server_close()


@pytest.fixture(scope="module")
def navigateur():
    with sync_playwright() as pw:
        chromium = pw.chromium.launch()
        yield chromium
        chromium.close()


def ouvrir(navigateur, adresse, largeur=1366, hauteur=768, theme="light", progression=None, init="", suffixe=""):
    contexte = navigateur.new_context(viewport={"width": largeur, "height": hauteur})
    script = f"localStorage.setItem('atelier-joints-theme','{theme}');"
    if progression is not None:
        script += f"if(!sessionStorage.getItem('init')){{localStorage.setItem('{CLE_PROG}',{json.dumps(progression)});sessionStorage.setItem('init','1');}}"
    contexte.add_init_script(script + init)
    page = contexte.new_page()
    erreurs = []
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("console", lambda m: erreurs.append(m.text) if m.type == "error" and "ERR_FAILED" not in m.text else None)
    page.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    page.goto(adresse + suffixe)
    page.wait_for_selector("#contenu h1, #q-enonce")
    return page, erreurs


def item(page):
    return page.evaluate("Atelier.etat().items[Atelier.etat().i]")


def repondre_qcm(page, juste=True):
    it = item(page)
    k = it["bonne"] if juste else (it["bonne"] + 1) % len(it["options"])
    page.locator(".options .option").nth(k).click()
    return it


def coder(page, juste=True):
    """Remplit l'outil du mode Coder comme le ferait l'élève, à partir de la réponse attendue."""
    it = item(page)
    at = it["attendu"]
    outil = it["outil"]
    if outil in ("palette", "palettePosition"):
        page.locator(f'.palette button[data-sym="{at["sym"]}"]').click()
        if outil == "palettePosition":
            page.locator(f'[aria-label="Place du symbole"] [data-v="{at["place"]}"]').click()
    elif outil == "supp":
        page.locator(f'[aria-label="Forme du cordon"] [data-v="{at["forme"]}"]').click()
        if it["base"] == "V":
            page.locator(f'[aria-label="Envers"] [data-v="{at["envers"]}"]').click()
        for cle in ("toutAutour", "chantier"):
            if at[cle]:
                page.locator(f'[aria-label="Position"] [data-v="{cle}"]').click()
    elif outil == "cotes":
        lettre, valeur = at["lettre"], at["valeur"]
        if not juste and not at["discontinue"]:
            lettre, valeur = {"a": ("z", valeur), "z": ("a", valeur), "s": ("", 0), "": ("s", 3)}[lettre]
        page.locator(f'[aria-label="Cote de section (à gauche)"] [data-v="{lettre}"]').click()
        if lettre:
            page.fill("#c-valeur", str(valeur))
        if at["discontinue"]:
            page.locator('[aria-label="Longueur (à droite)"] [data-v="1"]').click()
            page.fill("#c-n", str(at["n"]))
            page.fill("#c-l", str(at["l"]))
            page.fill("#c-e", str(at["e"] + (0 if juste else 10)))
    elif outil == "fourche":
        page.locator(f'[aria-label="Niveau de qualité (ISO 5817)"] [data-v="{at["niveau"]}"]').click()
        page.locator(f'[aria-label="Procédé (ISO 4063)"] [data-v="{at["procede"]}"]').click()
        position = at["position"] if juste else ("PA" if at["position"] != "PA" else "PB")
        page.locator(f'[aria-label="Position (ISO 6947)"] [data-v="{position}"]').click()
    if not juste and outil.startswith("palette"):
        autre = next(x for x in it["palette"] if x != at["sym"])
        page.locator(f'.palette button[data-sym="{autre}"]').click()
    elif not juste and outil == "supp":
        page.locator('[aria-label="Position"] [data-v="chantier"]').click()
    page.locator("#valider").click()
    return it


def test_parcours_initial(navigateur, adresse):
    page, erreurs = ouvrir(navigateur, adresse)
    expect(page.get_by_role("heading", name="Atelier des joints")).to_be_visible()
    expect(page.get_by_role("button", name="Décoder, niveau 1")).to_be_enabled()
    expect(page.get_by_role("button", name="Décoder, niveau 2")).to_be_disabled()
    expect(page.get_by_role("button", name="Commencer l'examen")).to_be_disabled()
    assert not erreurs


def test_serie_parfaite_debloque_le_niveau_suivant(navigateur, adresse):
    page, erreurs = ouvrir(navigateur, adresse)
    page.get_by_role("button", name="Décoder, niveau 1").click()
    for k in range(10):
        expect(page.locator(".q-compte")).to_have_text(f"Question {k + 1} / 10")
        repondre_qcm(page)
        expect(page.locator("#retour")).to_contain_text("Juste")
        page.locator("#suivant").click()
    expect(page.locator(".score")).to_have_text("10 / 10")
    expect(page.locator("#contenu")).to_contain_text("Le niveau 2 est débloqué")
    assert json.loads(page.evaluate(f"localStorage.getItem('{CLE_PROG}')"))["etoiles"]["1d"] == 3
    page.get_by_role("link", name="Retour au parcours").click()
    expect(page.get_by_role("button", name="Décoder, niveau 2")).to_be_enabled()
    assert not erreurs


def test_une_erreur_part_en_revision_et_remonte(navigateur, adresse):
    page, erreurs = ouvrir(navigateur, adresse)
    page.get_by_role("button", name="Décoder, niveau 1").click()
    repondre_qcm(page, juste=False)
    expect(page.locator("#retour")).to_contain_text("Pas tout à fait")
    expect(page.locator("#retour a.lien-cours")).to_be_visible()
    expect(page.locator("#pastille")).to_have_text("1")
    page.get_by_role("link", name="Révision").click()
    expect(page.locator("#contenu")).to_contain_text("1 carte à revoir maintenant")
    page.get_by_role("button", name="Commencer la révision").click()
    repondre_qcm(page)
    page.locator("#suivant").click()
    expect(page.locator(".score")).to_have_text("1 / 1")
    boites = page.evaluate("Leitner.compter(Atelier.boites())")
    assert boites == [0, 1, 0, 0, 0]
    expect(page.locator("#pastille")).to_be_hidden()
    assert not erreurs


@pytest.mark.parametrize("niveau", [1, 2, 3, 4, 5])
def test_les_outils_du_mode_coder(navigateur, adresse, niveau):
    page, erreurs = ouvrir(navigateur, adresse, progression=LIBRE, suffixe=f"#serie-{niveau}-coder")
    for k in range(10):
        coder(page, juste=(k != 3))
        attendu = "Pas tout à fait" if k == 3 else "Juste"
        expect(page.locator("#retour")).to_contain_text(attendu)
        if k == 3:
            expect(page.locator("#retour")).to_contain_text("Réponse attendue")
        page.locator("#suivant").click()
    expect(page.locator(".score")).to_have_text("9 / 10")
    assert not erreurs


def test_examen_blanc(navigateur, adresse):
    page, erreurs = ouvrir(navigateur, adresse, progression=LIBRE, suffixe="#examen")
    page.get_by_role("button", name="Commencer l'examen").click()
    for k in range(20):
        expect(page.locator("#suivant")).to_be_disabled()
        repondre_qcm(page, juste=(k % 5 != 0))
        expect(page.locator("#retour")).to_be_hidden()
        page.locator("#suivant").click()
    expect(page.locator(".score")).to_have_text("80 %")
    expect(page.locator(".competence")).to_have_count(5)
    assert json.loads(page.evaluate(f"localStorage.getItem('{CLE_PROG}')"))["examMeilleur"] == 80
    assert page.evaluate("Leitner.total(Atelier.boites())") == 4
    assert not erreurs


def test_clavier(navigateur, adresse):
    page, erreurs = ouvrir(navigateur, adresse, suffixe="#serie-1-decoder")
    page.keyboard.press("2")
    expect(page.locator("#retour")).to_be_visible()
    expect(page.locator("#suivant")).to_be_focused()
    page.keyboard.press("Enter")
    expect(page.locator(".q-compte")).to_have_text("Question 2 / 10")
    assert not erreurs


def test_liens_vers_les_cours(navigateur, adresse):
    page, _ = ouvrir(navigateur, adresse)
    href = page.locator(".niveau a.lien-cours").first.get_attribute("href")
    chemin = REPO / "applications" / "atelier-joints" / unquote(urlsplit(href).path)
    assert chemin.resolve().exists(), chemin
    assert urlsplit(href).fragment == "c2"


def test_stockage_corrompu_ou_indisponible(navigateur, adresse):
    page, erreurs = ouvrir(navigateur, adresse, init=f"localStorage.setItem('{CLE_PROG}','{{pas du json');localStorage.setItem('atelier-joints-revision','x');")
    expect(page.get_by_role("button", name="Décoder, niveau 1")).to_be_enabled()
    assert not erreurs
    page, erreurs = ouvrir(navigateur, adresse, init="Storage.prototype.setItem=function(){throw new Error('quota')};")
    expect(page.locator("#avis-stockage")).to_be_visible()
    page.get_by_role("button", name="Décoder, niveau 1").click()
    repondre_qcm(page)
    expect(page.locator("#retour")).to_contain_text("Juste")
    assert not erreurs


MESURE = """() => {
  const depasse = document.scrollingElement.scrollWidth > innerWidth + 1, hors = [];
  for (const s of document.querySelectorAll('#contenu svg')) {
    const vb = s.viewBox.baseVal; if (!vb || !vb.width) continue;
    for (const t of s.querySelectorAll('text')) {
      const b = t.getBBox();
      if (b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1) hors.push(t.textContent);
    }
  }
  const nan = [...document.querySelectorAll('#contenu svg *')].filter(n => [...n.attributes].some(a => /NaN|undefined/.test(a.value))).length;
  return { depasse, hors, nan };
}"""


@pytest.mark.parametrize("largeur,hauteur", [(360, 740), (390, 844), (768, 1024), (1366, 768), (1440, 900)])
@pytest.mark.parametrize("theme", ["light", "dark"])
def test_mise_en_page(navigateur, adresse, largeur, hauteur, theme):
    page, erreurs = ouvrir(navigateur, adresse, largeur, hauteur, theme, progression=LIBRE)
    vues = ["#parcours", "#serie-1-decoder", "#serie-2-decoder", "#serie-4-coder", "#serie-3-coder", "#serie-5-decoder", "#revision", "#examen", "#aide"]
    for v in vues:
        page.goto(page.url.split("#")[0] + v)
        page.wait_for_timeout(80)
        m = page.evaluate(MESURE)
        assert not m["depasse"], f"{v} déborde à {largeur} px"
        assert not m["hors"], f"{v} : textes hors cadre {m['hors']}"
        assert m["nan"] == 0, v
    if largeur == 1366:
        page.goto(page.url.split("#")[0] + "#serie-1-decoder")
        boite = page.locator(".options").bounding_box()
        assert boite["y"] + boite["height"] <= hauteur, "les réponses tiennent sur l'écran en paysage"
    assert not erreurs
