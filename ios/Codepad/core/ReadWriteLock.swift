import Foundation

/// A pthread_rwlock_t kept on the heap: a lock stored inline in a Swift object could be moved by the runtime.
public final class ReadWriteLock: @unchecked Sendable {
  private let lock: UnsafeMutablePointer<pthread_rwlock_t>

  public init() {
    lock = .allocate(capacity: 1)
    lock.initialize(to: pthread_rwlock_t())
    pthread_rwlock_init(lock, nil)
  }

  deinit {
    pthread_rwlock_destroy(lock)
    lock.deinitialize(count: 1)
    lock.deallocate()
  }

  public func read<T>(_ body: () throws -> T) rethrows -> T {
    pthread_rwlock_rdlock(lock)
    defer { pthread_rwlock_unlock(lock) }
    return try body()
  }

  public func write<T>(_ body: () throws -> T) rethrows -> T {
    pthread_rwlock_wrlock(lock)
    defer { pthread_rwlock_unlock(lock) }
    return try body()
  }
}
