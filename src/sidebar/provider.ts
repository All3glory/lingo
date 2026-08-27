import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs";
import * as path from "node:path";
import type { LingoElement } from "../types.ts";
import {
  discoverProjects,
  countUiFiles,
  dbPathFor,
  nodePath as configuredNode,
  relDbPath,
} from "../workspace.ts";
import {
  healMcpServer,
  registerMcpServer,
  stageBundledServer,
} from "../mcpConfig.ts";
import { ensureClaudeMd } from "../claudeMd.ts";
import { ensureInitCommand, INIT_COMMAND_NAME } from "../initCommand.ts";
import { ensureMcpAutoApprove } from "../claudeSettings.ts";
import { PROFILES, getProfile, type Profile } from "../profiles.ts";
import { detectProfile } from "../profileDetect.ts";

interface Snapshot {
  elements: LingoElement[];
  areas: string[];
  profile: string | null;
}

function profilePayload(p: Profile) {
  return {
    id: p.id,
    areaNoun: p.areaNoun,
    areaNounPlural: p.areaNounPlural,
    views: p.views,
  };
}

const PROFILE_CHOICES = Object.values(PROFILES).map((p) => ({
  id: p.id,
  label: p.label,
  blurb: p.blurb,
}));

const execFileAsync = promisify(execFile);
const ACTIVE_KEY = "lingo.activeFolder";

/**
 * The Lingo sidebar. A small state machine:
 *
 *   no-folder   → nothing open in VS Code
 *   pick-folder → several candidate projects, none chosen
 *   not-setup   → chosen project has no Lingo yet (offer one-click setup)
 *   ready       → chosen project has Lingo; show its dictionary
 *
 * Reads are out-of-process (`node dist/db-cli.js`) because the extension host
 * has no `node:sqlite`.
 */
