import XCTest

@testable import Codepad

final class KeyboardInsetTests: XCTestCase {
  func testOverlapIsTheViewBandUnderTheKeyboard() {
    XCTAssertEqual(KeyboardInset.overlap(viewBottomInWindow: 800, windowHeight: 900, keyboardTop: 600), 200)
    XCTAssertEqual(KeyboardInset.overlap(viewBottomInWindow: 800, windowHeight: 900, keyboardTop: 850), 0)
    XCTAssertEqual(KeyboardInset.overlap(viewBottomInWindow: 800, windowHeight: 900, keyboardTop: 950), 0)
    XCTAssertEqual(KeyboardInset.overlap(viewBottomInWindow: 900, windowHeight: 900, keyboardTop: 600), 300)
    XCTAssertEqual(KeyboardInset.overlap(viewBottomInWindow: 500, windowHeight: 900, keyboardTop: 900), 0)
    // A keyboard frame below the window counts as the window bottom.
    XCTAssertEqual(KeyboardInset.overlap(viewBottomInWindow: 950, windowHeight: 900, keyboardTop: 1200), 50)
  }
}
