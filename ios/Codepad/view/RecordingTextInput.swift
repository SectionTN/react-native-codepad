import Foundation
import os

/// Logs every UITextInput call the keyboard makes, its arguments and the document after it, one JSON line per
/// call in the Android recorder's shape (open first, then t, call, args, after), while codepad_debug is on.
@MainActor
final class RecordingTextInput {
  static let log = Logger(subsystem: "me.sectiontn.codepad", category: "ime")
  private let opened = ProcessInfo.processInfo.systemUptime
  private unowned let view: TextInputView

  init(view: TextInputView, ime: String?) {
    self.view = view
    emit("open", args: [], extra: ime.map { ["ime": $0] } ?? [:])
  }

  /// Runs `block` and logs the call with the state after it.
  func record(_ call: String, _ args: [Any], _ block: () -> Void) {
    block()
    emit(call, args: args, extra: [:])
  }

  private func emit(_ call: String, args: [Any], extra: [String: Any]) {
    let t = Int(((ProcessInfo.processInfo.systemUptime - opened) * 1000).rounded())
    var line: [String: Any] = ["t": t, "call": call, "args": args, "after": view.imeState()]
    for (key, value) in extra { line[key] = value }
    guard let data = try? JSONSerialization.data(withJSONObject: line, options: [.sortedKeys, .withoutEscapingSlashes]),
      let text = String(data: data, encoding: .utf8)
    else { return }
    view.recorderLog(text)
  }
}
