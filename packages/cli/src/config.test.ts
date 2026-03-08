import { describe, expect, it } from "bun:test";
import { DEFAULT_API_URL, parseCliConfig, resolveApiUrl, resolveConfigDir, resolveToken } from "./config.js";
import { CliError } from "./errors.js";

describe("config resolution", () => {
  it("prefers explicit token over env and stored config", () => {
    const result = resolveToken(
      { version: 1, token: "stored-token" },
      { OPSY_TOKEN: "env-token" },
      "flag-token",
    );

    expect(result).toEqual({ value: "flag-token", source: "flag" });
  });

  it("prefers env token over stored token", () => {
    const result = resolveToken(
      { version: 1, token: "stored-token" },
      { OPSY_TOKEN: "env-token" },
    );

    expect(result).toEqual({ value: "env-token", source: "env" });
  });

  it("falls back to the stored token", () => {
    const result = resolveToken(
      { version: 1, token: "stored-token" },
      {},
    );

    expect(result).toEqual({ value: "stored-token", source: "stored" });
  });

  it("resolves api url in flag > env > stored > default order", () => {
    expect(resolveApiUrl({ version: 1, apiUrl: "http://stored.test/" }, { OPSY_API_URL: "http://env.test/" }, "http://flag.test/"))
      .toEqual({ value: "http://flag.test", source: "flag" });
    expect(resolveApiUrl({ version: 1, apiUrl: "http://stored.test/" }, { OPSY_API_URL: "http://env.test/" }))
      .toEqual({ value: "http://env.test", source: "env" });
    expect(resolveApiUrl({ version: 1, apiUrl: "http://stored.test/" }, {}))
      .toEqual({ value: "http://stored.test", source: "stored" });
    expect(resolveApiUrl({ version: 1 }, {}))
      .toEqual({ value: DEFAULT_API_URL, source: "default" });
  });

  it("uses xdg config home when present", () => {
    const dir = resolveConfigDir({
      HOME: "/Users/test",
      XDG_CONFIG_HOME: "/tmp/xdg",
    });

    expect(dir).toBe("/tmp/xdg/opsy");
  });

  it("defaults to the hosted api domain", () => {
    expect(DEFAULT_API_URL).toBe("https://api.opsy.sh");
  });

  it("validates the stored config shape", () => {
    expect(parseCliConfig({ version: 1, token: "pat_123", apiUrl: "https://api.opsy.sh" })).toEqual({
      version: 1,
      token: "pat_123",
      apiUrl: "https://api.opsy.sh",
    });

    expect(() => parseCliConfig({ version: 2 })).toThrow(CliError);
    expect(() => parseCliConfig({ version: 1, token: 123 })).toThrow(CliError);
  });
});
