// Cœur du widget de chat (S25) : ce qui se vérifie sans compte OpenRouter. Node seul, sans dépendance.
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const chat = require("../../assets/chat-widget.js");

const SYSTEM = `Tu es l'assistant de révision IWE de PolyWE (Polytech Nantes, DU Ingénierie du soudage).
1. Réponds à partir des EXTRAITS fournis. Cite chaque affirmation avec l'identifiant entre crochets, ex. [RDM-04].
2. Si les EXTRAITS ne couvrent pas la question :
   - notion générale et stable : réponds avec tes connaissances, en commençant par « Hors cours : » ;
   - fait précis (valeur, exigence ou numéro de norme, donnée produit, date) : fais UNE recherche web et cite l'URL. Si tu ne trouves pas de source fiable, dis que tu ne sais pas.
   - Ne cherche jamais sur le web si les extraits suffisent.
3. En cas de doute, dis-le. N'invente ni valeur numérique, ni norme, ni source.
4. 120 mots maximum, sauf calcul (formule, application numérique, unité, résultat).
5. Hors soudage et matériaux : décline en une phrase.`;

const ROWS = [
  {id: "TH-01-INTRO", cours: "Préchauffage", matiere: "Thermique", mots_cles: ["ZAT"], titre: "Comprendre le préchauffage",
   url: "Thermique/introduction.html#intro", texte: "Comprendre le préchauffage\nPréchauffer un acier trempant ralentit le refroidissement de la ZAT et limite la fissuration à froid."},
  {id: "RDM-04-C3", cours: "Directions principales et tricercle de Mohr", matiere: "RDM", mots_cles: ["Mohr"], titre: "Le tricercle de Mohr",
   url: "RDM/04-directions-principales-mohr.html#c3", texte: "Le tricercle de Mohr\nLes trois cercles relient les contraintes principales σ1, σ2 et σ3."},
  {id: "FAT-01-C1", cours: "Le cycle de fatigue", matiere: "Fatigue", mots_cles: ["cycle"], titre: "Parler la langue des cycles",
   url: "Fatigue/01-cycles-chargement.html#c1", texte: "Parler la langue des cycles\nUn cycle de chargement se décrit par sa contrainte moyenne et son amplitude."},
];

