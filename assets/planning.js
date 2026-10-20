(() => {
  "use strict";
  const root = document.getElementById("planning");
  if (!root) return;
  const form = document.getElementById("planning-filters");
  const phase = document.getElementById("planning-phase");
  const theme = document.getElementById("planning-theme");
  const ready = document.getElementById("planning-ready");
  const nowButton = document.getElementById("planning-now");
  const status = document.getElementById("planning-status");
  const weeks = [...root.querySelectorAll(".planning-week")];
  const phases = [...root.querySelectorAll(".planning-phase")];
  const parts = Object.fromEntries(new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date()).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const first = phases.map(p => p.dataset.start).sort()[0];
  const last = phases.map(p => p.dataset.end).sort().at(-1);
  const current = today >= first && today <= last ? weeks.find(w => w.dataset.start <= today && today <= w.dataset.end) : null;
  nowButton.disabled = !current;
  if (current) {
    const currentLink = document.getElementById("planning-current-link");
    currentLink.href = "#" + current.id;
    currentLink.hidden = false;
    currentLink.addEventListener("click", event => { event.preventDefault(); nowButton.click(); });
    current.dataset.current = "true";
    current.querySelector(".planning-week-current").hidden = false;
    document.getElementById("planning-position-title").textContent = phases.find(p => p.dataset.phase === current.dataset.phase).querySelector("h2").textContent;
    document.getElementById("planning-position-text").textContent = `Semaine ${current.id.slice(-2)} · ${new Intl.DateTimeFormat("fr-FR", {timeZone:"Europe/Paris", day:"numeric", month:"long", year:"numeric"}).format(new Date())}`;
  } else {
    document.getElementById("planning-position-title").textContent = today < first ? "La formation approche" : "Le planning en un regard";
    document.getElementById("planning-position-text").textContent = today < first ? "Explorez les premières semaines de pré-rentrée." : "Aucune semaine prévue à la date du jour dans ces documents.";
  }
  root.querySelectorAll(".planning-day").forEach(day => {
    if (day.dataset.date === today) day.querySelector(".planning-today").hidden = false;
  });

  function hashTarget() {
    try { return document.getElementById(decodeURIComponent(location.hash.slice(1))); }
    catch { return null; }
  }
  function save(clearHash) {
    const url = new URL(location.href);
    url.searchParams.set("phase", phase.value);
    theme.value ? url.searchParams.set("matiere", theme.value) : url.searchParams.delete("matiere");
    ready.checked ? url.searchParams.set("supports", "1") : url.searchParams.delete("supports");
    if (clearHash) url.hash = "";
    history.replaceState(null, "", url);
  }
  function apply(expand = false, clearHash = false) {
    let count = 0, visibleWeeks = 0;
    for (const week of weeks) {
      let weekCount = 0;
      week.querySelectorAll(".planning-day").forEach(day => {
        let dayCount = 0;
        day.querySelectorAll(".planning-event").forEach(event => {
          const visible = (!phase.value || phase.value === week.dataset.phase) &&
            (!theme.value || theme.value === event.dataset.theme) && (!ready.checked || Number(event.dataset.supports) > 0);
          event.hidden = !visible;
          if (visible) dayCount++;
        });
        day.hidden = dayCount === 0;
        weekCount += dayCount;
      });
      week.hidden = weekCount === 0;
      if (weekCount) { visibleWeeks++; count += weekCount; }
      week.open = !week.hidden && (expand || week === current || week === hashTarget());
    }
    phases.forEach(p => { p.hidden = ![...p.querySelectorAll(".planning-week")].some(w => !w.hidden); });
    status.textContent = count ? `${count} séances ou périodes · ${visibleWeeks} semaine${visibleWeeks > 1 ? "s" : ""}.` : "Aucune séance avec ces filtres. Essayez une autre matière ou désactivez le filtre des supports.";
    save(clearHash);
  }
  function revealHash() {
    const target = hashTarget();
    if (!target || !root.contains(target)) return;
    if (target.dataset.phase) {
      phase.value = target.dataset.phase;
      apply(Boolean(theme.value || ready.checked));
      if (target.hidden) { theme.value = ""; ready.checked = false; apply(); }
      if (target.matches("details")) target.open = true;
      requestAnimationFrame(() => target.scrollIntoView({block:"start"}));
    }
  }
  function restore() {
    const params = new URL(location.href).searchParams;
    const target = hashTarget();
    phase.value = params.has("phase") ? params.get("phase") : (target?.dataset.phase || current?.dataset.phase || (today > last ? "" : root.dataset.reference));
    if (phase.selectedIndex < 0) phase.value = "";
    theme.value = params.get("matiere") || "";
    if (theme.selectedIndex < 0) theme.value = "";
    ready.checked = params.get("supports") === "1";
    apply(Boolean(theme.value || ready.checked));
    revealHash();
  }
  form.hidden = false;
  form.addEventListener("submit", event => event.preventDefault());
  form.addEventListener("change", () => apply(true, true));
  form.addEventListener("reset", event => {
    event.preventDefault(); phase.value = ""; theme.value = ""; ready.checked = false; apply(false, true);
  });
  nowButton.addEventListener("click", () => {
    if (!current) return;
    phase.value = current.dataset.phase; theme.value = ""; ready.checked = false;
    apply(false, true);
    location.hash = current.id;
    current.open = true;
    current.scrollIntoView({block:"start"});
    current.querySelector("summary").focus({preventScroll:true});
  });
  addEventListener("hashchange", revealHash);
  addEventListener("popstate", restore);
  restore();
})();