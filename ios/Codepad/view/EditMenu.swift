import UIKit

/// The cut, copy, paste and select all menu over the content view, anchored to the selection or the caret.
/// The items are the view's responder actions that canPerformAction allows, nothing UIKit adds on its own.
@MainActor
final class EditMenu: NSObject, @preconcurrency UIEditMenuInteractionDelegate {
  private static let actions = [
    #selector(UIResponderStandardEditActions.cut(_:)), #selector(UIResponderStandardEditActions.copy(_:)),
    #selector(UIResponderStandardEditActions.paste(_:)), #selector(UIResponderStandardEditActions.selectAll(_:)),
  ]

  private(set) var interaction: UIEditMenuInteraction!
  private(set) var targetRect = CGRect.zero
  /// True between the interaction's will present and will dismiss callbacks.
  private(set) var isShowing = false
  /// The titles of the last presented items, in UIKit's order.
  private(set) var itemTitles: [String] = []

  init(view: UIView) {
    super.init()
    interaction = UIEditMenuInteraction(delegate: self)
    view.addInteraction(interaction)
  }

  /// Presents at a rect in the view's coordinates, or moves a visible menu there with fresh items.
  func show(at rect: CGRect) {
    targetRect = rect
    if isShowing {
      interaction.reloadVisibleMenu()
      interaction.updateVisibleMenuPosition(animated: true)
      return
    }
    let configuration = UIEditMenuConfiguration(identifier: nil, sourcePoint: CGPoint(x: rect.midX, y: rect.minY))
    interaction.presentEditMenu(with: configuration)
  }

  func hide() {
    interaction.dismissMenu()
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction, menuFor configuration: UIEditMenuConfiguration, suggestedActions: [UIMenuElement]
  ) -> UIMenu? {
    var kept: [UIMenuElement] = []
    func walk(_ elements: [UIMenuElement]) {
      for element in elements {
        if let menu = element as? UIMenu {
          walk(menu.children)
        } else if let command = element as? UICommand, EditMenu.actions.contains(command.action) {
          kept.append(command)
        }
      }
    }
    walk(suggestedActions)
    itemTitles = kept.map(\.title)
    return UIMenu(children: kept)
  }

  func editMenuInteraction(_ interaction: UIEditMenuInteraction, targetRectFor configuration: UIEditMenuConfiguration) -> CGRect {
    targetRect
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction, willPresentMenuFor configuration: UIEditMenuConfiguration,
    animator: any UIEditMenuInteractionAnimating
  ) {
    isShowing = true
  }

  func editMenuInteraction(
    _ interaction: UIEditMenuInteraction, willDismissMenuFor configuration: UIEditMenuConfiguration,
    animator: any UIEditMenuInteractionAnimating
  ) {
    isShowing = false
  }
}
