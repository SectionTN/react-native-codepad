import Foundation

/// Laid out lines for the viewport plus a margin, least recently used first out. Keys are line indexes.
final class LayoutCache<T> {
  private var map: [Int: T] = [:]
  private var order: [Int] = []

  var capacity: Int {
    didSet { trim() }
  }

  init(capacity: Int) {
    self.capacity = capacity
  }

  var size: Int { map.count }

  subscript(line: Int) -> T? {
    guard let value = map[line] else { return nil }
    touch(line)
    return value
  }

  func put(_ line: Int, _ value: T) {
    if map[line] == nil { order.append(line) } else { touch(line) }
    map[line] = value
    trim()
  }

  func clear() {
    map.removeAll()
    order.removeAll()
  }

  /// Lines [first, first + oldCount) changed. Their entries drop and later entries move with their text.
  func shift(first: Int, oldCount: Int, newCount: Int) {
    if map.isEmpty { return }
    let delta = newCount - oldCount
    var kept: [(Int, T)] = []
    for line in order {
      guard let value = map[line] else { continue }
      if line < first {
        kept.append((line, value))
      } else if line >= first + oldCount {
        kept.append((line + delta, value))
      }
    }
    clear()
    for (line, value) in kept {
      map[line] = value
      order.append(line)
    }
  }

  private func touch(_ line: Int) {
    if let i = order.firstIndex(of: line) {
      order.remove(at: i)
      order.append(line)
    }
  }

  private func trim() {
    while map.count > capacity, let oldest = order.first {
      order.removeFirst()
      map[oldest] = nil
    }
  }
}
