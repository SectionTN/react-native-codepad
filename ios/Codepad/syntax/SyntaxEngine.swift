import Foundation
import os

/// One serial queue per editor owns the parser, the UTF-16 mirror and the live tree. Edits arrive in
/// order, each reparse is incremental, and every completed parse publishes an immutable snapshot.
final class SyntaxEngine: @unchecked Sendable {
  struct EditPoints: Sendable {
    let start: Point
    let oldEnd: Point
    let newEnd: Point
  }

  private struct Kept {
    let language: LoadedLanguage
    let tree: Tree
  }

  private struct RangeKey: Hashable {
    let id: String
    let ranges: [Int]
  }

  private struct Counts {
    var fresh = 0
    var reused = 0
  }

  private let postToMain: @Sendable (@escaping @Sendable () -> Void) -> Void
  private let onSnapshot: @Sendable (Snapshot) -> Void
  let queue = DispatchQueue(label: "codepad-syntax", qos: .userInitiated)
  private let pending = OSAllocatedUnfairLock(initialState: 0)
  private let cancel = CancelFlag()
  private let budgetMicros: Int64 = 50_000
  // Set by the first call after a snapshot, cleared when the next one posts: the difference is the parse latency.
  private let pendingSince = OSAllocatedUnfairLock<UInt64>(initialState: 0)

  // Syntax queue only from here on.
  private let mirror = Mirror()
  private let parser = Parser()
  private var language: LoadedLanguage?
  private var tree: Tree?
  // Injected trees of the last snapshot, edited along with the document so unchanged ranges reparse for free.
  private var kept: [Kept] = []
  private var revision = 0
  private var closed = false

  init(
    postToMain: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void,
    onSnapshot: @escaping @Sendable (Snapshot) -> Void
  ) {
    self.postToMain = postToMain
    self.onSnapshot = onSnapshot
  }

  func setLanguage(_ id: String?) {
    submit { [self] in
      language = id.flatMap { LanguageRegistry.resolve($0) }
      tree = nil
      kept.removeAll()
      parser.reset()
      if let language { parser.setLanguage(language.pointer) }
      reparse()
    }
  }

  func setText(_ text: String, revision: Int) {
    submit { [self] in
      mirror.setText(text)
      self.revision = revision
      tree = nil
      kept.removeAll()
      parser.reset()
      reparse()
    }
  }

  func edit(_ change: Change, points: EditPoints) {
    markPending()
    queue.async { [self] in
      if closed { return }
      mirror.replace(change.start, change.end, change.inserted)
      revision = change.revision
      let edit = InputEdit(
        start: change.start, oldEnd: change.end, newEnd: change.newEnd, startPoint: points.start, oldEndPoint: points.oldEnd,
        newEndPoint: points.newEnd)
      tree?.edit(edit)
      for k in kept { k.tree.edit(edit) }
      if settlePending() { reparse() }
    }
  }

  func close() {
    queue.async { [self] in
      closed = true
      tree = nil
      kept.removeAll()
    }
  }

  /// Counts a queued call and raises the cancel flag so a running parse yields to it.
  private func markPending() {
    pendingSince.withLock { if $0 == 0 { $0 = DispatchTime.now().uptimeNanoseconds } }
    pending.withLock { $0 += 1 }
    cancel.set(true)
  }

  /// Uncounts a call; true when it was the last queued one, which lowers the flag.
  private func settlePending() -> Bool {
    let last = pending.withLock { count -> Bool in
      count -= 1
      return count == 0
    }
    if last { cancel.set(false) }
    return last
  }

  private func submit(_ block: @escaping @Sendable () -> Void) {
    markPending()
    queue.async { [self] in
      if closed { return }
      _ = settlePending()
      block()
    }
  }

  private func reparse() {
    guard let lang = language else { return }
    if pending.withLock({ $0 }) > 0 { return }
    guard let result = parser.parse(tree, mirror, cancel, budgetMicros: budgetMicros) else {
      if cancel.isSet {
        parser.reset()
        return
      }
      queue.async { [self] in if !closed { reparse() } }
      return
    }
    tree = result
    var counts = Counts()
    guard let injected = injections(lang, result, &counts) else {
      if !cancel.isSet { queue.async { [self] in if !closed { reparse() } } }
      return
    }
    let since = pendingSince.withLock { value -> UInt64 in
      let v = value
      value = 0
      return v
    }
    let latency = since == 0 ? 0 : Int((DispatchTime.now().uptimeNanoseconds - since) / 1_000_000)
    let stats = ParseStats(latencyMillis: latency, freshInjections: counts.fresh, reusedInjections: counts.reused)
    let snapshot = Snapshot(revision: revision, tree: result.copy(), injected: injected, languageId: lang.id, stats: stats)
    let onSnapshot = self.onSnapshot
    postToMain { onSnapshot(snapshot) }
  }

