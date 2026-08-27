// @ts-check
(function () {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById("root");

  /** @type {any} */
  let state = { view: "loading", projects: [], elements: [], areas: [] };
  let mode = (vscode.getState() && vscode.getState().mode) || null;

  window.addEventListener("message", (event) => {
    const msg = event.data;
    if (msg.type === "render") {
      state = { ...state, ...msg };
      if (state.profile) {
        const views = state.profile.views || ["glossary"];
        if (!mode || !views.includes(mode)) mode = views[0];
      }
      draw();
    } else if (msg.type === "busy") {
      renderNotice(msg.message || "Working…");
    } else if (msg.type === "error") {
      draw();
      root.prepend(
        el("div", { class: "notice error", text: "Error: " + msg.message }),
      );
    }
  });

  function send(type, extra) {
    vscode.postMessage({ type, ...(extra || {}) });
  }

  function setMode(next) {
    mode = next;
    vscode.setState({ ...(vscode.getState() || {}), mode });
    draw();
  }

  // ---- top level --------------------------------------------------------

  function draw() {
    root.textContent = "";
    switch (state.view) {
      case "no-folder":
        return renderNoFolder();
      case "pick-folder":
        return renderPicker();
      case "not-setup":
        return renderNotSetup();
      case "ready":
        return renderReady();
      default:
        return renderNotice("Loading…");
    }
  }

  function renderNotice(text) {
    root.textContent = "";
    root.appendChild(el("div", { class: "notice", text }));
  }

  function renderNoFolder() {
    root.appendChild(
      el("div", { class: "notice", text: "Open a project folder to use Lingo." }),
    );
    const btn = el("button", { class: "primary", text: "Open Folder…" });
    btn.addEventListener("click", () => send("openFolder"));
    root.appendChild(btn);
  }

  function renderPicker() {
    root.appendChild(el("h3", { text: "Choose a project" }));
    root.appendChild(
      el("div", {
        class: "hint",
        text: "Lingo keeps a separate dictionary per project.",
      }),
    );
    const list = el("div", { class: "project-list" });
    for (const p of state.projects) {
      const item = el("button", { class: "project" });
      item.appendChild(el("span", { class: "project-name", text: p.name }));
      item.appendChild(
        el("span", {
          class: "badge " + (p.hasLingo ? "on" : "off"),
          text: p.hasLingo ? "Lingo" : "not set up",
        }),
      );
      if (state.activeId === p.path) item.classList.add("active");
      item.addEventListener("click", () => send("selectFolder", { id: p.path }));
      list.appendChild(item);
    }
    root.appendChild(list);
  }

  function renderNotSetup() {
    root.appendChild(folderBar(state.folder));
    const card = el("div", { class: "card" });
    card.appendChild(
      el("p", { text: "This project has no Lingo dictionary yet." }),
    );

    card.appendChild(el("label", { class: "field-label", text: "Project type" }));
    card.appendChild(profileSelect(state.selectedProfile));
    const chosen = (state.profiles || []).find(
      (p) => p.id === state.selectedProfile,
    );
    if (chosen) {
      card.appendChild(el("p", { class: "hint", text: chosen.blurb }));
    }

    const ul = el("ul");
    ul.appendChild(el("li", { text: "add a lingo entry to .mcp.json" }));
    ul.appendChild(
      el("li", { text: "write CLAUDE.md instructions for this project type" }),
    );
    ul.appendChild(el("li", { text: "add the /lingo-init catalog command" }));
    ul.appendChild(
      el("li", { text: "auto-approve the server in .claude/settings.local.json" }),
    );
    card.appendChild(ul);
    card.appendChild(
      el("p", {
        class: "hint",
        text:
          "Then restart Claude Code with this folder as its working directory.",
      }),
    );
    const btn = el("button", { class: "primary", text: "Set up Lingo here" });
    btn.addEventListener("click", () => send("setup"));
    card.appendChild(btn);
    root.appendChild(card);
  }

  function profileSelect(selected) {
    const sel = el("select", { class: "profile-select" });
    for (const p of state.profiles || []) {
      const opt = el("option", { text: p.label });
      opt.value = p.id;
      if (p.id === selected) opt.selected = true;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () =>
      send("setProfile", { id: sel.value }),
    );
    return sel;
  }

  function renderReady() {
    const bar = folderBar(state.folder);
    if (state.profile) {
      // Read-only — the type is chosen once at setup. "Lingo: Change project
      // type" in the command palette is the escape hatch.
      bar.appendChild(
        el("span", {
          class: "profile-chip",
          text: state.profile.label || state.profile.id,
        }),
      );
    }
    root.appendChild(bar);

    const toolbar = el("div", { class: "toolbar" });
    const modes = el("div", { class: "modes" });
    for (const v of (state.profile && state.profile.views) || ["glossary"]) {
      modes.appendChild(modeButton(v, VIEW_LABELS[v] || v));
    }
    toolbar.appendChild(modes);
    const refresh = el("button", { text: "Refresh" });
    refresh.addEventListener("click", () => send("refresh"));
    toolbar.appendChild(refresh);
    root.appendChild(toolbar);

    const body = el("div", { class: "body" });

    if (!state.elements.length) {
      if (state.suggestInit) {
        const c = el("div", { class: "card" });
        c.appendChild(
          el("p", { text: "This project has code, but nothing is in Lingo yet." }),
        );
        c.appendChild(
          el("p", {
            class: "hint",
            text:
              "Run " +
              (state.initCommand || "/lingo-init") +
              " in Claude Code to catalog it. Read-only — it never edits code.",
          }),
        );
        const btn = el("button", {
          class: "primary",
          text: "Copy " + (state.initCommand || "/lingo-init"),
        });
        btn.addEventListener("click", () => send("copyInitCommand"));
        c.appendChild(btn);
        body.appendChild(c);
      } else {
        body.appendChild(
          el("div", {
            class: "notice",
            text: "Nothing logged yet. Entries appear as the agent logs them.",
          }),
        );
      }
      root.appendChild(body);
      return;
    }

    if (mode === "glossary" || mode === "tree") {
      const controls = el("div", { class: "list-controls" });
      const ex = el("button", { class: "link", text: "Expand all" });
      const co = el("button", { class: "link", text: "Collapse all" });
      ex.addEventListener("click", () => setAllAreas(body, true));
      co.addEventListener("click", () => setAllAreas(body, false));
      controls.appendChild(ex);
      controls.appendChild(co);
      root.appendChild(controls);
    }
    root.appendChild(body);

    const byArea = groupBy(state.elements, (e) => e.area);
    const areas = Object.keys(byArea).sort();

    if (mode === "map") {
      const cfg = mapConfig();
      if (!cfg) {
        body.appendChild(
          el("div", {
            class: "notice",
            text: "No map for this project type — try Tree or Glossary.",
          }),
        );
      } else {
        body.appendChild(legend(cfg));
        for (const a of areas) renderAreaMap(body, a, byArea[a], cfg);
      }
    } else if (mode === "tree") {
      for (const a of areas) renderAreaTree(body, a, byArea[a]);
    } else {
      for (const a of areas) renderAreaGlossary(body, a, byArea[a]);
    }
  }

  const VIEW_LABELS = { glossary: "Glossary", tree: "Tree", map: "Map" };

  // ---- shared bits -----------------------------------------------------

  function folderBar(folder) {
    const bar = el("div", { class: "folder-bar" });
    bar.appendChild(
      el("span", { class: "folder-name", text: folder ? folder.name : "—" }),
    );
    if ((state.projects || []).length > 1) {
      const change = el("button", { class: "link", text: "change" });
      change.addEventListener("click", () => send("changeFolder"));
      bar.appendChild(change);
    }
    return bar;
  }

  function modeButton(value, label) {
    const b = el("button", {
      class: "mode" + (mode === value ? " active" : ""),
      text: label,
    });
    b.addEventListener("click", () => setMode(value));
    return b;
  }

  function setAllAreas(body, open) {
    body.querySelectorAll("details.area").forEach((d) => {
      d.open = open;
    });
  }

  // ---- glossary --------------------------------------------------------

  function renderAreaGlossary(parent, area, items) {
    const section = el("details", { class: "area", open: true });
    section.appendChild(
      el("summary", { class: "area-summary", text: `${area} (${items.length})` }),
    );
    for (const item of [...items].sort((a, b) => a.name.localeCompare(b.name))) {
      section.appendChild(elementRow(item));
    }
    parent.appendChild(section);
  }

  // ---- tree -----------------------------------------------------------

  function renderAreaTree(parent, area, items) {
    const section = el("details", { class: "area", open: true });
    section.appendChild(
      el("summary", { class: "area-summary", text: `${area} (${items.length})` }),
    );
    const names = new Set(items.map((i) => i.name));
    const childrenOf = groupBy(
      items.filter((i) => i.parent && names.has(i.parent)),
      (i) => i.parent,
    );
    const roots = items
      .filter((i) => !i.parent || !names.has(i.parent))
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const r of roots) {
      section.appendChild(treeNode(r, childrenOf, new Set()));
    }
    parent.appendChild(section);
  }

  function treeNode(item, childrenOf, seen) {
    if (seen.has(item.name)) return el("div", { class: "notice", text: item.name });
    seen.add(item.name);
    const row = elementRow(item);
    const kids = (childrenOf[item.name] || []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    if (kids.length) {
      const nest = el("div", { class: "tree-children" });
      for (const k of kids) nest.appendChild(treeNode(k, childrenOf, seen));
      row.querySelector(".element-body").appendChild(nest);
      row.open = true;
    }
    return row;
  }

  // ---- one element row (shared by glossary + tree) --------------------

  function elementRow(item) {
    const row = el("details", { class: "element" });
    const summary = el("summary", { class: "element-summary" });
    if (item.kind) {
      summary.appendChild(el("span", { class: "kindtag", text: item.kind }));
    }
    summary.appendChild(el("span", { class: "name", text: item.name }));
    row.appendChild(summary);

    const body = el("div", { class: "element-body" });
    body.appendChild(
      el("p", {
        class: "desc" + (item.description ? "" : " muted"),
        text: item.description || "No description.",
      }),
    );
    if (item.previousNames && item.previousNames.length) {
      body.appendChild(
        el("div", {
          class: "prev",
          text: "previously: " + item.previousNames.join(", "),
        }),
      );
    }

    const adv = el("details", { class: "advanced" });
    adv.appendChild(el("summary", { text: "code" }));
    const dl = el("div", { class: "adv-body" });
    if (item.codeId) dl.appendChild(kv("id", item.codeId, true));
    if (item.filePath) {
      const link = el("button", { class: "link file", text: item.filePath });
      link.addEventListener("click", () =>
        send("openFile", { file: item.filePath }),
      );
      const line = el("div", { class: "kv" });
      line.appendChild(el("span", { class: "k", text: "file" }));
      line.appendChild(link);
      dl.appendChild(line);
    }
    if (item.parent) dl.appendChild(kv("parent", item.parent));
    const place = [item.kind, item.region].filter(Boolean).join(" · ");
    if (place) dl.appendChild(kv("type", place));
    dl.appendChild(kv("lingo id", String(item.id)));
    adv.appendChild(dl);
    body.appendChild(adv);

    row.appendChild(body);
    return row;
  }

  function kv(k, v, mono) {
    const line = el("div", { class: "kv" });
    line.appendChild(el("span", { class: "k", text: k }));
    line.appendChild(el("span", { class: "v" + (mono ? " mono" : ""), text: v }));
    return line;
  }

  // ---- map (per profile) ------------------------------------------

  function mapConfig() {
    return (state.profile && state.profile.map) || null;
  }

  // Which band an item belongs to, as a 0-based index into cfg.bands (-1 = Other).
  function bandIndex(item, cfg) {
    const key =
      cfg.by === "region"
        ? item.region || webRegion(item)
        : (item.kind || "").toLowerCase();
    return cfg.bands.findIndex((b) => b.match.includes(key));
  }

  function renderAreaMap(parent, area, items, cfg) {
    const sorted = [...items].sort((a, b) => a.id - b.id);
    const buckets = cfg.bands.map(() => []);
    const other = [];
    for (const item of sorted) {
      const i = bandIndex(item, cfg);
      (i >= 0 ? buckets[i] : other).push(item);
    }

    const frame = el("div", { class: "map-frame" });
    frame.appendChild(el("div", { class: "map-page-label", text: area }));

    const bandEl = (label, list, idx, flow) => {
      const wrap = el("div", {
        class: `map-band band-c${((idx % 6) + 6) % 6} flow-${flow}`,
      });
      wrap.appendChild(el("div", { class: "map-band-label", text: label }));
      const blocks = el("div", { class: `map-blocks flow-${flow}` });
      if (!list.length) {
        blocks.appendChild(el("span", { class: "map-empty", text: "—" }));
      }
      for (const item of list) {
        const b = el("div", { class: "map-block", text: item.name });
        b.title = item.description
          ? `${item.name} — ${item.description}`
          : item.name;
        if (item.filePath) {
          b.classList.add("clickable");
          b.addEventListener("click", () =>
            send("openFile", { file: item.filePath }),
          );
        }
        blocks.appendChild(b);
      }
      wrap.appendChild(blocks);
      return wrap;
    };

    if (cfg.layout === "silhouette") {
      // bands are [Header, Main, Aside, Footer] by convention
      const [h, m, a, f] = buckets;
      if (h.length) frame.appendChild(bandEl(cfg.bands[0].label, h, 0, "row"));
      const mid = el("div", { class: "map-mid" });
      const mainBand = bandEl(cfg.bands[1].label, m, 1, "col");
      mainBand.classList.add("grow");
      mid.appendChild(mainBand);
      if (a.length) mid.appendChild(bandEl(cfg.bands[2].label, a, 2, "col"));
      frame.appendChild(mid);
      if (f.length) frame.appendChild(bandEl(cfg.bands[3].label, f, 3, "row"));
    } else {
      cfg.bands.forEach((b, i) => {
        if (buckets[i].length) {
          frame.appendChild(bandEl(b.label, buckets[i], i, "row"));
        }
      });
    }
    if (other.length) {
      frame.appendChild(bandEl("Other", other, cfg.bands.length, "row"));
    }
    parent.appendChild(frame);
  }

  function legend(cfg) {
    const box = el("div", { class: "legend" });
    cfg.bands.forEach((b, i) => {
      const chip = el("span", { class: "legend-item" });
      chip.appendChild(
        el("span", { class: `legend-swatch band-c${i % 6}` }),
      );
      chip.appendChild(el("span", { text: b.label }));
      box.appendChild(chip);
    });
    return box;
  }

  // web only: guess a region when `region` wasn't logged
  function webRegion(item) {
    const s = (item.name + " " + (item.description || "")).toLowerCase();
    if (/(navbar|\bnav\b|header|topbar|breadcrumb)/.test(s)) return "header";
    if (/footer/.test(s)) return "footer";
    if (/(sidebar|\baside\b|rail)/.test(s)) return "aside";
    return "main";
  }

  // ---- helpers ----------------------------------------------------

  function groupBy(arr, keyOf) {
    const out = {};
    for (const x of arr) (out[keyOf(x)] ??= []).push(x);
    return out;
  }

  function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.text != null) node.textContent = opts.text;
    if (opts.open) node.open = true;
    return node;
  }

  send("ready");
})();
