import Foundation
import os

final class CompiledQuery: @unchecked Sendable {
  let query: Query
  let evaluator: PredicateEvaluator
  let styleIds: [Int]
  let captureIndex: [String: Int]

  init(query: Query, evaluator: PredicateEvaluator) {
    self.query = query
    self.evaluator = evaluator
    styleIds = query.captureNames.map { StyleTable.id($0) }
    var index: [String: Int] = [:]
    for (i, name) in query.captureNames.enumerated() { index[name] = i }
    captureIndex = index
  }
}

final class LoadedLanguage: @unchecked Sendable {
  let id: String
  let pointer: OpaquePointer
  let highlights: CompiledQuery
  let injections: CompiledQuery?

  init(id: String, pointer: OpaquePointer, highlights: CompiledQuery, injections: CompiledQuery?) {
    self.id = id
    self.pointer = pointer
    self.highlights = highlights
    self.injections = injections
  }
}

enum LanguageRegistry {
  private final class State: @unchecked Sendable {
    let lock = NSLock()
    var providers: [String: any CPLanguageProvider] = [:]
    var cache: [String: LoadedLanguage?] = [:]
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
    "console": "", "text": "", "txt": "", "plain": "", "regex": "", "jsdoc": "", "comment": "", "luap": "",
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

  /// Lowercases a fence or query name and maps it through the aliases; nil means never inject, unknown names pass through.
  static func canonicalInjectionId(_ name: String) -> String? {
    let lower = name.lowercased()
    guard let mapped = aliases[lower] else { return lower }
    return mapped.isEmpty ? nil : mapped
  }

  static func resolveInjection(_ name: String) -> LoadedLanguage? {
    canonicalInjectionId(name).flatMap { resolve($0) }
  }

  private static func load(_ id: String, _ registered: (any CPLanguageProvider)?) -> LoadedLanguage? {
    guard let provider = registered ?? reflect(id) else {
      log.warning("language \(id, privacy: .public) is not installed, falling back to plain text")
      return nil
    }
    let pointer = OpaquePointer(provider.languagePointer)
    let abi = TreeSitterRuntime.abiVersion(of: pointer)
    let range = TreeSitterRuntime.abiRange
    guard range.contains(abi) else {
      log.warning("language \(id, privacy: .public) has ABI \(abi), runtime supports \(range.lowerBound) to \(range.upperBound)")
      return nil
    }
    guard let highlights = compile(pointer, provider.highlights, "\(id) highlights") else { return nil }
    let injectionSource = provider.injections
    let blank = injectionSource.allSatisfy { $0.isWhitespace }
    let injections = blank ? nil : compile(pointer, injectionSource, "\(id) injections")
    return LoadedLanguage(id: id, pointer: pointer, highlights: highlights, injections: injections)
  }

  private static func compile(_ pointer: OpaquePointer, _ source: String, _ label: String) -> CompiledQuery? {
    do {
      let query = try Query.compile(pointer, source)
      return CompiledQuery(query: query, evaluator: PredicateEvaluator(query: query))
    } catch {
      log.warning("\(label, privacy: .public) query failed to compile: \(String(describing: error), privacy: .public)")
      return nil
    }
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
