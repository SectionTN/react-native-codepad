import Foundation

struct Position: Hashable, Sendable {
  let line: Int
  let column: Int

  init(line: Int, column: Int) {
    self.line = line
    self.column = column
  }
}

struct TextRange: Hashable, Sendable {
  let start: Int
  let end: Int

  init(start: Int, end: Int) {
    self.start = start
    self.end = end
  }

  var length: Int { end - start }
  var isEmpty: Bool { start == end }
}

struct Selection: Hashable, Sendable {
  let anchor: Int
  let head: Int

  init(anchor: Int, head: Int) {
    self.anchor = anchor
    self.head = head
  }

  var min: Int { Swift.min(anchor, head) }
  var max: Int { Swift.max(anchor, head) }
  var isEmpty: Bool { anchor == head }
  var range: TextRange { TextRange(start: min, end: max) }

  static func caret(_ offset: Int) -> Selection { Selection(anchor: offset, head: offset) }
}

enum ChangeOrigin: String, Sendable {
  case input
  case api
  case undo
  case redo
}

/// One replacement: [start, end) of the old text became [start, newEnd) of the new text, in UTF-16 units.
struct Change: Hashable, Sendable {
  let start: Int
  let removed: String
  let inserted: String
  let revision: Int

  init(start: Int, removed: String, inserted: String, revision: Int) {
    self.start = start
    self.removed = removed
    self.inserted = inserted
    self.revision = revision
  }

  var end: Int { start + removed.utf16.count }
  var newEnd: Int { start + inserted.utf16.count }
  var delta: Int { inserted.utf16.count - removed.utf16.count }
}

struct EditorSettings: Hashable, Sendable {
  var tabSize: Int
  var insertSpaces: Bool
  var autoIndent: Bool
  var autoCloseBrackets: Bool

  init(tabSize: Int = 4, insertSpaces: Bool = true, autoIndent: Bool = true, autoCloseBrackets: Bool = true) {
    self.tabSize = tabSize
    self.insertSpaces = insertSpaces
    self.autoIndent = autoIndent
    self.autoCloseBrackets = autoCloseBrackets
  }
}

struct SearchQuery: Hashable, Sendable {
  let text: String
  let regex: Bool
  let caseSensitive: Bool
  let wholeWord: Bool

  init(text: String, regex: Bool = false, caseSensitive: Bool = false, wholeWord: Bool = false) {
    self.text = text
    self.regex = regex
    self.caseSensitive = caseSensitive
    self.wholeWord = wholeWord
  }
}

/// The UTF-16 unit of a BMP scalar, for the unit comparisons the core makes.
@inline(__always) func u16(_ scalar: Unicode.Scalar) -> UInt16 {
  UInt16(truncatingIfNeeded: scalar.value)
}
