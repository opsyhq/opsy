import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const DEFAULT_CONFIG_DIR = join(homedir(), ".opsy");
const DEFAULT_CONFIG_FILE = join(DEFAULT_CONFIG_DIR, "config.json");

type Config = {
  token?: string;
  apiUrl?: string;
  project?: string;
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

export function getProject(flags: { project?: string }): string | undefined {
  return flags.project ?? process.env.OPSY_PROJECT ?? loadConfig().project;
}
