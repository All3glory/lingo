/**
 * Project profiles. A profile adapts Lingo's vocabulary and views to the kind
 * of project.
 *
 * Pure data + lookup, no `vscode` — the bundled MCP server imports this to build
 * a profile-aware `log_element` description, and `claudeMd.ts` / `initCommand.ts`
 * use `records` + `remember` to generate the project's instructions. Detection
 * lives in `profileDetect.ts` (extension host only).
 */

export type ViewId = "glossary" | "tree" | "map";

/** One horizontal band of the Map view. */
export interface MapBand {
  label: string;
  /** `kind` values (or `region` values for web) whose items fall in this band. */
  match: string[];
}

export interface MapConfig {
  /** Which field decides an item's band. */
  by: "kind" | "region";
  /**
   * `silhouette` — header/footer full-width, main + aside side by side (web).
   * `stack` — every band full-width, top to bottom.
   */
  layout: "silhouette" | "stack";
  bands: MapBand[];
}

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
  /** Suggested `kind` vocabulary, in a sensible display order. */
  kinds: string[];
  /** Sidebar views this profile offers; first is the default. */
  views: ViewId[];
  /** The Map view's bands. Omit to not offer a Map for this profile. */
  map?: MapConfig;
  /**
   * The "what to record" clause, dropped into CLAUDE.md and the tool
   * description. Finishes "record every …".
   */
  records: string;
  /**
   * The things that are specifically easy to forget for this kind of project —
   * injected into CLAUDE.md and /lingo-init as "especially log these".
   */
  remember: string[];
}

