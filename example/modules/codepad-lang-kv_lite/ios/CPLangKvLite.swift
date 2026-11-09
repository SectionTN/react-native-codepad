import Foundation
import Codepad

@objc(CPLangKvLite)
public final class CPLangKvLite: NSObject, CPLanguageProvider {
  public let id: String = "kv_lite"
  public var languagePointer: UnsafeRawPointer { UnsafeRawPointer(tree_sitter_kv_lite()) }
  public let highlights: String = #"""
(key) @property

"=" @operator

(string) @string

(number) @number

(boolean) @boolean

(comment) @comment

"""#
  public let injections: String = #"""

"""#
}
