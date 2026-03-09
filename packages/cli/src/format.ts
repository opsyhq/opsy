/**
 * Minimal formatting utilities for agent-optimized CLI output.
 * No colors, no icons, no relative time — just clean, structured text.
 */

/**
 * Render aligned columns with uppercase headers and 2-char gap padding.
 */
export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => {
    let max = h.length;
    for (const row of rows) {
      const cell = row[i] ?? "";
      if (cell.length > max) max = cell.length;
    }
    return max;
  });

  const pad = (value: string, width: number) => value + " ".repeat(Math.max(0, width - value.length));
  const gap = "  ";

  const headerLine = headers.map((h, i) => pad(h.toUpperCase(), widths[i])).join(gap).trimEnd();
  const bodyLines = rows.map((row) =>
    row.map((cell, i) => pad(cell, widths[i])).join(gap).trimEnd(),
  );

  return [headerLine, ...bodyLines].join("\n");
}

/**
 * Render labeled key-value pairs with consistent left-aligned padding.
 * Each line is indented with 2 spaces.
 */
export function detail(pairs: [string, string][]): string {
  let maxLabel = 0;
  for (const [label] of pairs) {
    if (label.length > maxLabel) maxLabel = label.length;
  }

  return pairs
    .map(([label, value]) => `  ${label}${" ".repeat(maxLabel - label.length)}  ${value}`)
    .join("\n");
}
