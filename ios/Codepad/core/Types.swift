import Foundation

public struct Position: Hashable, Sendable {
  public let line: Int
  public let column: Int

  public init(line: Int, column: Int) {
    self.line = line
    self.column = column
  }
}

public struct TextRange: Hashable, Sendable {
  public let start: Int
  public let end: Int

  public init(start: Int, end: Int) {
    self.start = start
    self.end = end
  }

  public var length: Int { end - start }
  public var isEmpty: Bool { start == end }
}

public struct Selection: Hashable, Sendable {
  public let anchor: Int
  public let head: Int

  public init(anchor: Int, head: Int) {
    self.anchor = anchor
    self.head = head
  }

  public var min: Int { Swift.min(anchor, head) }
  public var max: Int { Swift.max(anchor, head) }
  public var isEmpty: Bool { anchor == head }
  public var range: TextRange { TextRange(start: min, end: max) }

  public static func caret(_ offset: Int) -> Selection { Selection(anchor: offset, head: offset) }
}

public enum ChangeOrigin: String, Sendable {
  case input
  case api
  case undo
  case redo
}

/// One replacement: [start, end) of the old text became [start, newEnd) of the new text, in UTF-16 units.
public struct Change: Hashable, Sendable {
  public let start: Int
  public let removed: String
  public let inserted: String
  public let revision: Int

  public init(start: Int, removed: String, inserted: String, revision: Int) {
    self.start = start
    self.removed = removed
    self.inserted = inserted
    self.revision = revision
  }

  public var end: Int { start + removed.utf16.count }
  public var newEnd: Int { start + inserted.utf16.count }
  public var delta: Int { inserted.utf16.count - removed.utf16.count }
}

public struct EditorSettings: Hashable, Sendable {
  public var tabSize: Int
  public var insertSpaces: Bool
  public var autoIndent: Bool
  public var autoCloseBrackets: Bool

  public init(tabSize: Int = 4, insertSpaces: Bool = true, autoIndent: Bool = true, autoCloseBrackets: Bool = true) {
    self.tabSize = tabSize
    self.insertSpaces = insertSpaces
    self.autoIndent = autoIndent
    self.autoCloseBrackets = autoCloseBrackets
  }
}

public struct SearchQuery: Hashable, Sendable {
  public let text: String
  public let regex: Bool
  public let caseSensitive: Bool
  public let wholeWord: Bool

  public init(text: String, regex: Bool = false, caseSensitive: Bool = false, wholeWord: Bool = false) {
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
