"use strict";
const byId = (id) => document.getElementById(id);
const time = new Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"});
const sent = (row) => time.format(new Date(row.sent)) + " UTC";
const label = (value) => value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

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
    node("p", "From " + row.sender, "meta"),
    node("p", "Sent " + sent(row), "meta"),
    node("p", row.body, "email-body")
  );
  panel.replaceChildren(detail);
}

function showBrowser(rows) {
  const state = {query: "", topic: "", project: "", page: 0, timeline: false};
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
    const terms = state.query.toLowerCase().match(/\w+/g) || [];
    const matches = rows.filter((row) => {
      const words = new Set([row.subject, row.project, row.topic, row.body].join(" ").toLowerCase().match(/\w+/g) || []);
      return (!state.topic || row.topic === state.topic) &&
        (!state.project || row.project === state.project) && terms.every((term) => words.has(term));
    });
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
      : "No matching sources. Try a project name such as Atlas or clear the filters.";
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
  .then((rows) => {
    const source = byId("source");
    if (source) showSource(rows, source);
    else showBrowser(rows);
  })
  .catch(() => {
    (byId("source") || byId("summary")).textContent = "Demo sources could not be loaded. Refresh and try again.";
  });
