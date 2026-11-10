/// The app's decorations in current document coordinates. `version` moves on every change. Main thread only.
final class DecorationSet {
  private(set) var items: [Decoration] = []
  private(set) var version = 0

  func replace(_ items: [Decoration]) {
    self.items = items
    version += 1
  }

  func clear() {
    if !items.isEmpty { replace([]) }
  }

  func map(_ span: EditSpan) {
    if items.isEmpty { return }
    replace(items.compactMap { DecorationSet.mapOne($0, span) })
  }

  /// Total gap rows per line, lines with a gap only.
  func gapRows() -> [Int: Int] {
    var out: [Int: Int] = [:]
    for d in items {
      if case .gap(let line, let rows) = d { out[line, default: 0] += rows }
    }
    return out
  }

  static func mapOne(_ d: Decoration, _ span: EditSpan) -> Decoration? {
    switch d {
    case .underline(let u):
      return span.mapUnderline(u).map { .underline($0) }
    case .gap(let line, let rows):
      let l = span.mapLine(line)
      return l < 0 ? nil : .gap(line: l, rows: rows)
    case .lineBackground(let line, let color):
      let l = span.mapLine(line)
      return l < 0 ? nil : .lineBackground(line: l, color: color)
    }
  }
}
