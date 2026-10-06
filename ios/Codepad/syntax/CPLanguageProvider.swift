import Foundation

/// A generated language package registers one of these; the registry looks it up by class name.
@objc public protocol CPLanguageProvider: NSObjectProtocol {
  var id: String { get }
  var languagePointer: UnsafeRawPointer { get }
  var highlights: String { get }
  var injections: String { get }
}
