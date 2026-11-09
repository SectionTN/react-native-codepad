package codepad.example

import android.content.Context
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ScrollView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import me.sectiontn.codepad.view.CodeEditorView
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

/** Counts the editor's touch grabs, which react-native-gesture-handler's root reads as a native gesture taking over. */
private class GrabCounter(context: Context) : LinearLayout(context) {
  var grabs = 0

  override fun requestDisallowInterceptTouchEvent(disallowIntercept: Boolean) {
    if (disallowIntercept) grabs++
    super.requestDisallowInterceptTouchEvent(disallowIntercept)
  }
}

@RunWith(AndroidJUnit4::class)
class NestedScrollTest {
  private var column: GrabCounter? = null

  private fun nest(s: ActivityScenario<TestActivity>): ScrollView {
    var page: ScrollView? = null
    s.onActivity { a ->
      (a.editor.parent as ViewGroup).removeView(a.editor)
      val column = GrabCounter(a).apply {
        orientation = LinearLayout.VERTICAL
        addView(a.editor, LinearLayout.LayoutParams(600, 400))
        addView(View(a), LinearLayout.LayoutParams(600, 4000))
      }
      page = ScrollView(a).apply { addView(column) }
      this.column = column
      a.setContentView(page)
    }
    return page!!
  }

  private fun drag(page: ScrollView, points: List<Pair<Float, Float>>) {
    val t0 = SystemClock.uptimeMillis()
    points.forEachIndexed { i, (x, y) ->
      val action = when (i) {
        0 -> MotionEvent.ACTION_DOWN
        points.lastIndex -> MotionEvent.ACTION_UP
        else -> MotionEvent.ACTION_MOVE
      }
      val e = MotionEvent.obtain(t0, t0 + 16L * i, action, x, y, 0)
      page.dispatchTouchEvent(e)
      e.recycle()
    }
  }

  private fun setUp(s: ActivityScenario<TestActivity>): Pair<ScrollView, CodeEditorView> {
    val page = nest(s)
    val editor = s.editor()
    onMain {
      editor.setLineNumbers(false)
      editor.setScrollEnabled(false)
      editor.setInitialText(("x".repeat(200) + "\n").repeat(20))
      layout(page, 600, 800)
      draw(editor)
    }
    return page to editor
  }

  @Test
  fun aFastSidewaysFlickScrollsTheEditorAndNotThePage() {
    launch().use { s ->
      val (page, editor) = setUp(s)
      onMain {
        val slop = ViewConfiguration.get(editor.context).scaledTouchSlop.toFloat()
        // The first move already passes the page's vertical slop.
        drag(page, listOf(400f to 200f, 400f - 4 * slop to 200f - 1.5f * slop, 100f to 200f - 2 * slop, 100f to 200f - 2 * slop))
        draw(editor)
        assertTrue("editor scrollX ${editor.frame.scrollX}", editor.frame.scrollX > 0f)
        assertEquals("page scrollY", 0, page.scrollY)
      }
    }
  }

  @Test
  fun aVerticalDragOnTheEditorScrollsThePage() {
    launch().use { s ->
      val (page, editor) = setUp(s)
      onMain {
        drag(page, (0..10).map { 300f to 350f - 30f * it } + (300f to 50f))
        draw(editor)
        assertTrue("page scrollY ${page.scrollY}", page.scrollY > 0)
        assertEquals("editor scrollX", 0f, editor.frame.scrollX, 0.5f)
        assertEquals("editor touch grabs", 0, column!!.grabs)
      }
    }
  }
}
