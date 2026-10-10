import Foundation

public enum Indenter {
  public struct Newline: Equatable {
    public let text: String
    public let caretOffset: Int
  }

  public static func unit(_ settings: EditorSettings) -> String {
    settings.insertSpaces ? String(repeating: " ", count: settings.tabSize) : "\t"
  }

  public static func leadingWhitespace(_ line: [UInt16]) -> [UInt16] {
    var i = 0
    while i < line.count && (line[i] == u16(" ") || line[i] == u16("\t")) { i += 1 }
    return Array(line[..<i])
  }

  /// Text to insert for Enter replacing [start, end), and where the caret lands relative to the insertion start.
  public static func newline(_ doc: Document, _ start: Int, _ end: Int, _ settings: EditorSettings) -> Newline {
    if !settings.autoIndent { return Newline(text: "\n", caretOffset: 1) }
    let line = doc.lineAt(start)
    let text = doc.line(line)
    let col = start - doc.lineStart(line)
    var indent = leadingWhitespace(text)
    if indent.count > col { indent = Array(indent[..<col]) }
    let indentText = String(decoding: indent, as: UTF16.self)
    let opener = text[..<col].last { !TextMovement.isWhitespace($0) }
    guard let opener, let matching = closerOf(opener) else {
      return Newline(text: "\n" + indentText, caretOffset: 1 + indent.count)
    }
    let closer: UInt16? = end < doc.length ? doc.unit(at: end) : nil
    let innerText = indentText + unit(settings)
    let caret = 1 + innerText.utf16.count
    if closer == matching { return Newline(text: "\n" + innerText + "\n" + indentText, caretOffset: caret) }
    return Newline(text: "\n" + innerText, caretOffset: caret)
  }

  /// Lines a selection covers. A selection that ends exactly at a line start does not include that line.
  public static func selectedLines(_ doc: Document, _ sel: Selection) -> ClosedRange<Int> {
    let first = doc.lineAt(sel.min)
    var last = doc.lineAt(sel.max)
    if last > first && sel.max == doc.lineStart(last) { last -= 1 }
    return first...last
  }

  /// Units to drop from the line start for one outdent: a tab, or up to tabSize spaces.
  public static func outdentCount(_ line: [UInt16], _ settings: EditorSettings) -> Int {
    if line.isEmpty { return 0 }
    if line[0] == u16("\t") { return 1 }
    var n = 0
    while n < line.count && n < settings.tabSize && line[n] == u16(" ") { n += 1 }
    return n
  }

  private static func closerOf(_ opener: UInt16) -> UInt16? {
    switch opener {
    case u16("{"): return u16("}")
    case u16("("): return u16(")")
    case u16("["): return u16("]")
    default: return nil
    }
  }
}
