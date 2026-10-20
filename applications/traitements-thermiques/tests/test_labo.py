"""Parcours de l'élève dans le laboratoire des traitements thermiques, dans un vrai Chromium, sans réseau."""
import functools
import http.server
import json
import re
import threading
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit

import pytest

playwright = pytest.importorskip("playwright.sync_api")
from playwright.sync_api import expect, sync_playwright  # noqa: E402

REPO = Path(__file__).resolve().parents[3]
APP = REPO / "applications" / "traitements-thermiques"
TRAITEMENTS = re.findall(r"^ {6}id: '([a-z0-9-]+)',", (APP / "data" / "traitements.js").read_text(encoding="utf-8"), re.M)
TEXTES_SVG = """() => {
  const svg = document.getElementById('cycle'), vb = svg.viewBox.baseVal, hors = [];
  for (const t of svg.querySelectorAll('text')) {
    const b = t.getBBox();
    if (b.x < vb.x - 1 || b.y < vb.y - 1 || b.x + b.width > vb.x + vb.width + 1 || b.y + b.height > vb.y + vb.height + 1) hors.push(t.textContent);
  }
  const nan = [...svg.querySelectorAll('*')].filter(n => [...n.attributes].some(a => /NaN|undefined/.test(a.value))).length;
  return { hors, nan };
}"""


class Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="module")
def adresse():
    service = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(Silencieux, directory=str(REPO)))
    threading.Thread(target=service.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{service.server_port}/applications/traitements-thermiques/index.html"
    service.shutdown()
    service.server_close()


@pytest.fixture(scope="module")
def navigateur():
    with sync_playwright() as pw:
        chromium = pw.chromium.launch()
        yield chromium
        chromium.close()


def ouvrir(navigateur, adresse, largeur=1366, hauteur=768, theme="light", suffixe=""):
    contexte = navigateur.new_context(viewport={"width": largeur, "height": hauteur})
    contexte.add_init_script(f"if (!localStorage.getItem('traitements-thermiques-theme')) localStorage.setItem('traitements-thermiques-theme','{theme}')")
    page = contexte.new_page()
    erreurs = []
    page.on("pageerror", lambda e: erreurs.append(str(e)))
    page.on("console", lambda m: erreurs.append(m.text) if m.type == "error" and "ERR_FAILED" not in m.text else None)
    page.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    page.route("**/fonts.gstatic.com/**", lambda r: r.abort())
    page.goto(adresse + suffixe)
    page.wait_for_function("window.labo && labo.pret")
    return contexte, page, erreurs


def test_chaque_traitement_se_parcourt_a_toutes_les_echelles(navigateur, adresse):
    contexte, page, erreurs = ouvrir(navigateur, adresse)
    for tid in TRAITEMENTS:
        page.evaluate(f"labo.charger('{tid}')")
        expect(page).to_have_url(re.compile("#" + tid + "$"))
        for u in (0, 0.2, 0.4, 0.6, 0.8, 1):
            page.evaluate(f"labo.aller({u})")
            for i in range(5):
                page.evaluate(f"labo.echelle({i})")
                # La toile n'est pas vide : plusieurs couleurs différentes au centre.
                couleurs = page.evaluate("""() => { const c = document.getElementById('toile'), x = c.getContext('2d');
                  const d = x.getImageData(c.width * 0.3, c.height * 0.3, c.width * 0.4, c.height * 0.4).data, s = new Set();
                  for (let k = 0; k < d.length; k += 4 * 97) s.add(d[k] + ',' + d[k + 1] + ',' + d[k + 2]); return s.size; }""")
                assert couleurs > 2, f"{tid} u={u} échelle {i} : toile vide"
            controle = page.evaluate(TEXTES_SVG)
            assert controle == {"hors": [], "nan": 0}, (tid, u, controle)
        assert page.locator("#jauges .jauge").count() >= 4
        assert page.locator("#volet-savoir a").count() >= 2
    assert erreurs == []
    contexte.close()


def test_le_curseur_se_pilote_au_clavier_et_les_evenements_se_commentent(navigateur, adresse):
    contexte, page, erreurs = ouvrir(navigateur, adresse, suffixe="#trempe-revenu-42crmo4")
    curseur = page.locator("#cycle")
    curseur.focus()
    page.keyboard.press("Home")
    assert curseur.get_attribute("aria-valuenow") == "0"
    page.keyboard.press("PageDown")
    page.keyboard.press("PageDown")
    expect(page.locator("#etape-nom")).to_contain_text("Trempe")
    for _ in range(12):
        page.keyboard.press("Shift+ArrowRight")
    assert int(curseur.get_attribute("aria-valuenow")) > 40
    assert "°C" in curseur.get_attribute("aria-valuetext")
    expect(page.locator("#evenement")).not_to_be_empty()
    page.keyboard.press("End")
    expect(page.locator("#etape-nom")).to_contain_text("Refroidissement")
    # Un clic sur un losange d'événement fait sauter le curseur.
    avant = curseur.get_attribute("aria-valuenow")
    page.locator("#cycle .evt").first.dispatch_event("click")
    assert curseur.get_attribute("aria-valuenow") != avant
    assert erreurs == []
    contexte.close()


def test_un_exemple_piege_modifie_le_resultat_et_affiche_son_alerte(navigateur, adresse):
    contexte, page, erreurs = ouvrir(navigateur, adresse, suffixe="#trempe-revenu-42crmo4")
    page.get_by_role("tab", name="Réglages").click()
    page.evaluate("labo.aller(1)")
    durete = page.locator('.jauge[data-cle="HV"] .jauge-val')
    avant = durete.text_content()
    page.get_by_role("button", name="Revenu à 350 °C (piège)").click()
    page.wait_for_timeout(300)
    page.evaluate("labo.aller(1)")
    expect(page.locator('.reglage[data-id="Trev"] .alerte')).to_contain_text("fragilité")
    assert durete.text_content() != avant
    page.get_by_role("tab", name="Propriétés").click()
    assert "Martensite revenue" in page.locator("#repartition").text_content()
    assert erreurs == []
    contexte.close()


def test_la_banque_s_ouvre_filtre_et_rend_le_focus(navigateur, adresse):
    contexte, page, erreurs = ouvrir(navigateur, adresse)
    page.locator("#choisir").click()
    expect(page.locator("#banque")).to_be_visible()
    assert page.locator("#cartes .carte").count() == len(TRAITEMENTS)
    page.locator("#filtres").get_by_role("button", name="Aluminium").click()
    assert page.locator("#cartes .carte").count() == 1
    page.keyboard.press("Escape")
    expect(page.locator("#banque")).not_to_be_visible()
    assert page.evaluate("document.activeElement.id") == "choisir"
    page.locator("#choisir").click()
    page.locator("#filtres").get_by_role("button", name="Toutes").click()
    page.locator("#cartes .carte-choix", has_text="Durcissement structural").click()
    expect(page).to_have_url(re.compile("#durcissement-6082$"))
    expect(page.locator("#choix-titre")).to_have_text("Durcissement structural")
    assert erreurs == []
    contexte.close()


def test_niveau_et_theme_sont_memorises(navigateur, adresse):
    contexte, page, erreurs = ouvrir(navigateur, adresse, suffixe="#ttas-s355")
    page.evaluate("labo.aller(0.45)")
    simple = page.locator("#etape-texte").text_content()
    page.get_by_role("radio", name="Maîtriser").click()
    assert page.locator("#etape-texte").text_content() != simple
    fond = page.evaluate("getComputedStyle(document.body).backgroundColor")
    page.locator("#bouton-theme").click()
    assert page.evaluate("getComputedStyle(document.body).backgroundColor") != fond
    page.reload()
    page.wait_for_function("window.labo && labo.pret")
    assert page.evaluate("document.documentElement.dataset.theme") == "dark"
    assert page.evaluate("labo.etat.niveau") == 2
    assert page.evaluate("localStorage.getItem('traitements-thermiques-dernier')") == "ttas-s355"
    assert erreurs == []
    contexte.close()


@pytest.mark.parametrize("largeur,hauteur", [(360, 740), (390, 844), (768, 1024), (1280, 800), (1366, 768), (1440, 900)])
@pytest.mark.parametrize("theme", ["light", "dark"])
def test_mise_en_page_sans_debordement(navigateur, adresse, largeur, hauteur, theme):
    contexte, page, erreurs = ouvrir(navigateur, adresse, largeur, hauteur, theme)
    for tid in TRAITEMENTS:
        page.evaluate(f"labo.charger('{tid}')")
        page.evaluate("labo.aller(0.6)")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (tid, largeur)
        assert page.evaluate(TEXTES_SVG) == {"hors": [], "nan": 0}
        if largeur >= 1000 and largeur > hauteur:
            # Lecture paysage : la toile, le cycle et le panneau tiennent sur l'écran, sans défilement de page.
            assert page.evaluate("document.documentElement.scrollHeight <= innerHeight + 1"), (tid, largeur)
            boite = page.locator("#toile").bounding_box()
            assert boite["height"] >= 300 and boite["y"] + boite["height"] <= hauteur
            assert page.locator("#cycle").bounding_box()["y"] + 120 <= hauteur
    assert erreurs == []
    contexte.close()


def test_les_liens_de_revision_visent_des_sections_existantes(navigateur, adresse):
    contexte, page, erreurs = ouvrir(navigateur, adresse)
    for tid in TRAITEMENTS:
        page.evaluate(f"labo.charger('{tid}')")
        for href in page.locator("#volet-savoir ul.reviser a").evaluate_all("els => els.map(a => a.href)"):
            url = urlsplit(urljoin(adresse, href))
            fichier = REPO / unquote(url.path).lstrip("/")
            assert fichier.is_file(), href
            assert f'id="{url.fragment}"' in fichier.read_text(encoding="utf-8"), href
    assert erreurs == []
    contexte.close()


def test_la_table_des_cours_suit_le_catalogue():
    catalogue = json.loads((REPO / "catalogue-cours.json").read_text(encoding="utf-8"))
    cours = {c["id"]: c for c in catalogue["cours"]}
    source = (APP / "data" / "traitements.js").read_text(encoding="utf-8")
    table = re.findall(r"'([a-z]+-\d+)': \{ titre: '[^']*', url: '([^']+)', fichier: (?:'([^']+)'|\"([^\"]+)\") \}", source)
    assert len(table) >= 8
    for ident, url, f1, f2 in table:
        assert ident in cours and cours[ident]["statut"] == "disponible", ident
        assert cours[ident]["fichier"] == (f1 or f2), ident
        assert cours[ident]["url"] == url, ident
    cites = set(re.findall(r"\{ cours: '([a-z]+-\d+)'", source))
    assert cites <= {t[0] for t in table}, cites - {t[0] for t in table}


def test_la_banque_couvre_le_lot_des_aciers():
    assert len(TRAITEMENTS) == 13 and len(set(TRAITEMENTS)) == 13
    for tid in ("recuit-complet-c45", "normalisation-c45", "globulisation-c45", "homogeneisation-g20mn5", "trempes-etagees-34crnimo6",
                "durcissement-secondaire-x40crmov5", "post-chauffage-s690", "normalisation-revenu-p91", "ttas-10crmo9-10"):
        assert tid in TRAITEMENTS, tid


def dimensions_webp(fichier):
    """Largeur et hauteur d'une image WebP (en-têtes VP8, VP8L ou VP8X)."""
    d = fichier.read_bytes()
    assert d[:4] == b"RIFF" and d[8:12] == b"WEBP", fichier
    morceau = d[12:16]
    if morceau == b"VP8 ":
        return int.from_bytes(d[26:28], "little") & 0x3FFF, int.from_bytes(d[28:30], "little") & 0x3FFF
    if morceau == b"VP8L":
        b = int.from_bytes(d[21:25], "little")
        return (b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1
    assert morceau == b"VP8X", fichier
    return int.from_bytes(d[24:27], "little") + 1, int.from_bytes(d[27:30], "little") + 1


def test_chaque_traitement_a_une_photographie_creditee_et_declaree():
    source = (APP / "data" / "vignettes.js").read_text(encoding="utf-8")
    # Le registre reste local ; les credits publics sont controles dans tous les cas.
    registre_local = REPO / "docs" / "ILLUSTRATIONS.md"
    registre = registre_local.read_text(encoding="utf-8") if registre_local.is_file() else None
    catalogue = json.loads((REPO / "catalogue-cours.json").read_text(encoding="utf-8"))
    publies = next(a for a in catalogue["applications"] if a["id"] == "traitements-thermiques")["fichiers"]
    assert "data/vignettes.js" in publies
    motif = r"^    '([a-z0-9-]+)': \{\n      fichier: '([^']+)', largeur: (\d+), hauteur: (\d+)"
    entrees = {m[0]: m[1:] for m in re.findall(motif, source, re.M)}
    assert set(entrees) == set(TRAITEMENTS)
    for tid, (fichier, largeur, hauteur) in entrees.items():
        chemin = APP / fichier
        assert chemin.is_file(), fichier
        assert dimensions_webp(chemin) == (int(largeur), int(hauteur)), fichier
        assert chemin.stat().st_size < 160_000, fichier
        assert fichier in publies, fichier
        if registre is not None:
            assert chemin.name in registre, chemin.name
        credit = re.search(r"^    '" + re.escape(tid) + r"': \{(.*?)^    \}", source, re.M | re.S).group(1)
        for champ in ("auteur", "titre", "licence"):
            assert re.search(champ + r": '[^']+'", credit), (tid, champ)
        assert re.search(r"source: 'https://commons\.wikimedia\.org/wiki/File:[^']+'", credit), tid
    assert len(re.findall(r"source: 'https://commons\.wikimedia\.org/wiki/File:", source)) == len(TRAITEMENTS)
    licences = re.findall(r"licence: '([^']+)'", source)
    assert set(licences) <= {"CC BY 4.0", "CC BY-SA 2.0", "CC BY-SA 3.0", "CC BY-SA 4.0", "domaine public"}


def test_les_cartes_et_le_titre_montrent_des_photos_creditees_sans_emoji(navigateur, adresse):
    contexte, page, erreurs = ouvrir(navigateur, adresse, suffixe="#homogeneisation-g20mn5")
    assert page.locator("#choix-emoji").count() == 0
    mini = page.locator("#choix-vignette")
    expect(mini).to_have_attribute("src", re.compile("homogeneisation-g20mn5\\.webp$"))
    assert page.evaluate("document.getElementById('choix-vignette').naturalWidth") > 0
    page.locator("#choisir").click()
    cartes = page.locator("#cartes .carte")
    assert cartes.count() == len(TRAITEMENTS)
    for i in range(cartes.count()):
        carte = cartes.nth(i)
        carte.scroll_into_view_if_needed()
        img = carte.locator(".carte-image img")
        expect(img).to_have_attribute("alt", "")
        page.wait_for_function("i => i.complete && i.naturalWidth > 0", arg=img.element_handle())
        liens = carte.locator(".carte-credit a")
        assert liens.count() >= 1
        assert liens.first.get_attribute("href").startswith("https://commons.wikimedia.org/wiki/File:")
    texte = page.locator("#cartes").inner_text()
    assert not re.search("[\U0001F300-\U0001FAFF\u2600-\u27BF]", texte), "emoji dans les cartes"
    expect(page.locator("#cartes .carte.actuelle")).to_have_count(1)
    assert page.locator("#cartes .carte.actuelle .carte-choix").get_attribute("aria-current") == "true"
    page.keyboard.press("Escape")
    page.get_by_role("tab", name="En savoir plus").click()
    figure = page.locator("#volet-savoir figure.vignette")
    expect(figure).to_be_visible()
    assert len(figure.locator("img").get_attribute("alt")) > 30
    expect(figure.locator("figcaption")).to_contain_text("CC BY-SA 2.0")
    image = page.locator("#volet-savoir .encadre.image").inner_text()
    assert not re.search("[\U0001F300-\U0001FAFF\u2600-\u27BF]", image), "emoji dans l’image à retenir"
    assert erreurs == []
    contexte.close()


def test_les_nouvelles_jauges_du_lot_des_aciers(navigateur, adresse):
    contexte, page, erreurs = ouvrir(navigateur, adresse, suffixe="#post-chauffage-s690")
    page.evaluate("labo.aller(1)")
    risque = page.locator('.jauge[data-cle="risque"]')
    expect(risque).to_have_class(re.compile("inverse"))
    expect(risque.locator(".jauge-val")).to_have_text("faible")
    page.evaluate("labo.regler({ pc: false })")
    page.evaluate("labo.aller(1)")
    assert risque.locator(".jauge-val").text_content() in ("élevé", "très élevé")
    page.evaluate("labo.charger('trempes-etagees-34crnimo6')")
    page.evaluate("labo.aller(1)")
    expect(page.locator('.jauge[data-cle="ecartMs"] .jauge-val')).to_have_text("pas de martensite")
    page.evaluate("labo.regler({ mode: 'huile', revenu: false })")
    page.evaluate("labo.aller(1)")
    assert re.match(r"\d+\s°C", page.locator('.jauge[data-cle="ecartMs"] .jauge-val').text_content())
    page.evaluate("labo.charger('durcissement-secondaire-x40crmov5')")
    page.evaluate("labo.regler({ nRev: 1 })")
    page.evaluate("labo.aller(1)")
    assert "Martensite fraîche" in page.locator("#repartition").text_content()
    page.evaluate("labo.charger('homogeneisation-g20mn5')")
    page.evaluate("labo.aller(0); labo.echelle(2)")
    assert "manganèse" in page.locator("#legende").text_content()
    assert "800" in page.locator("#echelle-champ").text_content()
    assert erreurs == []
    contexte.close()


PASTILLES = """() => {
  const lab = c => {
    const m = c.match(/\d+(\.\d+)?/g).map(Number);
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const [r, g, b] = m.slice(0, 3).map(lin);
    const X = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, Y = 0.2126 * r + 0.7152 * g + 0.0722 * b, Z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    const f = v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
    return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
  };
  const items = [...document.querySelectorAll('#legende li')].map(li => {
    const p = li.firstElementChild;
    const c = p.dataset.couleur || getComputedStyle(p).backgroundColor;
    const tmp = document.createElement('i'); tmp.style.color = c; document.body.append(tmp);
    const rgb = getComputedStyle(tmp).color; tmp.remove();
    return { texte: li.textContent, motif: p.dataset.motif || 'uni', lab: lab(rgb) };
  });
  const conflits = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    const dE = Math.hypot(a.lab[0] - b.lab[0], a.lab[1] - b.lab[1], a.lab[2] - b.lab[2]);
    if (a.motif === b.motif && dE < 15) conflits.push(`${a.texte} / ${b.texte} (ΔE ${dE.toFixed(1)})`);
  }
  return conflits;
}"""


def test_les_pastilles_de_legende_se_distinguent(navigateur, adresse):
    """Deux constituants d'une même légende ne partagent jamais à la fois motif et couleur voisine."""
    contexte, page, erreurs = ouvrir(navigateur, adresse)
    conflits = set()
    for tid in TRAITEMENTS:
        page.evaluate(f"labo.charger('{tid}')")
        exemples = page.evaluate("labo.etat.tr.exemples.map(x => x.valeurs)")
        for valeurs in [None] + exemples:
            if valeurs is not None:
                page.evaluate(f"labo.regler({json.dumps(valeurs)})")
            for u in (0, 0.3, 0.5, 0.7, 0.85, 1):
                page.evaluate(f"labo.aller({u})")
                for mode in ("microscope", "phases"):
                    page.evaluate(f"document.querySelector('#modes [data-mode={mode}]').click()")
                    for i in range(5):
                        page.evaluate(f"labo.echelle({i})")
                        for c in page.evaluate(PASTILLES):
                            conflits.add(f"{tid} · échelle {i} · {mode} : {c}")
    assert not conflits, "\n".join(sorted(conflits)[:40])
    assert erreurs == []
    contexte.close()

