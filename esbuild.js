"use strict";

const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const common = {
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node20",
  sourcemap: true,
  logLevel: "info",
  // node:sqlite and other builtins are resolved by the running Node, never bundled.
  external: ["vscode", "node:sqlite"],
};

const targets = [
  // The VS Code extension host entry point.
  { entryPoints: ["src/extension.ts"], outfile: "dist/extension.js" },
  // The bundled local MCP server. Spawned as its own `node` process (stdio transport).
  { entryPoints: ["src/mcp/server.ts"], outfile: "dist/mcp-server.js" },
  // Tiny read-only DB reader the sidebar spawns to get JSON without native modules in the host.
  { entryPoints: ["src/db/cli.ts"], outfile: "dist/db-cli.js" },
];

async function main() {
  const contexts = await Promise.all(
    targets.map((t) => esbuild.context({ ...common, ...t })),
  );
  if (watch) {
    await Promise.all(contexts.map((c) => c.watch()));
    console.log("[lingo] watching…");
  } else {
    await Promise.all(
      contexts.map(async (c) => {
        await c.rebuild();
        await c.dispose();
      }),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
