# Changelog

## 0.2.0

- **More project types.** Added `mobile`, `desktop`, `game`, and `infra`
  profiles; renamed `service` → `backend` (existing databases migrate
  automatically). Every profile's `kind` vocabulary is wider.
- **"Especially log these" guidance.** Each profile now carries a list of the
  things that are easy to forget for that kind of project — endpoint
  method+paths and event-name strings for a backend, data lineage and feature
  definitions for a data project, IPC channel names for a desktop app, and so
  on. This goes into the generated `CLAUDE.md` section and the `/lingo-init`
  command, so the agent logs the details that make the dictionary worth having.
- Detection recognises React Native / Expo / Flutter, Electron / Tauri, Unity /
  Godot / Phaser, and Terraform / Pulumi / CDK.
- **Works from a parent directory.** `log_element` / `list_elements` /
  `get_element` take an optional `project` path; the server routes the call to
  that project's own `.lingo/lingo.sqlite`. `/lingo-init` now takes a folder
  argument (`/lingo-init packages/api`) and tells the agent to pass `project`
  accordingly — so you can catalog a sub-project without opening it directly.
- The project type is a one-time choice at setup (pick from the dropdown, or
  take the detected default). The sidebar no longer shows a type switcher; use
  **Lingo: Change project type** in the command palette if detection was wrong.

## 0.1.2

- Publisher id is `pwnsbd`, so the extension id is now **`pwnsbd.lingo`**
  (was `All3gory.lingo`). If you installed an earlier `.vsix`, uninstall it and
  install this one.

## 0.1.1

- Marketplace icon.
- Fixed a grammar slip in the generated `/lingo-init` command ("for an page").

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
