import XCTest

@testable import Codepad

final class LanguageRegistryTests: XCTestCase {
  /// A provider whose highlights query names a node the grammar lacks; counts how often the registry asks for it.
  private final class BadQueryProvider: NSObject, CPLanguageProvider {
    let id = "javascript_bad"
    let highlights = "(no_such_node) @x"
    let injections = ""
    let pointer: OpaquePointer
    var reads = 0

    init(pointer: OpaquePointer) {
      self.pointer = pointer
    }

    var languagePointer: UnsafeRawPointer {
      reads += 1
      return UnsafeRawPointer(pointer)
    }
  }

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

  func testUnknownLanguagesAndBadQueriesResolveToNilOnce() {
    let base = HostLanguages.javascript()
    XCTAssertNil(LanguageRegistry.resolve("no_such_language"))
    XCTAssertNil(LanguageRegistry.resolveInjection("c_sharp"))
    XCTAssertTrue(LanguageRegistry.resolveInjection("js") === LanguageRegistry.resolve("javascript"))
    let bad = BadQueryProvider(pointer: base.pointer)
    LanguageRegistry.register(bad)
    XCTAssertNil(LanguageRegistry.resolve("javascript_bad"), "a highlights query naming a missing node fails the load")
    XCTAssertNil(LanguageRegistry.resolve("javascript_bad"))
    XCTAssertEqual(bad.reads, 1, "the failure is cached")
  }
}
