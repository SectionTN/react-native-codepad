// The document as the mover reads it.
export type DocLike = {
  readonly lineCount: number;
  readonly length: number;
  lineAt(offset: number): number;
  lineStart(line: number): number;
};

// Visual rows of laid out lines, in pixels from the line's left edge, answered by the view.
export type LineGeometry = {
  rows(line: number): number;
  rowOf(line: number, column: number): number;
  caretX(line: number, column: number): number;
  columnAt(line: number, row: number, x: number): number;
};

// Up, down and page movement by visual rows, the web twin of CaretMover.kt. The goal x lasts until reset.
export class CaretMover {
  private goalX: number | null = null;

  reset(): void {
    this.goalX = null;
  }

  // The offset rows visual rows from offset (negative is up), clamped to the document ends.
  target(doc: DocLike, geometry: LineGeometry, offset: number, rows: number): number {
    let line = doc.lineAt(offset);
    const column = offset - doc.lineStart(line);
    let row = geometry.rowOf(line, column);
    const x = this.goalX ?? geometry.caretX(line, column);
    this.goalX = x;
    for (let left = rows; left < 0; left++) {
      if (row > 0) {
        row--;
      } else {
        if (line === 0) return 0;
        line--;
        row = geometry.rows(line) - 1;
      }
    }
    for (let left = rows; left > 0; left--) {
      if (row < geometry.rows(line) - 1) {
        row++;
      } else {
        if (line === doc.lineCount - 1) return doc.length;
        line++;
        row = 0;
      }
    }
    return doc.lineStart(line) + geometry.columnAt(line, row, x);
  }
}
