import CoreGraphics
import CoreText

/// Derived once per font change. Ascent and descent are padded so they add up to the row height.
final class RowMetrics {
  let font: CTFont
  let fontHeight: Int
  let rowHeight: Int
  /// Row top to baseline, padding included.
  let ascent: CGFloat
  let descent: CGFloat
  let spaceWidth: CGFloat
  let tabWidth: Int
  private let bold: CTFont
  private let italic: CTFont
  private let boldItalic: CTFont

  init(font: CTFont, lineHeight: CGFloat, tabSize: Int) {
    self.font = font
    let a = CTFontGetAscent(font)
    let d = CTFontGetDescent(font)
    fontHeight = Int((a + d).rounded())
    rowHeight = Int((CTFontGetSize(font) * lineHeight).rounded())
    let extra = rowHeight - fontHeight
    ascent = a + CGFloat(extra / 2)
    descent = d + CGFloat(extra - extra / 2)
    spaceWidth = RowMetrics.advance(of: " ", in: font)
    tabWidth = Int((spaceWidth * CGFloat(tabSize)).rounded())
    bold = RowMetrics.variant(font, .boldTrait)
    italic = RowMetrics.variant(font, .italicTrait)
    boldItalic = RowMetrics.variant(font, [.boldTrait, .italicTrait])
  }

  func font(bold: Bool, italic: Bool) -> CTFont {
    switch (bold, italic) {
    case (true, true): return boldItalic
    case (true, false): return self.bold
    case (false, true): return self.italic
    case (false, false): return font
    }
  }

  static func advance(of character: Character, in font: CTFont) -> CGFloat {
    var units = Array(String(character).utf16)
    var glyphs = [CGGlyph](repeating: 0, count: units.count)
    CTFontGetGlyphsForCharacters(font, &units, &glyphs, units.count)
    return CTFontGetAdvancesForGlyphs(font, .horizontal, glyphs, nil, 1)
  }

  private static func variant(_ font: CTFont, _ traits: CTFontSymbolicTraits) -> CTFont {
    CTFontCreateCopyWithSymbolicTraits(font, 0, nil, traits, traits) ?? font
  }
}
