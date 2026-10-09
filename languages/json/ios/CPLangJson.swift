import Foundation
import Codepad

@objc(CPLangJson)
public final class CPLangJson: NSObject, CPLanguageProvider {
  public let id: String = "json"
  public var languagePointer: UnsafeRawPointer { UnsafeRawPointer(tree_sitter_json()) }
  public let highlights: String = #"""
[
  (true)
  (false)
] @boolean

(null) @constant.builtin

(number) @number

(pair
  key: (string) @property)

(pair
  value: (string) @string)

(array
  (string) @string)

[
  ","
  ":"
] @punctuation.delimiter

[
  "["
  "]"
  "{"
  "}"
] @punctuation.bracket

("\"" @conceal
  (#set! conceal ""))

(escape_sequence) @string.escape

((escape_sequence) @conceal
  (#eq? @conceal "\\\"")
  (#set! conceal "\""))

(comment) @comment @spell

"""#
  public let injections: String = #"""
((comment) @injection.content
  (#set! injection.language "comment"))

"""#
}
