import { isAbsolute, resolve } from "node:path";
import { LingoStore } from "../db/store.ts";

/**
 * Opens and caches a `LingoStore` per project.
 *
 * The server usually serves one project (the one its `.mcp.json` or cwd points
 * at). But when Claude Code runs from a parent directory, `log_element` can pass
 * a `project` path and the write is routed to that project's own
 * `.lingo/lingo.sqlite`.
 */
export class StoreProvider {
  private readonly cache = new Map<string, LingoStore>();
  private readonly defaultDbPath: string;
  private readonly cwd: string;

  constructor(defaultDbPath: string, cwd: string) {
    this.defaultDbPath = defaultDbPath;
    this.cwd = cwd;
  }

  /** The store for `project` (relative to cwd, or absolute), or the default. */
  get(project?: string | null): LingoStore {
    const path = this.resolvePath(project);
    let store = this.cache.get(path);
    if (!store) {
      store = LingoStore.open(path);
      this.cache.set(path, store);
    }
    return store;
  }

  default(): LingoStore {
    return this.get();
  }

  private resolvePath(project?: string | null): string {
    const p = project?.trim();
    if (!p) {
      return this.defaultDbPath;
    }
    const base = isAbsolute(p) ? p : resolve(this.cwd, p);
    return p.endsWith(".sqlite") ? base : resolve(base, ".lingo", "lingo.sqlite");
  }

  close(): void {
    for (const store of this.cache.values()) {
      store.close();
    }
    this.cache.clear();
  }
}
