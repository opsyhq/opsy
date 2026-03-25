import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_CONFIG_DIR = join(homedir(), ".opsy");
const DEFAULT_CONFIG_FILE = join(DEFAULT_CONFIG_DIR, "config.json");

type Config = {
  token?: string;
  apiUrl?: string;
  workspace?: string;
  env?: string;
};

function getConfigFilePath(): string {
  return process.env.OPSY_CONFIG_PATH ?? DEFAULT_CONFIG_FILE;
}

function getConfigDirPath(): string {
  return dirname(getConfigFilePath());
}

export function loadConfig(): Config {
  try {
    return JSON.parse(readFileSync(getConfigFilePath(), "utf8"));
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(getConfigDirPath(), { recursive: true });
  writeFileSync(getConfigFilePath(), JSON.stringify(config, null, 2) + "\n");
}

export function getToken(flags: { token?: string }): string {
  const token = flags.token ?? process.env.OPSY_TOKEN ?? loadConfig().token;
  if (!token) {
    console.error("Error: No token. Set OPSY_TOKEN, use --token, or run `opsy auth login`.");
    process.exit(1);
  }
  return token;
}

export function getApiUrl(flags: { apiUrl?: string }): string {
  return flags.apiUrl ?? process.env.OPSY_API_URL ?? loadConfig().apiUrl ?? "https://api.opsy.sh";
}

export function getWorkspace(flags: { workspace?: string }): string | undefined {
  return flags.workspace ?? process.env.OPSY_WORKSPACE ?? loadConfig().workspace;
}

export function getEnv(flags: { env?: string }): string | undefined {
  return flags.env ?? process.env.OPSY_ENV ?? loadConfig().env;
}
