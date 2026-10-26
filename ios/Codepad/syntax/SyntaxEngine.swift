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

  /// A kept injected tree: `hulls` are unit pairs over its match's captures, `extent` the content span after offsets.
  private final class Kept {
    let language: LoadedLanguage
    let tree: Tree
    let combined: Bool
    var hulls: [Int]
    var extent: [Int]
    // The start point, shifted like the extent; the tree's own positions stay where its last applied edit left them.
    var row: Int
    var col: Int
    var base: Int
    var baseRow: Int
    var baseCol: Int
    // Pass-local marks: a region met one of the hulls; the tree was replaced by a reparse.
    var hit = false
    var consumed = false

    init(language: LoadedLanguage, tree: Tree, combined: Bool, hulls: [Int], extent: [Int], row: Int, col: Int) {
      self.language = language
      self.tree = tree
      self.combined = combined
      self.hulls = hulls
      self.extent = extent
      self.row = row
      self.col = col
      base = extent[0]
      baseRow = row
      baseCol = col
    }

    var start: Int { extent[0] }
    var end: Int { extent[1] }

    /// Units to add to the tree's positions to reach the document.
    var shift: Int { start - base }

    /// Applies the edits deferred before the tree as one synthetic edit, so its positions match the document again.
    func catchUp() {
      if start == base && row == baseRow && col == baseCol { return }
      let before = Point(row: baseRow, column: baseCol)
      let now = Point(row: row, column: col)
      if start >= base {
        tree.edit(InputEdit(start: base, oldEnd: base, newEnd: start, startPoint: before, oldEndPoint: before, newEndPoint: now))
      } else {
        tree.edit(InputEdit(start: start, oldEnd: base, newEnd: start, startPoint: now, oldEndPoint: before, newEndPoint: now))
      }
      base = start
      baseRow = row
      baseCol = col
    }
  }

  private struct Match {
    let target: LoadedLanguage
    let combined: Bool
    let hullStart: Int
    let hullEnd: Int
    let ranges6: [Int]
    let start: Int
    let end: Int
  }

  private struct MatchKey: Hashable {
    let pattern: Int
    let start: Int
    let end: Int
  }

  private struct ExtentKey: Hashable {
    let id: String
    let start: Int
    let end: Int
  }

  private struct RangeKey: Hashable {
    let id: String
    let ranges: [Int]
  }

  private struct Counts {
    var fresh = 0
    var reused = 0
    var carried = 0
  }

  private let postToMain: @Sendable (@escaping @Sendable () -> Void) -> Void
  private let onSnapshot: @Sendable (Snapshot) -> Void
  let queue = DispatchQueue(label: "codepad-syntax", qos: .userInitiated)
  private let pending = OSAllocatedUnfairLock(initialState: 0)
  private let cancel = CancelFlag()
  private let budgetMicros: Int64
  // Set by the first call after a snapshot, cleared when the next one posts: the difference is the parse latency.
  private let pendingSince = OSAllocatedUnfairLock<UInt64>(initialState: 0)

  // Syntax queue only from here on.
  private let mirror = Mirror()
  private let parser = Parser()
  private var language: LoadedLanguage?
  private var tree: Tree?
  // Injected trees of the last pass, edited along with the document so unchanged ranges reparse for free.
  private var kept: [Kept] = []
  // The host tree of the last completed pass, edited like the live one; its diff against the new tree bounds the pass.
  private var reconciled: Tree?
  private var reconciledRevision = -1
  // New spans of the edits since the last completed pass, shifted like hulls: the diff misses a retyped leaf.
  private var dirty: [Int] = []
  // The text a split parse keeps reading until it finishes, and the edits made since, replayed onto its tree.
  private var frozen: Mirror?
  private var replay: [InputEdit] = []
  private var revision = 0
  private var closed = false

  init(
    postToMain: @escaping @Sendable (@escaping @Sendable () -> Void) -> Void,
    onSnapshot: @escaping @Sendable (Snapshot) -> Void,
    budgetMicros: Int64 = 50_000
  ) {
    self.postToMain = postToMain
    self.onSnapshot = onSnapshot
    self.budgetMicros = budgetMicros
  }

  func setLanguage(_ id: String?) {
    submit { [self] in
      language = id.flatMap { LanguageRegistry.resolve($0) }
      tree = nil
      dropKept()
      dropFrozen()
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
      dropKept()
      dropFrozen()
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
      if frozen != nil { replay.append(edit) } else { tree?.edit(edit) }
      reconciled?.edit(edit)
      for k in kept {
        let s = k.start
        let before = change.end <= s
        let after = change.start > k.end
        // Only an edit reaching the tree is applied to it: one before it accumulates as a shift, one after it is a no-op.
        let reaches = k.combined || !(before || after)
        if reaches {
          k.catchUp()
          k.tree.edit(edit)
        }
        shift(&k.hulls, change.start, change.end, change.newEnd)
        shift(&k.extent, change.start, change.end, change.newEnd)
        if before {
          // tree-sitter's point arithmetic: a start at or past the old end moves with the new end.
          if k.row > points.oldEnd.row {
            k.row += points.newEnd.row - points.oldEnd.row
          } else {
            k.row = points.newEnd.row
            k.col = points.newEnd.column + (k.col - points.oldEnd.column)
          }
        } else if change.start < s {
          k.row = points.start.row
          k.col = points.start.column
        }
        if reaches {
          k.base = k.start
          k.baseRow = k.row
          k.baseCol = k.col
        }
      }
      shift(&dirty, change.start, change.end, change.newEnd)
      dirty = coalesce(dirty + [change.start, change.newEnd])
      if settlePending() { reparse() }
    }
  }

  /// Drops the view's last reference to a replaced snapshot on the queue, so the main thread never frees the trees.
  func release(_ snapshot: Snapshot) {
    queue.async { _ = snapshot }
  }

  func close() {
    queue.async { [self] in
      closed = true
      tree = nil
      dropKept()
      dropFrozen()
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
    guard let parsed = parser.parse(tree, frozen ?? mirror, cancel, budgetMicros: budgetMicros) else {
      // The parse resumes on the text it started with, whatever the edits that cut in do to the live one.
      if frozen == nil { frozen = mirror.copy() }
      if !cancel.isSet { queue.async { [self] in if !closed { reparse() } } }
      return
    }
    let result = catchUp(parsed)
    tree = result
    var counts = Counts()
    let basedOn = reconciled == nil ? -1 : reconciledRevision
    let length = mirror.length
    let regions = regions(result, length)
    // The regions plus the capture hulls of every highlight match they meet, old tree and new: the painter's dirty lines.
    var changed: [Int] = []
    if let reconciled {
      changed = regions
      collectHulls(lang.highlights, reconciled, regions, length, &changed)
      collectHulls(lang.highlights, result, regions, length, &changed)
    }
    guard let injected = injections(lang, result, regions, length, &counts, &changed, incremental: basedOn >= 0) else {
      if !cancel.isSet { queue.async { [self] in if !closed { reparse() } } }
      return
    }
    reconciled = result.copy()
    reconciledRevision = revision
    dirty = []
    let published = basedOn < 0 ? [] : coalesce(changed.map { min(max($0, 0), length) })
    let since = pendingSince.withLock { value -> UInt64 in
      let v = value
      value = 0
      return v
    }
    let latency = since == 0 ? 0 : Int((DispatchTime.now().uptimeNanoseconds - since) / 1_000_000)
    let stats = ParseStats(latencyMillis: latency, freshInjections: counts.fresh, reusedInjections: counts.reused, carriedInjections: counts.carried)
    let snapshot = Snapshot(
      revision: revision, tree: result.copy(), injected: injected, languageId: lang.id, stats: stats, basedOn: basedOn, changed: published)
    let onSnapshot = self.onSnapshot
    postToMain { onSnapshot(snapshot) }
  }

  private func dropKept() {
    kept.removeAll()
    reconciled = nil
    dirty = []
  }

  private func dropFrozen() {
    frozen = nil
    replay.removeAll()
  }

  /// Brings a tree parsed from the frozen text to the live one: the replayed edits, then one parse that is never cut short.
  private func catchUp(_ parsed: Tree) -> Tree {
    guard frozen != nil else { return parsed }
    frozen = nil
    for e in replay { parsed.edit(e) }
    replay.removeAll()
    // Edits cutting into this parse too could keep every snapshot from landing.
    guard let live = parser.parse(parsed, mirror, nil, budgetMicros: 0) else { preconditionFailure("an uncancellable parse returned no tree") }
    return live
  }

  /// Pairs after the edit move with it, pairs before it stay, pairs meeting it grow over its new span.
  private func shift(_ pairs: inout [Int], _ start: Int, _ oldEnd: Int, _ newEnd: Int) {
    let delta = newEnd - oldEnd
    var i = 0
    while i + 1 < pairs.count {
      let s = pairs[i]
      let e = pairs[i + 1]
      if s >= oldEnd {
        pairs[i] = s + delta
        pairs[i + 1] = e + delta
      } else if e > start {
        pairs[i] = min(s, start)
        pairs[i + 1] = max(e + delta, newEnd)
      }
      i += 2
    }
  }

  /// Region [a, b) meets hull [c, d) when they intersect or touch, so an edit at a hull end counts.
  private func meets(_ a: Int, _ b: Int, _ c: Int, _ d: Int) -> Bool {
    a <= d && b >= c
  }

  private func metBy(_ hulls: [Int], _ regions: [Int]) -> Bool {
    var i = 0
    while i + 1 < hulls.count {
      var j = 0
      while j + 1 < regions.count {
        if meets(regions[j], regions[j + 1], hulls[i], hulls[i + 1]) { return true }
        j += 2
      }
      i += 2
    }
    return false
  }

  // The whole document before the first completed pass, else tree-sitter's diff plus the edits' own spans.
  private func regions(_ host: Tree, _ length: Int) -> [Int] {
    guard let ref = reconciled else { return [0, length] }
    var out = host.changedRanges(since: ref)
    out.append(contentsOf: dirty)
    for i in out.indices { out[i] = min(max(out[i], 0), length) }
    return coalesce(out)
  }

  /// Appends the capture hull of every highlight match the regions meet: a capture whose pattern constrains a changed sibling.
  private func collectHulls(_ compiled: CompiledQuery, _ tree: Tree, _ regions: [Int], _ length: Int, _ out: inout [Int]) {
    let root = tree.rootNode
    let cursor = QueryCursor()
    var i = 0
    while i + 1 < regions.count {
      cursor.exec(compiled.query, root)
      cursor.setUnitRange(max(0, regions[i] - 1), min(length, regions[i + 1] + 1))
      while cursor.nextMatch() {
        var lo = Int.max
        var hi = 0
        for j in 0..<cursor.matchCaptureCount {
          let n = cursor.matchCapture(j).node
          lo = min(lo, n.startUnit)
          hi = max(hi, n.endUnit)
        }
        if lo < hi {
          out.append(lo)
          out.append(hi)
        }
      }
      i += 2
    }
  }

  /// One cursor run over [from, to); matches are deduped across runs by pattern and content extent.
  private func collectMatches(
    _ lang: LoadedLanguage, _ cursor: QueryCursor, _ root: Node, _ from: Int, _ to: Int, _ seen: inout Set<MatchKey>, _ out: inout [Match]
  ) {
    guard let compiled = lang.injections, let contentIndex = compiled.captureIndex["injection.content"] else { return }
    let languageIndex = compiled.captureIndex["injection.language"]
    let mirror = self.mirror
    let read: (Node) -> String = { n in mirror.text(n.startUnit, n.endUnit) }
    cursor.exec(compiled.query, root)
    cursor.setUnitRange(from, to)
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
      let combined = settings["injection.combined"] != nil
      let offset = compiled.evaluator.offset(capture.patternIndex)
      // The hull spans every captured node, so an edit to a language marker touches the tree.
      var hullStart = Int.max
      var hullEnd = 0
      for c in all {
        hullStart = min(hullStart, c.node.startUnit)
        hullEnd = max(hullEnd, c.node.endUnit)
      }
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
        if !seen.insert(MatchKey(pattern: capture.patternIndex, start: start, end: end)).inserted { continue }
        out.append(
          Match(
            target: target, combined: combined, hullStart: hullStart, hullEnd: hullEnd,
            ranges6: [start, end, sp.row, startColumn, ep.row, endColumn], start: start, end: end))
      }
    }
  }

  /// Reconciles the kept trees against what changed since the last completed pass: the query runs over the changed
  /// regions only, trees they meet are reparsed, the rest are carried over. Nil when a new edit cancelled the pass.
  private func injections(
    _ lang: LoadedLanguage, _ host: Tree, _ regions: [Int], _ length: Int, _ counts: inout Counts, _ changed: inout [Int],
    incremental: Bool
  ) -> [Injected]? {
    guard let compiled = lang.injections, compiled.captureIndex["injection.content"] != nil else { return [] }
    var touched: [Kept] = []
    var carried: [Kept] = []
    for k in kept {
      k.hit = metBy(k.hulls, regions)
      k.consumed = false
      if k.hit || k.combined { touched.append(k) } else { carried.append(k) }
    }
    var matches: [Match] = []
    var seen = Set<MatchKey>()
    let root = host.rootNode
    let cursor = QueryCursor()
    var i = 0
    while i + 1 < regions.count {
      // Widened by one unit so a touched hull, however the edit sits against it, intersects the run.
      collectMatches(lang, cursor, root, max(0, regions[i] - 1), min(length, regions[i + 1] + 1), &seen, &matches)
      i += 2
    }
    // A combined group is re-derived every pass: each member hull is queried so unchanged members are found again.
    for k in touched where k.combined {
      var j = 0
      while j + 1 < k.hulls.count {
        collectMatches(lang, cursor, root, max(0, k.hulls[j] - 1), min(length, k.hulls[j + 1] + 1), &seen, &matches)
        j += 2
      }
    }
    // A match found again at a carried tree's language and extent keeps the carried tree.
    var carriedKeys = Set<ExtentKey>()
    for k in carried { carriedKeys.insert(ExtentKey(id: k.language.id, start: k.start, end: k.end)) }
    var plainOrder: [String] = []
    var plain: [String: [Match]] = [:]
    var groupedOrder: [String] = []
    var grouped: [String: [Match]] = [:]
    for m in matches {
      if m.combined {
        if grouped[m.target.id] == nil {
          groupedOrder.append(m.target.id)
          grouped[m.target.id] = []
        }
        grouped[m.target.id]?.append(m)
      } else if !carriedKeys.contains(ExtentKey(id: m.target.id, start: m.start, end: m.end)) {
        if plain[m.target.id] == nil {
          plainOrder.append(m.target.id)
          plain[m.target.id] = []
        }
        plain[m.target.id]?.append(m)
      }
    }
    // Touched trees are indexed by their edited ranges; a plain match with equal ranges reparses against one.
    var index: [RangeKey: [Kept]] = [:]
    for k in touched {
      if !k.combined { k.catchUp() }
      // The old tree's matches are the ones that can vanish with this pass.
      if incremental { collectHulls(k.language.highlights, k.tree, regions, length, &changed) }
      if k.combined { continue }
      index[RangeKey(id: k.language.id, ranges: k.tree.includedRanges()), default: []].append(k)
    }
    var out: [Injected] = []
    var next: [Kept] = []
    func cancelled() -> [Injected]? {
      // A new edit cancelled a parse: every tree still valid stays kept for the next pass, nothing is published.
      kept = carried + next + touched.filter { !$0.consumed }
      return nil
    }
    for id in plainOrder {
      guard let group = plain[id], let target = group.first?.target else { continue }
      let sub = Parser()
      if !sub.setLanguage(target.pointer) { continue }
      for m in group {
        sub.setIncludedRanges(m.ranges6)
        let key = RangeKey(id: id, ranges: m.ranges6)
        var old: Kept?
        if var list = index[key], !list.isEmpty {
          old = list.removeFirst()
          index[key] = list
        }
        guard let t = sub.parse(old?.tree, mirror, cancel, budgetMicros: 0) else { return cancelled() }
        if incremental { collectHulls(target.highlights, t, regions, length, &changed) }
        if let old {
          old.consumed = true
          counts.reused += 1
        } else {
          counts.fresh += 1
        }
        out.append(Injected(language: target, tree: t, start: m.start, end: m.end))
        next.append(
          Kept(
            language: target, tree: t.copy(), combined: false, hulls: [m.hullStart, m.hullEnd], extent: [m.start, m.end],
            row: m.ranges6[2], col: m.ranges6[3]))
      }
    }
    // A combined group is one tree over every member range; it reparses against its old tree only when the ranges match.
    for id in groupedOrder {
      guard var group = grouped[id], let target = group.first?.target else { continue }
      group.sort { $0.start < $1.start }
      var flat: [Int] = []
      var hulls: [Int] = []
      for m in group {
        flat.append(contentsOf: m.ranges6)
        hulls.append(contentsOf: [m.hullStart, m.hullEnd])
      }
      let old = touched.first { $0.combined && !$0.consumed && $0.language.id == id }
      let same = old.map { $0.tree.includedRanges() == flat } ?? false
      if let old, same, !old.hit {
        // No member met a region and the ranges are unchanged: the group is carried like a plain tree.
        touched.removeAll { $0 === old }
        carried.append(old)
        continue
      }
      let sub = Parser()
      if !sub.setLanguage(target.pointer) { continue }
      sub.setIncludedRanges(flat)
      guard let t = sub.parse(same ? old?.tree : nil, mirror, cancel, budgetMicros: 0) else { return cancelled() }
      if incremental { collectHulls(target.highlights, t, regions, length, &changed) }
      if let old { old.consumed = true }
      if same { counts.reused += 1 } else { counts.fresh += 1 }
      let extent = [group[0].start, group[group.count - 1].end]
      out.append(Injected(language: target, tree: t, start: extent[0], end: extent[1]))
      next.append(
        Kept(
          language: target, tree: t.copy(), combined: true, hulls: hulls, extent: extent, row: group[0].ranges6[2],
          col: group[0].ranges6[3]))
    }
    kept = carried + next
    kept.sort { $0.start < $1.start }
    counts.carried = carried.count
    var result = carried.map { Injected(language: $0.language, tree: $0.tree.copy(), start: $0.start, end: $0.end, shift: $0.shift) }
    result.append(contentsOf: out)
    result.sort { $0.start < $1.start }
    return result
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
