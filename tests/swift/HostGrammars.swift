import CodepadHostGrammars
import Foundation

/// The grammars the package links for the tests, by the id the language packages use.
enum HostGrammars {
  private static let table: [String: @Sendable () -> UnsafeRawPointer?] = [
    "c": { tree_sitter_c() },
    "css": { tree_sitter_css() },
    "dtd": { tree_sitter_dtd() },
    "go": { tree_sitter_go() },
    "html": { tree_sitter_html() },
    "ini": { tree_sitter_ini() },
    "java": { tree_sitter_java() },
    "javascript": { tree_sitter_javascript() },
    "json": { tree_sitter_json() },
    "kotlin": { tree_sitter_kotlin() },
    "kv_lite": { tree_sitter_kv_lite() },
    "markdown": { tree_sitter_markdown() },
    "markdown_inline": { tree_sitter_markdown_inline() },
    "php": { tree_sitter_php() },
    "php_only": { tree_sitter_php_only() },
    "python": { tree_sitter_python() },
    "rust": { tree_sitter_rust() },
    "sql": { tree_sitter_sql() },
    "swift": { tree_sitter_swift() },
    "tsx": { tree_sitter_tsx() },
    "typescript": { tree_sitter_typescript() },
    "xml": { tree_sitter_xml() },
    "yaml": { tree_sitter_yaml() },
  ]

  static var names: [String] { table.keys.sorted() }

  static func language(named name: String) -> OpaquePointer? {
    table[name]?().map { OpaquePointer($0) }
  }

  static func javascript() -> OpaquePointer {
    language(named: "javascript")!
  }
}
