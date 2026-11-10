import Foundation

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// Capture names interned by the core into small ints shared by every language. Names are cached here.
enum StyleTable {
  private final class Names: @unchecked Sendable {
    let lock = NSLock()
    var byId: [Int: String] = [:]
  }

  private static let names = Names()

  static func id(_ name: String) -> Int { Int(cp_style_id(name)) }

  static func name(_ id: Int) -> String {
    if let cached = names.lock.withLock({ names.byId[id] }) { return cached }
    var buffer = [CChar](repeating: 0, count: 128)
    let length = Int(cp_style_name(Int32(id), &buffer, 128))
    if length >= 128 {
      buffer = [CChar](repeating: 0, count: length + 1)
      _ = cp_style_name(Int32(id), &buffer, UInt32(length + 1))
    }
    let name = String(cString: buffer)
    names.lock.withLock { names.byId[id] = name }
    return name
  }
}
