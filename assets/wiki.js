(() => {
  "use strict";
  const runtime = document.getElementById("wiki-runtime");
  const form = document.getElementById("wiki-search-form");
  const compact = text => text.replace(/\s+/g, " ").trim();
  const normalize = text => String(text).toLowerCase().normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/t\s*8\s*\/?\s*5/g, "t85")
    .replace(/[σετγν]/g, char => ({"σ":" sigma ","ε":" epsilon ","τ":" tau ","γ":" gamma ","ν":" nu "})[char]);

  // Un seul index par page, partagé entre suggestions et recherche complète.
  let rowsPromise;
  const getRows = () => rowsPromise ||= fetch(new URL("recherche.json", runtime.src))
    .then(response => {
      if (!response.ok) throw new Error("Index indisponible");
      return response.json();
    }).catch(error => { rowsPromise = null; throw error; });
  const searchTerms = value => normalize(value).trim().split(/\s+/).filter(Boolean);
  function findMatches(rows, terms, selected = "") {
    return rows.filter(row => !selected || row.matiere === selected).map(row => {
      const title = normalize(row.titre), course = normalize(row.cours);
      const words = title.split(/[^\p{L}\p{N}]+/u);
      const all = normalize([row.titre, row.cours, row.matiere_titre, ...row.mots_cles, ...row.ressources].join(" "));
      if (!terms.every(term => all.includes(term))) return null;
      const score = terms.reduce((sum, term) => sum + (title === term ? 60 : title.startsWith(term) ? 30
        : words.some(word => word.startsWith(term)) ? 20 : title.includes(term) ? 12 : course.includes(term) ? 3 : 1), row.type === "cours" ? 1 : 0);
      return {row, score};
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.row.titre.localeCompare(b.row.titre, "fr", {numeric: true}));
  }

  if (form && runtime) {
    const query = document.getElementById("wiki-query");
    const subject = document.getElementById("wiki-subject-filter");
    const results = document.getElementById("wiki-results");
    const status = document.getElementById("wiki-search-status");
    const params = new URL(location.href).searchParams;
    query.value = params.get("q") || "";
    subject.value = params.get("matiere") || "";
    if (subject.selectedIndex < 0) subject.value = "";
    let revision = 0;
    let debounce;

    async function search() {
      const call = ++revision;
      const terms = searchTerms(query.value);
      const selected = subject.value;
      const url = new URL(location.href);
      query.value.trim() ? url.searchParams.set("q", query.value.trim()) : url.searchParams.delete("q");
      selected ? url.searchParams.set("matiere", selected) : url.searchParams.delete("matiere");
      history.replaceState(null, "", url);
      results.replaceChildren();
      if (!terms.length && !selected) {
        status.textContent = "Explorez les matières ci-dessous ou recherchez un sujet précis.";
        return;
      }
      status.textContent = "Recherche…";
      try {
        const rows = await getRows();
        if (call !== revision) return;
        const matches = findMatches(rows, terms, selected);
        status.textContent = matches.length ? `${matches.length} résultat${matches.length > 1 ? "s" : ""}.` : "Aucun résultat. Essayez un autre mot ou une autre matière.";
        const fragment = document.createDocumentFragment();
        for (const {row} of matches) {
          const li = document.createElement("li");
          const anchor = document.createElement("a");
          anchor.href = row.url;
          anchor.textContent = row.titre;
          const context = document.createElement("small");
          context.textContent = `${row.matiere_titre} · ${row.type === "section" ? row.cours : row.type === "application" ? "Application interactive" : "Cours complet"}`;
          li.append(anchor, context);
          fragment.append(li);
        }
        results.append(fragment);
      } catch {
        if (call === revision) status.textContent = "La recherche est indisponible. Vous pouvez parcourir les matières ci-dessous.";
      }
    }
    form.addEventListener("submit", event => { event.preventDefault(); clearTimeout(debounce); search(); });
    query.addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(search, 150); });
    subject.addEventListener("change", search);
    if (query.value || subject.value) search();
  }

  const panel = document.getElementById("wiki-panel");
  if (!panel) return;
  const root = document.documentElement;
  const status = document.getElementById("wiki-share-status");
  const title = document.querySelector('meta[name="wiki-course-title"]')?.content || document.title;
  const targetFor = hash => {
    try { return document.getElementById(decodeURIComponent(hash.replace(/^#/, ""))); }
    catch { return null; }
  };
  const headingFor = target => target?.matches("h2,h3") ? target : target?.querySelector("h2,h3");

  // Panneau : ouvert, replié en rail (écran large) ou tiroir (écran étroit). La largeur décide, comme dans la feuille de style.
  const docked = matchMedia("(min-width: 1000px)");
  const opener = document.querySelector('[data-wiki-panel="open"]');
  const backdrop = document.querySelector(".wiki-backdrop");
  const fold = panel.querySelector('[data-wiki-panel="fold"]');
  const query = document.getElementById("wiki-panel-query");
  if (query && form) query.value = new URL(location.href).searchParams.get("q") || "";
  if (query && runtime) {
    const searchForm = query.form;
    const popup = document.createElement("div");
    popup.className = "wiki-suggestions";
    popup.hidden = true;
    const hint = document.createElement("p");
    hint.id = "wiki-suggest-status";
    hint.className = "wiki-suggest-status";
    hint.setAttribute("role", "status");
    const list = document.createElement("ul");
    list.id = "wiki-suggest-list";
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Suggestions de recherche");
    const more = document.createElement("a");
    more.className = "wiki-suggest-more";
    more.textContent = "Voir tous les résultats →";
    popup.append(hint, list, more);
    searchForm.append(popup);
    query.setAttribute("role", "combobox");
    query.setAttribute("aria-autocomplete", "list");
    query.setAttribute("aria-controls", list.id);
    query.setAttribute("aria-expanded", "false");
    query.setAttribute("aria-busy", "false");
    let revision = 0, active = -1, options = [];

    function closeSuggestions() {
      ++revision;
      popup.hidden = true;
      query.setAttribute("aria-expanded", "false");
      query.setAttribute("aria-busy", "false");
      query.removeAttribute("aria-activedescendant");
      active = -1;
    }
    function choose(index) {
      active = index;
      options.forEach((option, i) => option.setAttribute("aria-selected", String(i === active)));
      query.setAttribute("aria-activedescendant", options[active].id);
      options[active].scrollIntoView({block: "nearest"});
    }
    async function suggest() {
      const terms = searchTerms(query.value);
      if (!terms.length) { closeSuggestions(); return; }
      const call = ++revision;
      active = -1;
      options = [];
      list.replaceChildren();
      query.removeAttribute("aria-activedescendant");
      const url = new URL(searchForm.action);
      url.searchParams.set("q", query.value.trim());
      more.href = url.href;
      popup.hidden = false;
      query.setAttribute("aria-expanded", "true");
      query.setAttribute("aria-busy", "true");
      hint.textContent = "Recherche…";
      try {
        const matches = findMatches(await getRows(), terms);
        if (call !== revision) return;
        // Éviter qu’un seul cours et ses nombreux chapitres occupent toute la liste.
        const perCourse = new Map();
        const suggestions = matches.filter(({row}) => {
          if (row.type !== "section") return true;
          const count = perCourse.get(row.cours_id) || 0;
          perCourse.set(row.cours_id, count + 1);
          return count < 2;
        }).slice(0, 8);
        for (const {row} of suggestions) {
          const item = document.createElement("li");
          item.setAttribute("role", "presentation");
          const link = document.createElement("a");
          link.className = "wiki-suggest-link";
          link.id = `wiki-suggestion-${options.length}`;
          link.href = new URL(row.url, new URL("../", runtime.src)).href;
          link.setAttribute("role", "option");
          link.setAttribute("aria-selected", "false");
          link.tabIndex = -1;
          const label = document.createElement("span");
          label.textContent = row.titre;
          const context = document.createElement("small");
          const type = row.type === "section" ? "Chapitre / section" : row.type === "application" ? "Application" : "Cours complet";
          context.textContent = ` · ${type} · ${row.type === "section" ? row.cours : row.matiere_titre}`;
          link.append(label, context);
          item.append(link);
          list.append(item);
          options.push(link);
        }
        popup.scrollTop = 0;
        hint.textContent = suggestions.length ? `${suggestions.length} suggestion${suggestions.length > 1 ? "s" : ""} · ↑ ↓ pour choisir`
          : "Aucun résultat. Essayez un autre mot.";
      } catch {
        if (call === revision) hint.textContent = "Recherche indisponible. Réessayez ou parcourez les matières.";
      } finally {
        if (call === revision) query.setAttribute("aria-busy", "false");
      }
    }
    query.addEventListener("input", suggest);
    query.addEventListener("focus", suggest);
    query.addEventListener("keydown", event => {
      if (event.isComposing) return;
      if (event.key === "Escape" && !popup.hidden) {
        event.preventDefault(); event.stopPropagation(); closeSuggestions();
      } else if ((event.key === "ArrowDown" || event.key === "ArrowUp") && options.length && !popup.hidden) {
        event.preventDefault();
        choose(active < 0 ? (event.key === "ArrowDown" ? 0 : options.length - 1)
          : (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
      } else if (event.key === "Enter" && active >= 0 && !popup.hidden) {
        event.preventDefault(); options[active].click();
      }
    });
    searchForm.addEventListener("focusout", event => {
      if (!searchForm.contains(event.relatedTarget)) closeSuggestions();
    });
    document.addEventListener("pointerdown", event => {
      if (!searchForm.contains(event.target)) closeSuggestions();
    });
    list.addEventListener("click", closeSuggestions);
    docked.addEventListener("change", closeSuggestions);
  }

  const syncFold = () => fold?.setAttribute("aria-expanded", String(!root.classList.contains("wiki-replie")));
  syncFold();

  function openDrawer() {
    root.classList.add("wiki-tiroir");
    opener?.setAttribute("aria-expanded", "true");
    if (backdrop) backdrop.hidden = false;
    (panel.querySelector('[data-wiki-panel="close"]') || panel).focus();
  }
  function closeDrawer(restoreFocus = true) {
    if (!root.classList.contains("wiki-tiroir")) return;
    root.classList.remove("wiki-tiroir");
    opener?.setAttribute("aria-expanded", "false");
    if (backdrop) backdrop.hidden = true;
    if (restoreFocus) opener?.focus();
  }
  const drawerOpen = () => !docked.matches && root.classList.contains("wiki-tiroir");

  document.addEventListener("click", event => {
    const control = event.target.closest("[data-wiki-panel]");
    if (control) {
      const action = control.dataset.wikiPanel;
      if (action === "open") openDrawer();
      else if (action === "close") closeDrawer();
      else if (action === "fold") {
        root.classList.toggle("wiki-replie");
        syncFold();
        try { localStorage.setItem("wiki-panneau", root.classList.contains("wiki-replie") ? "replie" : "deplie"); } catch {}
      }
      return;
    }
    // Suivre un lien du tiroir le referme, y compris vers une section de la même page.
    if (drawerOpen() && event.target.closest("#wiki-panel a[href]")) closeDrawer(false);
  });
  document.addEventListener("keydown", event => {
    if (!drawerOpen()) return;
    if (event.key === "Escape") { event.preventDefault(); closeDrawer(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll("a[href], button, input, summary")].filter(item => item.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  docked.addEventListener("change", () => closeDrawer(false));

  // Sommaire du cours : surligner la section en cours de lecture et la garder visible dans le panneau.
  const scroller = panel.querySelector(".wiki-panel-scroll");
  const sections = [...panel.querySelectorAll('.wiki-toc a[href^="#"]')]
    .map(link => ({link, target: targetFor(link.hash)})).filter(item => item.target)
    .sort((a, b) => a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  let active = null, pending = false;
  function spy() {
    pending = false;
    if (!sections.length) return;
    const line = innerHeight * 0.3;
    let current = sections[0];
    for (const item of sections) {
      if (item.target.getBoundingClientRect().top <= line) current = item; else break;
    }
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = sections[sections.length - 1];
    if (current.link === active) return;
    active?.removeAttribute("aria-current");
    active = current.link;
    active.setAttribute("aria-current", "location");
    if (scroller && getComputedStyle(scroller).display !== "none") {
      const box = active.getBoundingClientRect(), view = scroller.getBoundingClientRect();
      if (box.top < view.top + 24 || box.bottom > view.bottom - 24) scroller.scrollTop += box.top - view.top - view.height / 3;
    }
  }
  const requestSpy = () => { if (!pending) { pending = true; requestAnimationFrame(spy); } };
  addEventListener("scroll", requestSpy, {passive: true});
  addEventListener("resize", requestSpy);
  addEventListener("hashchange", requestSpy);
  addEventListener("load", requestSpy);
  spy();

  // Manipulations sur écran paysage : lectures et commentaire sous le schéma, réglages à droite.
  // La grille de la feuille de style a déjà donné au schéma sa largeur avant le premier dessin du cours ;
  // le regroupement ne la change pas. En dessous du seuil, l'ordre d'origine des éléments est rétabli.
  const landscape = matchMedia("(min-width: 1280px) and (orientation: landscape)");
  const labs = [...document.querySelectorAll(".lab")].filter(lab => lab.querySelectorAll(":scope > svg").length === 1);
  function splitLab(lab) {
    if (lab.classList.contains("wiki-lab-split")) return;
    const children = [...lab.children];
    const figure = document.createElement("div");
    const side = document.createElement("div");
    figure.className = "wiki-lab-fig";
    side.className = "wiki-lab-side";
    for (const child of children) {
      if (child.matches(".lab-h") || (child.matches(".lab-sub") && child === children[1])) continue;
      (child.matches("svg, .readout, .status") ? figure : side).append(child);
    }
    lab.wikiChildren = children;
    lab.append(figure, side);
    lab.classList.add("wiki-lab-split");
  }
  function joinLab(lab) {
    if (!lab.classList.contains("wiki-lab-split")) return;
    const wrappers = lab.querySelectorAll(":scope > .wiki-lab-fig, :scope > .wiki-lab-side");
    lab.append(...lab.wikiChildren);
    wrappers.forEach(wrapper => wrapper.remove());
    lab.classList.remove("wiki-lab-split");
  }
  const arrangeLabs = () => labs.forEach(landscape.matches ? splitLab : joinLab);
  arrangeLabs();
  landscape.addEventListener("change", arrangeLabs);

  // Boutons « Partager cette section » : ajoutés au document affiché, jamais aux sources pédagogiques.
  for (const {link} of sections) {
    const heading = headingFor(targetFor(link.hash));
    if (!heading) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "wiki-section-share";
    button.textContent = "Partager cette section";
    button.dataset.wikiShare = "native";
    button.dataset.wikiAnchor = link.hash;
    heading.insertAdjacentElement("afterend", button);
  }

  async function copyLink(url) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Copie non disponible");
      await navigator.clipboard.writeText(url);
      status.textContent = "Lien copié.";
    } catch {
      if (!docked.matches && !root.classList.contains("wiki-tiroir")) openDrawer();
      if (docked.matches && root.classList.contains("wiki-replie")) { root.classList.remove("wiki-replie"); syncFold(); }
      const fallback = panel.querySelector(".wiki-copy-fallback");
      fallback.hidden = false;
      const input = fallback.querySelector("input");
      input.value = url;
      input.focus();
      input.select();
      status.textContent = "Sélectionnez et copiez ce lien.";
    }
  }

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-wiki-share]");
    if (!button) return;
    const url = new URL(location.href);
    if (button.dataset.wikiAnchor) url.hash = button.dataset.wikiAnchor;
    const heading = headingFor(targetFor(url.hash));
    const text = heading ? `${title} — ${compact(heading.textContent).replace(/^\d+\s*(?=[A-ZÀ-Ü])/, "")}` : title;
    status.textContent = "";
    if (button.dataset.wikiShare === "native" && navigator.share) {
      try {
        await navigator.share({title, text, url: url.href});
        status.textContent = "Partage ouvert.";
        return;
      } catch (error) {
        if (error.name === "AbortError") return;
      }
    }
    await copyLink(url.href);
  });

  function revealTarget() {
    const target = targetFor(location.hash);
    if (!target) return;
    for (let parent = target; parent; parent = parent.parentElement) {
      if (parent.tagName === "DETAILS") parent.open = true;
    }
  }
  addEventListener("hashchange", revealTarget);
  revealTarget();
})();
