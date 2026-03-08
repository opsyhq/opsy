import { UsageError } from "./errors.js";

export type ParsedArgs = {
  flags: Map<string, string | boolean>;
  positionals: string[];
};

const BOOLEAN_FLAGS = new Set(["json", "help", "quiet", "sensitive", "force", "preview-only", "clear"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string | boolean>();
  const positionals: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }

    if (token === "-h") {
      flags.set("help", true);
      continue;
    }

    if (!token.startsWith("--")) {
      positionals.push(token);
      continue;
    }

    const [rawName, attachedValue] = splitFlag(token.slice(2));
    const name = rawName.trim();
    if (!name) {
      throw new UsageError("Invalid empty flag.");
    }

    if (BOOLEAN_FLAGS.has(name)) {
      flags.set(name, attachedValue === undefined ? true : attachedValue === "true");
      continue;
    }

    if (attachedValue !== undefined) {
      flags.set(name, attachedValue);
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new UsageError(`Missing value for --${name}.`);
    }

    flags.set(name, value);
    index += 1;
  }

  return { flags, positionals };
}

export function getStringFlag(parsed: ParsedArgs, name: string): string | undefined {
  const value = parsed.flags.get(name);
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new UsageError(`--${name} does not accept a boolean value.`);
  }
  return value;
}

export function getBooleanFlag(parsed: ParsedArgs, name: string): boolean {
  return parsed.flags.get(name) === true;
}

export function getOptionalIntFlag(parsed: ParsedArgs, name: string): number | undefined {
  const value = getStringFlag(parsed, name);
  if (value === undefined) {
    return undefined;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new UsageError(`--${name} must be a positive integer.`);
  }
  return parsedValue;
}

function splitFlag(raw: string): [string, string | undefined] {
  const equalsIndex = raw.indexOf("=");
  if (equalsIndex === -1) {
    return [raw, undefined];
  }
  return [raw.slice(0, equalsIndex), raw.slice(equalsIndex + 1)];
}
