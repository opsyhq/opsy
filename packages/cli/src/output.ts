export function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const head = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
  const body = rows.map((r) => r.map((c, i) => (c ?? "").padEnd(widths[i])).join("  ")).join("\n");
  return `${head}\n${sep}\n${body}`;
}

export function output(data: unknown, flags: { json?: boolean; quiet?: boolean }): void {
  if (flags.json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (flags.quiet) {
    // quiet: print only IDs or minimal info
    if (typeof data === "string") console.log(data);
    else if (data && typeof data === "object" && "id" in data) console.log((data as any).id);
    else if (data && typeof data === "object" && "shortId" in data) console.log((data as any).shortId);
  } else {
    console.log(data);
  }
}
