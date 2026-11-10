import CodepadCore
import Foundation
import XCTest

@testable import Codepad

/// Languages, styles and predicates of the C++ core, driven through its C API.
final class CoreLanguageTests: XCTestCase {
  private func load(_ id: String, _ pointer: UnsafeRawPointer?, _ highlights: String, _ injections: String = "")
    -> (OpaquePointer?, String)
  {
    var error = [CChar](repeating: 0, count: 512)
    let h = Array(highlights.utf8)
    let i = Array(injections.utf8)
    let language = h.withUnsafeBufferPointer { hb in
      i.withUnsafeBufferPointer { ib in
        hb.withMemoryRebound(to: CChar.self) { hc in
          ib.withMemoryRebound(to: CChar.self) { ic in
            cp_language_load(id, pointer, hc.baseAddress, UInt32(hc.count), ic.baseAddress, UInt32(ic.count), &error, 512)
          }
        }
      }
    }
    return (language, String(cString: error))
  }

  private func javascript() throws -> OpaquePointer {
    try XCTUnwrap(HostGrammars.language(named: "javascript"))
  }

  /// How many matches of query over source pass their predicates, with the javascript grammar.
  private func accepted(_ query: String, _ source: String) throws -> Int32 {
    let (language, error) = load("javascript", UnsafeRawPointer(try javascript()), "(comment) @comment")
    let lang = try XCTUnwrap(language, error)
    var message = [CChar](repeating: 0, count: 512)
    let q = Array(query.utf8)
    let s = Array(source.utf16)
    let count = q.withUnsafeBufferPointer { qb in
      qb.withMemoryRebound(to: CChar.self) { qc in
        cp_test_predicate(lang, qc.baseAddress, UInt32(qc.count), s, UInt32(s.count), &message, 512)
      }
    }
    XCTAssertGreaterThanOrEqual(count, 0, String(cString: message))
    return count
  }

  func testEveryHostLanguageLoads() throws {
    let packages = HostLanguages.packages()
    XCTAssertTrue(packages.contains { $0.grammar == "kv_lite" })
    for (id, grammar) in packages {
      let dir = (FileManager.default.fileExists(atPath: HostLanguages.languagesDir.appendingPathComponent(id).path)
        ? HostLanguages.languagesDir : HostLanguages.modulesDir)
        .appendingPathComponent(id).appendingPathComponent("queries").appendingPathComponent(grammar)
      let highlights = try String(contentsOf: dir.appendingPathComponent("highlights.scm"), encoding: .utf8)
      let injections = (try? String(contentsOf: dir.appendingPathComponent("injections.scm"), encoding: .utf8)) ?? ""
      let pointer = try XCTUnwrap(HostGrammars.language(named: grammar))
      let (language, error) = load(grammar, UnsafeRawPointer(pointer), highlights, injections)
      XCTAssertNotNil(language, "\(grammar): \(error)")
      XCTAssertEqual(error, "", grammar)
      if let language { XCTAssertEqual(String(cString: cp_language_id(language)), grammar) }
    }
  }

  func testAbiOutsideRangeIsRefused() {
    // A TSLanguage starts with its ABI version; nothing else may be read once the check fails.
    let fake = UnsafeMutableRawPointer.allocate(byteCount: 4096, alignment: 16)
    defer { fake.deallocate() }
    fake.initializeMemory(as: UInt8.self, repeating: 0, count: 4096)
    fake.storeBytes(of: UInt32(cp_abi_max() + 1), as: UInt32.self)
    let (language, error) = load("future", UnsafeRawPointer(fake), "(comment) @comment")
    XCTAssertNil(language)
    XCTAssertTrue(error.contains("future"), error)
    XCTAssertTrue(error.contains("ABI"), error)
  }

  func testBadQueryNamesTheLanguage() throws {
    let (language, error) = load("javascript", UnsafeRawPointer(try javascript()), "((identifier) @x (#match? @x \"(\"))")
    XCTAssertNil(language)
    XCTAssertTrue(error.contains("javascript"), error)
    XCTAssertTrue(error.contains("match?"), error)
  }

