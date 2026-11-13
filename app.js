"use strict";
const byId = (id) => document.getElementById(id);
const time = new Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
const sent = (row) => time.format(new Date(row.sent)) + " UTC";
const label = (value) => value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const backend = /^https:\/\/[a-z0-9.-]+$/i.test(window.demoBackendOrigin || "")
  ? window.demoBackendOrigin : "";

async function loadApprovedSources() {
  if (!backend) return [];
  const response = await fetch(backend + "/api/demo/sources", {
    credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Approved sources unavailable");
  const {sources} = await response.json();
  if (!Array.isArray(sources)) throw new Error("Invalid feed");
  return sources.filter((row) => row && /^approved-[0-9a-f]{32}$/.test(row.id) &&
    ["subject", "project", "topic", "body", "sent"].every((key) => typeof row[key] === "string") &&
    Number.isFinite(Date.parse(row.sent)));
}
const questionWords = new Set(
  "a an are about any be can could did do does for from give has have how i in is me of on please show tell the there to was were what when where which who will with would you".split(" ")
);
const questionPrefix = /^(?:(?:what(?: is|'s| are)|are there|can you|could you|would you|please|show me|tell me|give me|is there|do we have)\s+)+(?:the\s+|any\s+)*/i;
const updatePrefix = /^(?:(?:the\s+|any\s+)?(?:latest|recent|new)\s+(?:(?:news|updates?)\s+)?(?:on|about|for|from|with)\s+|(?:news|updates?)\s+(?:on|about|for|from|with)\s+)/i;
const tokenize = (text) => text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];

function searchTerms(query) {
  const cleaned = query.replace(/’/g, "'").replace(questionPrefix, "").replace(updatePrefix, "");
  const terms = tokenize(cleaned).filter((term) => !questionWords.has(term));
  return [...new Set(terms.length ? terms : tokenize(query))];
}

function node(tag, content, className) {
  const element = document.createElement(tag);
  element.textContent = content;
  if (className) element.className = className;
  return element;
}

function showSource(rows, panel) {
  const id = new URLSearchParams(location.search).get("id");
  const row = rows.find((entry) => entry.id === id);
  if (!row) {
    panel.textContent = "This source is not in the demo.";
    return;
  }
  const detail = node("section", "", "source");
  detail.append(
    node("h1", row.subject),
    node("p", row.sender ? "From " + row.sender : "Approved synthetic source", "meta"),
    node("p", "Sent " + sent(row), "meta"),
    node("p", row.body, "email-body")
  );
  panel.replaceChildren(detail);
}

function showBrowser(rows) {
  const state = {query: "", topic: "", project: "", page: 0, timeline: false};
  const searchable = rows.map((row) => ({
    row,
    words: new Set(tokenize([row.subject, row.project, row.topic, row.body].join(" "))),
  }));
  const topicCounts = new Map();
  for (const row of rows) topicCounts.set(row.topic, (topicCounts.get(row.topic) || 0) + 1);
  const topicButtons = new Map();
  const all = [["", rows.length], ...[...topicCounts.entries()].sort()];
  for (const [topic, count] of all) {
    const button = node("button", (topic ? label(topic) : "All topics") + " · " + count);
    button.type = "button";
    button.addEventListener("click", () => { state.topic = topic; state.page = 0; render(); });
    topicButtons.set(topic, button);
    byId("topics").append(button);
  }
  for (const project of [...new Set(rows.map((row) => row.project))].sort()) {
    const option = node("option", project);
    option.value = project;
    byId("project").append(option);
  }
  byId("project").addEventListener("change", (event) => {
    state.project = event.target.value; state.page = 0; render();
  });
  byId("search").addEventListener("submit", (event) => {
    event.preventDefault();
    state.query = byId("query").value.trim().slice(0, 300);
    state.page = 0;
    render();
  });
  byId("timeline").addEventListener("click", () => { state.timeline = !state.timeline; state.page = 0; render(); });
  byId("prev").addEventListener("click", () => { state.page--; render(); });
  byId("next").addEventListener("click", () => { state.page++; render(); });

  function render() {
    const terms = searchTerms(state.query);
    const matches = searchable.filter(({row, words}) => {
      return (!state.topic || row.topic === state.topic) &&
        (!state.project || row.project === state.project) && terms.every((term) => words.has(term));
    }).map(({row}) => row);
    state.page = Math.max(0, Math.min(state.page, Math.ceil(matches.length / 10) - 1));
    const start = state.page * 10;
    const results = byId("results");
    results.replaceChildren();
    let day;
    for (const row of matches.slice(start, start + 10)) {
      if (state.timeline && row.sent.slice(0, 10) !== day) {
        day = row.sent.slice(0, 10);
        results.append(node("h3", day, "date-group"));
      }
      const card = node("article", "");
      const info = node("div", "");
      info.append(node("h3", row.subject), node("p", row.project + " · " + label(row.topic) + " · Sent " + sent(row), "meta"));
      const link = node("a", "Read source");
      link.href = "source.html?id=" + encodeURIComponent(row.id);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      card.append(info, link);
      results.append(card);
    }
    for (const [topic, button] of topicButtons) button.setAttribute("aria-pressed", String(topic === state.topic));
    byId("timeline").setAttribute("aria-pressed", String(state.timeline));
    byId("view-title").textContent = state.timeline ? "Project timeline" : "Sources";
    byId("summary").textContent = matches.length
      ? "Showing " + (start + 1) + "–" + Math.min(start + 10, matches.length) + " of " + matches.length + " sources"
      : "No matching sources. Try a project name, topic, or fewer keywords, or clear the filters.";
    byId("prev").disabled = start === 0;
    byId("next").disabled = start + 10 >= matches.length;
  }
  render();
}

fetch("sources.json")
  .then((response) => {
    if (!response.ok) throw new Error("Source data unavailable");
    return response.json();
  })
  .then(async (rows) => {
    const operator = byId("operator-link");
    if (operator && backend) {
      operator.querySelector("a").href = backend + "/review";
      operator.hidden = false;
    }
    const additions = await loadApprovedSources().catch(() => []);
    rows = [...rows, ...additions].sort((a, b) => Date.parse(b.sent) - Date.parse(a.sent) || a.id.localeCompare(b.id));
    const source = byId("source");
    if (source) showSource(rows, source);
    else showBrowser(rows);
  })
  .catch(() => {
    (byId("source") || byId("summary")).textContent = "Demo sources could not be loaded. Refresh and try again.";
  });
