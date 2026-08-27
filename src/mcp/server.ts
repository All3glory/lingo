/**
 * Lingo's bundled local MCP server.
 *
 * Spawned by Claude Code (stdio transport). The DB path is resolved from, in
 * order:
 *   1. `LINGO_DB_PATH` env var        — set by a per-project `.mcp.json`
 *   2. argv[2]                        — manual / testing
 *   3. `<cwd>/.lingo/lingo.sqlite`    — so a single global registration works:
 *      Claude Code runs the server with cwd = project root.
 *
 * Reactive only: this server never scans or edits code. It records what Claude
 * passes to `log_element`, and answers reads via `list_elements` / `get_element`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { resolve } from "node:path";
import { registerLingoTools } from "./tools.ts";
import { StoreProvider } from "./stores.ts";

function resolveDbPath(): string {
  const raw =
    process.env.LINGO_DB_PATH ||
    process.argv[2] ||
    resolve(process.cwd(), ".lingo", "lingo.sqlite");
  return resolve(raw);
}

async function main(): Promise<void> {
  const dbPath = resolveDbPath();
  const stores = new StoreProvider(dbPath, process.cwd());
  stores.default(); // open the primary DB up front
  const server = new McpServer({
    name: "lingo",
    version: "0.0.1",
  });

  registerLingoTools(server, stores);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`[lingo] MCP server ready (db: ${dbPath})\n`);
}

main().catch((err) => {
  process.stderr.write(`[lingo] fatal: ${String(err)}\n`);
  process.exit(1);
});
