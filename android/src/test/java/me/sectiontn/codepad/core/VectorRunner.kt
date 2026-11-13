package me.sectiontn.codepad.core

import me.sectiontn.codepad.layout.Viewport
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail

class VectorRunner(private val case: JSONObject) {
  private var now = 0L
  private val core = EditorCore(case.optString("text", ""), clock = { now })
  private val changes = ArrayList<Pair<Change, ChangeOrigin>>()
  private var lastResult: Any? = null
  private var lastError: String? = null

  // Created by the first layout op and attached to the editor, which keeps its rows in step.
  private var viewport: Viewport? = null
  private var anchor: Viewport.Anchor? = null
  private var widthChanged = false
  private val pairs = IntArray(64)

  init {
    core.onChange = { change, origin -> changes.add(change to origin) }
  }

  private fun layout(op: JSONObject) {
    val vp = viewport ?: Viewport().also {
      it.attach(core)
      viewport = it
    }
    val before = vp.textAreaWidth
    val insets = op.getJSONArray("insets")
    vp.rowHeight = op.getInt("rowHeight")
    vp.gutterWidth = op.getInt("gutter")
    vp.textPadding = op.getInt("padding")
    vp.wrap = op.getBoolean("wrap")
    vp.resize(op.getInt("width"), op.getInt("height"))
    vp.setInsets(insets.getInt(0), insets.getInt(1), insets.getInt(2), insets.getInt(3))
    widthChanged = vp.textAreaWidth != before
  }

  fun run() {
    // A pending case pins behavior the engine does not have yet.
    case.optString("pending").takeIf { it.isNotEmpty() }?.let {
      println("pending (${it}): ${case.optString("name")}")
      return
    }
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
      "bracketMatch" -> lastResult = core.bracketMatch(0L)
      "search" -> try {
        core.setSearch(SearchQuery(op.getString("text"), op.optBoolean("regex", false), op.optBoolean("caseSensitive", false), op.optBoolean("wholeWord", false)))
        core.ensureMatches()
        lastResult = core.matchCount
      } catch (e: IllegalArgumentException) {
        lastError = e.message ?: "invalid"
      }
      "findNext" -> lastResult = core.findNext()
      "findPrevious" -> lastResult = core.findPrevious()
      "replaceCurrent" -> lastResult = core.replaceCurrent(op.getString("text"))
      "replaceAll" -> lastResult = core.replaceAll(op.getString("text"))
      "clearSearch" -> core.clearSearch()
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
      "decorate" -> {
        val arr = op.getJSONArray("items")
        val items = (0 until arr.length()).map { i -> decorationOf(arr.getJSONObject(i)) }
        core.setDecorations(items, op.optInt("revision", -1))
      }
      "layout" -> layout(op)
      // Through the draw's batch call, so the vectors cover the pair marshalling.
      "measure" -> {
        val vp = viewport!!
        val list = op.getJSONArray("pairs")
        for (i in 0 until list.length()) {
          pairs[2 * i] = list.getJSONArray(i).getInt(0)
          pairs[2 * i + 1] = list.getJSONArray(i).getInt(1)
        }
        vp.beginDraw(checksCalls = true)
        vp.measure(pairs, list.length(), op.optInt("widest", -1), 0, -1)
        vp.endDraw()
      }
      "scrollTo" -> lastResult = viewport!!.scrollTo(op.getInt("x"), op.getInt("y"))
      "scrollBy" -> lastResult = viewport!!.scrollBy(op.getInt("dx"), op.getInt("dy"))
      "reveal" -> lastResult = viewport!!.reveal(op.getInt("left"), op.getInt("top"), op.getInt("right"), op.getInt("bottom"))
      "anchor" -> anchor = viewport!!.anchor()
      "restore" -> viewport!!.restore(anchor!!)
      "resetRows" -> viewport!!.resetRows()
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

  private fun decorationOf(o: JSONObject): Decoration = when (val kind = o.getString("kind")) {
    "underline" -> Underline(o.getInt("start"), o.getInt("end"), 0, UnderlineStyle.Solid, o.optDouble("thickness", 1.0).toFloat(), 2f)
    "gap" -> Gap(o.getInt("line"), o.getInt("rows"))
    "lineBackground" -> LineBackground(o.getInt("line"), 0)
    else -> error("unknown decoration kind $kind")
  }

  // Only what mapping changes: kind and range, or kind, line and rows.
  private fun describe(d: Decoration): String = when (d) {
    is Underline -> "underline ${d.start} ${d.end}"
    is Gap -> "gap ${d.line} ${d.rows}"
    is LineBackground -> "lineBackground ${d.line}"
  }

  private fun check(expect: JSONObject, where: String) {
    if (expect.has("decorations")) {
      val arr = expect.getJSONArray("decorations")
      val expected = (0 until arr.length()).map { describe(decorationOf(arr.getJSONObject(it))) }
      assertEquals("decorations $where", expected, core.decorations.items.map(::describe))
    }
    if (expect.has("gapRows")) {
      val o = expect.getJSONObject("gapRows")
      assertEquals("gapRows $where", o.keys().asSequence().associate { it.toInt() to o.getInt(it) }, core.decorations.gapRows())
    }
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
    if (expect.has("matches")) {
      val arr = expect.getJSONArray("matches")
      val expected = IntArray(arr.length() * 2) { i -> arr.getJSONArray(i / 2).getInt(i % 2) }
      assertArrayEquals("matches $where", expected, core.matches)
    }
    if (expect.has("found")) {
      if (expect.isNull("found")) assertNull("found $where", lastResult)
      else {
        val f = expect.getJSONObject("found")
        assertEquals("found $where", EditorCore.SearchHit(f.getInt("index"), f.getInt("total")), lastResult)
      }
    }
    if (expect.has("result")) assertEquals("result $where", expect.get("result"), lastResult)
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
    checkLayout(expect, where)
  }

  private fun checkLayout(expect: JSONObject, where: String) {
    val vp = viewport ?: return
    fun pair(key: String) = expect.getJSONArray(key).let { listOf(it.getInt(0), it.getInt(1)) }
    fun keyed(key: String, actual: (Int) -> Any) {
      val o = expect.getJSONObject(key)
      val expected = o.keys().asSequence().associate { it.toInt() to o.get(it) }
      assertEquals("$key $where", expected, expected.mapValues { (k, _) -> actual(k) })
    }
    if (expect.has("widthChanged")) assertEquals("widthChanged $where", expect.getBoolean("widthChanged"), widthChanged)
    if (expect.has("scroll")) assertEquals("scroll $where", pair("scroll"), listOf(vp.scrollX, vp.scrollY))
    if (expect.has("maxScroll")) assertEquals("maxScroll $where", pair("maxScroll"), listOf(vp.maxScrollX, vp.maxScrollY))
    if (expect.has("content")) assertEquals("content $where", pair("content"), listOf(vp.contentWidth, vp.contentHeight))
    if (expect.has("visible")) assertEquals("visible $where", pair("visible"), listOf(vp.firstVisibleLine(), vp.lastVisibleLine()))
    if (expect.has("totalRows")) assertEquals("totalRows $where", expect.getInt("totalRows"), vp.totalRows)
    if (expect.has("rowStart")) keyed("rowStart") { vp.rowStart(it) }
    if (expect.has("lineAtRow")) keyed("lineAtRow") { vp.lineAtRow(it) }
    if (expect.has("isGapRow")) keyed("isGapRow") { vp.isGapRow(it) }
    if (expect.has("lineTop")) keyed("lineTop") { vp.lineTop(it) }
  }
}
