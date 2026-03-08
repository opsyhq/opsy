import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { CliError, EXIT_CODE } from "./errors.js";

export const DEFAULT_API_URL = "https://api.opsy.sh";

export type CliConfig = {
  version: 1;
  token?: string;
  apiUrl?: string;
};

export type ConfigValueSource = "flag" | "env" | "stored" | "default";

export type ResolvedValue = {
  value: string;
  source: ConfigValueSource;
};

export interface ConfigStore {
  load(): Promise<CliConfig>;
  save(config: CliConfig): Promise<void>;
  clear(): Promise<void>;
  getPath(): string;
}

export class FileConfigStore implements ConfigStore {
  constructor(private readonly env: NodeJS.ProcessEnv) {}

  getPath(): string {
    return join(resolveConfigDir(this.env), "config.json");
  }

  async load(): Promise<CliConfig> {
    try {
      const raw = await readFile(this.getPath(), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      return parseCliConfig(parsed);
    } catch (error) {
      if (isMissingFileError(error)) {
        return { version: 1 };
      }
      if (error instanceof CliError) {
        throw error;
      }
      throw new CliError("Failed to read CLI config.", {
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  async save(config: CliConfig): Promise<void> {
    const targetPath = this.getPath();
    const dir = dirname(targetPath);
    const tempPath = `${targetPath}.tmp`;

    try {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(tempPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
      await rename(tempPath, targetPath);
    } catch (error) {
      throw new CliError("Failed to write CLI config.", {
        details: error instanceof Error ? error.message : error,
      });
    }
  }

  async clear(): Promise<void> {
    try {
      await rm(this.getPath(), { force: true });
    } catch (error) {
      throw new CliError("Failed to clear CLI config.", {
        details: error instanceof Error ? error.message : error,
      });
    }
  }
}

export function parseCliConfig(value: unknown): CliConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CliError("CLI config is invalid. Expected a JSON object.", {
      code: "INVALID_CONFIG",
      details: value,
    });
  }

  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) {
    throw new CliError("CLI config is invalid. Expected version 1.", {
      code: "INVALID_CONFIG",
      details: raw.version,
    });
  }

  if (raw.token !== undefined && typeof raw.token !== "string") {
    throw new CliError('CLI config is invalid. "token" must be a string.', {
      code: "INVALID_CONFIG",
      details: raw.token,
    });
  }

  if (raw.apiUrl !== undefined && typeof raw.apiUrl !== "string") {
    throw new CliError('CLI config is invalid. "apiUrl" must be a string.', {
      code: "INVALID_CONFIG",
      details: raw.apiUrl,
    });
  }

  return {
    version: 1,
    ...(raw.token !== undefined ? { token: raw.token } : {}),
    ...(raw.apiUrl !== undefined ? { apiUrl: raw.apiUrl } : {}),
  };
}

export function resolveConfigDir(env: NodeJS.ProcessEnv): string {
  const home = env.HOME ?? homedir();
  if (!home) {
    throw new CliError("Unable to resolve a home directory for CLI config storage.", {
      exitCode: EXIT_CODE.FAILURE,
      code: "CONFIG_HOME_ERROR",
    });
  }

  if (env.XDG_CONFIG_HOME) {
    return join(env.XDG_CONFIG_HOME, "opsy");
  }

  if (process.platform === "win32" && env.APPDATA) {
    return join(env.APPDATA, "opsy");
  }

  if (process.platform === "darwin") {
    return join(home, "Library", "Application Support", "opsy");
  }

  return join(home, ".config", "opsy");
}

export function trimTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function resolveToken(
  config: CliConfig,
  env: NodeJS.ProcessEnv,
  explicitToken?: string,
): ResolvedValue | null {
  if (explicitToken) {
    return { value: explicitToken, source: "flag" };
  }
  if (env.OPSY_TOKEN) {
    return { value: env.OPSY_TOKEN, source: "env" };
  }
  if (config.token) {
    return { value: config.token, source: "stored" };
  }
  return null;
}

export function resolveApiUrl(
  config: CliConfig,
  env: NodeJS.ProcessEnv,
  explicitApiUrl?: string,
): ResolvedValue {
  if (explicitApiUrl) {
    return { value: trimTrailingSlash(explicitApiUrl), source: "flag" };
  }
  if (env.OPSY_API_URL) {
    return { value: trimTrailingSlash(env.OPSY_API_URL), source: "env" };
  }
  if (config.apiUrl) {
    return { value: trimTrailingSlash(config.apiUrl), source: "stored" };
  }
  return { value: DEFAULT_API_URL, source: "default" };
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
