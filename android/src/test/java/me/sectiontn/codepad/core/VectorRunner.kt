package me.sectiontn.codepad.core

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail

class VectorRunner(private val case: JSONObject) {
  private var now = 0L
  private val core = EditorCore(case.optString("text", ""), clock = { now })
  private val changes = ArrayList<Pair<Change, ChangeOrigin>>()
  private var lastResult: Any? = null
  private var lastError: String? = null

  init {
    core.onChange = { change, origin -> changes.add(change to origin) }
  }

  fun run() {
    val ops = case.optJSONArray("ops") ?: JSONArray()
    for (i in 0 until ops.length()) {
      val op = ops.getJSONObject(i)
      lastResult = null
      lastError = null
      apply(op)
      op.optJSONObject("expect")?.let { check(it, "after op ${i + 1} (${op.getString("op")})") }
    }
    case.optJSONObject("expect")?.let { check(it, "at end") }
  }

  private fun apply(op: JSONObject) {
    when (val name = op.getString("op")) {
      "replace" -> core.replace(op.getInt("start"), op.getInt("end"), op.getString("text"))
      "setSelection" -> core.setSelection(op.getInt("anchor"), op.getInt("head"))
      "selectAll" -> core.selectAll()
      "move" -> core.move(unitOf(op.getString("unit")), op.getInt("dir") > 0, op.optBoolean("extend", false))
      "selectWord" -> core.selectWordAt(op.getInt("offset"))
      "type" -> core.typeText(op.getString("text"))
      "insertText" -> core.insertText(op.getString("text"))
      "setText" -> core.setText(op.getString("text"), op.optBoolean("keepHistory", false))
      "backspace" -> core.backspace()
      "delete" -> core.delete()
      "undo" -> lastResult = core.undo()
      "redo" -> lastResult = core.redo()
      "enter" -> core.insertNewline()
      "tab" -> core.tab()
      "shiftTab" -> core.shiftTab()
      "indent" -> core.indent()
      "outdent" -> core.outdent()
      "bracketMatch" -> lastResult = core.bracketMatch(null)
      "config" -> core.settings = core.settings.copy(
        tabSize = op.optInt("tabSize", core.settings.tabSize),
        insertSpaces = op.optBoolean("insertSpaces", core.settings.insertSpaces),
        autoIndent = op.optBoolean("autoIndent", core.settings.autoIndent),
        autoCloseBrackets = op.optBoolean("autoCloseBrackets", core.settings.autoCloseBrackets),
      )
      "offsetToPosition" -> lastResult = core.document.offsetToPosition(op.getInt("offset"))
      "positionToOffset" -> lastResult = core.document.positionToOffset(op.getInt("line"), op.getInt("column"))
      "getLine" -> lastResult = core.document.line(op.getInt("index")).toString()
      "wait" -> now += op.getLong("ms")
      else -> fail("op not implemented: $name")
    }
  }

  private fun unitOf(name: String): TextMovement.Unit = when (name) {
    "char" -> TextMovement.Unit.Char
    "word" -> TextMovement.Unit.Word
    "lineStart" -> TextMovement.Unit.LineStart
    "lineEnd" -> TextMovement.Unit.LineEnd
    "docStart" -> TextMovement.Unit.DocStart
    "docEnd" -> TextMovement.Unit.DocEnd
    else -> error("unknown unit $name")
  }

  private fun check(expect: JSONObject, where: String) {
    val doc = core.document
    if (expect.has("text")) assertEquals("text $where", expect.getString("text"), doc.text())
    if (expect.has("length")) assertEquals("length $where", expect.getInt("length"), doc.length)
    if (expect.has("lineCount")) assertEquals("lineCount $where", expect.getInt("lineCount"), doc.lineCount)
    if (expect.has("revision")) assertEquals("revision $where", expect.getInt("revision"), doc.revision)
    if (expect.has("selection")) {
      val s = expect.getJSONObject("selection")
      assertEquals("selection $where", Selection(s.getInt("anchor"), s.getInt("head")), core.selection)
    }
    if (expect.has("position")) {
      val p = expect.getJSONObject("position")
      assertEquals("position $where", Position(p.getInt("line"), p.getInt("column")), lastResult)
    }
    if (expect.has("canUndo")) assertEquals("canUndo $where", expect.getBoolean("canUndo"), core.canUndo)
    if (expect.has("canRedo")) assertEquals("canRedo $where", expect.getBoolean("canRedo"), core.canRedo)
    if (expect.has("offset")) assertEquals("offset $where", expect.getInt("offset"), lastResult)
    if (expect.has("line")) assertEquals("line $where", expect.getString("line"), lastResult)
    if (expect.has("brackets")) {
      if (expect.isNull("brackets")) assertNull("brackets $where", lastResult)
      else {
        val arr = expect.getJSONArray("brackets")
        assertEquals("brackets $where", listOf(arr.getInt(0), arr.getInt(1)), (lastResult as IntArray?)?.toList())
      }
    }
    if (expect.has("changes")) {
      val list = expect.getJSONArray("changes")
      assertEquals("change count $where", list.length(), changes.size)
      for (i in 0 until list.length()) {
        val e = list.getJSONObject(i)
        val (c, origin) = changes[i]
        assertEquals("change $i start $where", e.getInt("start"), c.start)
        assertEquals("change $i end $where", e.getInt("end"), c.end)
        assertEquals("change $i text $where", e.getString("text"), c.inserted)
        assertEquals("change $i origin $where", e.getString("origin"), origin.name.lowercase())
      }
    }
    if (expect.has("error")) {
      if (expect.getBoolean("error")) assertEquals("error expected $where", true, lastError != null)
      else assertNull("no error expected $where", lastError)
    }
  }
}
