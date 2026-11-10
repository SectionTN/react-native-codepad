import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// One injected tree of a snapshot: its language, content extent, carried shift and how many ranges it covers.
struct Injected: Sendable {
  let language: LoadedLanguage
  let start: Int
  let end: Int
  let shift: Int
  let ranges: Int
}

/// Edit to snapshot time plus how many injected trees were parsed fresh, reused incrementally or carried without a parse.
struct ParseStats: Sendable {
  let latencyMillis: Int
  let freshInjections: Int
  let reusedInjections: Int
  let carriedInjections: Int
}

/// The core engine a snapshot was published by, or nil once it closed. Releasing goes through it.
final class EngineHandle: @unchecked Sendable {
  private let lock = NSLock()
  private var engine: OpaquePointer?

  init(_ engine: OpaquePointer) { self.engine = engine }

  var pointer: OpaquePointer? { lock.withLock { engine } }

  /// Frees on the engine's queue while it runs, here once it has closed.
  func release(_ snapshot: OpaquePointer) {
    lock.withLock { cp_engine_release(engine, snapshot) }
  }

  func close() {
    lock.withLock {
      if let engine { cp_engine_close(engine) }
      engine = nil
    }
  }
}

/// An immutable parse result for one document revision, owned by the core and freed with this object.
final class Snapshot: @unchecked Sendable {
  let pointer: OpaquePointer
  let revision: Int
  let languageId: String
  let stats: ParseStats
  // The published revision `changed` is relative to, -1 after a full parse; `changed` is sorted, coalesced unit pairs.
  let basedOn: Int
  let changed: [Int]
  /// The length of the text the snapshot was parsed from.
  let length: Int
  private let owner: EngineHandle

  init(_ pointer: OpaquePointer, owner: EngineHandle) {
    self.pointer = pointer
    self.owner = owner
    var info = cp_snapshot_info()
    cp_snapshot_info_get(pointer, &info)
    revision = Int(info.revision)
    basedOn = Int(info.based_on)
    stats = ParseStats(
      latencyMillis: Int(info.latency_ms), freshInjections: Int(info.fresh), reusedInjections: Int(info.reused),
      carriedInjections: Int(info.carried))
    let changedPointer = cp_snapshot_changed(pointer)
    changed = (0..<Int(info.changed_len)).map { Int(changedPointer![$0]) }
    languageId = String(cString: cp_language_id(cp_snapshot_language(pointer)))
    length = Int(cp_snapshot_length(pointer))
  }

  deinit { owner.release(pointer) }

  /// The injected trees, sorted by start.
  var injected: [Injected] {
    (0..<cp_snapshot_injected_count(pointer)).compactMap { i in
      var info = cp_injected_info()
      cp_snapshot_injected_get(pointer, i, &info)
      guard let handle = info.language, let language = LanguageRegistry.loaded(handle) else {
        return nil
      }
      return Injected(
        language: language, start: Int(info.start), end: Int(info.end), shift: Int(info.shift), ranges: Int(info.ranges))
    }
  }
}