export const PROFILES: Record<string, Profile> = {
  web: {
    id: "web",
    label: "Website / web app",
    blurb: "Pages and the UI elements on them.",
    areaNoun: "Page",
    areaNounPlural: "Pages",
    areaExamples: "Home, Pricing, Dashboard, Settings",
    kinds: [
      "nav",
      "header",
      "footer",
      "shell",
      "hero",
      "section",
      "heading",
      "text",
      "image",
      "media",
      "gallery",
      "card",
      "list",
      "table",
      "chart",
      "stat",
      "button",
      "cta",
      "form",
      "field",
      "modal",
      "drawer",
      "tabs",
      "toast",
      "menu",
      "breadcrumb",
      "pagination",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "region",
      layout: "silhouette",
      bands: [
        { label: "Header", match: ["header"] },
        { label: "Main", match: ["main"] },
        { label: "Aside", match: ["aside"] },
        { label: "Footer", match: ["footer"] },
      ],
    },
    records:
      "named UI element — nav bars, hero sections, headings, cards, lists, " +
      "forms, buttons, footers, modals",
    remember: [
      "The route path behind a page name (/app/settings/billing is the \"Billing settings\" page)",
      "Whether a component is shared, and which pages use it",
      "Component variant / prop names (<Button variant=\"ghost\" size=\"sm\">)",
      "Named design tokens used in code (color.brand.subtle, space.4)",
      "Breakpoint names and components with distinct mobile / desktop variants",
      "Named animations or transitions",
      "Feature-flagged UI and the flag key",
      "Distinct empty / loading / error states that are their own components",
    ],
  },
  backend: {
    id: "backend",
    label: "Backend / API service",
    blurb: "Endpoints, handlers, services, models, jobs, events.",
    areaNoun: "Area",
    areaNounPlural: "Areas",
    areaExamples: "Auth, Users, Orders, Billing, Notifications",
    kinds: [
      "endpoint",
      "route",
      "controller",
      "handler",
      "middleware",
      "guard",
      "service",
      "usecase",
      "model",
      "entity",
      "schema",
      "repository",
      "query",
      "migration",
      "job",
      "worker",
      "queue",
      "cron",
      "event",
      "listener",
      "webhook",
      "client",
      "config",
      "flag",
      "error",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "kind",
      layout: "stack",
      bands: [
        {
          label: "Entry",
          match: ["endpoint", "route", "controller", "handler", "middleware", "guard"],
        },
        {
          label: "Logic",
          match: ["service", "usecase", "model", "entity", "schema"],
        },
        { label: "Data", match: ["repository", "query", "migration"] },
        {
          label: "Async",
          match: ["job", "worker", "queue", "cron", "event", "listener"],
        },
        { label: "Edges", match: ["webhook", "client", "config", "flag", "error"] },
      ],
    },
    records:
      "named part of the backend — endpoints and routes, request handlers, " +
      "services, data models, middleware, background jobs, queues, events",
    remember: [
      "The method + path of every endpoint (PATCH /orders/:id/status)",
      "Which service or module owns a piece of business logic",
      "Event / message name strings (order.placed, UserDeactivated)",
      "Table names, which model maps to which table, and the columns that matter",
      "Background job names, their triggers and schedules",
      "Middleware / guard names and which routes they protect",
      "External service client names and what each wraps (StripeClient)",
      "Feature-flag keys, env var names, config keys",
      "Named error codes or exceptions (ERR_INSUFFICIENT_FUNDS)",
    ],
  },
  library: {
    id: "library",
    label: "Library / SDK / package",
    blurb: "Exported functions, classes, hooks, types.",
    areaNoun: "Module",
    areaNounPlural: "Modules",
    areaExamples: "core, hooks, utils, types",
    kinds: [
      "function",
      "class",
      "hook",
      "component",
      "decorator",
      "type",
      "interface",
      "enum",
      "generic",
      "constant",
      "config",
      "default",
      "helper",
      "plugin",
      "hookpoint",
      "entrypoint",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "kind",
      layout: "stack",
      bands: [
        { label: "Entry points", match: ["entrypoint"] },
        {
          label: "Public API",
          match: [
            "function",
            "class",
            "hook",
            "component",
            "decorator",
            "type",
            "interface",
            "enum",
            "generic",
            "constant",
            "config",
            "default",
          ],
        },
        { label: "Internal", match: ["helper"] },
        { label: "Extension", match: ["plugin", "hookpoint"] },
      ],
    },
    records:
      "named piece of the public API — exported functions, classes, hooks, " +
      "components, types, constants, and the modules that group them",
    remember: [
      "What's exported vs internal — the public API surface",
      "Subpath entry points (pkg, pkg/react, pkg/server) and what each exposes",
      "Exact export names and which module or barrel they come from",
      "Deprecated exports and their replacement",
      "Long or shared type / generic names you keep referring to",
      "Named default configs and constants",
      "Extension points / plugin hook names",
      "Peer dependencies the API assumes are present",
    ],
  },
  cli: {
    id: "cli",
    label: "CLI tool",
    blurb: "Commands, subcommands, flags, config keys.",
    areaNoun: "Command group",
    areaNounPlural: "Command groups",
    areaExamples: "auth, deploy, db, config",
    kinds: [
      "command",
      "subcommand",
      "flag",
      "option",
      "argument",
      "env",
      "config-key",
      "output",
      "format",
      "exit-code",
      "prompt",
      "action",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "kind",
      layout: "stack",
      bands: [
        { label: "Commands", match: ["command", "subcommand", "action"] },
        {
          label: "Inputs",
          match: ["flag", "option", "argument", "env", "config-key", "prompt"],
        },
        { label: "Outputs", match: ["output", "format", "exit-code"] },
      ],
    },
    records:
      "named part of the CLI — commands and subcommands, their flags and " +
      "arguments, config keys, and notable output formats",
    remember: [
      "The full command path (app db migrate --to latest)",
      "Flag names + aliases (-f / --force) and which command owns each",
      "Config file keys and their precedence order",
      "Env vars the CLI reads",
      "Named exit codes and what each means",
      "Interactive prompt names / flows",
      "Named output formats (--format table|json|ndjson)",
    ],
  },
  data: {
    id: "data",
    label: "Data / ML project",
    blurb: "Datasets, features, pipelines, models, metrics.",
    areaNoun: "Stage",
    areaNounPlural: "Stages",
    areaExamples: "Ingest, Clean, Features, Train, Evaluate, Serve",
    kinds: [
      "dataset",
      "source",
      "raw",
      "staging",
      "mart",
      "table",
      "schema",
      "transform",
      "feature",
      "feature-set",
      "pipeline",
      "dag",
      "task",
      "notebook",
      "script",
      "model",
      "experiment",
      "run",
      "metric",
      "threshold",
      "report",
      "dashboard",
      "param-set",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "kind",
      layout: "stack",
      bands: [
        {
          label: "Sources",
          match: ["source", "raw", "dataset", "staging", "table", "schema"],
        },
        { label: "Transforms", match: ["transform", "feature", "feature-set"] },
        {
          label: "Pipelines",
          match: ["pipeline", "dag", "task", "notebook", "script"],
        },
        { label: "Models", match: ["model", "experiment", "run", "param-set"] },
        {
          label: "Outcomes",
          match: ["metric", "threshold", "report", "dashboard", "mart"],
        },
      ],
    },
    records:
      "named part of the data work — datasets and sources, features, " +
      "transforms, pipeline stages, models, experiments, key metrics",
    remember: [
      "Data lineage — where a table comes from and what it feeds",
      "Feature names and their one-line definitions (days_since_signup)",
      "Model names + versions and what data / params each was trained on",
      "Metric names, current values, and targets / thresholds",
      "What each notebook is for",
      "Warehouse table + key column names",
      "Experiment names and the hypothesis each tested",
      "Pipeline / DAG task names and their order",
    ],
  },
  mobile: {
    id: "mobile",
    label: "Mobile app",
    blurb: "Screens, navigation, native modules, permissions.",
    areaNoun: "Screen",
    areaNounPlural: "Screens",
    areaExamples: "Home, Profile, Checkout, Onboarding",
    kinds: [
      "screen",
      "navigator",
      "stack",
      "tab",
      "component",
      "sheet",
      "modal",
      "list",
      "form",
      "field",
      "button",
      "native-module",
      "permission",
      "deep-link",
      "notification",
      "storage-key",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "kind",
      layout: "stack",
      bands: [
        { label: "Navigation", match: ["navigator", "stack", "tab", "deep-link"] },
        { label: "Screens", match: ["screen"] },
        {
          label: "Pieces",
          match: ["component", "sheet", "modal", "list", "form", "field", "button"],
        },
        {
          label: "Native",
          match: ["native-module", "permission", "notification", "storage-key"],
        },
      ],
    },
    records:
      "named part of the app — screens, navigators, shared components, native " +
      "modules, permissions, deep links",
    remember: [
      "Navigation route / screen names and how you get there (push, present, tab)",
      "Navigator names and the screens each contains",
      "Screen params — the route params a screen expects",
      "Deep-link paths / URL schemes",
      "Permission strings the app requests",
      "Push notification types / categories",
      "Async-storage / secure-store keys",
      "Native module names and what each bridges",
    ],
  },
  desktop: {
    id: "desktop",
    label: "Desktop app",
    blurb: "Windows, menus, commands, IPC channels.",
    areaNoun: "Window",
    areaNounPlural: "Windows",
    areaExamples: "Main, Preferences, Onboarding, Tray",
    kinds: [
      "window",
      "view",
      "panel",
      "menu",
      "menu-item",
      "command",
      "action",
      "shortcut",
      "ipc-channel",
      "tray-item",
      "protocol",
      "pref",
      "dialog",
      "notification",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "kind",
      layout: "stack",
      bands: [
        { label: "Windows", match: ["window", "view", "panel"] },
        {
          label: "Commands",
          match: ["menu", "menu-item", "command", "action", "shortcut"],
        },
        { label: "Bridge", match: ["ipc-channel", "protocol"] },
        {
          label: "System",
          match: ["tray-item", "pref", "dialog", "notification"],
        },
      ],
    },
    records:
      "named part of the app — windows, views, menus and commands, keyboard " +
      "shortcuts, IPC channels, tray items, preferences",
    remember: [
      "IPC channel names and which side sends / handles",
      "Window names and each window's role",
      "Menu command IDs and their keyboard accelerators",
      "Tray actions",
      "Preference / setting keys",
      "Protocol / deep-link schemes the app registers",
    ],
  },
  game: {
    id: "game",
    label: "Game",
    blurb: "Scenes, entities, systems, states, assets.",
    areaNoun: "Scene",
    areaNounPlural: "Scenes",
    areaExamples: "MainMenu, Level1, BossArena, Inventory",
    kinds: [
      "entity",
      "actor",
      "character",
      "enemy",
      "npc",
      "prop",
      "prefab",
      "system",
      "component",
      "state",
      "transition",
      "ability",
      "item",
      "weapon",
      "pickup",
      "hud",
      "menu",
      "signal",
      "trigger",
      "spawner",
      "asset",
      "sfx",
      "music",
      "vfx",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "kind",
      layout: "stack",
      bands: [
        {
          label: "Entities",
          match: ["entity", "actor", "character", "enemy", "npc", "prop", "prefab"],
        },
        {
          label: "Systems",
          match: ["system", "component", "spawner", "trigger"],
        },
        { label: "States", match: ["state", "transition"] },
        { label: "Play", match: ["ability", "item", "weapon", "pickup"] },
        {
          label: "Presentation",
          match: ["hud", "menu", "asset", "sfx", "music", "vfx"],
        },
        { label: "Signals", match: ["signal"] },
      ],
    },
    records:
      "named part of the game — scenes and levels, entities and prefabs, " +
      "systems, state-machine states, abilities and items, signals, assets",
    remember: [
      "State names + transitions in every state machine",
      "Prefab / entity names and which scene they belong to",
      "Scene / level names and load / unlock order",
      "Input action names (Jump, Interact, Dodge)",
      "Signal / event names",
      "Asset keys — the string you load by",
      "Ability / item / weapon IDs",
    ],
  },
  infra: {
    id: "infra",
    label: "Infrastructure / IaC",
    blurb: "Resources, modules, stacks, pipelines, secrets.",
    areaNoun: "Stack",
    areaNounPlural: "Stacks",
    areaExamples: "networking, compute, data, observability",
    kinds: [
      "resource",
      "module",
      "stack",
      "env",
      "pipeline",
      "workflow",
      "job",
      "step",
      "secret",
      "variable",
      "output",
      "provider",
      "policy",
      "role",
      "other",
    ],
    views: ["map", "tree", "glossary"],
    map: {
      by: "kind",
      layout: "stack",
      bands: [
        { label: "Providers", match: ["provider"] },
        { label: "Resources", match: ["resource", "module", "stack"] },
        {
          label: "Config",
          match: ["variable", "secret", "output", "env", "policy", "role"],
        },
        { label: "Delivery", match: ["pipeline", "workflow", "job", "step"] },
      ],
    },
    records:
      "named part of the infrastructure — resources, modules, stacks, " +
      "environments, pipelines and workflows, secrets, outputs",
    remember: [
      "Resource names and each one's logical role",
      "Module names and their inputs / outputs",
      "Stack / environment names and what differs between them",
      "Secret and variable names — never values",
      "Pipeline / workflow / job names and their triggers",
      "Named outputs other stacks consume",
    ],
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
    remember: [
      "The parts of the project you refer to by name in conversation",
      "Anything with a name that would be hard to recall a week later",
    ],
  },
};

/** Old profile ids mapped to their current equivalent. */
const ALIASES: Record<string, string> = { service: "backend" };

export const DEFAULT_PROFILE_ID = "web";

export function getProfile(id: string | null | undefined): Profile {
  if (!id) {
    return PROFILES[DEFAULT_PROFILE_ID];
  }
  return PROFILES[id] || PROFILES[ALIASES[id]] || PROFILES[DEFAULT_PROFILE_ID];
}

export function profileIds(): string[] {
  return Object.keys(PROFILES);
}
