import Foundation

/// The bracket pair at the caret, recomputed only when the document, the caret, the snapshot or the flag changes.
final class BracketHighlight {
  private let core: EditorCore
  private let match: (Snapshot?) -> (Int, Int)?
  var enabled = true

  private var cached: (Int, Int)?
  private var keyRevision = -1
  private var keyHead = -1
  private var keySnapshot = -1
  private var keyEnabled = false

  init(core: EditorCore, match: ((Snapshot?) -> (Int, Int)?)? = nil) {
    self.core = core
    self.match = match ?? { core.bracketMatch(snapshot: $0) }
  }

  /// A snapshot at the document revision skips brackets in strings and comments. Without one every bracket counts.
  /// A draw passes its frame's revision and caret, so the document is not read again.
  func pair(snapshot: Snapshot?, revision: Int? = nil, head: Int? = nil) -> (Int, Int)? {
    let revision = revision ?? core.document.revision
    let head = head ?? core.selection.head
    let snapshotRevision = snapshot?.revision ?? -1
    if revision == keyRevision && head == keyHead && snapshotRevision == keySnapshot && enabled == keyEnabled { return cached }
    keyRevision = revision
    keyHead = head
    keySnapshot = snapshotRevision
    keyEnabled = enabled
    cached = enabled ? match(snapshot) : nil
    return cached
  }
}
