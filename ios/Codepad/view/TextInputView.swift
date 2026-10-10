import UIKit

/// The scroll view's content: the decoration layers under the recycled line layers.
final class TextInputView: UIView {
  let decorations = Decorations()
  let textHost = StillLayer()

  override init(frame: CGRect) {
    super.init(frame: frame)
    isOpaque = false
    for sublayer in decorations.layers { layer.addSublayer(sublayer) }
    layer.addSublayer(textHost)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }
}
