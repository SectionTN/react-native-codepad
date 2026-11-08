import CoreGraphics
import CoreText
import Foundation

/// The face React Native's `Text` draws for a family at weight 400 upright (RCTFontWithFontProperties).
enum FontFace {
  /// RCTGetFontWeight's suffixes in match order, so a SemiBold name reads as semibold before bold.
  private static let suffixes: [(String, CGFloat)] = [
    ("normal", 0), ("ultralight", -0.8), ("thin", -0.6), ("light", -0.4), ("regular", 0), ("medium", 0.23),
    ("semibold", 0.3), ("demibold", 0.3), ("extrabold", 0.56), ("ultrabold", 0.56), ("bold", 0.4),
    ("heavy", 0.56), ("black", 0.62),
  ]

  /// Ties go to the earliest name; with no upright face, the first name.
  static func regular(of names: [String]) -> String? {
    var best: String?
    var bestWeight = CGFloat.infinity
    for name in names {
      let font = CTFontCreateWithName(name as CFString, 12, nil)
      if CTFontGetSymbolicTraits(font).contains(.italicTrait) { continue }
      let faceWeight = weight(of: name, font)
      if abs(faceWeight) < abs(bestWeight) {
        best = name
        bestWeight = faceWeight
      }
    }
    return best ?? names.first
  }

  /// The name before the weight trait, as RN reads it: custom fonts often carry a wrong trait.
  private static func weight(of name: String, _ font: CTFont) -> CGFloat {
    let lower = name.lowercased()
    for (suffix, value) in suffixes where lower.hasSuffix(suffix) { return value }
    let traits = CTFontCopyTraits(font) as NSDictionary
    let trait = traits[kCTFontWeightTrait as String] as? NSNumber
    return trait.map { CGFloat($0.doubleValue) } ?? 0
  }
}
