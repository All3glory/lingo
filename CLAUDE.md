# Lingo — instructions for Claude Code

> This is the reference copy. **"Lingo: Set up Lingo in the selected project"**
> injects a **profile-specific**, marker-delimited version of this into each
> project's own `CLAUDE.md` automatically — you don't copy this by hand.

This project uses **Lingo**: a shared record of every named thing in the
project, exposed through the `lingo` MCP server. The developer reads these names
from the Lingo sidebar and refers to them — so keep the record accurate.

## When to call `log_element`

Call `log_element` whenever you **create, rename, restyle, or meaningfully
change a named thing** — the vocabulary depends on the project profile:

| Profile | Things to log |
| --- | --- |
| web | nav bars, hero sections, headings, cards, forms, buttons, footers, modals |
| service | endpoints, handlers, services, models, middleware, jobs, queues, events |
| library | exported functions, classes, hooks, components, types, constants, modules |
| cli | commands, subcommands, flags, arguments, config keys |
| data | datasets, features, transforms, pipeline stages, models, experiments, metrics |
| generic | the components, modules, services, or concepts referred to by name |

Do it as part of the same change, not batched later. Re-logging something that
already exists just updates its row (matched on `area` + `name`), so log freely.

Pass:

- `area` — the grouping it belongs to (a page, service, module, command group…)
- `name` — what you call it in the code
- `file` — workspace-relative path to the file that defines it
- `description` — one plain-English sentence
- `kind` — a short type label (the profile suggests a vocabulary)
- `parent` — optional: the name of a containing element in the same area
- `region` — web only: `header` / `main` / `aside` / `footer`
- `codeId` — optional: the exact code identifier (export name, DOM id, selector)
- `previousName` — only on a rename

## Before changing something

Call `list_elements` (optionally filtered by `area`) or `get_element` to recall
the exact name already in use.

## What Lingo does not do

It never scans or edits code. It only records what you tell it.
