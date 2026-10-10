import CoreGraphics
import XCTest

@testable import Codepad

final class ThemeColorsTests: XCTestCase {
  private func rgba(_ color: CGColor?) -> [Double]? {
    color?.components?.map { (Double($0) * 1000).rounded() / 1000 }
  }

  func testParsesCssColors() {
    XCTAssertEqual(rgba(ThemeColors.parse(css: "#fff")), [1, 1, 1, 1])
    XCTAssertEqual(rgba(ThemeColors.parse(css: "#112233")), [0.067, 0.133, 0.2, 1])
    XCTAssertEqual(rgba(ThemeColors.parse(css: "#ff000080")), [1, 0, 0, 0.502])
    XCTAssertEqual(rgba(ThemeColors.parse(css: "rgb(0, 0, 255)")), [0, 0, 1, 1])
    XCTAssertEqual(rgba(ThemeColors.parse(css: "rgba(0,0,255,0.5)")), [0, 0, 1, 0.5])
    XCTAssertNil(ThemeColors.parse(css: "nonsense"))
  }

  func testLooksUpTheLongestDottedPrefix() {
    let red = TokenStyle(color: ThemeColors.parse(css: "#ff0000")!, bold: false, italic: false)
    let theme = ThemeColors.default.withTokens(["keyword": red])
    XCTAssertEqual(theme.styleFor(StyleTable.id("keyword.function.method")), red)
    XCTAssertEqual(theme.styleFor(StyleTable.id("keyword")), red)
    XCTAssertNil(theme.styleFor(StyleTable.id("string")))
  }
}
