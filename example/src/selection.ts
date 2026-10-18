export type Position = { line: number; column: number };

// A caret reads Ln 8, Col 18; a selection on one line Ln 8, Col 18 to 25; across lines Ln 8:18 to 10:3.
export function describeSelection(anchor: Position, head: Position): string {
  if (anchor.line === head.line && anchor.column === head.column) {
    return `Ln ${anchor.line}, Col ${anchor.column}`;
  }
  if (anchor.line === head.line) {
    return `Ln ${anchor.line}, Col ${anchor.column} to ${head.column}`;
  }
  return `Ln ${anchor.line}:${anchor.column} to ${head.line}:${head.column}`;
}
