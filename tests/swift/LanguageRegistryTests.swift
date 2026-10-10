import XCTest

@testable import Codepad

final class LanguageRegistryTests: XCTestCase {
  func testInjectionNamesLowercaseAndAlias() {
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("JS"), "javascript")
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("jsx"), "javascript")
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("ts"), "typescript")
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("py"), "python")
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("JSON"), "json")
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("yml"), "yaml")
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("md"), "markdown")
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("h"), "c")
    XCTAssertNil(LanguageRegistry.canonicalInjectionId("bash"))
    XCTAssertNil(LanguageRegistry.canonicalInjectionId("cpp"))
    XCTAssertNil(LanguageRegistry.canonicalInjectionId("regex"))
    XCTAssertEqual(LanguageRegistry.canonicalInjectionId("ruby"), "ruby")
  }
}
