import * as vscode from "vscode";

/**
 * Ensure Claude Code auto-approves this project's `.mcp.json` servers, so the
 * `lingo` server connects on the next start without a manual approval prompt.
 *
 * Writes `.claude/settings.local.json` (personal, git-ignored by Claude Code's
 * defaults). Merges — never clobbers existing settings.
 *
 * @returns true if the file was changed.
 */
export async function ensureMcpAutoApprove(
  folder: vscode.Uri,
): Promise<boolean> {
  const dir = vscode.Uri.joinPath(folder, ".claude");
  await vscode.workspace.fs.createDirectory(dir);
  const uri = vscode.Uri.joinPath(dir, "settings.local.json");

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(
      Buffer.from(await vscode.workspace.fs.readFile(uri)).toString("utf8"),
    );
  } catch {
    settings = {};
  }

  if (settings.enableAllProjectMcpServers === true) {
    return false;
  }
  settings.enableAllProjectMcpServers = true;
  await vscode.workspace.fs.writeFile(
    uri,
    Buffer.from(JSON.stringify(settings, null, 2) + "\n", "utf8"),
  );
  return true;
}
