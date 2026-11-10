import Foundation
import os

#if canImport(CodepadCore)
  import CodepadCore
#endif

/// A language loaded into the core. The core keeps it for the life of the process.
final class LoadedLanguage: @unchecked Sendable {
  let id: String
  let handle: OpaquePointer

  init(id: String, handle: OpaquePointer) {
    self.id = id
    self.handle = handle
  }
}

enum LanguageRegistry {
  private final class State: @unchecked Sendable {
    let lock = NSLock()
    var providers: [String: any CPLanguageProvider] = [:]
    var cache: [String: LoadedLanguage?] = [:]
    var installed: [String: Bool] = [:]
    var byHandle: [OpaquePointer: LoadedLanguage] = [:]
  }

  /// The language a core handle was loaded as.
  static func loaded(_ handle: OpaquePointer) -> LoadedLanguage? {
    state.lock.withLock { state.byHandle[handle] }
  }

  private static let log = Logger(subsystem: "me.sectiontn.codepad", category: "syntax")
  private static let state = State()

  // Names nvim queries and fence info strings use for languages we ship under another id. Empty means never inject.
  private static let aliases: [String: String] = [
    "js": "javascript", "jsx": "javascript", "mjs": "javascript", "cjs": "javascript",
    "ts": "typescript", "mts": "typescript", "cts": "typescript",
    "py": "python", "python3": "python", "kt": "kotlin", "kts": "kotlin", "rs": "rust", "golang": "go",
    "yml": "yaml", "jsonc": "json", "json5": "json", "htm": "html", "xhtml": "html", "md": "markdown", "h": "c",
    "cpp": "", "c++": "", "cc": "", "hpp": "", "objc": "", "bash": "", "sh": "", "shell": "", "zsh": "",
    "console": "", "text": "", "txt": "", "plain": "", "regex": "", "jsdoc": "", "phpdoc": "", "comment": "", "luap": "",
    "printf": "", "styled": "", "angular": "", "groq": "", "graphql": "", "glimmer": "", "sql": "", "c_sharp": "",
  ]

  /// Explicit registration for tests and for grammars that do not follow the package naming.
  static func register(_ provider: any CPLanguageProvider) {
    state.lock.withLock {
      state.providers[provider.id] = provider
      state.cache[provider.id] = nil
    }
  }

  /// Loads once per id, failures included, so a missing language warns a single time.
  static func resolve(_ id: String) -> LoadedLanguage? {
    state.lock.withLock {
      if let cached = state.cache[id] { return cached }
      let loaded = load(id, state.providers[id])
      state.cache[id] = .some(loaded)
      return loaded
    }
  }

  /// Lowercases a fence or query name; an installed id wins over the aliases, nil means never inject.
  static func canonicalInjectionId(_ name: String) -> String? {
    let lower = name.lowercased()
    guard let mapped = aliases[lower] else { return lower }
    if isInstalled(lower) { return lower }
    return mapped.isEmpty ? nil : mapped
  }

  private static func isInstalled(_ id: String) -> Bool {
    state.lock.withLock {
      if state.providers[id] != nil { return true }
      if let known = state.installed[id] { return known }
      let found = reflect(id) != nil
      state.installed[id] = found
      return found
    }
  }

  static func resolveInjection(_ name: String) -> LoadedLanguage? {
    canonicalInjectionId(name).flatMap { resolve($0) }
  }

  private static func load(_ id: String, _ registered: (any CPLanguageProvider)?) -> LoadedLanguage? {
    guard let provider = registered ?? reflect(id) else {
      log.warning("language \(id, privacy: .public) is not installed, falling back to plain text")
      return nil
    }
    let highlights = Array(provider.highlights.utf8)
    let injections = provider.injections.allSatisfy { $0.isWhitespace } ? [] : Array(provider.injections.utf8)
    var error = [CChar](repeating: 0, count: 512)
    let handle = highlights.withUnsafeBufferPointer { h in
      injections.withUnsafeBufferPointer { i in
        h.withMemoryRebound(to: CChar.self) { hc in
          i.withMemoryRebound(to: CChar.self) { ic in
            cp_language_load(
              id, provider.languagePointer, hc.baseAddress, UInt32(hc.count), ic.baseAddress, UInt32(ic.count), &error, 512)
          }
        }
      }
    }
    let message = String(cString: error)
    guard let handle else {
      log.warning("\(message, privacy: .public)")
      return nil
    }
    // A broken injections query still loads the language, without injections.
    if !message.isEmpty { log.warning("\(message, privacy: .public)") }
    let language = LoadedLanguage(id: id, handle: handle)
    state.byHandle[handle] = language
    return language
  }

  /// A generated package ships CPLang<Pascal id> as an NSObject conforming to CPLanguageProvider.
  private static func reflect(_ id: String) -> (any CPLanguageProvider)? {
    let pascal = id.split(separator: "_").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined()
    guard let cls = NSClassFromString("CPLang" + pascal) as? NSObject.Type else { return nil }
    return cls.init() as? any CPLanguageProvider
  }
}

/// The linked language packages, found once by walking the Objective C class list for the CPLang classes.
enum LanguageScan {
  private static let ids: [String] = {
    let expected = objc_getClassList(nil, 0)
    let classes = UnsafeMutablePointer<AnyClass>.allocate(capacity: Int(expected))
    defer { classes.deallocate() }
    let count = Int(objc_getClassList(AutoreleasingUnsafeMutablePointer(classes), expected))
    var found: [String] = []
    for i in 0..<min(count, Int(expected)) {
      let cls: AnyClass = classes[i]
      guard strncmp(class_getName(cls), "CPLang", 6) == 0, class_conformsToProtocol(cls, CPLanguageProvider.self),
        let type = cls as? NSObject.Type, let provider = type.init() as? any CPLanguageProvider
      else { continue }
      found.append(provider.id)
    }
    return found.sorted()
  }()

  static func providerIds() -> [String] {
    ids
  }
}
