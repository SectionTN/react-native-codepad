import CodepadCore
import Foundation
import XCTest

/// The core's generated Unicode tables against unicode.org's own conformance data.
final class CoreUnicodeTests: XCTestCase {
  private static let version = "16.0.0"

  private func source(_ name: String) throws -> String {
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    let url = root.appendingPathComponent("scripts/unicode/\(Self.version)/\(name)")
    return try String(contentsOf: url, encoding: .utf8)
  }

  private func breaks(_ units: [UInt16], backward: Bool = false) -> [UInt32] {
    var out = [UInt32](repeating: 0, count: units.count + 2)
    let n = units.withUnsafeBufferPointer { buffer in
      backward
        ? cp_test_grapheme_breaks_backward(buffer.baseAddress, UInt32(buffer.count), &out, UInt32(out.count))
        : cp_test_grapheme_breaks(buffer.baseAddress, UInt32(buffer.count), &out, UInt32(out.count))
    }
    return Array(out.prefix(Int(n)))
  }

  func testGraphemeBreakConformance() throws {
    try conformance(backward: false)
  }

  // Backspace and left arrow step back from the end, through the safe start scan instead of the forward rules.
  func testBackwardBreaksMatchConformance() throws {
    try conformance(backward: true)
  }

  private func conformance(backward: Bool) throws {
    var checked = 0
    for raw in try source("GraphemeBreakTest.txt").split(separator: "\n") {
      let line = raw.split(separator: "#", maxSplits: 1, omittingEmptySubsequences: false)[0].trimmingCharacters(in: .whitespaces)
      if line.isEmpty { continue }
      var units: [UInt16] = []
      var expected: [UInt32] = []
      for token in line.split(separator: " ") {
        if token == "÷" {
          expected.append(UInt32(units.count))
        } else if token != "×" {
          let value = try XCTUnwrap(UInt32(token, radix: 16))
          if value > 0xFFFF {
            let v = value - 0x10000
            units.append(UInt16(0xD800 + (v >> 10)))
            units.append(UInt16(0xDC00 + (v & 0x3FF)))
          } else {
            units.append(UInt16(value))
          }
        }
      }
      XCTAssertEqual(breaks(units, backward: backward), backward ? expected.reversed() : expected, line)
      checked += 1
    }
    XCTAssertGreaterThan(checked, 1000)
  }

  func testWhiteSpaceSamples() {
    var yes: [UInt32] = [0x20, 0x85, 0xA0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000]
    yes += Array(0x9...0xD) + Array(0x2000...0x200A)
    for c in yes { XCTAssertEqual(cp_test_white_space(c), 1, String(c, radix: 16)) }
    for c: UInt32 in [0x1C, 0x1D, 0x1E, 0x1F, 0x200B, 0xFEFF, 0x41] { XCTAssertEqual(cp_test_white_space(c), 0, String(c, radix: 16)) }
  }
}
