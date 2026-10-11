package me.sectiontn.codepad.syntax

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class TreeSitterTest {
  @Before
  fun setUp() = HostLib.ensure()

  @Test
  fun parsesJavascriptWithUnitOffsets() {
    Parser().use { parser ->
      assertTrue(parser.setLanguage(HostLib.javascript()))
      Mirror().use { mirror ->
        mirror.setText("let x = \"😀\";")
        val tree = checkNotNull(parser.parse(null, mirror, null, 0))
        tree.use {
          val root = it.rootNode()
          assertEquals("program", root.type)
          assertEquals(0, root.startUnit)
          assertEquals(13, root.endUnit)
          assertEquals(Point(0, 13), root.endPoint)
          val decl = root.child(0)
          assertEquals("lexical_declaration", decl.type)
          assertEquals("program", decl.parent().type)
        }
      }
    }
  }

  @Test
  fun cancelFlagAbortsAndResetAllowsRestart() {
    Parser().use { parser ->
      parser.setLanguage(HostLib.javascript())
      Mirror().use { mirror ->
        mirror.setText("let a = 1;\n".repeat(20_000))
        CancelFlag().use { flag ->
          flag.set(true)
          assertNull(parser.parse(null, mirror, flag, 0))
          parser.reset()
          flag.set(false)
          checkNotNull(parser.parse(null, mirror, flag, 0)).close()
        }
      }
    }
  }

  @Test
  fun queryExposesCapturesAndPredicateSteps() {
    val lang = HostLib.javascript()
    Query.compile(lang, "((identifier) @c (#match? @c \"^[A-Z]\"))").use { query ->
      assertEquals(1, query.patternCount)
      assertEquals(listOf("c"), query.captureNames.toList())
      val steps = query.predicates(0)
      assertEquals(listOf(2, 1, 2, 0), listOf(steps[0], steps[2], steps[4], steps[6]))
      assertEquals("match?", query.stringValues[steps[1]])
      assertEquals("^[A-Z]", query.stringValues[steps[5]])
    }
  }

  @Test
  fun queryCursorReturnsCapturesInRange() {
    val lang = HostLib.javascript()
    Parser().use { parser ->
      parser.setLanguage(lang)
      Mirror().use { mirror ->
        mirror.setText("let a = 1;\nlet b = 2;\n")
        val tree = checkNotNull(parser.parse(null, mirror, null, 0))
        Query.compile(lang, "(number) @n").use { query ->
          QueryCursor().use { cursor ->
            cursor.exec(query, tree.rootNode())
            cursor.setUnitRange(11, 22)
            val capture = Capture()
            val found = ArrayList<Int>()
            while (cursor.nextCapture(capture)) found.add(capture.node.startUnit)
            assertEquals(listOf(19), found)
          }
        }
        tree.close()
      }
    }
  }

  @Test
  fun includedRangesFollowEdits() {
    Parser().use { parser ->
      parser.setLanguage(HostLib.javascript())
      Mirror().use { mirror ->
        mirror.setText("aa let x = 1; bb")
        parser.setIncludedRanges(intArrayOf(3, 13, 0, 3, 0, 13))
        val tree = checkNotNull(parser.parse(null, mirror, null, 0))
        assertArrayEquals(intArrayOf(3, 13, 0, 3, 0, 13), tree.includedRanges())
        tree.edit(InputEdit(0, 0, 2, Point(0, 0), Point(0, 0), Point(0, 2)))
        assertArrayEquals(intArrayOf(5, 15, 0, 5, 0, 15), tree.includedRanges())
        tree.close()
      }
    }
  }

  @Test
  fun changedRangesCoverTheEditInUnits() {
    Parser().use { parser ->
      parser.setLanguage(HostLib.javascript())
      Mirror().use { mirror ->
        mirror.setText("let a = 1;\nlet b = 2;\n")
        val old = checkNotNull(parser.parse(null, mirror, null, 0))
        // A number becoming a call changes the structure; tree-sitter reports no range for a retyped leaf.
        mirror.replace(8, 9, "f(1)")
        old.edit(InputEdit(8, 9, 12, Point(0, 8), Point(0, 9), Point(0, 12)))
        val new = checkNotNull(parser.parse(old, mirror, null, 0))
        val r = new.changedRanges(since = old)
        assertTrue(r.size >= 2 && r.size % 2 == 0)
        assertTrue(r[0] <= 8)
        assertTrue(r[1] >= 12)
        assertTrue("units, not bytes", r[r.size - 1] <= 14)
        old.close()
        new.close()
      }
    }
  }
}
