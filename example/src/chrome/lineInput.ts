/** The line a typed value means, or null when it is not a number inside the document. */
export function parseLine(text: string, lineCount: number): number | null {
  const line = Number.parseInt(text.trim(), 10);
  if (!Number.isFinite(line) || line < 1 || line > lineCount) return null;
  return line;
}
