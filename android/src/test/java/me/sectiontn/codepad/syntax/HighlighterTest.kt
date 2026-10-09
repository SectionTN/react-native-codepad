package me.sectiontn.codepad.syntax

import me.sectiontn.codepad.core.Document
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
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

  private fun parse(lang: LoadedLanguage, text: String): Pair<Snapshot, Document> {
    val doc = Document(text)
    val parser = Parser()
    parser.setLanguage(lang.pointer)
    val mirror = Mirror()
    mirror.setText(text)
    val tree = checkNotNull(parser.parse(null, mirror, null, 0))
    mirror.close()
    parser.close()
    return Snapshot(doc.revision, tree, emptyList()) to doc
  }

  @Test
  fun capturesMapToStylesPerLine() {
    val lang = HostLanguages.javascript()
    val (snapshot, doc) = parse(lang, "const x = 1; // hi\nreturn \"s\";")
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
    val (snapshot, doc) = parse(lang, "let FOO = BAR_1 + bar;")
    val spans = Highlighter(lang).spans(snapshot, doc, 0, 0)
    assertEquals("constant", styleAt(spans[0], 4))
    assertEquals("constant", styleAt(spans[0], 10))
    assertEquals("variable", styleAt(spans[0], 18))
    snapshot.close()
  }

  @Test
  fun multiLineCapturesAreClippedPerLine() {
    val lang = HostLanguages.javascript()
    val (snapshot, doc) = parse(lang, "/* a\nb */ x")
    val spans = Highlighter(lang).spans(snapshot, doc, 0, 1)
    assertEquals("comment", styleAt(spans[0], 1))
    assertEquals("comment", styleAt(spans[1], 0))
    assertEquals("comment", styleAt(spans[1], 3))
    assertNull(styleAt(spans[1], 4))
    assertEquals("variable", styleAt(spans[1], 5))
    snapshot.close()
  }

  @Test
  fun unknownLanguageResolvesToNull() {
    HostLanguages.javascript()
    assertNull(LanguageRegistry.resolve("no_such_language"))
    assertNull(LanguageRegistry.resolveInjection("c_sharp"))
    assertTrue(LanguageRegistry.resolveInjection("js") === LanguageRegistry.resolve("javascript"))
  }

  @Test
  fun concealCapturesNeverPaint() {
    val base = HostLanguages.javascript()
    LanguageRegistry.register(object : LanguageProvider {
      override val id = "javascript_conceal"
      override val languagePointer = base.pointer
      override val highlights = "(comment) @conceal\n(number) @number"
      override val injections = ""
    })
    val lang = checkNotNull(LanguageRegistry.resolve("javascript_conceal"))
    val (snapshot, doc) = parse(lang, "1 // hi")
    val spans = Highlighter(lang).spans(snapshot, doc, 0, 0)
    assertEquals("number", styleAt(spans[0], 0))
    assertNull(styleAt(spans[0], 3))
    snapshot.close()
  }
}
