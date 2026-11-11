package me.sectiontn.codepad.syntax

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

class HighlighterTest {
  @Before
  fun setUp() = HostLib.ensure()

  private fun styleAt(spans: IntArray, column: Int): String? {
    var i = 0
    while (i < spans.size) {
      if (column >= spans[i] && column < spans[i + 1]) return StyleTable.name(spans[i + 2])
      i += 3
    }
    return null
  }

  @Test
  fun capturesMapToStylesPerLine() {
    val lang = HostLanguages.javascript()
    val (snapshot, doc) = parseSnapshot(lang, "const x = 1; // hi\nreturn \"s\";")
    val spans = Highlighter(lang).spans(snapshot, doc, 0, 1)
    assertEquals(2, spans.size)
    assertEquals("keyword", styleAt(spans[0], 0)?.split('.')?.first())
    assertEquals("number", styleAt(spans[0], 10))
    assertEquals("comment", styleAt(spans[0], 14))
    assertEquals("keyword.return", styleAt(spans[1], 0))
    assertEquals("string", styleAt(spans[1], 8))
    snapshot.close()
  }

  @Test
  fun predicatesFilterMatches() {
    val lang = HostLanguages.javascript()
    val (snapshot, doc) = parseSnapshot(lang, "let FOO = BAR_1 + bar;")
    val spans = Highlighter(lang).spans(snapshot, doc, 0, 0)
    assertEquals("constant", styleAt(spans[0], 4))
    assertEquals("constant", styleAt(spans[0], 10))
    assertEquals("variable", styleAt(spans[0], 18))
    snapshot.close()
  }

  @Test
  fun multiLineCapturesAreClippedPerLine() {
    val lang = HostLanguages.javascript()
    val (snapshot, doc) = parseSnapshot(lang, "/* a\nb */ x")
    val spans = Highlighter(lang).spans(snapshot, doc, 0, 1)
    assertEquals("comment", styleAt(spans[0], 1))
    assertEquals("comment", styleAt(spans[1], 0))
    assertEquals("comment", styleAt(spans[1], 3))
    assertNull(styleAt(spans[1], 4))
    assertEquals("variable", styleAt(spans[1], 5))
    snapshot.close()
  }

  @Test
  fun concealCapturesNeverPaint() {
    HostLanguages.javascript()
    LanguageRegistry.register(object : LanguageProvider {
      override val id = "javascript_conceal"
      override val languagePointer = HostLib.javascript()
      override val highlights = "(comment) @conceal\n(number) @number"
      override val injections = ""
    })
    val lang = checkNotNull(LanguageRegistry.resolve("javascript_conceal"))
    val (snapshot, doc) = parseSnapshot(lang, "1 // hi")
    val spans = Highlighter(lang).spans(snapshot, doc, 0, 0)
    assertEquals("number", styleAt(spans[0], 0))
    assertNull(styleAt(spans[0], 3))
    snapshot.close()
  }

  // The javascript tree covers "\nlet x = 1;\n" on lines 2 to 4.
  @Test
  fun injectionsOnThePaintedEdgeAreStyled() {
    val html = HostLanguages.load("html", "html")
    val js = HostLanguages.javascript()
    val text = "<p>a</p>\n<p>b</p>\n<script>\nlet x = 1;\n</script>\n<p>c</p>"
    val (snapshot, doc) = parseSnapshot(html, text)
    assertEquals(listOf(js.id), snapshot.injected.map { it.language.id })
    assertEquals(text.indexOf("\nlet"), snapshot.injected[0].start)
    val hl = Highlighter(html)
    assertEquals("keyword", styleAt(hl.spans(snapshot, doc, 3, 3)[0], 0))
    assertEquals("keyword", styleAt(hl.spans(snapshot, doc, 2, 3)[1], 0))
    assertEquals("keyword", styleAt(hl.spans(snapshot, doc, 3, 4)[0], 0))
    assertEquals(2, hl.spans(snapshot, doc, 0, 1).size)
    snapshot.close()
  }
}
