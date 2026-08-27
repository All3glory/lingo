import * as vscode from "vscode";

interface McpServerEntry {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpJson {
  mcpServers?: Record<string, McpServerEntry>;
  [key: string]: unknown;
}

const KEY = "lingo";

/**
 * Copy the bundled MCP server to a per-user location that does NOT change when
 * the extension updates, and return its path.
 *
 * `.mcp.json` lives in the user's project and persists; if it pointed at
 * `.../pm-journey.lingo-<version>/dist/mcp-server.js` it would break on
 * every extension update. globalStorageUri is stable across versions, and the
 * bundled server is a single self-contained file, so we just keep a fresh copy
 * there.
 */
export async function stageBundledServer(
  context: vscode.ExtensionContext,
): Promise<string> {
  const dir = context.globalStorageUri;
  await vscode.workspace.fs.createDirectory(dir);
  const dest = vscode.Uri.joinPath(dir, "mcp-server.js");
  const src = vscode.Uri.joinPath(context.extensionUri, "dist", "mcp-server.js");
  await vscode.workspace.fs.copy(src, dest, { overwrite: true });
  return dest.fsPath;
}

function buildEntry(
  serverPath: string,
  dbPath: string,
  nodePath: string,
): McpServerEntry {
  return {
    command: nodePath,
    args: [serverPath],
    env: { LINGO_DB_PATH: dbPath },
  };
}

function sameEntry(a: McpServerEntry | undefined, b: McpServerEntry): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function readConfig(uri: vscode.Uri): Promise<McpJson> {
  try {
    const raw = await vscode.workspace.fs.readFile(uri);
    return JSON.parse(Buffer.from(raw).toString("utf8")) as McpJson;
  } catch {
    return {};
  }
}

async function writeConfig(uri: vscode.Uri, config: McpJson): Promise<void> {
  const serialized = JSON.stringify(config, null, 2) + "\n";
  await vscode.workspace.fs.writeFile(uri, Buffer.from(serialized, "utf8"));
}

/**
 * Write/refresh the `lingo` entry in the workspace's `.mcp.json`.
 * Existing entries and unrelated keys are preserved.
 */
export async function registerMcpServer(
  workspaceRoot: vscode.Uri,
  serverPath: string,
  dbPath: string,
  nodePath: string,
): Promise<vscode.Uri> {
  const mcpUri = vscode.Uri.joinPath(workspaceRoot, ".mcp.json");
  const config = await readConfig(mcpUri);
  config.mcpServers ??= {};
  config.mcpServers[KEY] = buildEntry(serverPath, dbPath, nodePath);
  await writeConfig(mcpUri, config);
  return mcpUri;
}

/**
 * If `.mcp.json` already has a `lingo` entry but it is stale (e.g. an
 * old extension-version path after an update), rewrite it in place. Does
 * nothing if there is no entry yet — first registration stays opt-in via the
 * command.
 *
 * @returns true if the file was changed.
 */
export async function healMcpServer(
  workspaceRoot: vscode.Uri,
  serverPath: string,
  dbPath: string,
  nodePath: string,
): Promise<boolean> {
  const mcpUri = vscode.Uri.joinPath(workspaceRoot, ".mcp.json");
  const config = await readConfig(mcpUri);
  const existing = config.mcpServers?.[KEY];
  if (!existing) {
    return false;
  }
  const wanted = buildEntry(serverPath, dbPath, nodePath);
  if (sameEntry(existing, wanted)) {
    return false;
  }
  config.mcpServers![KEY] = wanted;
  await writeConfig(mcpUri, config);
  return true;
}
