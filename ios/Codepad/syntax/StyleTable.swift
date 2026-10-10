import Foundation

/// Interns capture names into small ints shared by every query so span arrays stay plain ints.
enum StyleTable {
  private final class Table: @unchecked Sendable {
    let lock = NSLock()
    var ids: [String: Int] = [:]
    var names: [String] = []
  }

  private static let table = Table()

  static func id(_ name: String) -> Int {
    table.lock.withLock {
      if let id = table.ids[name] { return id }
      table.names.append(name)
      let id = table.names.count - 1
      table.ids[name] = id
      return id
    }
  }

  static func name(_ id: Int) -> String {
    table.lock.withLock { table.names[id] }
  }
}
