package me.sectiontn.codepad.view

import android.util.Log
import me.sectiontn.codepad.syntax.StyleTable

data class TokenStyleColors(val color: Int, val bold: Boolean, val italic: Boolean)

class ThemeColors(
  val background: Int,
  val foreground: Int,
  val gutterBackground: Int,
  val gutterForeground: Int,
  val gutterActiveForeground: Int,
  val activeLine: Int,
  val selection: Int,
  val cursor: Int,
  val matchingBracket: Int,
  val searchMatch: Int,
  val searchMatchActive: Int,
  private val tokens: Map<String, TokenStyleColors>,
) {
  private val cache = HashMap<Int, TokenStyleColors?>()

  /** Longest dotted prefix wins: keyword.function falls back to keyword, then to the plain foreground. */
  fun styleFor(styleId: Int): TokenStyleColors? {
    if (cache.containsKey(styleId)) return cache[styleId]
    val style = lookup(StyleTable.name(styleId))
    cache[styleId] = style
    return style
  }

  fun withTokens(next: Map<String, TokenStyleColors>): ThemeColors = ThemeColors(
    background, foreground, gutterBackground, gutterForeground, gutterActiveForeground,
    activeLine, selection, cursor, matchingBracket, searchMatch, searchMatchActive, next,
  )

  private fun lookup(fullName: String): TokenStyleColors? {
    var name = fullName
    while (true) {
      tokens[name]?.let { return it }
      val dot = name.lastIndexOf('.')
      if (dot < 0) return null
      name = name.substring(0, dot)
    }
  }

  companion object {
    private const val TAG = "codepad"
    private val RGB = Regex("""rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)""")

    /** Accepts #rgb, #rgba, #rrggbb, #rrggbbaa, rgb() and rgba(). Anything else is magenta plus a warning. */
    fun parseColor(value: String): Int {
      val v = value.trim()
      try {
        if (v.startsWith("#")) {
          val hex = v.substring(1)
          val expanded = when (hex.length) {
            3 -> hex.map { "$it$it" }.joinToString("") + "ff"
            4 -> hex.map { "$it$it" }.joinToString("")
            6 -> "${hex}ff"
            8 -> hex
            else -> throw NumberFormatException(v)
          }
          val rgba = expanded.toLong(16)
          return ((rgba and 0xff).toInt() shl 24) or (rgba ushr 8).toInt()
        }
        val m = RGB.matchEntire(v)
        if (m != null) {
          val r = m.groupValues[1].toInt().coerceIn(0, 255)
          val g = m.groupValues[2].toInt().coerceIn(0, 255)
          val b = m.groupValues[3].toInt().coerceIn(0, 255)
          val a = m.groupValues[4].takeIf { it.isNotEmpty() }?.toFloat()?.coerceIn(0f, 1f) ?: 1f
          return (Math.round(a * 255) shl 24) or (r shl 16) or (g shl 8) or b
        }
      } catch (e: NumberFormatException) {
        // fall through to the warning
      }
      Log.w(TAG, "cannot parse color '$value', using magenta")
      return 0xFFFF00FF.toInt()
    }

    /** GitHub light, used until the theme prop arrives. */
    val default: ThemeColors = ThemeColors(
      background = 0xFFFFFFFF.toInt(), foreground = 0xFF1F2328.toInt(),
      gutterBackground = 0xFFFFFFFF.toInt(), gutterForeground = 0xFF8C959F.toInt(), gutterActiveForeground = 0xFF1F2328.toInt(),
      activeLine = 0xFFF6F8FA.toInt(), selection = 0x330969DA, cursor = 0xFF1F2328.toInt(),
      matchingBracket = 0x331F2328, searchMatch = 0x66FFD33D, searchMatchActive = 0x99FFB700.toInt(),
      tokens = mapOf(
        "comment" to TokenStyleColors(0xFF59636E.toInt(), false, true),
        "keyword" to TokenStyleColors(0xFFCF222E.toInt(), false, false),
        "string" to TokenStyleColors(0xFF0A3069.toInt(), false, false),
        "number" to TokenStyleColors(0xFF0550AE.toInt(), false, false),
        "constant" to TokenStyleColors(0xFF0550AE.toInt(), false, false),
        "function" to TokenStyleColors(0xFF8250DF.toInt(), false, false),
        "type" to TokenStyleColors(0xFF953800.toInt(), false, false),
      ),
    )
  }
}
