import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

enum TextMovement {
  enum Unit: Int32, Sendable {
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

  static func nextGrapheme(_ doc: Document, _ offset: Int) -> Int {
    Int(cp_doc_grapheme(doc.handle, Document.unsigned(offset), 1))
  }

  static func prevGrapheme(_ doc: Document, _ offset: Int) -> Int {
    Int(cp_doc_grapheme(doc.handle, Document.unsigned(offset), 0))
  }
}
