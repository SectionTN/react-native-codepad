import XCTest

@testable import Codepad

final class LayoutCacheTests: XCTestCase {
  func testEvictsTheLeastRecentlyUsedEntry() {
    let c = LayoutCache<String>(capacity: 2)
    c.put(0, "a")
    c.put(1, "b")
    _ = c[0]
    c.put(2, "c")
    XCTAssertNil(c[1])
    XCTAssertEqual(c[0], "a")
    XCTAssertEqual(c[2], "c")
    XCTAssertEqual(c.size, 2)
  }

  func testShiftDropsChangedLinesAndMovesTheRest() {
    let c = LayoutCache<String>(capacity: 10)
    for i in 0..<6 { c.put(i, "l\(i)") }
    c.shift(first: 2, oldCount: 1, newCount: 3)
    XCTAssertEqual(c[1], "l1")
    XCTAssertNil(c[2])
    XCTAssertNil(c[3])
    XCTAssertNil(c[4])
    XCTAssertEqual(c[5], "l3")
    XCTAssertEqual(c[7], "l5")
    XCTAssertEqual(c.size, 5)
    c.shift(first: 0, oldCount: 2, newCount: 1)
    XCTAssertNil(c[0])
    XCTAssertEqual(c[4], "l3")
    XCTAssertEqual(c[6], "l5")
    XCTAssertEqual(c.size, 3)
  }

  func testCapacityChangeTrims() {
    let c = LayoutCache<String>(capacity: 4)
    for i in 0..<4 { c.put(i, "x") }
    c.capacity = 2
    XCTAssertEqual(c.size, 2)
    XCTAssertNil(c[0])
    XCTAssertEqual(c[3], "x")
  }
}
