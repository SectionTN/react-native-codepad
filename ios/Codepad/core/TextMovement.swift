import Foundation

enum TextMovement {
  enum Unit: Sendable {
    case char
    case word
    case lineStart
    case lineEnd
    case docStart
    case docEnd
  }

  static func isWordChar(_ c: UInt16) -> Bool {
    c == u16("_") || (c >= u16("a") && c <= u16("z")) || (c >= u16("A") && c <= u16("Z")) || (c >= u16("0") && c <= u16("9"))
  }

  static func isWhitespace(_ c: UInt16) -> Bool {
    Unicode.Scalar(c)?.properties.isWhitespace ?? false
  }

  static func nextGrapheme(_ doc: Document, _ offset: Int) -> Int {
    if offset >= doc.length { return doc.length }
    let line = doc.lineAt(offset)
    let start = doc.lineStart(line)
    let text = doc.line(line)
    let col = offset - start
    if col >= text.count { return offset + 1 }
    return start + graphemeEnd(text, col)
  }

  static func prevGrapheme(_ doc: Document, _ offset: Int) -> Int {
    if offset <= 0 { return 0 }
    let line = doc.lineAt(offset)
    let start = doc.lineStart(line)
    let col = offset - start
    if col == 0 { return offset - 1 }
    return start + graphemeBefore(doc.line(line), col)
  }

  /// End of the word after `offset`. Skips whitespace first and steps over a line break at a line end.
  static func nextWordEnd(_ doc: Document, _ offset: Int) -> Int {
    if offset >= doc.length { return doc.length }
    let line = doc.lineAt(offset)
    let start = doc.lineStart(line)
    let text = doc.line(line)
    var col = offset - start
    if col >= text.count { return offset + 1 }
    while col < text.count && isWhitespace(text[col]) { col += 1 }
    if col >= text.count { return start + col }
    if isWordChar(text[col]) {
      while col < text.count && isWordChar(text[col]) { col += 1 }
      return start + col
    }
    return start + graphemeEnd(text, col)
  }

  static func prevWordStart(_ doc: Document, _ offset: Int) -> Int {
    if offset <= 0 { return 0 }
    let line = doc.lineAt(offset)
    let start = doc.lineStart(line)
    let text = doc.line(line)
    var col = offset - start
    if col == 0 { return offset - 1 }
    while col > 0 && isWhitespace(text[col - 1]) { col -= 1 }
    if col == 0 { return start }
    if isWordChar(text[col - 1]) {
      while col > 0 && isWordChar(text[col - 1]) { col -= 1 }
      return start + col
    }
    return start + graphemeStart(text, col - 1)
  }

  /// Double tap target: an identifier run, a whitespace run, or a single punctuation grapheme.
  static func wordRangeAt(_ doc: Document, _ offset: Int) -> TextRange {
    let o = max(0, min(offset, doc.length))
    let line = doc.lineAt(o)
    let start = doc.lineStart(line)
    let text = doc.line(line)
    if text.isEmpty { return TextRange(start: start, end: start) }
    var col = max(0, min(o - start, text.count))
    if col == text.count { col -= 1 }
    let c = text[col]
    let cls: ((UInt16) -> Bool)?
    if isWordChar(c) {
      cls = { isWordChar($0) }
    } else if isWhitespace(c) {
      cls = { isWhitespace($0) }
    } else {
      cls = nil
    }
    if let cls {
      var a = col
      var b = col + 1
      while a > 0 && cls(text[a - 1]) { a -= 1 }
      while b < text.count && cls(text[b]) { b += 1 }
      return TextRange(start: start + a, end: start + b)
    }
    // A punctuation grapheme is its own word. A word segmenter would merge "a.b" (UAX 29 MidNumLet).
    let a = graphemeStart(text, col)
    return TextRange(start: start + a, end: start + graphemeEnd(text, a))
  }

  /// Start of the grapheme containing `col`, or `col` itself when it sits on a boundary.
  private static func graphemeStart(_ text: [UInt16], _ col: Int) -> Int {
    if col <= 0 { return 0 }
    if col >= text.count { return text.count }
    let s = String(decoding: text, as: UTF16.self)
    let i = String.Index(utf16Offset: col, in: s)
    return s.index(before: s.index(after: i)).utf16Offset(in: s)
  }

  /// End of the grapheme containing `col`.
  private static func graphemeEnd(_ text: [UInt16], _ col: Int) -> Int {
    if col >= text.count { return text.count }
    let s = String(decoding: text, as: UTF16.self)
    let i = String.Index(utf16Offset: max(col, 0), in: s)
    return s.index(after: i).utf16Offset(in: s)
  }

  /// The last grapheme boundary before `col`, for `col` in 1...text.count.
  private static func graphemeBefore(_ text: [UInt16], _ col: Int) -> Int {
    let boundary = graphemeStart(text, col)
    if boundary < col { return boundary }
    let s = String(decoding: text, as: UTF16.self)
    return s.index(before: String.Index(utf16Offset: col, in: s)).utf16Offset(in: s)
  }
}
