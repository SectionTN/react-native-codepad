import XCTest

@testable import Codepad

final class FontFaceTests: XCTestCase {
  func testThePickTakesTheUprightFaceClosestToRegular() {
    XCTAssertEqual(
      FontFace.regular(of: ["Menlo-BoldItalic", "Menlo-Bold", "Menlo-Italic", "Menlo-Regular"]), "Menlo-Regular")
    XCTAssertEqual(FontFace.regular(of: ["Menlo-Italic", "Menlo-BoldItalic"]), "Menlo-Italic")
    XCTAssertNil(FontFace.regular(of: []))
  }

  // AlgoTN's three faces. Without JetBrains Mono on the host, only the names tell the weights apart.
  func testThePickReadsTheWeightFromTheNameFirst() {
    XCTAssertEqual(
      FontFace.regular(of: ["JetBrainsMono-SemiBold", "JetBrainsMono-Medium", "JetBrainsMono-Regular"]),
      "JetBrainsMono-Regular")
  }
}
