import { describe, expect, test } from "bun:test";
import {
  normalizeCommandPath,
  renderCommandErrorMessage,
  renderCommandHelp,
  renderServerInstructions,
} from "./commands";

describe("noun-first command contracts", () => {
  test("top-level help is workflow-first and workspace-first", () => {
    const help = renderCommandHelp([]);
    expect(help).toContain("Opsy manages infrastructure");
    expect(help).toContain("1. `opsy auth login --token <pat>`");
    expect(help).toContain("2. `opsy workspace list`");
    expect(help).toContain("`opsy resource list --workspace <slug> --env <slug>` returns root resources first.");
    expect(help).toContain("Mutation paths:");
    expect(help).toContain("Use `--parent <slug>` on `resource create` and `resource update`");
    expect(help).toContain('"kind"');
    expect(help).toContain('"dependsOn":["<slug>"]');
    expect(help).toContain('create a virtual resource with `type:"group"`');
    expect(help).toContain("Nouns:");
    expect(help).toContain("workspace");
  });

  test("renderCommandHelp resolves noun-first prefixes and richer command help", () => {
    expect(renderCommandHelp(["resource"])).toContain("Subcommands:");
    expect(renderCommandHelp(["resource", "accept-live"])).toContain("opsy resource accept-live");
    expect(renderCommandHelp(["workspace", "list"])).toContain("What to do next:");
    expect(renderCommandHelp(["change", "create"])).toContain("Run `opsy change append <shortId> --mutations <json>`");
    expect(renderCommandHelp(["change", "create"])).toContain('"kind"');
    expect(renderCommandHelp(["change", "create"])).toContain('"parent":"<slug>"');
    expect(renderCommandHelp(["change", "create"])).toContain('"dependsOn":["<slug>"]');
    expect(renderCommandHelp(["change", "append"])).toContain('"kind"');
    expect(renderCommandHelp(["change", "append"])).toContain('"parent":"<slug>"');
    expect(renderCommandHelp(["change", "append"])).toContain('"dependsOn":["<slug>"]');
    expect(renderCommandHelp(["change", "apply"])).toContain("Ask a human to open the returned review URL in the Opsy web UI");
    expect(renderCommandHelp(["change", "apply"])).toContain("the apply does not complete through MCP");
    expect(renderCommandHelp(["discovery", "aws"])).toContain("Subcommands:");
    expect(renderCommandHelp(["observability", "aws"])).toContain("observability aws logs groups");
  });

  test("normalizeCommandPath handles noun-first commands", () => {
    expect(normalizeCommandPath(["resource", "get", "vpc"])).toEqual(["resource", "get"]);
    expect(normalizeCommandPath(["feedback", "send", "--message", "hi"])).toEqual(["feedback", "send"]);
    expect(normalizeCommandPath(["discovery", "aws", "list", "extra"])).toEqual(["discovery", "aws", "list"]);
    expect(normalizeCommandPath(["observability", "aws", "logs", "tail", "extra"])).toEqual(["observability", "aws", "logs", "tail"]);
  });

  test("shared error guidance teaches the next explicit command", () => {
    expect(renderCommandErrorMessage("Missing --workspace.")).toContain("opsy workspace list");
    expect(renderCommandErrorMessage("Missing --env.")).toContain("opsy environment list --workspace <slug>");
    expect(renderCommandErrorMessage("Missing resource slug.")).toContain("opsy resource list --workspace <slug> --env <slug>");
    expect(renderCommandErrorMessage('NOT_FOUND: Workspace "acme" not found.')).toContain("opsy workspace list");
    expect(renderCommandErrorMessage("Invalid JSON in --mutations.")).toContain("opsy change create --workspace <slug> --env <slug>");
  });

  test("mcp server instructions reference noun-scoped tools", () => {
    const instructions = renderServerInstructions();

    expect(instructions).toContain("opsy_workspace");
    expect(instructions).toContain("opsy_resource");
    expect(instructions).toContain("opsy_change");
    expect(instructions).toContain("opsy_schema");
    expect(instructions).toContain("Zero-start flow");
    expect(instructions).toContain("aws:s3/bucket:Bucket");
    expect(instructions).toContain("opsy_schema list/get");
    expect(instructions).toContain("Reach for opsy_schema list/get only when the exact type token, field names, or field types are unclear.");
    expect(instructions).toContain('"kind"');
    expect(instructions).toContain('"dependsOn":["<slug>"]');
    expect(instructions).toContain('type:"group"');
    expect(instructions).toContain("MCP authentication is handled by the client session");
  });
});
