# Lingo

**A shared dictionary between you and your coding agent.** Lingo is a VS Code
extension that lets an agent (Claude Code) keep a running record of the names it
gives every part of your project — components, endpoints, modules, CLI commands,
data pipelines — and shows you that record in a sidebar, so you can ask for
precise changes using the exact words the agent already uses.

## The problem

As a project grows you forget what everything is called. So you describe it
vaguely — "the box on the left," "that auth thing," "the endpoint near the
webhook code" — and hope the agent lands on what you actually mean. It often
doesn't, and you burn a round trip finding out. Both sides are guessing: you're
guessing the name, the agent's guessing your intent.

## How Lingo helps

Every time the agent creates, renames, or meaningfully changes a named thing, it
records it in Lingo: the name, the file, the area it belongs to, a plain-English
description. The sidebar shows the current dictionary at a glance.

When you want a change, you read the real name off the sidebar and say it:

> "Make **PlanComparisonGrid** two columns on mobile."
> "Add rate-limiting to the **loginHandler** endpoint."

No vague descriptions, no guessing — on your side or the agent's.

## It adapts to the project

Lingo picks a **profile** at setup — website, backend, library, CLI, data
project, mobile app, desktop app, game, infra, or generic — detected from your
dependencies and layout, with a dropdown to override. The profile sets the
grouping ("Page" vs "Area" vs "Module"), the `kind` vocabulary the agent uses,
the default sidebar view, and a per-type list of *"especially log these"* — the
details that are easy to forget for that kind of project (an endpoint's
method+path, a data pipeline's lineage, a desktop app's IPC channel names).

## Why I built this

I forget things. Halfway through a project I can't remember what I named the
components I built a week ago, so I end up describing them to the agent — "the
section under the hero, no, the *other* one" — and hoping it changes the right
thing. The more the project grows, the worse it gets.

Lingo is me trying to organize a messy brain: let the agent write down every
name as it goes, and put that list somewhere I can just look at. So I can point
at the exact thing I mean, and still understand my own project once it's big.

