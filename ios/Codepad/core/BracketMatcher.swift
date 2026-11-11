import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

enum BracketMatcher {
  /// Returns (bracket at the caret, partner) or nil. The bracket after the caret is tried first, then the one
  /// before it. A snapshot at the document's revision excludes brackets inside strings and comments.
  static func match(_ doc: Document, caret: Int, snapshot: Snapshot?) -> (Int, Int)? {
    var out: (Int32, Int32) = (0, 0)
    let found = withUnsafeMutableBytes(of: &out) { raw in
      cp_editor_bracket_match(doc.handle, snapshot?.pointer, Document.unsigned(caret), raw.baseAddress!.assumingMemoryBound(to: Int32.self))
    }
    return found != 0 ? (Int(out.0), Int(out.1)) : nil
  }
}
