import Foundation

/// Computes the matches on a worker queue over a text snapshot and hands them to the core on the main thread.
/// Every member runs on the main thread; the painted matches shift through edits until fresh ones land.
final class SearchController: @unchecked Sendable {
  private final class Job: @unchecked Sendable {
    let generation: Int
    private let lock = NSLock()
    private var flag = false

    init(generation: Int) {
      self.generation = generation
    }

    var cancelled: Bool {
      get { lock.withLock { flag } }
      set { lock.withLock { flag = newValue } }
    }
  }

  private let core: EditorCore
  private let queue: DispatchQueue
  private let postToMain: @Sendable (@escaping @Sendable () -> Void) -> Void

  var onResult: ((_ count: Int, _ millis: Int64) -> Void)?
  var active: Bool { core.search != nil }

  private var generation = 0
  private var running: Job?
  private var displayed: [Int] = []
  private var continuations: [() -> Void] = []
  private var closed = false

  init(core: EditorCore, queue: DispatchQueue, postToMain: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void) {
    self.core = core
    self.queue = queue
    self.postToMain = postToMain
  }

  /// Throws SearchError for an invalid regex and clears the search; nil clears it too.
  func setQuery(_ query: SearchQuery?) throws {
    cancelRunning()
    displayed = []
    guard let query else {
      core.clearSearch()
      runContinuations()
      return
    }
    try core.setSearch(query)
    schedule()
  }

  func onChange(_ change: Change) {
    if !active { return }
    displayed = SearchSession.mapThrough(displayed, change)
    schedule()
  }

  /// Runs `block` now when nothing is stale, else once the next accepted result lands.
  func whenFresh(_ block: @escaping () -> Void) {
    if core.searchStale { continuations.append(block) } else { block() }
  }

  func matchesForPaint() -> [Int] {
    displayed
  }

  /// Queued continuations run now against the current state, so their promises settle instead of waiting forever.
  func close() {
    closed = true
    cancelRunning()
    runContinuations()
  }

  private func cancelRunning() {
    running?.cancelled = true
    running = nil
  }

  private func schedule() {
    cancelRunning()
    guard let query = core.search?.query else { return }
    generation += 1
    let job = Job(generation: generation)
    running = job
    let core = self.core
    queue.async { [self] in
      let (text, revision) = core.read { (core.document.text(), core.document.revision) }
      let started = DispatchTime.now().uptimeNanoseconds
      let result: [Int]
      do {
        result = try Searcher.find(text, query) { job.cancelled }
      } catch {
        return
      }
      let millis = Int64((DispatchTime.now().uptimeNanoseconds - started) / 1_000_000)
      postToMain { self.deliver(job, revision: revision, result: result, millis: millis) }
    }
  }

  private func deliver(_ job: Job, revision: Int, result: [Int], millis: Int64) {
    if closed || job.generation != generation || !core.acceptMatches(revision: revision, matches: result) { return }
    running = nil
    displayed = result
    onResult?(result.count / 2, millis)
    runContinuations()
  }

  private func runContinuations() {
    if continuations.isEmpty { return }
    let pending = continuations
    continuations.removeAll()
    for block in pending { block() }
  }
}
