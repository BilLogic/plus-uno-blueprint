/** Split multi-value cell text (one item per line) into display items. */
export function parseCellContentItems(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}
