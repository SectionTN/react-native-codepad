package me.sectiontn.codepad.input

import android.view.KeyEvent
import java.io.File
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.Range
import me.sectiontn.codepad.core.Selection
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/** Replays the keyboard sessions under tests/ime against a fresh core and checks the document after every call. */
@RunWith(Parameterized::class)
class ImeReplayTest(private val session: JSONObject, private val label: String) {
  companion object {
    private val SKIP = Any()

    @JvmStatic
    @Parameterized.Parameters(name = "{1}")
    fun sessions(): List<Array<Any>> {
      val dir = File(System.getProperty("codepad.imeDir") ?: "../tests/ime")
      val files = dir.listFiles { f -> f.name.endsWith(".json") }?.sortedBy { it.name }
        ?: error("no recordings in ${dir.absolutePath}")
      return files.flatMap { file ->
        val sessions = JSONObject(file.readText()).getJSONArray("sessions")
        (0 until sessions.length()).map { i ->
          arrayOf<Any>(sessions.getJSONObject(i), "${file.nameWithoutExtension} session ${i + 1}")
        }
      }
    }
  }

  @Test
  fun replay() {
    val initial = session.getJSONObject("initial")
    val core = EditorCore(initial.getString("text"))
    val sel = initial.getJSONArray("selection")
    core.setSelection(sel.getInt(0), sel.getInt(1))
    val ime = ImeSession(core)
    val steps = session.getJSONArray("steps")
    for (i in 0 until steps.length()) {
      val step = steps.getJSONObject(i)
      val call = step.getString("call")
      val where = "$label step ${i + 1} ($call)"
      val ret = dispatch(core, ime, call, step.optJSONArray("args") ?: JSONArray(), where)
      if (step.has("ret") && ret !== SKIP) {
        val expected = step.get("ret")
        assertTrue("$where returned $ret, recording has $expected", same(expected, ret))
      }
      step.optJSONObject("after")?.let { check(core, ime, it, where) }
    }
  }

  private fun dispatch(core: EditorCore, ime: ImeSession, call: String, a: JSONArray, where: String): Any? = when (call) {
    "commitText" -> ime.commitText(a.getString(0), a.getInt(1))
    "setComposingText" -> ime.setComposingText(a.getString(0), a.getInt(1))
    "setComposingRegion" -> ime.setComposingRegion(a.getInt(0), a.getInt(1))
    "finishComposingText" -> ime.finishComposingText()
    "replaceText" -> ime.replaceText(a.getInt(0), a.getInt(1), a.getString(2), a.getInt(3))
    "select" -> { core.setSelection(a.getInt(0), a.getInt(1)); SKIP }
    "deleteSurroundingText" -> ime.deleteSurroundingText(a.getInt(0), a.getInt(1))
    "deleteSurroundingTextInCodePoints" -> ime.deleteSurroundingTextInCodePoints(a.getInt(0), a.getInt(1))
    "getTextBeforeCursor" -> ime.textBeforeCursor(a.getInt(0))
    "getTextAfterCursor" -> ime.textAfterCursor(a.getInt(0))
    "getSelectedText" -> ime.selectedText()
    "getSurroundingText" -> ime.window(a.getInt(0), a.getInt(1)).let {
      JSONObject().put("text", it.text).put("selStart", it.selStart).put("selEnd", it.selEnd).put("offset", it.offset)
    }
    "setSelection" -> ime.setSelection(a.getInt(0), a.getInt(1))
    "beginBatchEdit" -> ime.beginBatchEdit()
    "endBatchEdit" -> ime.endBatchEdit()
    // Only key downs do anything, as in the view, and a key without a command (Shift) returns false there too.
    "sendKeyEvent" -> a.getInt(0) == KeyEvent.ACTION_DOWN && ime.sendKey(a.getInt(1), a.getInt(2))
    "performEditorAction" -> {
      ime.finishComposingText()
      core.insertNewline()
      true
    }
    "performContextMenuAction" -> when (a.getInt(0)) {
      android.R.id.selectAll -> {
        core.selectAll()
        true
      }
      android.R.id.undo -> {
        ime.reset()
        core.undo()
      }
      android.R.id.redo -> {
        ime.reset()
        core.redo()
      }
      else -> fail("$where clipboard actions do not replay")
    }
    "requestCursorUpdates", "getCursorCapsMode", "clearMetaKeyStates" -> SKIP
    "closeConnection", "close" -> {
      ime.reset()
      SKIP
    }
    else -> fail("$where unknown call")
  }

  // Field by field, since key order differs between the phone's org.json and the one on the JVM.
  private fun same(expected: Any, actual: Any?): Boolean {
    if (expected !is JSONObject || actual !is JSONObject) return expected.toString() == (actual?.toString() ?: "null")
    if (expected.length() != actual.length()) return false
    for (key in expected.keys()) if (expected.get(key).toString() != actual.opt(key)?.toString()) return false
    return true
  }

  private fun check(core: EditorCore, ime: ImeSession, after: JSONObject, where: String) {
    after.optJSONArray("sel")?.let { assertEquals("$where selection", Selection(it.getInt(0), it.getInt(1)), core.selection) }
    if (after.has("comp")) {
      val expected = after.optJSONArray("comp")?.let { Range(it.getInt(0), it.getInt(1)) }
      assertEquals("$where composing", expected, ime.composing)
    }
    if (after.has("len")) assertEquals("$where length", after.getInt("len"), core.document.length)
    if (after.has("text")) assertEquals("$where text", after.getString("text"), core.document.text())
  }
}
