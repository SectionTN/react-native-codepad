package me.sectiontn.codepad.view

import me.sectiontn.codepad.syntax.StyleTable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ThemeColorsTest {
  @Test
  fun parsesCssColors() {
    assertEquals(0xFFFFFFFF.toInt(), ThemeColors.parseColor("#fff"))
    assertEquals(0xFF112233.toInt(), ThemeColors.parseColor("#112233"))
    assertEquals(0x80FF0000.toInt(), ThemeColors.parseColor("#ff000080"))
    assertEquals(0xFF0000FF.toInt(), ThemeColors.parseColor("rgb(0, 0, 255)"))
    assertEquals(0x800000FF.toInt(), ThemeColors.parseColor("rgba(0,0,255,0.5)"))
    assertEquals(0xFFFF00FF.toInt(), ThemeColors.parseColor("nonsense"))
  }

  @Test
  fun looksUpTheLongestDottedPrefix() {
    val red = TokenStyleColors(0xFFFF0000.toInt(), bold = false, italic = false)
    val theme = ThemeColors.default.withTokens(mapOf("keyword" to red))
    assertEquals(red, theme.styleFor(StyleTable.id("keyword.function.method")))
    assertEquals(red, theme.styleFor(StyleTable.id("keyword")))
    assertNull(theme.styleFor(StyleTable.id("string")))
  }
}
