import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LingoStore } from "../db/store.ts";
import { getProfile } from "../profiles.ts";

export function registerLingoTools(server: McpServer, store: LingoStore): void {
  const profile = getProfile(store.getProfile());
  const areaLower = profile.areaNoun.toLowerCase();

  const kindLine = profile.kinds.length
    ? `Suggested \`kind\` values for this project: ${profile.kinds.join(", ")}.`
    : "Use whatever short `kind` label fits (e.g. service, model, job).";

  const a = /^[aeiou]/i.test(profile.label) ? "an" : "a";
  const description = [
    `Record a named thing in this project's Lingo (${a} ${profile.label}).`,
    "",
    `Call this whenever you create, rename, restyle, or meaningfully change a`,
    `${profile.records}. Do it as part of the same change, not batched later.`,
    "Re-logging something that already exists just updates its row (matched on",
    `\`area\` + \`name\`), so log freely.`,
    "",
    `\`area\` groups related things — for this project a ${areaLower}`,
    `(e.g. ${profile.areaExamples}).`,
    kindLine,
    "`parent` is the name of a containing element in the same area, if there is",
    "one — it builds the sidebar's tree. `codeId` is the exact code identifier",
    "(export name, DOM id, selector). On a rename pass `previousName`.",
  ].join("\n");

  server.registerTool(
    "log_element",
    {
      title: "Log a named thing",
      description,
      inputSchema: {
        area: z
          .string()
          .min(1)
          .describe(
            `The ${areaLower} this belongs to, e.g. ${profile.areaExamples}.`,
          ),
        name: z
          .string()
          .min(1)
          .describe("The name as used in the code, e.g. \"AuthController\"."),
        file: z
          .string()
          .optional()
          .describe("Workspace-relative path to the file that defines it."),
        description: z
          .string()
          .optional()
          .describe("One plain-English sentence: what this is."),
        kind: z
          .string()
          .optional()
          .describe(
            "Short type label. " +
              (profile.kinds.length ? profile.kinds.join(", ") + "." : ""),
          ),
        parent: z
          .string()
          .optional()
          .describe(
            "Name of a containing element in the same area, if any.",
          ),
        region: z
          .string()
          .optional()
          .describe(
            "Web only: header | main | aside | footer, for the map view.",
          ),
        codeId: z
          .string()
          .optional()
          .describe(
            "The exact code identifier: export name, DOM id, selector, or " +
              "data-testid.",
          ),
        previousName: z
          .string()
          .optional()
          .describe("If this is a rename, the name it had before."),
      },
    },
    async (args) => {
      const result = store.upsertElement({
        area: args.area,
        name: args.name,
        file: args.file ?? null,
        description: args.description ?? null,
        kind: args.kind ?? null,
        parent: args.parent ?? null,
        region: args.region ?? null,
        codeId: args.codeId ?? null,
        previousName: args.previousName ?? null,
      });
      return {
        content: [
          {
            type: "text",
            text: `${result.action}: ${result.element.area} / ${result.element.name}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_elements",
    {
      title: "List logged elements",
      description:
        `Return everything in this project's Lingo, or just one ${areaLower}. ` +
        "Use this to recall the exact names already in use before a change.",
      inputSchema: {
        area: z
          .string()
          .optional()
          .describe(`Optional ${areaLower} filter.`),
      },
    },
    async (args) => {
      const elements = store.listElements(args.area);
      return {
        content: [{ type: "text", text: JSON.stringify(elements, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_element",
    {
      title: "Get one element",
      description:
        "Look up a single element by area and name, including its previous " +
        "names and parent.",
      inputSchema: {
        area: z.string().min(1),
        name: z.string().min(1),
      },
    },
    async (args) => {
      const element = store.getElement(args.area, args.name);
      return {
        content: [
          {
            type: "text",
            text: element
              ? JSON.stringify(element, null, 2)
              : `No element "${args.name}" in "${args.area}".`,
          },
        ],
      };
    },
  );
}
