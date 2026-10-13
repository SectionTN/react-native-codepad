import Foundation

/// One injected tree with the unit extent of its content; the tree itself keeps the included ranges.
/// A carried tree's own positions lag the edits made before it: `shift` is what to add to reach the document.
struct Injected: Sendable {
  let language: LoadedLanguage
  let tree: Tree
  let start: Int
  let end: Int
  let shift: Int

  init(language: LoadedLanguage, tree: Tree, start: Int, end: Int, shift: Int = 0) {
    self.language = language
    self.tree = tree
    self.start = start
    self.end = end
    self.shift = shift
  }
}

/// Edit to snapshot time plus how many injected trees were parsed fresh, reused incrementally or carried without a parse.
struct ParseStats: Sendable {
  let latencyMillis: Int
  let freshInjections: Int
  let reusedInjections: Int
  let carriedInjections: Int
}

/// An immutable parse result for one document revision. Its trees free with it; `injected` is sorted by start.
final class Snapshot: @unchecked Sendable {
  let revision: Int
  let tree: Tree
  let injected: [Injected]
  let languageId: String
  let stats: ParseStats
  // The published revision `changed` is relative to, -1 after a full parse; `changed` is sorted, coalesced unit pairs.
  let basedOn: Int
  let changed: [Int]

  init(
    revision: Int, tree: Tree, injected: [Injected], languageId: String,
    stats: ParseStats = ParseStats(latencyMillis: 0, freshInjections: 0, reusedInjections: 0, carriedInjections: 0),
    basedOn: Int = -1, changed: [Int] = []
  ) {
    self.revision = revision
    self.tree = tree
    self.injected = injected
    self.languageId = languageId
    self.stats = stats
    self.basedOn = basedOn
    self.changed = changed
  }
}
