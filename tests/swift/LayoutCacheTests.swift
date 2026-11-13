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

  // The draw lists the cache for the frame call before it lays anything out. A listing that refreshed the order
  // would evict the lines just drawn instead of the stale ones.
  func testForEachEntryLeavesTheEvictionOrder() {
    let c = LayoutCache<String>(capacity: 8)
    for i in 0..<8 { c.put(i, "l\(i)") }
    _ = c[0]
    var seen: [Int: String] = [:]
    c.forEachEntry { line, value in seen[line] = value }
    XCTAssertEqual(seen, Dictionary(uniqueKeysWithValues: (0..<8).map { ($0, "l\($0)") }))
    c.put(8, "l8")
    c.put(9, "l9")
    XCTAssertNil(c[1])
    XCTAssertNil(c[2])
    XCTAssertEqual(c[0], "l0")
    XCTAssertEqual(c[3], "l3")
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
