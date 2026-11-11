import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// An invalid pattern. The message is what `setSearch` rejects with.
struct SearchError: Error, Equatable, Sendable {
  let message: String

  init(message: String) {
    self.message = message
  }
}

/// A query the core compiled, safe to use from any thread.
final class CompiledSearch: @unchecked Sendable {
  let pointer: OpaquePointer

  init(_ pointer: OpaquePointer) {
    self.pointer = pointer
  }

  deinit {
    cp_search_release(pointer)
  }
}

/// The document's text at one moment, unchanged by later edits. One thread uses it at a time.
final class TextSnapshot: @unchecked Sendable {
  let pointer: OpaquePointer

  init(_ pointer: OpaquePointer) {
    self.pointer = pointer
  }

  deinit {
    cp_text_release(pointer)
  }
}

enum Searcher {
  static let batch = 4096
  /// How long one core call may scan, so a cancel lands within it.
  static let budgetMs: UInt32 = 8

  struct Result: Equatable {
    /// Start and end pairs in document order.
    let matches: [Int]
    /// The scan stopped where a match attempt hit PCRE2's match limit.
    let limited: Bool
  }

  /// Throws CancellationError once `cancel` answers true, which it is asked before each call into the core.
  static func find(_ text: TextSnapshot, _ search: CompiledSearch, cancel: () -> Bool = { false }) throws -> Result {
    var matches: [Int] = []
    var buffer = [Int32](repeating: 0, count: batch * 2)
    var scan = cp_search_scan(next: 0, limited: 0, budget_ms: budgetMs)
    while scan.next >= 0 {
      if cancel() { throw CancellationError() }
      let n = Int(cp_search_find(search.pointer, text.pointer, &scan, &buffer, UInt32(buffer.count)))
      for i in 0..<n { matches.append(Int(buffer[i])) }
    }
    return Result(matches: matches, limited: scan.limited != 0)
  }
}
