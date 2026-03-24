import { describe, expect, test } from "bun:test";
import { normalizeCommandPath, renderCommandHelp } from "./commands";

describe("noun-first command contracts", () => {
  test("top-level help shows only noun-first roots", () => {
    const help = renderCommandHelp([]);
    expect(help).toContain("Core nouns:");
    expect(help).toContain("project");
    expect(help).toContain("observability aws");
    expect(help).not.toContain("Core verbs:");
    expect(help).not.toContain("list resources");
    expect(help).not.toContain("discover aws");
    expect(help).not.toContain("observe aws");
  });

  test("renderCommandHelp resolves noun-first prefixes", () => {
    expect(renderCommandHelp(["resource"])).toContain("accept-live");
    expect(renderCommandHelp(["resource", "accept-live"])).toContain("opsy resource accept-live");
    expect(renderCommandHelp(["discovery", "aws"])).toContain("Subcommands:");
    expect(renderCommandHelp(["discovery", "aws"])).toContain("list");
    expect(renderCommandHelp(["observability", "aws"])).toContain("observability aws logs groups");
  });

  test("normalizeCommandPath handles noun-first commands", () => {
    expect(normalizeCommandPath(["resource", "get", "vpc"])).toEqual(["resource", "get"]);
    expect(normalizeCommandPath(["feedback", "send", "--message", "hi"])).toEqual(["feedback", "send"]);
    expect(normalizeCommandPath(["discovery", "aws", "list", "extra"])).toEqual(["discovery", "aws", "list"]);
    expect(normalizeCommandPath(["observability", "aws", "logs", "tail", "extra"])).toEqual(["observability", "aws", "logs", "tail"]);
  });
});