If it helps you too, you can [buy me a coffee](https://buymeacoffee.com/pwnsbd) ☕

## This is early — tell me what's rough

I'm actively shaping Lingo around my own workflow, so there are edge cases I
haven't hit: project layouts the profile detection misreads, an agent that logs
too much or too little, a view that doesn't fit your kind of project, setup that
trips on a non-standard Claude Code setup.

If something feels awkward, breaks, or is missing, I'd genuinely like to hear
it. Concrete reports help most — *"I ran it on a \<kind of project\>, did X, and
Y happened."* Ideas for what would make it more useful are welcome too. Open an
issue on the repo, or reach me at [pwnsbd.me](https://pwnsbd.me).

## How it works

1. The extension bundles a small **local MCP server** exposing one main tool,
   `log_element` (plus `list_elements` and `get_element` for the agent to recall
   names before it edits). The tool's description is tailored to the project
   profile.
2. A profile-specific section in the project's `CLAUDE.md` tells the agent to
   call `log_element` as part of its normal work whenever it names or changes
   something.
3. Each entry is written to a local `.lingo/lingo.sqlite` file — one per project.
4. The **sidebar panel** renders that database live, updating as the agent works.

Lingo is **reactive only**. It never scans, infers, or edits code. It records
what the agent tells it, as a side effect of the agent's normal work — and it
keeps history: a renamed entry carries its old names with it.

## The sidebar

The panel walks itself through setup, then shows the dictionary:

- **No folder open** → an "Open Folder" button.
- **Folders open** → Lingo finds the candidate projects (each workspace folder
  and its project-like subdirectories) and auto-selects the obvious one,
  otherwise you pick from a list.
- **Project without Lingo** → a "Set up Lingo here" button, with the detected
  project type shown and changeable first.
- **Project with Lingo** → the dictionary. Views depend on the profile:
  - **Glossary** — collapsible per-area headings (Expand-all / Collapse-all).
    Each entry expands to its description, rename history, and a **code**
    disclosure: the exact `codeId`, the file link, the `parent`, the type.
  - **Tree** — the same entries nested by `parent` ("the `login` handler inside
    `AuthController`"). Default for services, libraries, CLIs, data projects.
  - **Map** — *(web only)* a rough visual map of each page: header band,
    main + aside, footer band, color-coded by kind.

Switch projects or the profile from the panel header.

## Install

Requires **Node 22.5+** on your `PATH` (for the built-in `node:sqlite` module).

```sh
code --install-extension lingo.vsix
```

Then reload the window. Build the `.vsix` yourself with `npm run vsix` (see
**Develop**).

## Use it in a project

1. Open your product's repo (or a folder that contains it) in VS Code.
2. Open the Lingo panel. Pick the project if prompted.
3. Confirm the **project type** (it's auto-detected), then click **Set up Lingo
   here**. That one action:
   - adds a `lingo` entry to `.mcp.json` at the project root, pointing at a
     version-stable copy of the bundled server;
   - creates `CLAUDE.md`, or appends a marker-delimited, profile-specific Lingo
     section to an existing one (re-synced in place on later runs);
   - writes `.claude/commands/lingo-init.md` (the `/lingo-init` catalog command);
   - writes `.claude/settings.local.json` so Claude Code auto-approves the server;
   - creates an empty `.lingo/lingo.sqlite` and stores the profile.
4. Restart Claude Code so it picks up the new MCP server.
5. **Existing project?** The panel offers **Copy `/lingo-init`** — run that in
   Claude Code once and it reads the codebase and logs what's already there
   (read-only, safe to re-run). Fresh project? Skip it.
6. Work as normal. The sidebar fills in as the agent names things.

See `.mcp.example.json` for the shape of the `.mcp.json` entry.

## Develop

```sh
npm install
npm run build      # esbuild -> dist/{extension,mcp-server,db-cli}.js
npm test           # store unit tests (node:test)
npm run check      # typecheck + lint + build
npm run vsix       # package dist/ into lingo.vsix
```

Press <kbd>F5</kbd> to launch an Extension Development Host (this only
debug-runs the extension — it does not install it).

## Repo layout

| Path | What it is |
| --- | --- |
| `src/extension.ts` | Thin entry point: creates the provider, registers commands |
| `src/sidebar/provider.ts` | The sidebar state machine: discovery, setup, watching, rendering |
| `src/profiles.ts` | Project profiles (web / service / library / cli / data / generic) — pure data |
| `src/profileDetect.ts` | Guess a profile from deps + layout (extension host only) |
| `src/workspace.ts` | Candidate-project discovery, per-folder paths, Lingo detection |
| `src/claudeMd.ts` | Create / append / re-sync the profile-specific CLAUDE.md section |
| `src/initCommand.ts` | Write the profile-specific `/lingo-init` command |
| `src/mcpConfig.ts` | Stage the server at a version-stable path, write / heal `.mcp.json` |
| `src/mcp/server.ts` | Bundled MCP server (stdio), spawned by Claude Code |
| `src/mcp/tools.ts` | `log_element` / `list_elements` / `get_element`, profile-aware |
| `src/db/store.ts` | All SQLite reads/writes (`node:sqlite`) + migrations |
| `src/db/cli.ts` | JSON reader/writer the sidebar host spawns (`snapshot`, `set-profile`, …) |
| `src/db/schema.ts` | Schema DDL, version, migration column list |
| `media/webview/` | Sidebar HTML / CSS / JS |
| `CLAUDE.md` | Reference copy of the instructions the extension injects |
| `DECISIONS.md` | Design decisions and open questions |

## Why the extension host doesn't touch SQLite

VS Code's Electron runtime has no `node:sqlite`, and native modules
(`better-sqlite3`) mean chasing Electron's ABI on every VS Code update. Instead:
**writes** go through the MCP server (its own `node` process), and the sidebar
**reads** by spawning `node dist/db-cli.js`. See `DECISIONS.md` §1.

## Status

| | |
| --- | --- |
| ✅ | MCP server + `log_element` / `list_elements` / `get_element`, profile-aware |
| ✅ | SQLite store, schema migrations (`page`→`area`, `parent`), per-project DB |
| ✅ | Project profiles: web / service / library / cli / data / generic, auto-detected |
| ✅ | Sidebar Glossary + Tree + Map views, live-updating |
| ✅ | Version-stable MCP server path + stale-`.mcp.json` self-heal |
| ✅ | In-panel onboarding: discovery, profile pick, one-click setup |
| ✅ | `/lingo-init` catalog command + "existing project" nudge |
| ⬜ | Relationship edges beyond `parent` ("X calls Y") + a graph view |
| ⬜ | One-click (rather than copy-paste) trigger for `/lingo-init` |

Early prototype.

## Support

I build this in my spare time to scratch my own itch. If it saves you some
round trips, you can [buy me a coffee](https://buymeacoffee.com/pwnsbd) ☕

More of my work: [pwnsbd.me](https://pwnsbd.me)
