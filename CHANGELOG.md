# Changelog

## 0.1.0

First public release.

- **Project profiles** — Lingo adapts to the project type: `web`, `service`,
  `library`, `cli`, `data`, or `generic`. Detected from dependencies and layout
  at setup, with a dropdown to override. The profile sets the grouping noun, the
  `kind` vocabulary, the CLAUDE.md wording, and the default view.
- **`log_element` gains `area` and `parent`** — `area` groups related things
  (page, service, module, command group…); `parent` names a containing element
  and drives the Tree view. `kind` is now free text. The tool's description is
  generated from the project's profile.
- **Sidebar views** — **Glossary** (all profiles), **Tree** (nested by
  `parent`), **Map** (web only — the page-silhouette view).
- **In-panel onboarding** — the sidebar discovers candidate projects, shows the
  detected profile, and sets everything up in one click: `.mcp.json`,
  `CLAUDE.md` (marker-delimited, re-synced in place), `.claude/commands/lingo-init.md`,
  `.claude/settings.local.json` (auto-approve), and the SQLite file.
- **`/lingo-init`** — a generated slash command that has the agent catalog an
  existing codebase into Lingo (read-only, idempotent).
- **Version-stable MCP server path** — the server is copied to a per-user
  location that survives extension updates; stale `.mcp.json` paths self-heal on
  activation. The server also falls back to `<cwd>/.lingo/lingo.sqlite`, so a
  single global `claude mcp add` registration works across projects.
- Schema migrates automatically from earlier internal versions (`page` → `area`,
  new columns).
