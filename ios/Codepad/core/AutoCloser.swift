import Foundation

enum AutoCloser {
  enum Action: Equatable {
    case insertPair(String)
    case skipCloser
    case wrap(open: UInt16, close: UInt16)
    case none
  }

  private static let pairs: [UInt16: UInt16] = [
    u16("("): u16(")"), u16("["): u16("]"), u16("{"): u16("}"),
    u16("\""): u16("\""), u16("'"): u16("'"), u16("`"): u16("`"),
  ]
  private static let allowedNext: Set<UInt16> = [u16(")"), u16("]"), u16("}"), u16(","), u16(";")]

  static func isQuote(_ c: UInt16) -> Bool {
    c == u16("\"") || c == u16("'") || c == u16("`")
  }

  static func actionFor(_ doc: Document, _ sel: Selection, typed: UInt16, _ settings: EditorSettings) -> Action {
    if !settings.autoCloseBrackets { return .none }
    let closer = pairs[typed]
    if !sel.isEmpty {
      if let closer { return .wrap(open: typed, close: closer) }
      return .none
    }
    let caret = sel.head
    let next = caret < doc.length ? doc.unit(at: caret) : u16("\n")
    let prev = caret > 0 ? doc.unit(at: caret - 1) : u16("\n")
    if next == typed && (closer == nil && pairs.values.contains(typed) || isQuote(typed)) { return .skipCloser }
    guard let closer else { return .none }
    let nextOk = next == u16("\n") || TextMovement.isWhitespace(next) || allowedNext.contains(next)
    let prevOk = !isQuote(typed) || !TextMovement.isWordChar(prev)
    return nextOk && prevOk ? .insertPair(String(decoding: [typed, closer], as: UTF16.self)) : .none
  }

  /// Backspace between an empty pair removes both units.
  static func deletesPair(_ doc: Document, caret: Int) -> Bool {
    if caret <= 0 || caret >= doc.length { return false }
    return pairs[doc.unit(at: caret - 1)] == doc.unit(at: caret)
  }
}