export class LingoViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "lingo.elements";

  private view?: vscode.WebviewView;
  private activeFolder?: vscode.Uri;
  private lastPayload = "";
  private forcePicker = false;
  /** Profile chosen in the not-setup picker, before setup runs. */
  private pendingProfile?: string;
  private readonly viewDisposables: vscode.Disposable[] = [];
  private folderWatchers: vscode.Disposable[] = [];
  private watchedFile?: string;
  private serverPathPromise?: Promise<string>;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly log: vscode.OutputChannel,
  ) {
    const saved = context.workspaceState.get<string>(ACTIVE_KEY);
    if (saved) {
      this.activeFolder = vscode.Uri.file(saved);
    }
  }

  // ---- lifecycle ----------------------------------------------------------

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "media", "webview"),
      ],
    };
    webviewView.webview.html = this.html(webviewView.webview);

    this.viewDisposables.push(
      webviewView.webview.onDidReceiveMessage((msg) => this.onMessage(msg)),
      webviewView.onDidChangeVisibility(() => {
        if (webviewView.visible) {
          void this.syncState();
        }
      }),
      webviewView.onDidDispose(() => {
        this.view = undefined;
      }),
    );
  }

  dispose(): void {
    for (const d of [...this.viewDisposables, ...this.folderWatchers]) {
      d.dispose();
    }
    if (this.watchedFile) {
      fs.unwatchFile(this.watchedFile);
    }
  }

  // ---- messages from the webview ----------------------------------------

  private onMessage(msg: unknown): void {
    if (!msg || typeof msg !== "object") {
      return;
    }
    const m = msg as { type: string; [k: string]: unknown };
    switch (m.type) {
      case "ready":
      case "refresh":
        this.forcePicker = false;
        void this.syncState(true);
        break;
      case "openFolder":
        void vscode.commands.executeCommand("workbench.action.files.openFolder");
        break;
      case "changeFolder":
        this.forcePicker = true;
        void this.syncState();
        break;
      case "selectFolder":
        if (typeof m.id === "string") {
          void this.selectFolder(m.id);
        }
        break;
      case "setup":
        void this.runSetup();
        break;
      case "openFile":
        if (typeof m.file === "string") {
          void this.openFile(m.file);
        }
        break;
      case "copyInitCommand":
        void this.copyInitCommand();
        break;
      case "setProfile":
        if (typeof m.id === "string" && PROFILES[m.id]) {
          void this.onProfilePicked(m.id);
        }
        break;
    }
  }

  private async onProfilePicked(id: string): Promise<void> {
    const folder = this.activeFolder;
    if (!folder) {
      return;
    }
    const projects = await discoverProjects();
    const project = projects.find((p) => p.path === folder.fsPath);
    if (project && !project.hasLingo) {
      // Pre-setup: just remember the choice and re-render the card.
      this.pendingProfile = id;
      await this.syncState(true);
      return;
    }
    // Already set up: persist it and re-sync the generated files.
    await this.runDbCli(folder, ["set-profile", id]);
    const profile = getProfile(id);
    try {
      await ensureClaudeMd(folder, profile);
      await ensureInitCommand(folder, profile);
    } catch {
      /* best effort */
    }
    this.lastPayload = "";
    await this.syncState(true);
  }

  async copyInitCommand(): Promise<void> {
    await vscode.env.clipboard.writeText(`/${INIT_COMMAND_NAME}`);
    void vscode.window.showInformationMessage(
      `Copied "/${INIT_COMMAND_NAME}" — paste it into Claude Code to catalog ` +
        "this project's existing components.",
    );
  }

  // ---- public entry points (also wired to commands) --------------------

  async syncState(force = false): Promise<void> {
    if (!this.view) {
      return;
    }
    const projects = await discoverProjects();

    if (projects.length === 0) {
      this.setActiveFolder(undefined);
      this.post({ type: "render", view: "no-folder" });
      return;
    }

    let activePath = this.activeFolder?.fsPath;
    if (!activePath || !projects.some((p) => p.path === activePath)) {
      activePath = this.autoPick(projects);
    }

    if (this.forcePicker || !activePath) {
      this.setActiveFolder(activePath ? vscode.Uri.file(activePath) : undefined);
      this.post({
        type: "render",
        view: "pick-folder",
        projects,
        activeId: activePath,
      });
      return;
    }

    this.forcePicker = false;
    const folder = vscode.Uri.file(activePath);
    this.setActiveFolder(folder);

    const project = projects.find((p) => p.path === activePath)!;
    if (!project.hasLingo) {
      const detected =
        this.pendingProfile ?? (await detectProfile(folder).catch(() => "web"));
      this.pendingProfile = detected;
      this.post({
        type: "render",
        view: "not-setup",
        projects,
        folder: { name: project.name, path: project.path },
        profiles: PROFILE_CHOICES,
        selectedProfile: detected,
      });
      return;
    }

    // Keep a stale `.mcp.json` path fixed without prompting.
    void this.healActive(folder);

    await this.renderReady(folder, project.name, projects, force);
  }

  async refresh(force = false): Promise<void> {
    await this.syncState(force);
  }

  /** Force the folder picker (bound to the `lingo.chooseFolder` command). */
  async promptPickFolder(): Promise<void> {
    this.forcePicker = true;
    await this.syncState();
  }

  async revealDatabase(): Promise<void> {
    if (!this.activeFolder) {
      void vscode.window.showInformationMessage("Lingo: no project selected.");
      return;
    }
    await vscode.commands.executeCommand(
      "revealFileInOS",
      vscode.Uri.file(dbPathFor(this.activeFolder)),
    );
  }

  // ---- setup -----------------------------------------------------------

  async runSetup(): Promise<void> {
    const folder = this.activeFolder;
    if (!folder) {
      await this.promptPickFolder();
      return;
    }
    this.post({ type: "busy", message: "Setting up Lingo…" });
    try {
      const serverPath = await this.serverPath();
      const dbPath = dbPathFor(folder);
      const nodePath = configuredNode();

      const profileId =
        this.pendingProfile ??
        (await detectProfile(folder).catch(() => "web"));
      const profile = getProfile(profileId);

      const mcpUri = await registerMcpServer(
        folder,
        serverPath,
        dbPath,
        nodePath,
      );
      const claude = await ensureClaudeMd(folder, profile);
      await ensureInitCommand(folder, profile);
      await ensureMcpAutoApprove(folder);
      await this.seedDatabase(dbPath, nodePath);
      await this.runDbCli(folder, ["set-profile", profile.id]);

      this.pendingProfile = undefined;
      this.log.appendLine(
        `setup ${folder.fsPath} [${profile.id}]: wrote ` +
          `${vscode.workspace.asRelativePath(mcpUri)}, CLAUDE.md ${claude.result}, ` +
          `.claude/commands/${INIT_COMMAND_NAME}.md, .claude/settings.local.json`,
      );
      this.setActiveFolder(folder);
      await this.syncState(true);

      const open = await vscode.window.showInformationMessage(
        `Lingo is set up as a ${profile.label}. Restart Claude Code in this ` +
          "project — with this folder as the working directory — to start logging.",
        "Open CLAUDE.md",
      );
      if (open) {
        await vscode.window.showTextDocument(claude.uri);
      }
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err);
      this.log.appendLine(`setup failed: ${message}`);
      this.post({ type: "error", message });
    }
  }

  private serverPath(): Promise<string> {
    this.serverPathPromise ??= stageBundledServer(this.context);
    return this.serverPathPromise;
  }

  /** Open (creating) the DB file so the sidebar can switch to the ready view. */
  private async seedDatabase(dbPath: string, nodePath: string): Promise<void> {
    const cli = path.join(this.context.extensionUri.fsPath, "dist", "db-cli.js");
    await execFileAsync(nodePath, [cli, dbPath, "touch"]);
  }

  private async runDbCli(
    folder: vscode.Uri,
    args: string[],
  ): Promise<string> {
    const cli = path.join(this.context.extensionUri.fsPath, "dist", "db-cli.js");
    const { stdout } = await execFileAsync(configuredNode(), [
      cli,
      dbPathFor(folder),
      ...args,
    ]);
    return stdout;
  }

  private async healActive(folder: vscode.Uri): Promise<void> {
    try {
      const changed = await healMcpServer(
        folder,
        await this.serverPath(),
        dbPathFor(folder),
        configuredNode(),
      );
      if (changed) {
        this.log.appendLine(`.mcp.json path healed for ${folder.fsPath}`);
      }
    } catch {
      /* best effort */
    }
  }

  // ---- ready view ----------------------------------------------------

  private async renderReady(
    folder: vscode.Uri,
    name: string,
    projects: Awaited<ReturnType<typeof discoverProjects>>,
    force: boolean,
  ): Promise<void> {
    try {
      const snap = await this.readSnapshot(folder);
      const profile = getProfile(snap.profile);
      const payload = JSON.stringify({ e: snap.elements, p: profile.id });
      if (!force && payload === this.lastPayload) {
        return;
      }
      this.lastPayload = payload;
      const suggestInit =
        snap.elements.length === 0 && (await countUiFiles(folder)) >= 3;
      this.post({
        type: "render",
        view: "ready",
        folder: { name, path: folder.fsPath },
        projects,
        elements: snap.elements,
        areas: snap.areas,
        profile: profilePayload(profile),
        profiles: PROFILE_CHOICES,
        suggestInit,
        initCommand: `/${INIT_COMMAND_NAME}`,
      });
      this.log.appendLine(
        `rendered ${snap.elements.length} element(s) for ${name} [${profile.id}]`,
      );
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err);
      this.log.appendLine(`read failed: ${message}`);
      this.post({ type: "error", message });
    }
  }

  private async readSnapshot(folder: vscode.Uri): Promise<Snapshot> {
    const stdout = await this.runDbCli(folder, ["snapshot"]);
    return JSON.parse(stdout || "{}") as Snapshot;
  }

  // ---- folder / watcher plumbing --------------------------------------

  private autoPick(
    projects: Awaited<ReturnType<typeof discoverProjects>>,
  ): string | undefined {
    if (projects.length === 1) {
      return projects[0].path;
    }
    const withLingo = projects.filter((p) => p.hasLingo);
    if (withLingo.length === 1) {
      return withLingo[0].path;
    }
    return undefined;
  }

  private async selectFolder(fsPath: string): Promise<void> {
    this.forcePicker = false;
    this.setActiveFolder(vscode.Uri.file(fsPath));
    await this.syncState(true);
  }

  private setActiveFolder(folder: vscode.Uri | undefined): void {
    const changed = folder?.fsPath !== this.activeFolder?.fsPath;
    this.activeFolder = folder;
    void this.context.workspaceState.update(ACTIVE_KEY, folder?.fsPath);
    if (changed) {
      this.lastPayload = "";
      this.retargetWatchers();
    }
  }

  private retargetWatchers(): void {
    for (const d of this.folderWatchers) {
      d.dispose();
    }
    this.folderWatchers = [];
    if (this.watchedFile) {
      fs.unwatchFile(this.watchedFile);
      this.watchedFile = undefined;
    }
    if (!this.activeFolder) {
      return;
    }

    const relDir = path.dirname(relDbPath()).replace(/\\/g, "/");
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(this.activeFolder, `${relDir}/**`),
    );
    const nudge = () => void this.syncState();
    this.folderWatchers.push(
      watcher,
      watcher.onDidChange(nudge),
      watcher.onDidCreate(nudge),
      watcher.onDidDelete(nudge),
    );

    const file = dbPathFor(this.activeFolder);
    this.watchedFile = file;
    fs.watchFile(file, { interval: 1500 }, (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs || curr.size !== prev.size) {
        void this.syncState();
      }
    });
  }

  // ---- misc ---------------------------------------------------------

  private async openFile(relPath: string): Promise<void> {
    if (!this.activeFolder) {
      return;
    }
    const uri = vscode.Uri.joinPath(this.activeFolder, relPath);
    try {
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    } catch {
      void vscode.window.showWarningMessage(
        `Lingo: could not open ${relPath}`,
      );
    }
  }

  private post(message: unknown): void {
    void this.view?.webview.postMessage(message);
  }

  private html(webview: vscode.Webview): string {
    const asset = (file: string) =>
      webview.asWebviewUri(
        vscode.Uri.joinPath(
          this.context.extensionUri,
          "media",
          "webview",
          file,
        ),
      );
    const nonce = String(Math.random()).slice(2);
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${asset("style.css")}" />
</head>
<body>
  <div id="root">Loading…</div>
  <script nonce="${nonce}" src="${asset("main.js")}"></script>
</body>
</html>`;
  }
}
