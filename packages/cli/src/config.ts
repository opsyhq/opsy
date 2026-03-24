import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CONFIG_DIR = join(homedir(), ".opsy");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

type Config = {
  token?: string;
  apiUrl?: string;
};

export function loadConfig(): Config {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n");
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
