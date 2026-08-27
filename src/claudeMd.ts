import * as vscode from "vscode";
import type { Profile } from "./profiles.ts";

const START = "<!-- lingo:start -->";
const END = "<!-- lingo:end -->";

/**
 * The Lingo block written into a project's CLAUDE.md, tailored to the project
 * profile. Delimited by HTML-comment markers so it can be re-synced in place
 * without disturbing the rest of the file.
 */
export function lingoClaudeSection(profile: Profile): string {
  const area = profile.areaNoun.toLowerCase();
  const kinds = profile.kinds.length
    ? `\n- \`kind\` (optional) — ${profile.kinds.join(" | ")}`
    : `\n- \`kind\` (optional) — a short type label (service, model, job, …)`;

  return `${START}
## Lingo — keep the project dictionary current

This project uses **Lingo**: a shared record of every named thing, exposed
through the \`lingo\` MCP server. The developer reads these names from the Lingo
sidebar and will refer to them — so keep the record accurate.

**Call \`log_element\` whenever you create, rename, restyle, or meaningfully
change a ${profile.records}** — as part of that same change, not batched later.
Re-logging something that already exists just updates its row, so log freely.
Pass:

- \`area\` — the ${area} it belongs to (e.g. ${profile.areaExamples})
- \`name\` — what you call it in the code
- \`file\` — workspace-relative path to the file that defines it
- \`description\` — one plain-English sentence${kinds}
- \`parent\` (optional) — the name of a containing element in the same area
- \`codeId\` (optional) — the exact code identifier (export name, DOM id, selector)
- \`previousName\` — only on a rename

**Especially log these — they're the ones people forget:**

${profile.remember.map((r) => `- ${r}`).join("\n")}

**Before changing something that already exists**, call \`list_elements\`
(optionally filtered by \`area\`) or \`get_element\` to recall the exact name.

Lingo never scans or edits code — it only records what you tell it.
${END}`;
}

export type ClaudeMdResult = "created" | "appended" | "updated" | "unchanged";

/**
 * Make sure `<folder>/CLAUDE.md` carries the current Lingo section for this
 * profile: create the file if missing, replace the block if the markers are
 * present, otherwise append it.
 */
export async function ensureClaudeMd(
  folder: vscode.Uri,
  profile: Profile,
): Promise<{ result: ClaudeMdResult; uri: vscode.Uri }> {
  const uri = vscode.Uri.joinPath(folder, "CLAUDE.md");
  const section = lingoClaudeSection(profile);

  let existing: string | undefined;
  try {
    existing = Buffer.from(
      await vscode.workspace.fs.readFile(uri),
    ).toString("utf8");
  } catch {
    existing = undefined;
  }

  if (existing === undefined) {
    await write(uri, `# CLAUDE.md\n\n${section}\n`);
    return { result: "created", uri };
  }

  if (existing.includes(START) && existing.includes(END)) {
    const re = new RegExp(`${escapeRe(START)}[\\s\\S]*?${escapeRe(END)}`);
    const next = existing.replace(re, section);
    if (next === existing) {
      return { result: "unchanged", uri };
    }
    await write(uri, next);
    return { result: "updated", uri };
  }

  await write(uri, `${existing.trimEnd()}\n\n${section}\n`);
  return { result: "appended", uri };
}

function write(uri: vscode.Uri, text: string): Thenable<void> {
  return vscode.workspace.fs.writeFile(uri, Buffer.from(text, "utf8"));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
