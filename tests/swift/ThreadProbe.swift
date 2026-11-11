import Foundation

/// Runs a reader loop on another thread until stopped, keeping the first problem it reports.
final class ThreadProbe: @unchecked Sendable {
  private let lock = NSLock()
  private var stopped = false
  private var problem: String?
  private let done = DispatchSemaphore(value: 0)
  private var readers = 0

  var failure: String? { lock.withLock { problem } }

  func start(_ read: @escaping @Sendable () -> String?) {
    readers += 1
    DispatchQueue.global(qos: .userInitiated).async { [self] in
      defer { done.signal() }
      while !lock.withLock({ stopped }) {
        if let found = read() {
          lock.withLock { if problem == nil { problem = found } }
          return
        }
      }
    }
  }

  func stop() {
    lock.withLock { stopped = true }
    for _ in 0..<readers { done.wait() }
  }
}
