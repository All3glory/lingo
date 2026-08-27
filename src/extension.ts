import * as vscode from "vscode";
import { LingoViewProvider } from "./sidebar/provider.ts";

export function activate(context: vscode.ExtensionContext): void {
  const out = vscode.window.createOutputChannel("Lingo");
  const provider = new LingoViewProvider(context, out);

  context.subscriptions.push(
    out,
    { dispose: () => provider.dispose() },
    vscode.window.registerWebviewViewProvider(
      LingoViewProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    ),
    vscode.commands.registerCommand("lingo.refresh", () =>
      provider.refresh(true),
    ),
    vscode.commands.registerCommand("lingo.chooseFolder", () =>
      provider.promptPickFolder(),
    ),
    vscode.commands.registerCommand("lingo.setup", () => provider.runSetup()),
    vscode.commands.registerCommand("lingo.copyInitCommand", () =>
      provider.copyInitCommand(),
    ),
    vscode.commands.registerCommand("lingo.openDatabase", () =>
      provider.revealDatabase(),
    ),
    vscode.commands.registerCommand("lingo.showLog", () => out.show()),
    vscode.workspace.onDidChangeWorkspaceFolders(() =>
      void provider.syncState(),
    ),
  );

  out.appendLine("activated");
}

export function deactivate(): void {
  // The MCP server is a child of Claude Code, not of us — nothing to tear down.
}
