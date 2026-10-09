export const swift = `import Foundation

/// A span of UTF-16 units, half open like everything else in the editor.
struct Span: Equatable {
  let start: Int
  let end: Int

  var length: Int { end - start }
  var isEmpty: Bool { start >= end }

  func contains(_ offset: Int) -> Bool {
    return offset >= start && offset < end
  }
}

enum Origin: String {
  case input, api, undo, redo
}

func describe(_ spans: [Span], origin: Origin = .input) -> String {
  guard let last = spans.last else { return "no spans" }
  let total = spans.reduce(0) { $0 + $1.length }
  return "\\(spans.count) spans, \\(total) units, last ends at \\(last.end) (\\(origin.rawValue))"
}

print(describe([Span(start: 0, end: 4), Span(start: 6, end: 10)]))
`;
