import * as vscode from "vscode";
import type { Profile } from "./profiles.ts";

/** Slash command name — invoked in Claude Code as `/lingo-init`. */
export const INIT_COMMAND_NAME = "lingo-init";

function body(profile: Profile): string {
  const area = profile.areaNoun.toLowerCase();
  const kinds = profile.kinds.length
    ? `\n   - \`kind\` — ${profile.kinds.join(" | ")}`
    : `\n   - \`kind\` — a short type label`;
  const areas = profile.areaNounPlural.toLowerCase();
  return `---
description: Catalog this project's existing structure into Lingo
---

Populate **Lingo** — this project's shared dictionary — from the code that
already exists. This is a ${profile.label}. Lingo exposes the \`log_element\`,
\`list_elements\`, and \`get_element\` MCP tools.

Do this:

1. Map the project into its **${areas}** (e.g. ${profile.areaExamples}).
2. Take one ${area} at a time. For each **${profile.records}** in it, call
   \`log_element\` with:
   - \`area\` — the ${area} name
   - \`name\` — the name as it appears in the code
   - \`file\` — the file that defines it (workspace-relative)
   - \`description\` — one plain-English sentence${kinds}
   - \`parent\` — the containing element's name, when there is a clear one
   - \`codeId\` — the exact code identifier, when there's a clear one
3. Call \`list_elements\` for that ${area} first so you don't repeat work.
   Re-logging is safe (it upserts) but skip the churn.
4. **Do not edit any code.** This is a read-and-record pass only.
5. Use the names already in the code — don't invent new ones.

**Especially capture these — the things people forget:**

${profile.remember.map((r) => `- ${r}`).join("\n")}

When done, summarise: which ${areas} you covered and how many things you logged.
`;
}

/**
 * Write `.claude/commands/lingo-init.md` into the project so the developer can
 * run `/lingo-init` in Claude Code to backfill Lingo from what already exists.
 * Overwrites — this is a generated helper, kept current with the profile.
 */
export async function ensureInitCommand(
  folder: vscode.Uri,
  profile: Profile,
): Promise<vscode.Uri> {
  const dir = vscode.Uri.joinPath(folder, ".claude", "commands");
  await vscode.workspace.fs.createDirectory(dir);
  const uri = vscode.Uri.joinPath(dir, `${INIT_COMMAND_NAME}.md`);
  await vscode.workspace.fs.writeFile(
    uri,
    Buffer.from(body(profile), "utf8"),
  );
  return uri;
}
