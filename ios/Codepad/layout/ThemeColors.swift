import CoreGraphics
import Foundation

struct TokenStyle: Equatable {
  let color: CGColor
  let bold: Bool
  let italic: Bool
}

protocol StyleResolver {
  func style(_ id: Int) -> TokenStyle?
}

/// The theme as CGColors in sRGB, with the longest dotted prefix lookup the token keys use.
final class ThemeColors: StyleResolver, @unchecked Sendable {
  let background: CGColor
  let foreground: CGColor
  let gutterBackground: CGColor
  let gutterForeground: CGColor
  let gutterActiveForeground: CGColor
  let activeLine: CGColor
  let selection: CGColor
  let cursor: CGColor
  let matchingBracket: CGColor
  let searchMatch: CGColor
  let searchMatchActive: CGColor
  private let tokens: [String: TokenStyle]
  private let lock = NSLock()
  private var cache: [Int: TokenStyle?] = [:]

  init(
    background: CGColor, foreground: CGColor, gutterBackground: CGColor, gutterForeground: CGColor,
    gutterActiveForeground: CGColor, activeLine: CGColor, selection: CGColor, cursor: CGColor, matchingBracket: CGColor,
    searchMatch: CGColor, searchMatchActive: CGColor, tokens: [String: TokenStyle]
  ) {
    self.background = background
    self.foreground = foreground
    self.gutterBackground = gutterBackground
    self.gutterForeground = gutterForeground
    self.gutterActiveForeground = gutterActiveForeground
    self.activeLine = activeLine
    self.selection = selection
    self.cursor = cursor
    self.matchingBracket = matchingBracket
    self.searchMatch = searchMatch
    self.searchMatchActive = searchMatchActive
    self.tokens = tokens
  }

  /// Longest dotted prefix wins: keyword.function falls back to keyword, then to the plain foreground.
  func styleFor(_ styleId: Int) -> TokenStyle? {
    lock.withLock {
      if let cached = cache[styleId] { return cached }
      let style = ThemeColors.lookup(StyleTable.name(styleId), in: tokens)
      cache[styleId] = .some(style)
      return style
    }
  }

  func style(_ id: Int) -> TokenStyle? {
    styleFor(id)
  }

  func withTokens(_ next: [String: TokenStyle]) -> ThemeColors {
    ThemeColors(
      background: background, foreground: foreground, gutterBackground: gutterBackground, gutterForeground: gutterForeground,
      gutterActiveForeground: gutterActiveForeground, activeLine: activeLine, selection: selection, cursor: cursor,
      matchingBracket: matchingBracket, searchMatch: searchMatch, searchMatchActive: searchMatchActive, tokens: next)
  }

  static func lookup(_ fullName: String, in tokens: [String: TokenStyle]) -> TokenStyle? {
    var name = Substring(fullName)
    while true {
      if let style = tokens[String(name)] { return style }
      guard let dot = name.lastIndex(of: ".") else { return nil }
      name = name[..<dot]
    }
  }

  private static let rgbPattern = try! NSRegularExpression(
    pattern: "^rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*(?:,\\s*([0-9.]+)\\s*)?\\)$")

  /// Accepts #rgb, #rgba, #rrggbb, #rrggbbaa, rgb() and rgba(). Anything else is nil.
  static func parse(css: String) -> CGColor? {
    let v = css.trimmingCharacters(in: .whitespacesAndNewlines)
    if v.hasPrefix("#") {
      let hex = String(v.dropFirst())
      let expanded: String
      switch hex.count {
      case 3: expanded = hex.map { "\($0)\($0)" }.joined() + "ff"
      case 4: expanded = hex.map { "\($0)\($0)" }.joined()
      case 6: expanded = hex + "ff"
      case 8: expanded = hex
      default: return nil
      }
      guard let rgba = UInt32(expanded, radix: 16) else { return nil }
      return color(Int((rgba >> 24) & 0xff), Int((rgba >> 16) & 0xff), Int((rgba >> 8) & 0xff), CGFloat(rgba & 0xff) / 255)
    }
    let ns = v as NSString
    guard let m = rgbPattern.firstMatch(in: v, range: NSRange(location: 0, length: ns.length)) else { return nil }
    func group(_ i: Int) -> String? {
      let r = m.range(at: i)
      return r.location == NSNotFound ? nil : ns.substring(with: r)
    }
    guard let r = group(1).flatMap({ Int($0) }), let g = group(2).flatMap({ Int($0) }), let b = group(3).flatMap({ Int($0) })
    else { return nil }
    let a = group(4).flatMap { Double($0) }.map { max(0, min($0, 1)) } ?? 1
    return color(min(r, 255), min(g, 255), min(b, 255), CGFloat(a))
  }

  static func color(_ r: Int, _ g: Int, _ b: Int, _ a: CGFloat = 1) -> CGColor {
    let space = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    return CGColor(colorSpace: space, components: [CGFloat(r) / 255, CGFloat(g) / 255, CGFloat(b) / 255, a]) ?? CGColor(gray: 0, alpha: 1)
  }

  private static func token(_ r: Int, _ g: Int, _ b: Int, bold: Bool = false, italic: Bool = false) -> TokenStyle {
    TokenStyle(color: color(r, g, b), bold: bold, italic: italic)
  }

  /// GitHub light, used until the theme prop arrives.
  static let `default` = ThemeColors(
    background: color(0xff, 0xff, 0xff), foreground: color(0x1f, 0x23, 0x28), gutterBackground: color(0xff, 0xff, 0xff),
    gutterForeground: color(0x8c, 0x95, 0x9f), gutterActiveForeground: color(0x1f, 0x23, 0x28), activeLine: color(0xf6, 0xf8, 0xfa),
    selection: color(0x09, 0x69, 0xda, 0x33 / 255), cursor: color(0x1f, 0x23, 0x28), matchingBracket: color(0x1f, 0x23, 0x28, 0x33 / 255),
    searchMatch: color(0xff, 0xd3, 0x3d, 0x66 / 255), searchMatchActive: color(0xff, 0xb7, 0x00, 0x99 / 255),
    tokens: [
      "comment": token(0x59, 0x63, 0x6e, italic: true), "keyword": token(0xcf, 0x22, 0x2e), "string": token(0x0a, 0x30, 0x69),
      "number": token(0x05, 0x50, 0xae), "constant": token(0x05, 0x50, 0xae), "function": token(0x82, 0x50, 0xdf),
      "type": token(0x95, 0x38, 0x00),
    ])
}
