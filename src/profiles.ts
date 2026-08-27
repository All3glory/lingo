/**
 * Project profiles. A profile adapts Lingo's vocabulary and views to the kind
 * of project — a website, a backend service, a library, a CLI, a data project,
 * or anything (generic).
 *
 * Pure data + lookup, no `vscode` — the bundled MCP server imports this to build
 * a profile-aware `log_element` description. Detection lives in
 * `profileDetect.ts` (extension host only).
 */

export type ViewId = "glossary" | "tree" | "map";

export interface Profile {
  id: string;
  label: string;
  /** One line shown in the setup picker. */
  blurb: string;
  /** Grouping noun, Title Case: "Page", "Service", "Module", "Area". */
  areaNoun: string;
  areaNounPlural: string;
  /** Example area names, shown as a hint. */
  areaExamples: string;
  /** Suggested `kind` vocabulary. Empty = free text, no hint. */
  kinds: string[];
  /** Sidebar views this profile offers; first is the default. */
  views: ViewId[];
  /**
   * The "what to record" sentence, dropped into CLAUDE.md and the tool
   * description. Finishes the clause "record every …".
   */
  records: string;
}

export const PROFILES: Record<string, Profile> = {
  web: {
    id: "web",
    label: "Website / web app",
    blurb: "Pages and the UI elements on them.",
    areaNoun: "Page",
    areaNounPlural: "Pages",
    areaExamples: "Home, Pricing, About",
    kinds: [
      "nav",
      "hero",
      "section",
      "heading",
      "text",
      "image",
      "media",
      "card",
      "list",
      "form",
      "button",
      "footer",
      "modal",
      "other",
    ],
    views: ["map", "glossary"],
    records:
      "named UI element — nav bars, hero sections, headings, cards, lists, " +
      "forms, buttons, footers, modals",
  },
  service: {
    id: "service",
    label: "Backend / API service",
    blurb: "Endpoints, handlers, services, models, jobs.",
    areaNoun: "Area",
    areaNounPlural: "Areas",
    areaExamples: "Auth, Users, Billing",
    kinds: [
      "endpoint",
      "route",
      "handler",
      "service",
      "model",
      "schema",
      "middleware",
      "job",
      "queue",
      "event",
      "migration",
      "config",
      "other",
    ],
    views: ["tree", "glossary"],
    records:
      "named part of the backend — endpoints and routes, request handlers, " +
      "services, data models, middleware, background jobs, queues, events",
  },
  library: {
    id: "library",
    label: "Library / SDK / package",
    blurb: "Exported functions, classes, hooks, types.",
    areaNoun: "Module",
    areaNounPlural: "Modules",
    areaExamples: "core, hooks, utils",
    kinds: [
      "function",
      "class",
      "hook",
      "component",
      "type",
      "interface",
      "constant",
      "enum",
      "module",
      "entrypoint",
      "other",
    ],
    views: ["tree", "glossary"],
    records:
      "named piece of the public API — exported functions, classes, hooks, " +
      "components, types, constants, and the modules that group them",
  },
  cli: {
    id: "cli",
    label: "CLI tool",
    blurb: "Commands, subcommands, flags, config keys.",
    areaNoun: "Command group",
    areaNounPlural: "Command groups",
    areaExamples: "auth, deploy, config",
    kinds: [
      "command",
      "subcommand",
      "flag",
      "option",
      "argument",
      "config-key",
      "output",
      "other",
    ],
    views: ["tree", "glossary"],
    records:
      "named part of the CLI — commands and subcommands, their flags and " +
      "arguments, config keys, and notable output formats",
  },
  data: {
    id: "data",
    label: "Data / ML project",
    blurb: "Datasets, features, pipelines, models, metrics.",
    areaNoun: "Area",
    areaNounPlural: "Areas",
    areaExamples: "Ingest, Features, Training, Eval",
    kinds: [
      "dataset",
      "source",
      "feature",
      "transform",
      "pipeline",
      "model",
      "experiment",
      "metric",
      "notebook",
      "artifact",
      "other",
    ],
    views: ["tree", "glossary"],
    records:
      "named part of the data work — datasets and sources, features, " +
      "transforms, pipeline stages, models, experiments, key metrics",
  },
  generic: {
    id: "generic",
    label: "Something else",
    blurb: "Any project — free-form components and concepts.",
    areaNoun: "Area",
    areaNounPlural: "Areas",
    areaExamples: "the major parts of the project",
    kinds: [],
    views: ["glossary", "tree"],
    records:
      "named part of the project — the components, modules, services, or " +
      "concepts that you and the developer will refer to by name",
  },
};

export const DEFAULT_PROFILE_ID = "web";

export function getProfile(id: string | null | undefined): Profile {
  return (id && PROFILES[id]) || PROFILES[DEFAULT_PROFILE_ID];
}

export function profileIds(): string[] {
  return Object.keys(PROFILES);
}
