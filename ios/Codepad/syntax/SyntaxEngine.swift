import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// One parse engine per editor, run by the shared C++ core on this object's serial queue. It reads the attached
/// document's own text, each reparse is incremental, and every completed parse publishes an immutable snapshot.
final class SyntaxEngine: @unchecked Sendable {
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
  private weak var attached: EditorCore?

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

  /// Main thread. The engine parses the core's current text, then every edit the core makes, and drops the
  /// snapshots of the previous attach. nil detaches.
  func attach(_ core: EditorCore?) {
    if let previous = attached { cp_editor_attach(previous.document.handle, nil) }
    attached = core
    guard let core, let engine = handle.pointer else { return }
    cp_editor_attach(core.document.handle, engine)
  }

  /// Test access to the core engine.
  var pointer: OpaquePointer? { handle.pointer }

  /// A snapshot frees on the engine's queue when its last reference goes, so this only drops the caller's.
  func release(_ snapshot: Snapshot) { _ = snapshot }

  func close() {
    attach(nil)
    handle.close()
  }

  // The host is retained by the core until close, so an engine dropped without close must close itself.
  deinit { close() }
}
