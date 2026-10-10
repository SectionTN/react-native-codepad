import Foundation

/// An invalid pattern. The message is what `setSearch` rejects with.
struct SearchError: Error, Equatable, Sendable {
  let message: String

  init(message: String) {
    self.message = message
  }
}

enum Searcher {
  /// Throws SearchError when the regex is invalid.
  static func compile(_ q: SearchQuery) throws -> NSRegularExpression {
    var options: NSRegularExpression.Options = [.anchorsMatchLines]
    if !q.caseSensitive { options.insert(.caseInsensitive) }
    let body = q.regex ? q.text : NSRegularExpression.escapedPattern(for: q.text)
    do {
      return try NSRegularExpression(pattern: body, options: options)
    } catch {
      // NSRegularExpression reports nothing beyond a generic formatting error.
      throw SearchError(message: "invalid regular expression: \(q.text)")
    }
  }

  /// Packed start and end pairs of the non overlapping matches in document order. Empty matches are skipped.
  /// Throws CancellationError once `cancel` answers true, between matches and during a long one.
  static func find(_ text: String, _ q: SearchQuery, cancel: () -> Bool = { false }) throws -> [Int] {
    if q.text.isEmpty { return [] }
    let pattern = try compile(q)
    let subject = text as NSString
    var out: [Int] = []
    var cancelled = false
    pattern.enumerateMatches(in: text, options: [.reportProgress], range: NSRange(location: 0, length: subject.length)) {
      result, _, stop in
      if cancel() {
        cancelled = true
        stop.pointee = true
        return
      }
      guard let range = result?.range, range.length > 0 else { return }
      let s = range.location
      let e = range.location + range.length
      if !q.wholeWord || isWordBounded(subject, s, e) {
        out.append(s)
        out.append(e)
      }
    }
    if cancelled || cancel() { throw CancellationError() }
    return out
  }

  private static func isWordBounded(_ text: NSString, _ s: Int, _ e: Int) -> Bool {
    let before = s == 0 || !TextMovement.isWordChar(text.character(at: s - 1))
    let after = e >= text.length || !TextMovement.isWordChar(text.character(at: e))
    return before && after
  }
}
