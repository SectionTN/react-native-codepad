import XCTest

@testable import Codepad

final class AvailableLanguagesTests: XCTestCase {
  func testClassScanFindsEveryLinkedProvider() {
    let ids = LanguageScan.providerIds()
    XCTAssertEqual(
      ids,
      [
        "c", "css", "go", "html", "java", "javascript", "json", "kotlin", "markdown", "markdown_inline", "python", "rust",
        "swift", "tsx", "typescript", "yaml",
      ])
    XCTAssertEqual(LanguageScan.providerIds(), ids, "the second call serves the cached list")
  }
}
