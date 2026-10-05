package com.margelo.nitro.codepad

import android.graphics.Typeface
import android.view.View
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.uimanager.ThemedReactContext
import com.margelo.nitro.core.Promise
import me.sectiontn.codepad.view.CodeEditorView
import me.sectiontn.codepad.view.ThemeColors
import me.sectiontn.codepad.view.TokenStyleColors

@DoNotStrip
class HybridCodeEditorView(val context: ThemedReactContext) : HybridCodeEditorViewSpec() {
  private val editor = CodeEditorView(context).apply {
    // Fonts linked with react-native-asset or expo-font resolve through React Native's font manager.
    typefaceResolver = { family -> ReactFontManager.getInstance().getTypeface(family, Typeface.NORMAL, context.assets) }
    // The first draw already has initialValue applied, so ref methods are valid from onReady on.
    onFirstDraw = { sendReady() }
    onScrollListener = { f ->
      onScroll?.invoke(NativeScrollEvent(f.scrollX.toDouble(), f.scrollY.toDouble(), f.contentWidth.toDouble(), f.contentHeight.toDouble()))
    }
    onSelectionListener = { s ->
      onSelectionChange?.invoke(NativeSelection(s.anchor.toDouble(), s.head.toDouble(), core.document.revision.toDouble()))
    }
  }
  private var loaded = false
  private var readySent = false
  private var fontDirty = false

  override val view: View = editor

  // Not mirrored: the document owns the text after the first load and a second copy of a big file is waste.
  override var initialValue: String? = null
    set(value) {
      if (!loaded && value != null) {
        loaded = true
        editor.setInitialText(value)
      }
    }

  override var language: String? = null
    set(value) {
      field = value
      editor.setLanguage(value)
    }

  override var theme: NativeTheme? = null
    set(value) {
      field = value
      editor.setTheme(value?.let { toColors(it) } ?: ThemeColors.default)
    }

  override var fontFamily: String? = null
    set(value) {
      field = value
      fontDirty = true
    }

  override var fontSize: Double? = null
    set(value) {
      field = value
      fontDirty = true
    }

  override var lineHeight: Double? = null
    set(value) {
      field = value
      fontDirty = true
    }

  override var lineNumbers: Boolean? = null
    set(value) {
      field = value
      editor.setLineNumbers(value ?: true)
    }

  override var softWrap: Boolean? = null
    set(value) {
      field = value
      editor.setSoftWrap(value ?: false)
    }

  override var readOnly: Boolean? = null
    set(value) {
      field = value
      editor.setReadOnly(value ?: false)
    }

  override var highlightActiveLine: Boolean? = null
    set(value) {
      field = value
      editor.setHighlightActiveLine(value ?: true)
    }

  override var placeholder: String? = null
    set(value) {
      field = value
      editor.setPlaceholder(value)
    }

  override var scrollEnabled: Boolean? = null
    set(value) {
      field = value
      editor.setScrollEnabled(value ?: true)
    }

  override var contentInsets: NativeInsets? = null
    set(value) {
      field = value
      editor.setContentInsets(
        (value?.top ?: 0.0).toFloat(),
        (value?.bottom ?: 0.0).toFloat(),
        (value?.left ?: 0.0).toFloat(),
        (value?.right ?: 0.0).toFloat(),
      )
    }

  override var onReady: (() -> Unit)? = null

  override var onScroll: ((NativeScrollEvent) -> Unit)? = null

  override var onSelectionChange: ((NativeSelection) -> Unit)? = null

  override fun afterUpdate() {
    if (fontDirty) {
      fontDirty = false
      editor.setFont(fontFamily, (fontSize ?: 14.0).toFloat(), (lineHeight ?: 1.4).toFloat())
    }
  }

  private fun sendReady() {
    if (readySent) return
    readySent = true
    onReady?.invoke()
  }

  override fun getText(): String = editor.core.let { c -> c.read { c.document.text() } }

  override fun getLength(): Double = editor.core.let { c -> c.read { c.document.length.toDouble() } }

  override fun getLineCount(): Double = editor.core.let { c -> c.read { c.document.lineCount.toDouble() } }

  override fun getLine(index: Double): String = editor.core.let { c -> c.read { c.document.line(index.toInt()).toString() } }

  override fun getRevision(): Double = editor.core.let { c -> c.read { c.document.revision.toDouble() } }

  override fun getSelection(): NativeSelection = editor.core.let { c ->
    c.read {
      val s = c.selection
      NativeSelection(s.anchor.toDouble(), s.head.toDouble(), c.document.revision.toDouble())
    }
  }

  override fun getTextInRange(start: Double, end: Double): String =
    editor.core.let { c -> c.read { c.document.text(start.toInt(), end.toInt()) } }

  override fun offsetToPosition(offset: Double): NativePosition = editor.core.let { c ->
    c.read {
      val p = c.document.offsetToPosition(offset.toInt())
      NativePosition(p.line.toDouble(), p.column.toDouble())
    }
  }

  override fun positionToOffset(line: Double, column: Double): Double =
    editor.core.let { c -> c.read { c.document.positionToOffset(line.toInt(), column.toInt()).toDouble() } }

  // Both read the frame the main thread published after its last draw.
  override fun getCursorRect(): NativeRect? = editor.frame.caret?.let {
    NativeRect(it.left.toDouble(), it.top.toDouble(), it.width().toDouble(), it.height().toDouble())
  }

  override fun getVisibleLines(): NativeVisibleLines =
    editor.frame.let { NativeVisibleLines(it.firstLine.toDouble(), it.lastLine.toDouble()) }

  override fun setText(text: String, keepHistory: Boolean): Promise<Unit> = onMain { editor.setText(text, keepHistory) }

  override fun setSelection(anchor: Double, head: Double): Promise<Unit> = onMain { editor.core.setSelection(anchor.toInt(), head.toInt()) }

  override fun selectAll(): Promise<Unit> = onMain { editor.selectAll() }

  override fun scrollToLine(line: Double, animated: Boolean): Promise<Unit> = onMain { editor.scrollToLine(line.toInt(), animated) }

  override fun revealSelection(): Promise<Unit> = onMain { editor.revealSelection() }

  /** Write methods run on the main thread and resolve once the change is applied and a redraw is queued. */
  private fun onMain(block: () -> Unit): Promise<Unit> {
    val promise = Promise<Unit>()
    editor.post {
      block()
      editor.invalidate()
      promise.resolve(Unit)
    }
    return promise
  }

  private fun toColors(t: NativeTheme): ThemeColors = ThemeColors(
    background = ThemeColors.parseColor(t.background),
    foreground = ThemeColors.parseColor(t.foreground),
    gutterBackground = ThemeColors.parseColor(t.gutterBackground),
    gutterForeground = ThemeColors.parseColor(t.gutterForeground),
    gutterActiveForeground = ThemeColors.parseColor(t.gutterActiveForeground),
    activeLine = ThemeColors.parseColor(t.activeLine),
    selection = ThemeColors.parseColor(t.selection),
    cursor = ThemeColors.parseColor(t.cursor),
    matchingBracket = ThemeColors.parseColor(t.matchingBracket),
    searchMatch = ThemeColors.parseColor(t.searchMatch),
    searchMatchActive = ThemeColors.parseColor(t.searchMatchActive),
    tokens = t.tokens.mapValues { (_, s) -> TokenStyleColors(ThemeColors.parseColor(s.color), s.bold, s.italic) },
  )
}
