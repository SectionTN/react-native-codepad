import Foundation
import Codepad

@objc(CPLangIni)
public final class CPLangIni: NSObject, CPLanguageProvider {
  public let id: String = "ini"
  public var languagePointer: UnsafeRawPointer { UnsafeRawPointer(tree_sitter_ini()) }
  public let highlights: String = #"""
(section_name
  (text) @markup.heading)

(comment) @comment @spell

[
  "["
  "]"
] @punctuation.bracket

"=" @operator

(setting
  (setting_name) @property)

(setting_value) @string

"""#
  public let injections: String = #"""
((comment
  (text) @injection.content)
  (#set! injection.language "comment"))

"""#
}
