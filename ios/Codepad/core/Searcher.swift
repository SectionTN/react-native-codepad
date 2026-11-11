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

  struct Result: Equatable {
    /// Start and end pairs in document order.
    let matches: [Int]
    /// The scan stopped where a match attempt hit PCRE2's match limit.
    let limited: Bool
  }

  /// Throws CancellationError once `cancel` answers true, which it is asked before each batch of matches.
  static func find(_ text: TextSnapshot, _ search: CompiledSearch, cancel: () -> Bool = { false }) throws -> Result {
    var matches: [Int] = []
    var buffer = [Int32](repeating: 0, count: batch * 2)
    var from: UInt32 = 0
    while true {
      if cancel() { throw CancellationError() }
      let n = Int(cp_search_find(search.pointer, text.pointer, from, &buffer, UInt32(buffer.count)))
      if n < 0 { return Result(matches: matches, limited: true) }
      for i in 0..<n { matches.append(Int(buffer[i])) }
      if n < buffer.count { return Result(matches: matches, limited: false) }
      from = UInt32(buffer[n - 1])
    }
  }
}
