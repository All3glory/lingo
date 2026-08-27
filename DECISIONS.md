# Lingo — open design questions

Carried from the project brief. Resolve these as the prototype matures.

## 1. SQLite access from the VS Code extension host

**Decided (for now):** the extension host never opens SQLite directly. The
Electron runtime VS Code ships has no `node:sqlite`, and native modules
(`better-sqlite3`) mean matching Electron's ABI on every VS Code update.

Instead:

- **Writes** go through the bundled MCP server (`dist/mcp-server.js`), spawned by
  Claude Code as its own `node` process — full `node:sqlite`, zero native deps.
- **Reads** for the sidebar spawn `node dist/db-cli.js <dbPath> list` and parse
  JSON.

Cost: the user needs Node 22.5+ on `PATH` (configurable via
`lingo.nodePath`).
Revisit if we ever want the sidebar to work with no Node install.

## 2. One database per project, or one per area?

One `.lingo/lingo.sqlite` per project, `area` as a column. One-per-area would
make area-scoped reads trivial but complicates cross-area queries and backfill.
Keep single-file until it hurts.

## 2b. Project profiles (v0.1.0)

Lingo is not web-only. `src/profiles.ts` defines profiles — `web`, `service`,
`library`, `cli`, `data`, `generic` — each with a grouping noun, a `kind`
vocabulary, a CLAUDE.md paragraph, and a default view. `src/profileDetect.ts`
scores them from `package.json` deps (+ requirements.txt / pyproject / go.mod)
and layout; the setup picker overrides. The choice lives in `meta.profile`; the
MCP server reads it to tailor the `log_element` description at registration.

Schema v4: `page` → `area` (migrated via `ALTER TABLE RENAME COLUMN`), `kind`
is now free text, and `parent` (a name in the same area) was added to drive the
Tree view. `region` stays but is web-only.

Open: detection is shallow and one-dir-deep. Monorepos with mixed packages get
one profile for the whole tree. Per-subfolder profiles would need the discovery
layer to treat each package as its own project.

## 3. Backfill: dumb scan or Claude-driven?

**Claude-driven, first cut done (v0.0.7).** Setup writes
`.claude/commands/lingo-init.md` (`src/initCommand.ts`) — a project slash
command whose body tells Claude to walk the pages/components and log each
element via `log_element` (read-only, idempotent). One `log_element` code path,
no separate scanner.

The extension can't run it for you — no supported API to send Claude Code a
prompt. So the sidebar nudges: when the DB is empty *and* the folder has ≥3 UI
source files (`countUiFiles` in `workspace.ts`), the ready view shows a "Copy
`/lingo-init`" button. Fresh projects see nothing — they fill in as you go.

Open: a truly one-click version would spawn a terminal and run
`claude "/lingo-init"`, but that's fragile (which terminal, `claude` on PATH).
Revisit if the copy-paste step is a real friction point.

## 4. `(page, name)` uniqueness

Current schema enforces it. If two different elements legitimately share a name
on one page, the second `log_element` silently updates the first. Acceptable for
a prototype; may need a disambiguating key (component path?) later.

## 5. Registering the MCP server

The sidebar's **Set up Lingo here** button (or `lingo.setup`) does three things
for the selected project: writes a version-stable `lingo` entry to `.mcp.json`,
injects a marker-delimited section into `CLAUDE.md` (`src/claudeMd.ts`), and
seeds an empty DB. Claude Code must still be restarted to pick up the server —
no programmatic reload hook today.

The "selected project" is chosen in the panel: `src/workspace.ts` discovers each
workspace folder plus its project-like immediate subdirectories, so opening a
parent directory of many repos still works. Auto-selects when there's one
candidate, or one that already has Lingo; otherwise the panel shows a picker.
The choice is remembered in `workspaceState`.

**Claude Code must run with the project as its working directory.** It reads
`.mcp.json` and `.claude/commands/` from its cwd only — not from subdirectories.
If someone opens a parent folder and runs Claude Code there, `me/.mcp.json` is
invisible. Setup can't fix that, but it mitigates:
- `src/mcp/server.ts` falls back to `<cwd>/.lingo/lingo.sqlite` when
  `LINGO_DB_PATH` is unset, so a single global `claude mcp add` registration
  works across every project.
- setup writes `.claude/settings.local.json` with
  `enableAllProjectMcpServers: true` (`src/claudeSettings.ts`) so the server is
  approved without a prompt.
- `/lingo-init` is a project command; if the user runs a "global" Claude, they
  copy it to `~/.claude/commands/`.

Open question: the subdirectory scan is one level deep and marker-based
(`package.json`, `.git`, …). Monorepos with nested packages, or projects two
levels down, won't be offered. Revisit if that bites.

## 6. Phase 2 block view

**Done (v0.0.3), first cut.** A List / Blocks toggle in the panel (choice
persisted via webview state). Blocks view draws a rough page silhouette per
page: a full-width `header` band, a `main` + optional `aside` row, a full-width
`footer` band. Blocks stack in log order (by `id`) within each band, coloured by
`kind`.

Position hints: took *both* routes from the brief. `log_element` now accepts
optional `kind` and `region`; when absent, the webview infers `kind` from
keywords in the name/description and derives `region` from that (nav→header,
footer→footer, else main). Schema v2 adds `kind` and `region` columns;
`migrate()` in store.ts `ALTER TABLE`s them onto older databases on open.

Still rough: no real x/y coordinates, no nesting/containment, `aside` only
appears if something is explicitly placed there. Good enough to eyeball a page;
revisit if a truer layout is wanted.
