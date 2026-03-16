const RESOURCE_CHANGE_RE = /^\s*([+~-]{1,2})\s+([^\s]+)\s+([^\s]+)\s+([a-z-]+)\s*$/i;

export function parseRunResourceChanges(stdout: string | null | undefined) {
  if (!stdout) {
    return [];
  }

  const seen = new Set<string>();
  const items: Array<{
    op: string;
    type: string;
    name: string;
    action: string;
    summary: string;
  }> = [];

  for (const line of stdout.split(/\r?\n/)) {
    const match = RESOURCE_CHANGE_RE.exec(line);
    if (!match) {
      continue;
    }

    const [, op, type, name, action] = match;
    if (!type.includes(":")) {
      continue;
    }

    const key = `${op}|${type}|${name}|${action}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    items.push({
      op,
      type,
      name,
      action,
      summary: `${op} ${type} ${name}`,
    });
  }

  return items;
}