  func testUnknownPredicatePassesLikeTheNativeEngines() throws {
    XCTAssertEqual(try accepted("((identifier) @x (#lua-match? @x \"^a\"))", "a; b;"), 2)
  }

  func testStyleIdsRoundTrip() {
    let id = cp_style_id("keyword.function")
    XCTAssertEqual(cp_style_id("keyword.function"), id)
    var name = [CChar](repeating: 0, count: 64)
    XCTAssertEqual(cp_style_name(id, &name, 64), UInt32("keyword.function".utf8.count))
    XCTAssertEqual(String(cString: name), "keyword.function")
    var short = [CChar](repeating: 0, count: 4)
    XCTAssertEqual(cp_style_name(id, &short, 4), UInt32("keyword.function".utf8.count))
  }

  func testEqAgainstAStringAndAnotherCapture() throws {
    XCTAssertEqual(try accepted("((identifier) @x (#eq? @x \"foo\"))", "foo; bar; foo;"), 2)
    XCTAssertEqual(try accepted("((identifier) @x (#not-eq? @x \"foo\"))", "foo; bar; foo;"), 1)
    let pair = "((assignment_expression left: (identifier) @a right: (identifier) @b) (#eq? @a @b))"
    XCTAssertEqual(try accepted(pair, "a = a; a = b;"), 1)
  }

  func testMatchIsAnUnanchoredSearch() throws {
    XCTAssertEqual(try accepted("((identifier) @x (#match? @x \"^[A-Z][A-Z_0-9]*$\"))", "FOO; Bar; BAZ_1;"), 2)
    XCTAssertEqual(try accepted("((identifier) @x (#match? @x \"ar\"))", "FOO; Bar; BAZ_1;"), 1)
    XCTAssertEqual(try accepted("((identifier) @x (#not-match? @x \"^[A-Z]\"))", "FOO; bar;"), 1)
  }

  func testAnyOfAndContains() throws {
    XCTAssertEqual(try accepted("((identifier) @x (#any-of? @x \"foo\" \"bar\"))", "foo; bar; baz;"), 2)
    XCTAssertEqual(try accepted("((identifier) @x (#contains? @x \"oo\" \"zz\"))", "foo; bar; boot;"), 2)
  }

  func testAnyFormsTestOneNodeInsteadOfAll() throws {
    // One capture name on both numbers: one match per two-number array, carrying two nodes.
    let pair = "(array . (number) @n . (number) @n .)"
    XCTAssertEqual(try accepted("(\(pair) (#match? @n \"^7$\"))", "[7, 7]; [1, 7]; [1, 2];"), 1)
    XCTAssertEqual(try accepted("(\(pair) (#any-match? @n \"^7$\"))", "[7, 7]; [1, 7]; [1, 2];"), 2)
  }

  func testParentAndAncestor() throws {
    XCTAssertEqual(try accepted("((identifier) @x (#has-parent? @x variable_declarator))", "let a = b; c;"), 2)
    XCTAssertEqual(try accepted("((identifier) @x (#not-has-parent? @x variable_declarator))", "let a = b; c;"), 1)
    XCTAssertEqual(try accepted("((identifier) @x (#has-ancestor? @x lexical_declaration))", "let a = b; c;"), 2)
  }

  func testMatchCountsCodePointsNotUnits() throws {
    XCTAssertEqual(try accepted("((string_fragment) @s (#match? @s \"^.{3}$\"))", "\"😀ab\";"), 1)
    XCTAssertEqual(try accepted("((string_fragment) @s (#match? @s \"^.{4}$\"))", "\"😀ab\";"), 0)
    XCTAssertEqual(try accepted("((string_fragment) @s (#match? @s \"^.{5}$\"))", "\"مرحبا\";"), 1)
  }

  func testDotStopsAtACarriageReturnLikeIcu() throws {
    XCTAssertEqual(try accepted("((template_string) @t (#match? @t \"^.a.b.$\"))", "`a\rb`;"), 0)
    XCTAssertEqual(try accepted("((template_string) @t (#match? @t \"^.a.b.$\"))", "`a-b`;"), 1)
  }
}
