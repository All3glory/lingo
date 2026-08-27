import * as vscode from "vscode";
import { DEFAULT_PROFILE_ID, PROFILES } from "./profiles.ts";

/**
 * Guess a project's profile from its dependencies and layout. Returns the
 * best-scoring profile id, or the default when nothing stands out. The setup
 * picker always lets the developer override.
 */
export async function detectProfile(folder: vscode.Uri): Promise<string> {
  const deps = await readDeps(folder);
  const has = (...names: string[]) => names.some((n) => deps.has(n));
  const fileExists = (p: string) => exists(vscode.Uri.joinPath(folder, p));
  const anyFile = async (glob: string) =>
    (await vscode.workspace.findFiles(
      new vscode.RelativePattern(folder, glob),
      "**/node_modules/**",
      1,
    )).length > 0;

  const score: Record<string, number> = {};
  const bump = (id: string, n = 1) => (score[id] = (score[id] ?? 0) + n);

  // web
  if (
    has(
      "react",
      "react-dom",
      "vue",
      "svelte",
      "next",
      "nuxt",
      "astro",
      "@angular/core",
      "solid-js",
      "gatsby",
      "@remix-run/react",
    )
  ) {
    bump("web", 2);
  }
  if (await fileExists("index.html")) bump("web", 1);
  if (await anyFile("**/*.{tsx,jsx,vue,svelte,astro}")) bump("web", 1);
  if ((await fileExists("pages")) || (await fileExists("app"))) bump("web", 1);

  // service
  if (
    has(
      "express",
      "fastify",
      "koa",
      "@nestjs/core",
      "hapi",
      "@hapi/hapi",
      "apollo-server",
      "@apollo/server",
      "flask",
      "django",
      "fastapi",
      "gin",
    )
  ) {
    bump("service", 2);
  }
  if (
    (await fileExists("routes")) ||
    (await fileExists("controllers")) ||
    (await fileExists("api")) ||
    (await fileExists("prisma/schema.prisma"))
  ) {
    bump("service", 1);
  }
  if (await anyFile("**/{openapi,swagger}.{yaml,yml,json}")) bump("service", 1);

  // cli
  if (await hasBin(folder)) bump("cli", 2);
  if (
    has(
      "commander",
      "yargs",
      "oclif",
      "@oclif/core",
      "cac",
      "inquirer",
      "prompts",
      "click",
      "typer",
      "cobra",
    )
  ) {
    bump("cli", 2);
  }

  // data
  if (await anyFile("**/*.ipynb")) bump("data", 2);
  if (
    (await fileExists("dvc.yaml")) ||
    (await fileExists("params.yaml")) ||
    (await fileExists("notebooks"))
  ) {
    bump("data", 1);
  }
  if (
    has(
      "pandas",
      "numpy",
      "scikit-learn",
      "torch",
      "tensorflow",
      "jax",
      "polars",
      "matplotlib",
    )
  ) {
    bump("data", 2);
  }

  // library
  if (await isLibrary(folder, deps)) bump("library", 2);

  const winner = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
  if (winner && winner[1] > 0 && PROFILES[winner[0]]) {
    return winner[0];
  }
  return DEFAULT_PROFILE_ID;
}

async function readDeps(folder: vscode.Uri): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const pkg = JSON.parse(
      Buffer.from(
        await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(folder, "package.json"),
        ),
      ).toString("utf8"),
    );
    for (const key of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const name of Object.keys(pkg[key] ?? {})) out.add(name);
    }
  } catch {
    /* no package.json */
  }
  for (const req of ["requirements.txt", "pyproject.toml", "go.mod"]) {
    try {
      const text = Buffer.from(
        await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(folder, req),
        ),
      ).toString("utf8");
      for (const m of text.matchAll(/[a-zA-Z][\w.-]{1,40}/g)) out.add(m[0]);
    } catch {
      /* not present */
    }
  }
  return out;
}

async function hasBin(folder: vscode.Uri): Promise<boolean> {
  try {
    const pkg = JSON.parse(
      Buffer.from(
        await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(folder, "package.json"),
        ),
      ).toString("utf8"),
    );
    return Boolean(pkg.bin);
  } catch {
    return false;
  }
}

async function isLibrary(
  folder: vscode.Uri,
  deps: Set<string>,
): Promise<boolean> {
  try {
    const pkg = JSON.parse(
      Buffer.from(
        await vscode.workspace.fs.readFile(
          vscode.Uri.joinPath(folder, "package.json"),
        ),
      ).toString("utf8"),
    );
    const looksPackaged = Boolean(
      pkg.exports || pkg.module || pkg.types || pkg.typings,
    );
    const appFramework = ["react", "vue", "svelte", "next", "express", "fastify"];
    const isApp = appFramework.some((d) => deps.has(d)) || Boolean(pkg.bin);
    return looksPackaged && !isApp;
  } catch {
    return false;
  }
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
