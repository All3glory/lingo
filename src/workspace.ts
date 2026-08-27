import * as vscode from "vscode";
import * as path from "node:path";

export const CONFIG_SECTION = "lingo";
const DEFAULT_DB_PATH = ".lingo/lingo.sqlite";

function cfg<T>(key: string, fallback: T): T {
  return vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .get<T>(key, fallback);
}

export function relDbPath(): string {
  return cfg("databasePath", DEFAULT_DB_PATH);
}

export function nodePath(): string {
  return cfg("nodePath", "node");
}

export function dbPathFor(folder: vscode.Uri): string {
  return path.join(folder.fsPath, relDbPath());
}

export interface Project {
  /** Display label. */
  name: string;
  /** fsPath — also used as the id in webview messages. */
  path: string;
  hasLingo: boolean;
}

const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  "out",
  "build",
  "release",
  "coverage",
  "vendor",
  "__pycache__",
  ".git",
  ".vscode",
  ".lingo",
  ".next",
  ".turbo",
  ".svelte-kit",
]);

const PROJECT_MARKERS = [
  "package.json",
  ".git",
  "CLAUDE.md",
  ".mcp.json",
  "index.html",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
];

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/** A folder "has Lingo" if its DB exists or `.mcp.json` already wires the server. */
export async function folderHasLingo(folder: vscode.Uri): Promise<boolean> {
  if (await exists(vscode.Uri.file(dbPathFor(folder)))) {
    return true;
  }
  try {
    const raw = await vscode.workspace.fs.readFile(
      vscode.Uri.joinPath(folder, ".mcp.json"),
    );
    const json = JSON.parse(Buffer.from(raw).toString("utf8"));
    return Boolean(json?.mcpServers?.lingo);
  } catch {
    return false;
  }
}

/**
 * Rough count of UI source files in a folder, capped. Used to decide whether to
 * suggest a `/lingo-init` backfill pass on an otherwise-empty dictionary.
 */
export async function countUiFiles(folder: vscode.Uri): Promise<number> {
  const hits = await vscode.workspace.findFiles(
    new vscode.RelativePattern(folder, "**/*.{tsx,jsx,vue,svelte,astro,html}"),
    "**/{node_modules,dist,out,build,release,.next,.svelte-kit,coverage}/**",
    40,
  );
  return hits.length;
}

async function looksLikeProject(uri: vscode.Uri): Promise<boolean> {
  for (const marker of PROJECT_MARKERS) {
    if (await exists(vscode.Uri.joinPath(uri, marker))) {
      return true;
    }
  }
  return false;
}

/**
 * Candidate projects the sidebar can operate on: every workspace folder, plus
 * each of their immediate subdirectories that look like a project. Lingo-enabled
 * ones are listed first.
 */
export async function discoverProjects(): Promise<Project[]> {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const seen = new Set<string>();
  const projects: Project[] = [];

  const add = async (uri: vscode.Uri, label: string) => {
    if (seen.has(uri.fsPath)) {
      return;
    }
    seen.add(uri.fsPath);
    projects.push({
      name: label,
      path: uri.fsPath,
      hasLingo: await folderHasLingo(uri),
    });
  };

  for (const wf of folders) {
    await add(wf.uri, wf.name);
    let entries: [string, vscode.FileType][] = [];
    try {
      entries = await vscode.workspace.fs.readDirectory(wf.uri);
    } catch {
      continue;
    }
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.Directory) {
        continue;
      }
      if (name.startsWith(".") || SKIP_DIRS.has(name)) {
        continue;
      }
      const child = vscode.Uri.joinPath(wf.uri, name);
      if (await looksLikeProject(child)) {
        await add(child, `${wf.name}/${name}`);
      }
    }
  }

  projects.sort((a, b) => {
    if (a.hasLingo !== b.hasLingo) {
      return a.hasLingo ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return projects;
}
