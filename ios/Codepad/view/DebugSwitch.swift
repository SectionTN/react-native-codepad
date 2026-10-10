import Foundation
import os

/// One user default turns on the paint and parse log lines the bench reads, debug builds only:
/// xcrun simctl spawn <udid> defaults write codepad.example codepad_debug -bool YES
enum DebugSwitch {
  static let log = Logger(subsystem: "me.sectiontn.codepad", category: "paint")

  static var isOn: Bool {
    #if DEBUG
      return UserDefaults.standard.bool(forKey: "codepad_debug")
    #else
      return false
    #endif
  }
}
