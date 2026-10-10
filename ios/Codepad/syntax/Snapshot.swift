import Foundation

struct Injected: Sendable {
  let language: LoadedLanguage
  let tree: Tree
  let ranges: [Int]
}

/// Edit to snapshot time plus how many injected trees were parsed fresh or reused incrementally.
struct ParseStats: Sendable {
  let latencyMillis: Int
  let freshInjections: Int
  let reusedInjections: Int
}

/// An immutable parse result for one document revision. Its trees free with it.
final class Snapshot: @unchecked Sendable {
  let revision: Int
  let tree: Tree
  let injected: [Injected]
  let languageId: String
  let stats: ParseStats

  init(
    revision: Int, tree: Tree, injected: [Injected], languageId: String,
    stats: ParseStats = ParseStats(latencyMillis: 0, freshInjections: 0, reusedInjections: 0)
  ) {
    self.revision = revision
    self.tree = tree
    self.injected = injected
    self.languageId = languageId
    self.stats = stats
  }
}
