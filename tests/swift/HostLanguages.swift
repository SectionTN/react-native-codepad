import Foundation

@testable import Codepad

/// A provider built from a host grammar and the generated query files, the twin of the Kotlin HostLanguages.
final class HostProvider: NSObject, CPLanguageProvider {
  let id: String
  let languagePointer: UnsafeRawPointer
  let highlights: String
  let injections: String

  init(id: String, pointer: OpaquePointer, highlights: String, injections: String) {
    self.id = id
    languagePointer = UnsafeRawPointer(pointer)
    self.highlights = highlights
    self.injections = injections
  }
}

enum HostLanguages {
  static let languagesDir = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("languages")

  static func javascript() -> LoadedLanguage {
    load("javascript", "javascript")
  }

  /// Registers languages/<id>/queries/<grammar> under the grammar name and resolves it.
  @discardableResult
  static func load(_ id: String, _ grammar: String) -> LoadedLanguage {
    let dir = languagesDir.appendingPathComponent(id).appendingPathComponent("queries").appendingPathComponent(grammar)
    guard let pointer = HostGrammars.language(named: grammar),
      let highlights = try? String(contentsOf: dir.appendingPathComponent("highlights.scm"), encoding: .utf8)
    else { fatalError("\(grammar) is not in the host grammars or has no highlights query") }
    let injections = (try? String(contentsOf: dir.appendingPathComponent("injections.scm"), encoding: .utf8)) ?? ""
    LanguageRegistry.register(HostProvider(id: grammar, pointer: pointer, highlights: highlights, injections: injections))
    guard let loaded = LanguageRegistry.resolve(grammar) else { fatalError("\(grammar) did not load") }
    return loaded
  }

  /// Every (package id, grammar name) with a highlights query, sorted by id then grammar.
  static func packages() -> [(id: String, grammar: String)] {
    let fm = FileManager.default
    var out: [(id: String, grammar: String)] = []
    for id in ((try? fm.contentsOfDirectory(atPath: languagesDir.path)) ?? []).sorted() {
      if id == "generator" || id == "host" || id.hasPrefix(".") { continue }
      let queries = languagesDir.appendingPathComponent(id).appendingPathComponent("queries")
      for grammar in ((try? fm.contentsOfDirectory(atPath: queries.path)) ?? []).sorted() {
        if fm.fileExists(atPath: queries.appendingPathComponent(grammar).appendingPathComponent("highlights.scm").path) {
          out.append((id, grammar))
        }
      }
    }
    return out
  }
}

/// Collects the snapshots an engine publishes from its queue; tests take them with a timeout.
final class SnapshotQueue: @unchecked Sendable {
  private let lock = NSLock()
  private var items: [Snapshot] = []
  private let available = DispatchSemaphore(value: 0)

  func add(_ snapshot: Snapshot) {
    lock.withLock { items.append(snapshot) }
    available.signal()
  }

  func take(_ timeout: TimeInterval = 5) -> Snapshot? {
    guard available.wait(timeout: .now() + timeout) == .success else { return nil }
    return lock.withLock { items.removeFirst() }
  }

  /// Skips the empty document snapshot setLanguage can publish before setText's one lands.
  func takeParsed(_ timeout: TimeInterval = 5) -> Snapshot? {
    while let s = take(timeout) {
      if s.tree.rootNode.endUnit > 0 { return s }
    }
    return nil
  }

  func takeRevision(_ revision: Int, _ timeout: TimeInterval = 5) -> Snapshot? {
    while let s = take(timeout) {
      if s.revision == revision { return s }
    }
    return nil
  }
}

func styleAt(_ spans: [Int], _ column: Int) -> String? {
  var i = 0
  while i < spans.count {
    if column >= spans[i] && column < spans[i + 1] { return StyleTable.name(spans[i + 2]) }
    i += 3
  }
  return nil
}

func parseSnapshot(_ lang: LoadedLanguage, _ text: String) -> (Snapshot, Document) {
  let doc = Document(text)
  let parser = Parser()
  parser.setLanguage(lang.pointer)
  let mirror = Mirror()
  mirror.setText(text)
  guard let tree = parser.parse(nil, mirror, nil, budgetMicros: 0) else { fatalError("parse failed") }
  return (Snapshot(revision: doc.revision, tree: tree, injected: [], languageId: lang.id), doc)
}

/// True when one of the unit pairs meets the line [start, end], the painter's rule for a dirty line.
func meetsLine(_ changed: [Int], _ start: Int, _ end: Int) -> Bool {
  var i = 0
  while i + 1 < changed.count {
    if changed[i] <= end && max(changed[i], changed[i + 1] - 1) >= start { return true }
    i += 2
  }
  return false
}
