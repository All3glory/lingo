/**
 * Read-only reader the VS Code extension host spawns to get Lingo data as JSON.
 * The host cannot open SQLite itself (no `node:sqlite` in the Electron runtime),
 * so it runs: `node dist/db-cli.js <dbPath> <command> [arg]`.
 *
 * Commands:
 *   snapshot        -> { elements: LingoElement[], areas: string[], profile: string|null }
 *   list [area]     -> LingoElement[]
 *   areas           -> string[]
 *   set-profile <id>
 *   touch           -> creates the DB file, prints nothing
 */
import { LingoStore } from "./store.ts";

function main(argv: string[]): void {
  const [dbPath, command, arg] = argv;
  if (!dbPath || !command) {
    process.stderr.write(
      "usage: db-cli <dbPath> <snapshot|list|areas|set-profile|touch> [arg]\n",
    );
    process.exit(2);
  }

  const store = LingoStore.open(dbPath);
  try {
    switch (command) {
      case "snapshot":
        emit({
          elements: store.listElements(),
          areas: store.listAreas(),
          profile: store.getProfile(),
        });
        break;
      case "list":
        emit(store.listElements(arg));
        break;
      case "areas":
        emit(store.listAreas());
        break;
      case "set-profile":
        if (!arg) {
          process.stderr.write("set-profile needs a profile id\n");
          process.exit(2);
        }
        store.setProfile(arg);
        break;
      case "touch":
        break;
      default:
        process.stderr.write(`unknown command: ${command}\n`);
        process.exit(2);
    }
  } finally {
    store.close();
  }
}

function emit(value: unknown): void {
  process.stdout.write(JSON.stringify(value));
}

main(process.argv.slice(2));
