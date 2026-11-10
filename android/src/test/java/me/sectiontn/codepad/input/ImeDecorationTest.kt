package me.sectiontn.codepad.input

import java.io.File
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.core.Underline
import me.sectiontn.codepad.core.UnderlineStyle
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ImeDecorationTest {
  // Gboard's autocorrect and suggestion picks replace a whole word through replaceText.
  @Test
  fun replacingAnUnderlinedWordKeepsIt() {
    val dir = File(System.getProperty("codepad.imeDir") ?: "../tests/ime")
    val session = JSONObject(File(dir, "latin-on.json").readText()).getJSONArray("sessions").getJSONObject(0)
    val replay = ImeReplayTest(session, "latin-on session 1")
    val initial = session.getJSONObject("initial")
    val core = EditorCore(initial.getString("text"))
    core.setSelection(initial.getJSONArray("selection").getInt(0), initial.getJSONArray("selection").getInt(1))
    val ime = ImeSession(core)
    val steps = session.getJSONArray("steps")
    var checked = false
    for (i in 0 until steps.length()) {
      val step = steps.getJSONObject(i)
      val call = step.getString("call")
      val a = step.optJSONArray("args") ?: JSONArray()
      val first = call == "replaceText" && !checked
      if (first) core.setDecorations(listOf(Underline(a.getInt(0), a.getInt(1), 0, UnderlineStyle.Solid, 1f, 2f)), -1)
      replay.dispatch(core, ime, call, a, "step ${i + 1} ($call)")
      if (first) {
        val start = a.getInt(0)
        assertEquals(listOf(Underline(start, start + a.getString(2).length, 0, UnderlineStyle.Solid, 1f, 2f)), core.decorations.items)
        checked = true
      }
    }
    assertTrue("latin-on has no replaceText call", checked)
  }
}
