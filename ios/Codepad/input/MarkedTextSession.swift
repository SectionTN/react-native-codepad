import Foundation

/// The composition half of UITextInput over the core: the marked range and the edits that grow, commit or
/// drop it. Pure, so recorded keyboard sessions replay under swift test.
public final class MarkedTextSession {
  private let core: EditorCore
  public private(set) var marked: TextRange?

  /// True while a session call mutates the core, so the view can tell keyboard edits from external ones.
  public private(set) var applying = false

  private var groupOpen = false
  private var doc: Document { core.document }

  public init(core: EditorCore) {
    self.core = core
  }

  /// Replaces the marked text, or the selection when nothing is marked. `selectedRange` is relative to the
  /// marked text, as UIKit passes it.
  public func setMarkedText(_ text: String, selectedRange: NSRange) {
    mutate {
      let region = marked ?? core.selection.range
      beginComposition()
      replaceRegion(region, text)
      let end = region.start + text.utf16.count
      marked = end > region.start ? TextRange(start: region.start, end: end) : nil
      if marked == nil { closeGroup() }
      let location = selectedRange.location == NSNotFound ? text.utf16.count : selectedRange.location
      let a = clamp(region.start + location, region.start, end)
      let b = clamp(a + max(0, selectedRange.length), region.start, end)
      core.setSelection(anchor: a, head: b)
    }
  }

  public func unmarkText() {
    mutate { endComposition() }
  }

  /// A commit. During a composition it replaces the marked text and ends it; otherwise single scalars take the
  /// typing path (auto close applies) and longer strings are one insert.
  public func insertText(_ text: String) {
    mutate {
      if let region = marked {
        replaceRegion(region, text)
        let caret = region.start + text.utf16.count
        core.setSelection(anchor: caret, head: caret)
        endComposition()
        return
      }
      if text.isEmpty {
        if !core.selection.isEmpty { core.insertText(text, origin: .input) }
        return
      }
      if text.unicodeScalars.count == 1 { core.typeText(text) } else { core.insertText(text, origin: .input) }
    }
  }

  /// Backspace inside the marked text shrinks it; anywhere else it ends the composition and deletes as usual.
  public func deleteBackward() {
    mutate {
      let sel = core.selection
      if let m = marked, sel.isEmpty, sel.head > m.start, sel.head <= m.end {
        let from = TextMovement.prevGrapheme(doc, sel.head)
        core.inputReplace(from, sel.head, "", typing: sel.head - from == 1)
        let end = m.end - (sel.head - from)
        marked = end > m.start ? TextRange(start: m.start, end: end) : nil
        if marked == nil { closeGroup() }
        return
      }
      endComposition()
      core.backspace()
    }
  }

  /// The suggestion rewrite: end composing, swap an absolute range through the smallest edit, caret after it.
  public func replace(_ range: TextRange, with text: String) {
    mutate {
      endComposition()
      let a = clamp(range.start, 0, doc.length)
      let b = clamp(range.end, 0, doc.length)
      let region = TextRange(start: min(a, b), end: max(a, b))
      replaceRegion(region, text)
      let caret = region.start + text.utf16.count
      core.setSelection(anchor: caret, head: caret)
    }
  }

  /// A selection the keyboard sets. One outside the marked text ends the composition.
  public func setSelection(_ selection: Selection) {
    mutate {
      if let m = marked, selection.min < m.start || selection.max > m.end { endComposition() }
      core.setSelection(anchor: selection.anchor, head: selection.head)
    }
  }

  /// A change the session did not make. Returns true when it hit the marked text, which the view answers by
  /// telling the keyboard the text changed.
  public func onExternalChange(_ change: Change) -> Bool {
    guard let c = marked else { return false }
    closeGroup()
    let inside = change.start > c.start && change.start < c.end
    let overlaps = change.start < c.end && change.end > c.start
    if inside || overlaps {
      marked = nil
      return true
    }
    if change.start <= c.start { marked = TextRange(start: c.start + change.delta, end: c.end + change.delta) }
    return false
  }

  public func reset() {
    marked = nil
    closeGroup()
  }

  /// Replaces `region` with `text` through the smallest edit, so growing a composition by one char is a one
  /// char insert. The edit never starts or ends inside a surrogate pair.
  private func replaceRegion(_ region: TextRange, _ text: String) {
    let old = Array(doc.text(region.start, region.end).utf16)
    let new = Array(text.utf16)
    let shortest = min(old.count, new.count)
    var prefix = 0
    while prefix < shortest && old[prefix] == new[prefix] { prefix += 1 }
    if prefix >= 1 && prefix < new.count && UTF16.isLeadSurrogate(new[prefix - 1]) { prefix -= 1 }
    var suffix = 0
    while suffix < shortest - prefix && old[old.count - 1 - suffix] == new[new.count - 1 - suffix] { suffix += 1 }
    if suffix >= 1 && suffix < new.count - prefix && UTF16.isTrailSurrogate(new[new.count - suffix]) { suffix -= 1 }
    if prefix == old.count && prefix == new.count { return }
    let inserted = String(decoding: new[prefix..<(new.count - suffix)], as: UTF16.self)
    core.inputReplace(region.start + prefix, region.end - suffix, inserted)
  }

  private func beginComposition() {
    if groupOpen { return }
    groupOpen = true
    core.history.beginGroup(core.selection)
  }

  private func endComposition() {
    marked = nil
    closeGroup()
  }

  private func closeGroup() {
    if !groupOpen { return }
    groupOpen = false
    core.history.endGroup(core.selection)
  }

  private func clamp(_ v: Int, _ lo: Int, _ hi: Int) -> Int {
    max(lo, min(v, hi))
  }

  private func mutate(_ block: () -> Void) {
    applying = true
    defer { applying = false }
    block()
  }
}
