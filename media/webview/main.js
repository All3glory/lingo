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
      body.appendChild(legend());
      for (const a of areas) renderAreaMap(body, a, byArea[a]);
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

  // ---- map (web) ----------------------------------------------------

  function renderAreaMap(parent, area, items) {
    const sorted = [...items].sort((a, b) => a.id - b.id);
    const bands = { header: [], main: [], aside: [], footer: [] };
    for (const item of sorted) {
      const kind = inferKind(item);
      bands[inferRegion(item, kind)].push({ item, kind });
    }
    const frame = el("div", { class: "map-frame" });
    frame.appendChild(el("div", { class: "map-page-label", text: area }));
    if (bands.header.length) frame.appendChild(band("header", bands.header, "row"));
    const mid = el("div", { class: "map-mid" });
    mid.appendChild(band("main", bands.main, "col"));
    if (bands.aside.length) mid.appendChild(band("aside", bands.aside, "col"));
    frame.appendChild(mid);
    if (bands.footer.length) frame.appendChild(band("footer", bands.footer, "row"));
    parent.appendChild(frame);
  }

  function band(region, entries, flow) {
    const wrap = el("div", { class: `map-band map-band-${region} flow-${flow}` });
    if (!entries.length) {
      wrap.appendChild(el("div", { class: "map-empty", text: region }));
      return wrap;
    }
    for (const { item, kind } of entries) {
      const block = el("div", { class: `map-block kind-${kind}`, text: item.name });
      block.title = item.description
        ? `${item.name} — ${item.description}`
        : item.name;
      if (item.filePath) {
        block.classList.add("clickable");
        block.addEventListener("click", () =>
          send("openFile", { file: item.filePath }),
        );
      }
      wrap.appendChild(block);
    }
    return wrap;
  }

  function legend() {
    const kinds = ["nav", "text", "image", "button", "form", "container", "footer"];
    const box = el("div", { class: "legend" });
    for (const k of kinds) {
      const chip = el("span", { class: "legend-item" });
      chip.appendChild(el("span", { class: `legend-swatch kind-${k}` }));
      chip.appendChild(el("span", { text: k }));
      box.appendChild(chip);
    }
    return box;
  }

  const MAP_KINDS = new Set([
    "nav",
    "text",
    "image",
    "button",
    "form",
    "container",
    "footer",
  ]);

  function inferKind(item) {
    if (item.kind && MAP_KINDS.has(item.kind)) return item.kind;
    const s = (item.name + " " + (item.description || "")).toLowerCase();
    if (/(navbar|\bnav\b|header|menu|breadcrumb|topbar)/.test(s)) return "nav";
    if (/footer/.test(s)) return "footer";
    if (/(image|\bimg\b|photo|logo|banner|gallery|carousel|video)/.test(s))
      return "image";
    if (/(button|\bbtn\b|\bcta\b)/.test(s)) return "button";
    if (/(form|input|\bfield\b|search|newsletter|sign ?up|subscribe)/.test(s))
      return "form";
    if (/(heading|title|headline|\btext\b|paragraph|copy|caption|label)/.test(s))
      return "text";
    return "container";
  }

  function inferRegion(item, kind) {
    if (item.region) return item.region;
    if (kind === "nav") return "header";
    if (kind === "footer") return "footer";
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
