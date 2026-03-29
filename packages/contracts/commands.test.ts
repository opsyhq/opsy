import { describe, expect, test } from "bun:test";
import {
  normalizeCommandPath,
  renderCommandErrorMessage,
  renderCommandHelp,
  renderServerInstructions,
} from "./commands";

describe("noun-first command contracts", () => {
  test("top-level help is workflow-first and project-first", () => {
    const help = renderCommandHelp([]);
    expect(help).toContain("Opsy manages infrastructure");
    expect(help).toContain("1. `opsy auth login --token <pat>`");
    expect(help).toContain("2. `opsy project list`");
    expect(help).toContain("`opsy resource list --project <slug>` returns root resources first.");
    expect(help).toContain("Mutation paths:");
    expect(help).toContain("`opsy resource forget`");
    expect(help).toContain("pass `--auto-apply` to apply immediately");
    expect(help).toContain("Use `--parent <slug>` on `resource create` and `resource update`");
    expect(help).toContain("Use `--depends-on <json>` on `resource create` and `resource update`");
    expect(help).toContain('"kind"');
    expect(help).toContain('"dependsOn":["<slug>"]');
    expect(help).toContain('"targetDependents":true');
    expect(help).toContain('create a virtual resource with `type:"group"`');
    expect(help).toContain("Nouns:");
    expect(help).toContain("project");
  });

  test("renderCommandHelp resolves noun-first prefixes and richer command help", () => {
    expect(renderCommandHelp(["resource"])).toContain("Subcommands:");
    expect(renderCommandHelp(["resource", "accept-live"])).toContain("opsy resource accept-live");
    expect(renderCommandHelp(["resource", "reconcile"])).toContain("recorded live state");
    expect(renderCommandHelp(["resource", "reconcile"])).toContain("refresh drift first");
    expect(renderCommandHelp(["resource", "create"])).toContain("--depends-on <json>");
    expect(renderCommandHelp(["resource", "create"])).toContain("--auto-apply");
    expect(renderCommandHelp(["resource", "create"])).toContain("previewing it by default");
    expect(renderCommandHelp(["resource", "update"])).toContain("--depends-on <json>");
    expect(renderCommandHelp(["resource", "update"])).toContain("--auto-apply");
    expect(renderCommandHelp(["resource", "delete"])).toContain("--auto-apply");
    expect(renderCommandHelp(["resource", "forget"])).toContain("--target-dependents");
    expect(renderCommandHelp(["resource", "forget"])).toContain("state-only removal");
    expect(renderCommandHelp(["project", "list"])).toContain("What to do next:");
    expect(renderCommandHelp(["change", "create"])).toContain("Run `opsy change append <shortId> --mutations <json>`");
    expect(renderCommandHelp(["change", "create"])).toContain('"kind"');
    expect(renderCommandHelp(["change", "create"])).toContain('"parent":"<slug>"');
    expect(renderCommandHelp(["change", "create"])).toContain('"dependsOn":["<slug>"]');
    expect(renderCommandHelp(["change", "create"])).toContain('"targetDependents":true');
    expect(renderCommandHelp(["change", "create"])).toContain('"customTimeouts"');
    expect(renderCommandHelp(["change", "append"])).toContain('"kind"');
    expect(renderCommandHelp(["change", "append"])).toContain('"parent":"<slug>"');
    expect(renderCommandHelp(["change", "append"])).toContain('"dependsOn":["<slug>"]');
    expect(renderCommandHelp(["change", "append"])).toContain('"targetDependents":true');
    expect(renderCommandHelp(["change", "append"])).toContain('"customTimeouts"');
    expect(renderCommandHelp(["change", "apply"])).toContain("Ask a human to open the returned review URL in the Opsy web UI");
    expect(renderCommandHelp(["change", "apply"])).toContain("the apply does not complete through MCP");
    expect(renderCommandHelp(["observability", "aws"])).toContain("observability aws logs groups");
  });

  test("normalizeCommandPath handles noun-first commands", () => {
    expect(normalizeCommandPath(["resource", "get", "vpc"])).toEqual(["resource", "get"]);
    expect(normalizeCommandPath(["feedback", "send", "--message", "hi"])).toEqual(["feedback", "send"]);
    expect(normalizeCommandPath(["observability", "aws", "logs", "tail", "extra"])).toEqual(["observability", "aws", "logs", "tail"]);
  });

  test("shared error guidance teaches the next explicit command", () => {
    expect(renderCommandErrorMessage("Missing --project.")).toContain("run `opsy project list`");
    expect(renderCommandErrorMessage("Missing project slug.")).toContain("run `opsy project list`");
    expect(renderCommandErrorMessage("Missing resource slug.")).toContain("Missing resource slug.");
    expect(renderCommandErrorMessage('NOT_FOUND: Project "acme" not found.')).toContain('NOT_FOUND: Project "acme" not found.');
    expect(renderCommandErrorMessage("Invalid JSON in --mutations.")).toContain("Invalid JSON in --mutations.");
  });

  test("mcp server instructions reference noun-scoped tools", () => {
    const instructions = renderServerInstructions();

    expect(instructions).toContain("opsy_project");
    expect(instructions).toContain("opsy_resource");
    expect(instructions).toContain("opsy_change");
    expect(instructions).toContain("opsy_schema");
    expect(instructions).toContain("Zero-start flow");
    expect(instructions).toContain("aws:s3/bucket:Bucket");
    expect(instructions).toContain("opsy_schema list/get");
    expect(instructions).toContain("Reach for opsy_schema list/get only when the exact type token, field names, or field types are unclear.");
    expect(instructions).toContain("opsy_resource create/update/delete preview first unless autoApply=true");
    expect(instructions).toContain('"kind"');
    expect(instructions).toContain('"dependsOn":["<slug>"]');
    expect(instructions).toContain('"targetDependents":true');
    expect(instructions).toContain('"customTimeouts"');
    expect(instructions).toContain('type:"group"');
    expect(instructions).toContain("MCP authentication is handled by the client session");
  });
});
