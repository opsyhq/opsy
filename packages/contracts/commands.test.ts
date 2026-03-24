import { describe, expect, test } from "bun:test";
import {
  normalizeCommandPath,
  renderCommandErrorMessage,
  renderCommandHelp,
  renderServerInstructions,
  renderToolDescription,
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
    expect(help).toContain('create a virtual resource with `type:"group"`');
    expect(help).toContain("Nouns:");
    expect(help).toContain("workspace");
  });

  test("renderCommandHelp resolves noun-first prefixes and richer command help", () => {
    expect(renderCommandHelp(["resource"])).toContain("Subcommands:");
    expect(renderCommandHelp(["resource", "accept-live"])).toContain("opsy resource accept-live");
    expect(renderCommandHelp(["workspace", "list"])).toContain("What to do next:");
    expect(renderCommandHelp(["change", "create"])).toContain("Run `opsy change append <shortId> --mutations <json>`");
    expect(renderCommandHelp(["change", "create"])).toContain('"parent":"<slug>"');
    expect(renderCommandHelp(["change", "append"])).toContain('"parent":"<slug>"');
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

  test("mcp instruction strings stay compact and workspace-first", () => {
    const instructions = renderServerInstructions();
    const description = renderToolDescription();

    expect(instructions).toContain("Use the single `opsy` tool");
    expect(instructions).toContain("opsy workspace list");
    expect(instructions).toContain("Use `--parent <slug>`");
    expect(instructions).toContain('Create `type:"group"` first');
    expect(instructions).toContain("MCP authentication is handled by the client session");

    expect(description).toContain("Mirrors the CLI grammar");
    expect(description).toContain("Workflow: workspace -> environment -> resource -> change.");
    expect(description).toContain("Use `--parent <slug>` to organize resources");
    expect(description).toContain('Create `type:"group"`');
    expect(description).toContain("MCP auth comes from the session");
  });
});
