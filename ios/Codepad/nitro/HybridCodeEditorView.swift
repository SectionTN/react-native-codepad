import UIKit

class HybridCodeEditorView: HybridCodeEditorViewSpec {
  var view: UIView = UIView()
  var initialValue: String? = nil
  var language: String? = nil
  var theme: NativeTheme? = nil
  var fontFamily: String? = nil
  var fontSize: Double? = nil
  var lineHeight: Double? = nil
  var onReady: (() -> Void)? = nil

  func getText() throws -> String {
    return initialValue ?? ""
  }

  func getLength() throws -> Double {
    return Double((initialValue ?? "").utf16.count)
  }

  func getLineCount() throws -> Double {
    return Double(lines().count)
  }

  func getLine(index: Double) throws -> String {
    let all = lines()
    let i = Int(index)
    return i >= 0 && i < all.count ? String(all[i]) : ""
  }

  func getRevision() throws -> Double {
    return 0
  }

  func setText(text: String, keepHistory: Bool) throws -> Promise<Void> {
    initialValue = text
    return Promise.resolved(withResult: ())
  }

  private func lines() -> [Substring] {
    return (initialValue ?? "").split(separator: "\n", omittingEmptySubsequences: false)
  }
}
