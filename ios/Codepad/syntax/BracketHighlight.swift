import Foundation

/// The bracket pair at the caret, recomputed only when the document, the caret, the snapshot or the flag changes.
final class BracketHighlight {
  private let core: EditorCore
  var enabled = true

  private var cached: (Int, Int)?
  private var keyRevision = -1
  private var keyHead = -1
  private var keySnapshot = -1
  private var keyEnabled = false

  init(core: EditorCore) {
    self.core = core
  }

  /// `snapshot` must match the document revision; without one every bracket counts.
  func pair(snapshot: Snapshot?, highlighter: Highlighter?) -> (Int, Int)? {
    let revision = core.document.revision
    let head = core.selection.head
    let snapshotRevision = snapshot?.revision ?? -1
    if revision == keyRevision && head == keyHead && snapshotRevision == keySnapshot && enabled == keyEnabled { return cached }
    keyRevision = revision
    keyHead = head
    keySnapshot = snapshotRevision
    keyEnabled = enabled
    if !enabled {
      cached = nil
    } else {
      var skip: ((Int) -> Bool)? = nil
      if let snapshot, let highlighter {
        let window = SpanWindow(snapshot: snapshot, highlighter: highlighter, doc: core.document)
        skip = { window.skip($0) }
      }
      cached = core.bracketMatch(skip: skip)
    }
    return cached
  }
}