  private func injections(_ lang: LoadedLanguage, _ host: Tree, _ counts: inout Counts) -> [Injected]? {
    guard let compiled = lang.injections, let contentIndex = compiled.captureIndex["injection.content"] else {
      kept.removeAll()
      return []
    }
    let mirror = self.mirror
    let read: (Node) -> String = { n in mirror.text(n.startUnit, n.endUnit) }
    let languageIndex = compiled.captureIndex["injection.language"]
    var order: [String] = []
    var groups: [String: [[Int]]] = [:]
    var combined = Set<String>()
    let cursor = QueryCursor()
    cursor.exec(compiled.query, host.rootNode)
    var handled = Set<Int>()
    while let capture = cursor.nextCapture() {
      if !handled.insert(capture.matchId).inserted { continue }
      let all = (0..<cursor.matchCaptureCount).map { i -> CaptureNode in
        let c = cursor.matchCapture(i)
        return CaptureNode(captureIndex: c.captureIndex, node: c.node)
      }
      if !compiled.evaluator.matches(capture.patternIndex, captures: all, text: read) {
        cursor.removeMatch(capture.matchId)
        continue
      }
      let settings = compiled.evaluator.settings(capture.patternIndex)
      let named = settings["injection.language"] ?? all.first { $0.captureIndex == languageIndex }.map { read($0.node) }
      guard let name = named, let target = LanguageRegistry.resolveInjection(name) else { continue }
      if settings["injection.combined"] != nil { combined.insert(target.id) }
      let offset = compiled.evaluator.offset(capture.patternIndex)
      for c in all where c.captureIndex == contentIndex {
        let n = c.node
        let sp = n.startPoint
        let ep = n.endPoint
        var start = n.startUnit
        var end = n.endUnit
        var startColumn = sp.column
        var endColumn = ep.column
        // Column shifts trim delimiters on their own row, which is all nvim uses; row shifts are ignored.
        if let offset, offset.captureIndex == c.captureIndex, offset.startRow == 0, offset.endRow == 0 {
          start += offset.startColumn
          end += offset.endColumn
          startColumn += offset.startColumn
          endColumn += offset.endColumn
        }
        if start >= end { continue }
        if groups[target.id] == nil {
          order.append(target.id)
          groups[target.id] = []
        }
        groups[target.id]?.append([start, end, sp.row, startColumn, ep.row, endColumn])
      }
    }
    // Kept trees are indexed once by their edited ranges; a hit reparses against the old tree.
    var index: [RangeKey: [Kept]] = [:]
    for k in kept { index[RangeKey(id: k.language.id, ranges: k.tree.includedRanges()), default: []].append(k) }
    var out: [Injected] = []
    var next: [Kept] = []
    for id in order {
      guard let ranges = groups[id], let target = LanguageRegistry.resolve(id) else { continue }
      let sub = Parser()
      if !sub.setLanguage(target.pointer) { continue }
      let batches = combined.contains(id) ? [ranges] : ranges.map { [$0] }
      for batch in batches {
        let flat = batch.flatMap { $0 }
        sub.setIncludedRanges(flat)
        let key = RangeKey(id: id, ranges: flat)
        var old: Kept?
        if var list = index[key], !list.isEmpty {
          old = list.removeFirst()
          index[key] = list
        }
        guard let t = sub.parse(old?.tree, mirror, cancel, budgetMicros: 0) else {
          // Cancelled by a new edit: the trees parsed so far stay kept for the next pass, nothing is published.
          kept.append(contentsOf: next)
          return nil
        }
        if let old {
          kept.removeAll { $0.tree === old.tree }
          counts.reused += 1
        } else {
          counts.fresh += 1
        }
        out.append(Injected(language: target, tree: t, ranges: flat))
        next.append(Kept(language: target, tree: t.copy()))
      }
    }
    kept = next
    return out
  }

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
