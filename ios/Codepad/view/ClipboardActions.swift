import UIKit

/// Cut, copy and paste between a core and the general pasteboard as plain text.
@MainActor
struct ClipboardActions {
  private var pasteboard: UIPasteboard { .general }

  /// Nil when the pasteboard holds no text; reading the string past hasStrings keeps the paste banner quiet.
  func text() -> String? {
    guard pasteboard.hasStrings, let text = pasteboard.string, !text.isEmpty else { return nil }
    return text
  }

  /// False when nothing is selected.
  func copy(_ core: EditorCore) -> Bool {
    let sel = core.selection
    if sel.isEmpty { return false }
    pasteboard.string = core.document.text(sel.min, sel.max)
    return true
  }

  func cut(_ core: EditorCore, origin: ChangeOrigin) {
    if !copy(core) { return }
    let sel = core.selection
    if origin == .api { core.replace(sel.min, sel.max, "", origin: origin) } else { core.delete() }
  }

  /// False when the pasteboard holds no text.
  func paste(_ core: EditorCore, origin: ChangeOrigin) -> Bool {
    guard let text = text() else { return false }
    core.insertText(text, origin: origin)
    return true
  }
}
