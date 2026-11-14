package codepad.example

import android.graphics.Bitmap
import android.graphics.Canvas
import android.view.View
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import me.sectiontn.codepad.layout.Viewport
import me.sectiontn.codepad.view.CodeEditorView
import org.junit.Assert.assertTrue

internal fun launch(): ActivityScenario<TestActivity> = ActivityScenario.launch(TestActivity::class.java)

internal fun ActivityScenario<TestActivity>.editor(): CodeEditorView {
  var view: CodeEditorView? = null
  onActivity { view = it.editor }
  return view ?: error("activity has no editor")
}

internal fun <T> onMain(block: () -> T): T {
  var result: T? = null
  InstrumentationRegistry.getInstrumentation().runOnMainSync { result = block() }
  @Suppress("UNCHECKED_CAST")
  return result as T
}

internal fun layout(view: View, width: Int = 600, height: Int = 400) {
  view.measure(
    View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
    View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY),
  )
  view.layout(0, 0, width, height)
}

internal fun draw(view: View): Bitmap {
  val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
  view.draw(Canvas(bitmap))
  // The app's check needs the debug switch, so the suite checks the draw's single layout calls here.
  if (view is CodeEditorView) {
    val calls = viewportOf(view).drawCalls
    assertTrue("$calls single layout calls in one draw", calls <= Viewport.DRAW_CALL_LIMIT)
  }
  return bitmap
}

internal fun viewportOf(editor: CodeEditorView): Viewport =
  CodeEditorView::class.java.getDeclaredField("viewport").apply { isAccessible = true }.get(editor) as Viewport

/** Pixels painted in a theme's pure red over the first [rows] pixel rows of the bitmap. */
internal fun redPixels(bitmap: Bitmap, rows: Int): Int {
  var n = 0
  for (y in 0 until minOf(rows, bitmap.height)) {
    for (x in 0 until bitmap.width) {
      val p = bitmap.getPixel(x, y)
      if ((p shr 16 and 0xff) > 200 && (p shr 8 and 0xff) < 80 && (p and 0xff) < 80) n++
    }
  }
  return n
}
