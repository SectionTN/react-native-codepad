import Foundation
import XCTest

@testable import Codepad

final class SearchControllerTests: XCTestCase {
  /// Collects what the worker posts to the main thread; the test delivers it by hand.
  private final class Mailbox: @unchecked Sendable {
    private let lock = NSLock()
    private var queue: [@Sendable () -> Void] = []

    func post(_ block: @escaping @Sendable () -> Void) {
      lock.withLock { queue.append(block) }
    }

    func drain() {
      while let next = lock.withLock({ queue.isEmpty ? nil : queue.removeFirst() }) { next() }
    }
  }

  private let queue = DispatchQueue(label: "codepad-search-test")
  private let main = Mailbox()
  private let core = EditorCore("ab ab ab")
  private lazy var controller = SearchController(core: core, queue: queue, postToMain: { [main] in main.post($0) })

  /// Waits for the worker, then delivers what it posted.
  private func settle() {
    queue.sync {}
    main.drain()
  }

  func testSetQueryAcceptsMatchesForTheCurrentRevision() throws {
    try controller.setQuery(SearchQuery(text: "ab"))
    XCTAssertTrue(core.searchStale)
    settle()
    XCTAssertFalse(core.searchStale)
    XCTAssertEqual(controller.matchesForPaint(), [0, 2, 3, 5, 6, 8])
    XCTAssertEqual(core.matchCount, 3)
  }

  func testWhenFreshQueuesUntilTheResultLands() throws {
    var ran = 0
    controller.whenFresh { ran += 1 }
    XCTAssertEqual(ran, 1, "nothing stale runs at once")
    try controller.setQuery(SearchQuery(text: "ab"))
    controller.whenFresh { ran += 1 }
    XCTAssertEqual(ran, 1)
    settle()
    XCTAssertEqual(ran, 2)
    controller.whenFresh { ran += 1 }
    XCTAssertEqual(ran, 3, "a settled query runs at once")
  }

  func testAStaleResultIsDroppedAndTheContinuationWaits() throws {
    try controller.setQuery(SearchQuery(text: "ab"))
    queue.sync {}
    let change = core.replace(0, 0, "x")
    // Held until resume, so the second job cannot land before the stale first result is delivered.
    queue.suspend()
    controller.onChange(change)
    var ran = 0
    controller.whenFresh { ran += 1 }
    main.drain()
    XCTAssertTrue(core.searchStale)
    XCTAssertEqual(ran, 0)
    queue.resume()
    settle()
    XCTAssertFalse(core.searchStale)
    XCTAssertEqual(ran, 1)
    XCTAssertEqual(controller.matchesForPaint(), [1, 3, 4, 6, 7, 9])
  }

  func testDisplayedMatchesShiftThroughAnEdit() throws {
    try controller.setQuery(SearchQuery(text: "ab"))
    settle()
    let change = core.replace(2, 2, "zz")
    controller.onChange(change)
    XCTAssertEqual(controller.matchesForPaint(), [0, 2, 5, 7, 8, 10])
  }

  func testClearingTheQueryDropsEverything() throws {
    try controller.setQuery(SearchQuery(text: "ab"))
    settle()
    try controller.setQuery(nil)
    XCTAssertFalse(controller.active)
    XCTAssertEqual(controller.matchesForPaint().count, 0)
  }

  func testCloseSettlesPendingContinuations() throws {
    try controller.setQuery(SearchQuery(text: "ab"))
    var ran = 0
    controller.whenFresh { ran += 1 }
    controller.close()
    XCTAssertEqual(ran, 1)
    settle()
    XCTAssertEqual(ran, 1)
  }

  func testAnInvalidRegexThrowsAndClears() {
    XCTAssertThrowsError(try controller.setQuery(SearchQuery(text: "(", regex: true)))
    XCTAssertFalse(controller.active)
  }
}
