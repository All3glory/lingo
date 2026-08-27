/** A single named thing in a project, as recorded in Lingo. */
export interface LingoElement {
  id: number;
  /** The grouping this belongs to — a page, module, service, feature, area. */
  area: string;
  name: string;
  filePath: string | null;
  description: string | null;
  /** Prior names, oldest first. Stored in SQLite as a JSON array string. */
  previousNames: string[];
  /** Rough type — vocabulary depends on the project profile. Free text. */
  kind: string | null;
  /** Page band for the web map view (header/main/aside/footer); web only. */
  region: string | null;
  /**
   * The exact identifier the code uses — component export name, DOM id,
   * selector, function/class name. Shown in the "code" disclosure.
   */
  codeId: string | null;
  /**
   * The `name` of a containing element in the same `area`, if any. Drives the
   * Tree view — "the login handler inside AuthController".
   */
  parent: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Payload accepted by the `log_element` MCP tool and the store's upsert. */
export interface LogElementInput {
  area: string;
  name: string;
  file?: string | null;
  description?: string | null;
  kind?: string | null;
  region?: string | null;
  codeId?: string | null;
  parent?: string | null;
  /**
   * If this call renames an existing element, the name it used to have.
   * The store moves that name into `previousNames` and updates the row in place.
   */
  previousName?: string | null;
}
