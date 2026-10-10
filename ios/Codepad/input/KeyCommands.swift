import Foundation

/// A hardware key as UIKit reports it, before the modifier table.
enum Key: Hashable, Sendable {
  case left
  case right
  case up
  case down
  case home
  case end
  case pageUp
  case pageDown
  case enter
  case tab
  case escape
  case backspace
  case forwardDelete
  case letter(Character)
}

struct Modifiers: OptionSet, Hashable, Sendable {
  let rawValue: Int

  init(rawValue: Int) {
    self.rawValue = rawValue
  }

  static let shift = Modifiers(rawValue: 1 << 0)
  static let option = Modifiers(rawValue: 1 << 1)
  static let command = Modifiers(rawValue: 1 << 2)
  static let control = Modifiers(rawValue: 1 << 3)
}

/// What a hardware key asks the editor to do. `edits` marks the ones a read only editor ignores.
enum KeyCommand: Hashable, Sendable {
  case move(unit: TextMovement.Unit, forward: Bool, extend: Bool)
  /// `direction` is -1 for up and 1 for down; `page` moves by a viewport instead of a row.
  case vertical(direction: Int, page: Bool, extend: Bool)
  case newline
  case tab
  case shiftTab
  case backspace
  case delete
  case undo
  case redo
  case cut
  case paste
  case selectAll
  case copy
  case escape

  var edits: Bool {
    switch self {
    case .move, .vertical, .selectAll, .copy, .escape: return false
    case .newline, .tab, .shiftTab, .backspace, .delete, .undo, .redo, .cut, .paste: return true
    }
  }
}

enum KeyCommands {
  /// The Android table with the Mac modifiers: Option moves by word, Command reaches the line and the document
  /// ends and carries the shortcuts, Control is left to the system.
  static func map(_ key: Key, _ modifiers: Modifiers) -> KeyCommand? {
    if modifiers.contains(.control) { return nil }
    let shift = modifiers.contains(.shift)
    let option = modifiers.contains(.option)
    let command = modifiers.contains(.command)
    if option && key != .left && key != .right { return nil }
    switch key {
    case .left, .right:
      let forward = key == .right
      if command { return .move(unit: forward ? .lineEnd : .lineStart, forward: forward, extend: shift) }
      return .move(unit: option ? .word : .char, forward: forward, extend: shift)
    case .up, .down:
      let down = key == .down
      if command { return .move(unit: down ? .docEnd : .docStart, forward: down, extend: shift) }
      return .vertical(direction: down ? 1 : -1, page: false, extend: shift)
    case .pageUp, .pageDown:
      return command ? nil : .vertical(direction: key == .pageDown ? 1 : -1, page: true, extend: shift)
    case .home:
      return .move(unit: command ? .docStart : .lineStart, forward: false, extend: shift)
    case .end:
      return .move(unit: command ? .docEnd : .lineEnd, forward: true, extend: shift)
    case .enter:
      return .newline
    case .tab:
      return command ? nil : (shift ? .shiftTab : .tab)
    case .backspace:
      return .backspace
    case .forwardDelete:
      return .delete
    case .escape:
      return .escape
    case .letter(let c):
      if !command { return nil }
      switch c.lowercased().first ?? c {
      case "z": return shift ? .redo : .undo
      case "a": return shift ? nil : .selectAll
      case "c": return shift ? nil : .copy
      case "x": return shift ? nil : .cut
      case "v": return shift ? nil : .paste
      default: return nil
      }
    }
  }
}
