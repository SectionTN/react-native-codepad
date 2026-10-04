package me.sectiontn.codepad.view

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.os.Handler
import android.os.Looper
import android.text.TextPaint
import android.util.TypedValue
import android.view.View
import me.sectiontn.codepad.core.EditorCore
import me.sectiontn.codepad.layout.LineLayout
import me.sectiontn.codepad.layout.RowMetrics
import me.sectiontn.codepad.syntax.Highlighter
import me.sectiontn.codepad.syntax.LanguageRegistry
import me.sectiontn.codepad.syntax.Snapshot
import me.sectiontn.codepad.syntax.SyntaxEngine

/** Draws highlighted lines from the top. Scrolling, input and the gutter come later. */
class CodeEditorView(context: Context) : View(context) {
  // Replaced once when initialValue loads. The JS thread reads it, so the reference must be volatile.
  @Volatile
  var core: EditorCore = EditorCore()
    private set

  var typefaceResolver: ((String) -> Typeface?)? = null

  private val mainHandler = Handler(Looper.getMainLooper())
  private val paint = TextPaint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG)
  private var theme: ThemeColors = ThemeColors.default
  private var lineHeight = 1.4f
  private var languageId: String? = null
  private var metrics: RowMetrics? = null
  private var snapshot: Snapshot? = null
  private var highlighter: Highlighter? = null
  private var engine: SyntaxEngine? = null
  private val layouts = HashMap<Int, LineLayout>()

  init {
    paint.typeface = Typeface.MONOSPACE
    paint.textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, 14f, resources.displayMetrics)
    wire(core)
  }

  fun setInitialText(value: String) {
    core = EditorCore(value)
    wire(core)
    engine().setText(value, core.document.revision)
    invalidateLayouts()
  }

  fun setLanguage(id: String?) {
    if (id == languageId) return
    languageId = id
    highlighter = id?.let { LanguageRegistry.resolve(it) }?.let { Highlighter(it) }
    engine().setLanguage(id)
    invalidateLayouts()
  }

  fun setTheme(colors: ThemeColors) {
    theme = colors
    invalidateLayouts()
  }

  fun setFont(family: String?, sizeDp: Float, lineHeightMultiplier: Float) {
    lineHeight = lineHeightMultiplier
    paint.typeface = family?.let { typefaceResolver?.invoke(it) } ?: Typeface.MONOSPACE
    paint.textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, sizeDp, resources.displayMetrics)
    metrics = null
    invalidateLayouts()
  }

  private fun wire(core: EditorCore) {
    core.onChange = { change, _ ->
      engine().edit(change, SyntaxEngine.pointsFor(core.document, change))
      invalidateLayouts()
    }
  }

  // Created on first use and after every re-attach, since detaching closes the parse thread.
  private fun engine(): SyntaxEngine = engine ?: SyntaxEngine(
    postToMain = { mainHandler.post(it) },
    onSnapshot = { onSnapshot(it) },
  ).also {
    engine = it
    it.setLanguage(languageId)
    it.setText(core.document.text(), core.document.revision)
  }

  private fun onSnapshot(next: Snapshot) {
    snapshot?.close()
    snapshot = next
    invalidateLayouts()
  }

  private fun invalidateLayouts() {
    layouts.clear()
    invalidate()
  }

  private fun rowMetrics(): RowMetrics = metrics ?: RowMetrics(paint, lineHeight, core.settings.tabSize).also { metrics = it }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    engine()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    engine?.close()
    engine = null
    snapshot?.close()
    snapshot = null
  }

  override fun onDraw(canvas: Canvas) {
    canvas.drawColor(theme.background)
    paint.color = theme.foreground
    val doc = core.document
    val m = rowMetrics()
    val consistent = snapshot?.takeIf { it.revision == doc.revision }
    val hl = highlighter
    var y = 0
    var line = 0
    while (line < doc.lineCount && y < height) {
      val layout = layouts.getOrPut(line) {
        val spans = if (consistent != null && hl != null) hl.spans(consistent, doc, line, line)[0] else null
        LineLayout(doc.line(line), spans, paint, theme, 0, core.settings.tabSize, m)
      }
      canvas.save()
      canvas.translate(PADDING_PX, y.toFloat())
      layout.draw(canvas)
      canvas.restore()
      y += m.rowHeight * layout.rowCount
      line++
    }
  }

  companion object {
    private const val PADDING_PX = 16f
  }
}
