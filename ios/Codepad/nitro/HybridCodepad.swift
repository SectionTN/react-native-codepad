import Foundation

final class HybridCodepad: HybridCodepadSpec {
  func availableLanguages() throws -> [String] {
    LanguageScan.providerIds()
  }
}