test("PKCE : défi S256 conforme au vecteur de la RFC 7636 et vérificateur aléatoire", async () => {
  assert.equal(await chat.codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  const first = chat.createVerifier(), second = chat.createVerifier();
  assert.match(first, /^[A-Za-z0-9_-]{43,128}$/);
  assert.notEqual(first, second);
});

test("PKCE : adresse d’autorisation et page de retour sans code ni ancre", () => {
  const back = chat.callbackUrl("https://pemcode.github.io/iwe/RDM/04-mohr.html?code=ancien&q=mohr#c3");
  assert.equal(back, "https://pemcode.github.io/iwe/RDM/04-mohr.html?q=mohr");
  assert.equal(chat.callbackUrl("https://pemcode.github.io/iwe/?code=x"), "https://pemcode.github.io/iwe/");
  const url = new URL(chat.authorizeUrl(back, "defi"));
  assert.equal(url.origin + url.pathname, "https://openrouter.ai/auth");
  assert.equal(url.searchParams.get("callback_url"), back);
  assert.equal(url.searchParams.get("code_challenge"), "defi");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
});

test("requête : prompt imposé, paramètres, outil web et trois derniers échanges", () => {
  const history = [1, 2, 3, 4, 5].map(n => ({question: `Q${n}`, answer: `R${n}`}));
  const extracts = chat.buildExtracts({rows: ROWS, question: "préchauffage acier trempant"});
  const body = chat.buildRequest({model: "openai/gpt-6.1-sol", question: "Pourquoi préchauffer ?", extracts, history});
  assert.equal(body.model, "openai/gpt-6.1-sol");
  assert.equal(body.stream, true);
  assert.equal(body.max_tokens, 1500);
  assert.deepEqual(body.reasoning, {effort: "low"});
  assert.deepEqual(body.tools, [{type: "openrouter:web_search", parameters: {engine: "exa", max_uses: 1, max_results: 3,
    max_characters: 1500, allowed_domains: chat.ALLOWED_DOMAINS}}]);
  assert.deepEqual(body.messages[0], {role: "system", content: SYSTEM});
  assert.deepEqual(body.messages.slice(1, -1).map(m => [m.role, m.content]),
    [["user", "Q3"], ["assistant", "R3"], ["user", "Q4"], ["assistant", "R4"], ["user", "Q5"], ["assistant", "R5"]]);
  const last = body.messages.at(-1);
  assert.equal(last.role, "user");
  assert.match(last.content, /^EXTRAITS\n\[TH-01-INTRO\] Préchauffage — Comprendre le préchauffage\n/);
  assert.match(last.content, /\n\nQUESTION\nPourquoi préchauffer \?$/);
  assert.doesNotMatch(last.content, /recherche web/);
  const verify = chat.buildRequest({model: "m", question: "Q", extracts: [], history: [], verify: true}).messages.at(-1).content;
  assert.match(verify, /Aucun extrait/);
  assert.match(verify, /CONSIGNE\nFais UNE recherche web .*cite l’URL/);
  assert.ok(chat.ALLOWED_DOMAINS.length > 0);
  for (const domain of chat.ALLOWED_DOMAINS) assert.match(domain, /^[a-z0-9.-]+\.[a-z]{2,}$/);
});

test("extraits : le texte sélectionné passe en premier, puis trois sections du site entier", () => {
  const ranked = chat.rankSections(ROWS, "Pourquoi préchauffer un acier trempant avant soudage ?", {page: "RDM/04-directions-principales-mohr.html"});
  assert.equal(ranked[0].row.id, "TH-01-INTRO", "la section pertinente d’un autre cours passe devant la page courante");
  assert.ok(ranked.every(item => item.row.id !== "FAT-01-C1"), "une section sans terme commun n’est pas envoyée");
  const selection = {id: "RDM-04-C3", titre: "Le tricercle de Mohr", cours: "Directions principales et tricercle de Mohr",
                     url: "RDM/04-directions-principales-mohr.html#c3", text: "Les trois cercles relient les contraintes principales."};
  const extracts = chat.buildExtracts({rows: ROWS, question: "Et le préchauffage, lien avec la contrainte ?", selection});
  assert.equal(extracts[0].id, "RDM-04-C3");
  assert.equal(extracts[0].texte, selection.text);
  assert.match(extracts[0].titre, /Texte sélectionné/);
  assert.equal(new Set(extracts.map(e => e.id)).size, extracts.length, "pas de doublon");
  assert.ok(extracts.length <= 4);
  const unknown = chat.buildExtracts({rows: ROWS, question: "explique", selection: {text: "x".repeat(4000)}});
  assert.equal(unknown[0].id, "TEXTE-SELECTIONNE");
  assert.ok(unknown[0].texte.length <= 1501);
});

test("extraits : ni section creuse portée par le titre du cours, ni extrait pour une question hors sujet", () => {
  const rows = [
    {id: "AS-02-QUIZ", cours: "Arc submergé : flux, fils et métal déposé", matiere: "Arc", mots_cles: ["flux", "basicité"], titre: "Quiz",
     url: "A/02.html#quiz", texte: "Quiz\nDouze questions éclair."},
    {id: "AS-02-C1", cours: "Arc submergé : flux, fils et métal déposé", matiere: "Arc", mots_cles: ["flux", "basicité"], titre: "Rôles et basicité du flux",
     url: "A/02.html#c1", texte: "Rôles et basicité du flux\nL’indice de basicité d’un flux compare ses oxydes basiques et acides."},
    {id: "EE-03-C2", cours: "Électrode enrobée", matiere: "EE", mots_cles: [], titre: "Les rôles de l’enrobage",
     url: "E/03.html#c2", texte: "Les rôles de l’enrobage\nLa recette de l’enrobage dose les minéraux."},
  ];
  assert.deepEqual(chat.rankSections(rows, "Qu’est-ce que la basicité d’un flux en arc submergé ?").map(item => item.row.id), ["AS-02-C1"]);
  assert.deepEqual(chat.buildExtracts({rows, question: "Quelle est la recette d’une tarte aux pommes ?"}), []);
  assert.deepEqual(chat.terms("avant et après le soudage"), ["soud"]);
});

test("cours entier : toutes les sections de la page, complètes et dans l’ordre, puis des extraits d’autres pages (S32)", () => {
  const filler = Array.from({length: 60}, (_, i) => `Phrase ${i} de remplissage sur la soudure.`).join("\n");
  const page = "Thermique/introduction.html";
  const rows = [
    {...ROWS[0], texte: `Comprendre le préchauffage\n${filler}`},
    {id: "TH-01-CALCUL", cours: "Préchauffage", matiere: "Thermique", mots_cles: ["ZAT"], titre: "Le t8/5 en pratique",
     url: "Thermique/introduction.html#calcul", texte: "Le t8/5 en pratique\nLe temps de refroidissement entre 800 et 500 °C."},
    ...ROWS.slice(1),
    {id: "MET-03-C6", cours: "Martensite", matiere: "Métallurgie", mots_cles: [], titre: "Préchauffage et martensite",
     url: "Metallurgie/03-martensite.html#c6", texte: "Préchauffage et martensite\nUn préchauffage limite la martensite de la ZAT."},
  ];
  assert.deepEqual(chat.courseRows(rows, page).map(row => row.id), ["TH-01-INTRO", "TH-01-CALCUL"]);
  assert.deepEqual(chat.courseRows(rows, "index.html"), []);
  const extracts = chat.buildExtracts({rows, question: "Pourquoi le préchauffage ?", page, course: true});
  assert.deepEqual(extracts.map(item => item.id), ["TH-01-INTRO", "TH-01-CALCUL", "MET-03-C6"]);
  assert.equal(extracts[0].texte, rows[0].texte, "texte complet, sans réduction au meilleur passage");
  assert.ok(extracts[0].texte.length > 1500);
  const selection = {id: "TH-01-CALCUL", titre: "Le t8/5 en pratique", cours: "Préchauffage", url: "Thermique/introduction.html#calcul",
                     text: "Le temps de refroidissement"};
  const selected = chat.buildExtracts({rows, question: "Détaille", page, course: true, selection});
  assert.match(selected[0].titre, /Texte sélectionné/);
  assert.deepEqual(selected.slice(1, 3).map(item => item.id), ["TH-01-INTRO", "TH-01-CALCUL"]);
  const home = {rows, question: "Pourquoi le préchauffage ?", page: "index.html"};
  assert.deepEqual(chat.buildExtracts({...home, course: true}), chat.buildExtracts(home), "sans section sur la page, rien ne change");
  assert.equal(chat.approxTokens("x".repeat(3500)), 1000);
});

test("consignes : celles de ce navigateur remplacent le prompt système, sinon celles d’origine (S32)", () => {
  for (const empty of [undefined, null, "", "  \n "]) assert.equal(chat.systemPrompt(empty), SYSTEM);
  assert.equal(chat.systemPrompt("  Réponds en anglais.\n"), "Réponds en anglais.");
  assert.equal(chat.systemPrompt("x".repeat(9000)).length, 8000);
  const body = chat.buildRequest({model: "m", question: "Q", system: "Réponds en anglais."});
  assert.deepEqual(body.messages[0], {role: "system", content: "Réponds en anglais."});
  assert.deepEqual(chat.buildRequest({model: "m", question: "Q", system: " "}).messages[0], {role: "system", content: SYSTEM});
});

test("images : jointes à la dernière question au format multimodal, historique en texte seul (S32)", () => {
  const image = "data:image/jpeg;base64,AAAA";
  const history = [{question: "Q1", answer: "R1", thumbs: ["data:image/jpeg;base64,OLD"]}];
  const body = chat.buildRequest({model: "m", question: "Que montre cette capture ?", history, images: [image]});
  assert.deepEqual(body.messages.slice(1, 3), [{role: "user", content: "Q1"}, {role: "assistant", content: "R1"}]);
  const [text, ...images] = body.messages.at(-1).content;
  assert.equal(text.type, "text");
  assert.match(text.text, /\n\nQUESTION\nQue montre cette capture \?$/);
  assert.deepEqual(images, [{type: "image_url", image_url: {url: image}}]);
  assert.equal(typeof chat.buildRequest({model: "m", question: "Q"}).messages.at(-1).content, "string", "sans image, le message reste du texte");
});

test("modèles : lecture des images d’après les modalités d’entrée publiées (S32)", () => {
  const models = chat.pickModels(chat.MODEL_CANDIDATES, [
    {id: "openai/gpt-6.1-sol", supported_parameters: ["tools"], architecture: {input_modalities: ["text", "image", "file"]}},
    {id: "mistralai/mistral-large-4-0", supported_parameters: ["tools"], architecture: {input_modalities: ["text"]}},
    {id: "deepseek/deepseek-v4-pro", supported_parameters: ["tools"]},
  ]);
  assert.deepEqual(models.map(model => [model.id, model.images]),
    [["openai/gpt-6.1-sol", true], ["mistralai/mistral-large-4-0", false], ["deepseek/deepseek-v4-pro", null]]);
});

test("extraits : seul le meilleur passage d’une longue section est envoyé", () => {
  const filler = Array.from({length: 30}, (_, i) => `Paragraphe ${i} sur un tout autre sujet de dessin.`).join("\n");
  const text = `Titre\n${filler}\nLa règle du levier donne les fractions massiques des phases.\n${filler}`;
  const passage = chat.bestPassage(text, chat.terms("règle du levier"), 400);
  assert.match(passage, /règle du levier/);
  assert.ok(passage.length <= 402, passage.length);
});

test("citations : identifiants repérés, vérifiés contre les extraits envoyés", () => {
  const text = "Le préchauffage [TH-01-INTRO], voir aussi [RDM-04-C3; FAT-01-C1] et [ISO-9606](https://www.iso.org).";
  assert.deepEqual(chat.citations(text), ["TH-01-INTRO", "RDM-04-C3", "FAT-01-C1"]);
  const sent = new Set(["TH-01-INTRO"]);
  const byId = new Map(ROWS.map(row => [row.id, row]));
  assert.deepEqual(chat.checkCitation("TH-01-INTRO", sent, byId), {id: "TH-01-INTRO", verified: true, url: "Thermique/introduction.html#intro"});
  assert.deepEqual(chat.checkCitation("RDM-04-C3", sent, byId), {id: "RDM-04-C3", verified: false, url: "RDM/04-directions-principales-mohr.html#c3"});
  assert.deepEqual(chat.checkCitation("XX-99-C1", sent, byId), {id: "XX-99-C1", verified: false, url: null});
});

function walk(blocks) {
  const nodes = [];
  const visit = node => { nodes.push(node); for (const child of node.inline || node.children || []) visit(child); for (const item of node.items || []) item.forEach(visit); };
  blocks.forEach(visit);
  return nodes;
}

test("markdown : HTML laissé en texte, liens http(s) seulement", () => {
  const blocks = chat.parseMarkdown("<img src=x onerror=alert(1)> **gras** et *penché* `<b>`\n[clic](javascript:alert(1)) [site](https://exemple.org/a?b=1) https://iso.org/page.");
  const nodes = walk(blocks);
  const links = nodes.filter(node => node.type === "link");
  assert.deepEqual(links.map(link => link.href), ["https://exemple.org/a?b=1", "https://iso.org/page"]);
  assert.ok(nodes.some(node => node.type === "text" && node.text.includes("<img src=x onerror=alert(1)>")));
  assert.ok(nodes.some(node => node.type === "text" && node.text.includes("javascript:alert(1)")));
  assert.ok(nodes.some(node => node.type === "strong"));
  assert.ok(nodes.some(node => node.type === "em"));
  assert.ok(nodes.some(node => node.type === "code" && node.text === "<b>"));
  const lists = chat.parseMarkdown("Étapes :\n- nettoyer\n- préchauffer\n\n1. souder\n2. contrôler\n\n```\n<script>x</script>\n```");
  assert.deepEqual(lists.map(block => block.type), ["p", "list", "list", "pre"]);
  assert.equal(lists[1].ordered, false);
  assert.equal(lists[2].ordered, true);
  assert.equal(lists[1].items.length, 2);
  assert.equal(lists[3].text, "<script>x</script>");
  const cites = walk(chat.parseMarkdown("Voir [TH-01-INTRO, RDM-04-C3].")).filter(node => node.type === "cite");
  assert.deepEqual(cites.map(node => node.ids), [["TH-01-INTRO", "RDM-04-C3"]]);
});

test("flux : lignes coupées, commentaires, annotations, usage et fin", () => {
  const events = [];
  const parser = chat.createStreamParser(event => events.push(event));
  parser.push(": OPENROUTER PROCESSING\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"Bon\"}}]}\n\nda");
  parser.push("ta: {\"choices\":[{\"delta\":{\"content\":\"jour [TH-01-INTRO]\",\"annotations\":[{\"type\":\"url_citation\",\"url_citation\":{\"url\":\"https://www.twi-global.com/a\",\"title\":\"TWI\"}},{\"type\":\"url_citation\",\"url_citation\":{\"url\":\"javascript:alert(1)\",\"title\":\"piège\"}}]}}]}\r\n\r\n");
  parser.push("data: {\"choices\":[{\"delta\":{},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":900,\"completion_tokens\":120,\"total_tokens\":1020,\"cost\":0.0042}}\n\ndata: [DONE]\n\n");
  parser.end();
  assert.equal(events.at(-1).done, true);
  const state = events.filter(event => !event.done).reduce(chat.reduceChunk, chat.emptyAnswer());
  assert.equal(state.text, "Bonjour [TH-01-INTRO]");
  assert.deepEqual(state.sources, [{url: "https://www.twi-global.com/a", title: "TWI"}]);
  assert.equal(state.finish, "stop");
  assert.equal(state.usage.total_tokens, 1020);
  const failed = chat.reduceChunk(chat.emptyAnswer(), {error: {code: 402, message: "Insufficient credits"}, choices: [{delta: {content: ""}, finish_reason: "error"}]});
  assert.equal(failed.error.code, 402);
  assert.match(chat.formatUsage(state.usage).replace(/\s/g, ""), /1020tokens.*0,0042\$/);
});

test("erreurs : messages clairs en français et reconnexion sur 401", () => {
  assert.equal(chat.errorFor(401).reconnect, true);
  assert.match(chat.errorFor(401).message, /Reconnectez-vous/);
  assert.match(chat.errorFor(402).message, /[Cc]rédits/);
  assert.equal(chat.errorFor(402).reconnect, false);
  assert.match(chat.errorFor(429).message, /Trop de requêtes/);
  assert.match(chat.errorFor(0).message, /[Cc]onnexion/);
  assert.match(chat.errorFor(400, {error: {message: "bad <b>"}}).message, /bad <b>/);
});

test("hors cours : repéré seulement en tête de réponse", () => {
  assert.equal(chat.isOffCourse("Hors cours : la loi de Hooke…"), true);
  assert.equal(chat.isOffCourse("**Hors cours :** la loi de Hooke…"), true);
  assert.equal(chat.isOffCourse("  hors cours: la loi"), true);
  assert.equal(chat.isOffCourse("D’après [TH-01-INTRO], ce n’est pas hors cours : …"), false);
});

test("modèles : seuls les candidats présents et compatibles avec les outils sont proposés", () => {
  const api = [
    {id: "openai/gpt-6.1-sol", name: "OpenAI: GPT-6.1 Sol", supported_parameters: ["tools", "reasoning"]},
    {id: "openai/gpt-6.1-sol-pro", name: "OpenAI: GPT-6.1 Sol Pro", supported_parameters: ["tools"]},
    {id: "anthropic/claude-opus-5.5", name: "Anthropic: Claude Opus 5.5", supported_parameters: ["reasoning"]},
    {id: "deepseek/deepseek-v4-pro-0813", name: "DeepSeek: V4 Pro", supported_parameters: ["tools"]},
    {id: "moonshotai/kimi-k3:free", name: "Kimi K3 (free)", supported_parameters: ["tools"]},
    {id: "mistralai/mistral-large-4-0", name: "Mistral Large 4", supported_parameters: ["tools", "reasoning"]},
  ];
  const models = chat.pickModels(chat.MODEL_CANDIDATES, api);
  assert.deepEqual(models.map(model => model.id), ["openai/gpt-6.1-sol", "mistralai/mistral-large-4-0", "deepseek/deepseek-v4-pro-0813"]);
  assert.equal(chat.DEFAULT_MODEL, "openai/gpt-6.1-sol");
  const argon = chat.pickModels(chat.MODEL_CANDIDATES, [{id: "google/gemini-4-argon-preview", name: "Google: Gemini 4 Argon (Preview)", supported_parameters: ["tools"]}]);
  assert.deepEqual(argon.map(model => model.label), ["Gemini 4 Argon"]);
  assert.deepEqual(chat.MODEL_CANDIDATES.map(model => model.label),
    ["Claude Opus 5.5", "GPT-6.1 Sol", "Gemini 4 Argon", "Kimi K3", "Mistral Large 4", "DeepSeek V4 Pro"]);
});
