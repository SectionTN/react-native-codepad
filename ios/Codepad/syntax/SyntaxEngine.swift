import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

struct Point: Hashable, Sendable {
  let row: Int
  let column: Int
}

/// One parse engine per editor, run by the shared C++ core on this object's serial queue. Edits arrive in
/// order, each reparse is incremental, and every completed parse publishes an immutable snapshot.
final class SyntaxEngine: @unchecked Sendable {
  struct EditPoints: Sendable {
    let start: Point
    let oldEnd: Point
    let newEnd: Point
  }

  /// A C work item crossing to a queue.
  private struct Job: @unchecked Sendable {
    let work: (@convention(c) (UnsafeMutableRawPointer?) -> Void)?
    let arg: UnsafeMutableRawPointer?
    func run() { work?(arg) }
  }

  /// The core's host context. It lives until the core's final post after close.
  private final class Host: @unchecked Sendable {
    let queue: DispatchQueue
    let postToMain: @Sendable (@escaping @Sendable () -> Void) -> Void
    let onSnapshot: @Sendable (Snapshot) -> Void
    var owner: EngineHandle?

    init(
      queue: DispatchQueue, postToMain: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void,
      onSnapshot: @escaping @Sendable (Snapshot) -> Void
    ) {
      self.queue = queue
      self.postToMain = postToMain
      self.onSnapshot = onSnapshot
    }

    static func from(_ ctx: UnsafeMutableRawPointer?) -> Host { Unmanaged<Host>.fromOpaque(ctx!).takeUnretainedValue() }
  }

  let queue = DispatchQueue(label: "codepad-syntax", qos: .userInitiated)
  private let handle: EngineHandle

  init(
    postToMain: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void,
    onSnapshot: @escaping @Sendable (Snapshot) -> Void,
    budgetMicros: Int64 = 50_000
  ) {
    let host = Host(queue: queue, postToMain: postToMain, onSnapshot: onSnapshot)
    var h = cp_host()
    h.ctx = Unmanaged.passRetained(host).toOpaque()
    h.schedule = { ctx, work, arg in
      let job = Job(work: work, arg: arg)
      Host.from(ctx).queue.async { job.run() }
    }
    h.post_main = { ctx, work, arg in
      let job = Job(work: work, arg: arg)
      Host.from(ctx).postToMain { job.run() }
    }
    h.now_micros = { _ in Int64(DispatchTime.now().uptimeNanoseconds / 1000) }
    h.resolve = { _, id in
      guard let id else { return nil }
      return LanguageRegistry.resolveInjection(String(cString: id))?.handle
    }
    let engine = cp_engine_new(&h, budgetMicros) { ctx, snapshot in
      let unmanaged = Unmanaged<Host>.fromOpaque(ctx!)
      // The final post after close carries no snapshot: the host may go.
      guard let snapshot else {
        unmanaged.release()
        return
      }
      let host = unmanaged.takeUnretainedValue()
      host.onSnapshot(Snapshot(snapshot, owner: host.owner!))
    }!
    handle = EngineHandle(engine)
    host.owner = handle
  }

  func setLanguage(_ id: String?) {
    let language = id.flatMap { LanguageRegistry.resolve($0) }
    guard let engine = handle.pointer else { return }
    cp_engine_set_language(engine, language?.handle)
  }

  func setText(_ text: String, revision: Int) {
    guard let engine = handle.pointer else { return }
    let units = Array(text.utf16)
    cp_engine_set_text(engine, units, UInt32(units.count), Int32(revision))
  }

  func edit(_ change: Change, points: EditPoints) {
    guard let engine = handle.pointer else { return }
    let inserted = Array(change.inserted.utf16)
    cp_engine_edit(
      engine, UInt32(change.start), UInt32(change.removed.utf16.count), inserted, UInt32(inserted.count),
      Int32(change.revision), Self.point(points.start), Self.point(points.oldEnd), Self.point(points.newEnd))
  }

  /// A snapshot frees on the engine's queue when its last reference goes, so this only drops the caller's.
  func release(_ snapshot: Snapshot) { _ = snapshot }

  func close() { handle.close() }

  // The host is retained by the core until close, so an engine dropped without close must close itself.
  deinit { handle.close() }

  private static func point(_ p: Point) -> cp_point { cp_point(line: Int32(p.row), column: Int32(p.column)) }

  /// Call right after a change was applied: the start is unchanged, the old end comes from the removed text.
  static func pointsFor(doc: Document, change: Change) -> EditPoints {
    let start = doc.offsetToPosition(change.start)
    let newEnd = doc.offsetToPosition(change.newEnd)
    let removed = Array(change.removed.utf16)
    let oldEnd: Point
    if let lastBreak = removed.lastIndex(of: 10) {
      oldEnd = Point(row: start.line + removed.filter { $0 == 10 }.count, column: removed.count - lastBreak - 1)
    } else {
      oldEnd = Point(row: start.line, column: start.column + removed.count)
    }
    return EditPoints(
      start: Point(row: start.line, column: start.column), oldEnd: oldEnd, newEnd: Point(row: newEnd.line, column: newEnd.column))
  }
}
