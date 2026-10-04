import UIKit

class HybridCodeEditorView: HybridCodeEditorViewSpec {
  var view: UIView = UIView()
  var initialValue: String? = nil
  var onReady: (() -> Void)? = nil

  func getText() throws -> String {
    return initialValue ?? ""
  }
}
