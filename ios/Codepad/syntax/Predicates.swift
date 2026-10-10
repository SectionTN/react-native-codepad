import Foundation

struct CaptureNode {
  let captureIndex: Int
  let node: Node
}

/// An offset! directive: row and column deltas for the start and end of one capture.
struct Offset {
  let captureIndex: Int
  let startRow: Int
  let startColumn: Int
  let endRow: Int
  let endColumn: Int
}

/// Evaluates a pattern's predicate steps against one match. The C runtime only hands out the steps.
final class PredicateEvaluator: @unchecked Sendable {
  private struct Pred {
    let name: String
    let negate: Bool
    let any: Bool
    let args: [(Int, Int)]
  }

  static let done = 0
  static let capture = 1
  static let string = 2

  private let query: Query
  private let byPattern: [[Pred]]
  private let settingsByPattern: [[String: String]]
  private let offsetByPattern: [Offset?]
  private let regexLock = NSLock()
  private var regexCache: [String: NSRegularExpression?] = [:]

  init(query: Query) {
    self.query = query
    let patterns = (0..<query.patternCount).map { PredicateEvaluator.parse(query.predicates($0), query) }
    byPattern = patterns
    settingsByPattern = patterns.map { preds in
      var out: [String: String] = [:]
      for p in preds where p.name == "set!" {
        let strings = p.args.filter { $0.0 == PredicateEvaluator.string }.map { query.stringValues[$0.1] }
        if let key = strings.first { out[key] = strings.count > 1 ? strings[1] : "true" }
      }
      return out
    }
    offsetByPattern = patterns.map { preds in
      guard let p = preds.first(where: { $0.name == "offset!" }),
        let capture = p.args.first(where: { $0.0 == PredicateEvaluator.capture })?.1
      else { return nil }
      let ints = p.args.filter { $0.0 == PredicateEvaluator.string }.map { Int(query.stringValues[$0.1]) }
      guard ints.count >= 4, let a = ints[0], let b = ints[1], let c = ints[2], let d = ints[3] else { return nil }
      return Offset(captureIndex: capture, startRow: a, startColumn: b, endRow: c, endColumn: d)
    }
  }

  func settings(_ pattern: Int) -> [String: String] {
    settingsByPattern[pattern]
  }

  func offset(_ pattern: Int) -> Offset? {
    offsetByPattern[pattern]
  }

  func hasPredicates(_ pattern: Int) -> Bool {
    byPattern[pattern].contains { !$0.name.hasSuffix("!") }
  }

  /// `text` reads node text from whatever copy of the document is consistent with the tree.
  func matches(_ pattern: Int, captures: [CaptureNode], text: (Node) -> String) -> Bool {
    for p in byPattern[pattern] where !p.name.hasSuffix("!") {
      if !eval(p, captures, text) { return false }
    }
    return true
  }

  private func eval(_ p: Pred, _ captures: [CaptureNode], _ text: (Node) -> String) -> Bool {
    guard let capture = p.args.first(where: { $0.0 == PredicateEvaluator.capture }) else { return true }
    let nodes = captures.filter { $0.captureIndex == capture.1 }.map { $0.node }
    let strings = p.args.filter { $0.0 == PredicateEvaluator.string }.map { query.stringValues[$0.1] }
    let other = p.args.dropFirst().first { $0.0 == PredicateEvaluator.capture }
    var base = true
    if !nodes.isEmpty {
      base = withoutActuallyEscaping(text) { text -> Bool in
        let test: (Node) -> Bool
        switch p.name {
        case "eq?":
          test = { n in
            let expected: String?
            if let other {
              expected = captures.first { $0.captureIndex == other.1 }.map { text($0.node) }
            } else {
              expected = strings.first
            }
            return expected != nil && text(n) == expected
          }
        case "match?":
          test = { n in
            guard let s = strings.first, let regex = self.regex(s) else { return false }
            let t = text(n)
            return regex.firstMatch(in: t, range: NSRange(location: 0, length: (t as NSString).length)) != nil
          }
        case "any-of?":
          test = { n in strings.contains(text(n)) }
        case "contains?":
          test = { n in
            let t = text(n)
            return strings.contains { t.contains($0) }
          }
        case "has-parent?":
          test = { n in
            let parent = n.parent
            return !parent.isNull && strings.contains(parent.type)
          }
        case "has-ancestor?":
          test = { n in
            var a = n.parent
            while !a.isNull {
              if strings.contains(a.type) { return true }
              a = a.parent
            }
            return false
          }
        default:
          test = { _ in true }
        }
        return p.any ? nodes.contains(where: test) : nodes.allSatisfy(test)
      }
    }
    return p.negate ? !base : base
  }

  private func regex(_ pattern: String) -> NSRegularExpression? {
    regexLock.withLock {
      if let cached = regexCache[pattern] { return cached }
      let compiled = try? NSRegularExpression(pattern: pattern)
      regexCache[pattern] = .some(compiled)
      return compiled
    }
  }

  private static func parse(_ steps: [Int], _ query: Query) -> [Pred] {
    var out: [Pred] = []
    var i = 0
    while i < steps.count {
      var j = i
      while j < steps.count && steps[j] != done { j += 2 }
      if steps[i] == string {
        let rawName = query.stringValues[steps[i + 1]]
        var name = rawName
        let negate = name.hasPrefix("not-")
        if negate { name.removeFirst(4) }
        let any = name.hasPrefix("any-") && name != "any-of?"
        if any { name.removeFirst(4) }
        var args: [(Int, Int)] = []
        var k = i + 2
        while k < j {
          args.append((steps[k], steps[k + 1]))
          k += 2
        }
        out.append(Pred(name: rawName.hasSuffix("!") ? rawName : name, negate: negate, any: any, args: args))
      }
      i = j + 2
    }
    return out
  }
}
