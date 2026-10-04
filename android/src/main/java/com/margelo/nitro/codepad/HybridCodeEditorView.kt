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
  }
  private var loaded = false
  private var readySent = false
  private var fontDirty = false

  override val view: View = editor

  override var initialValue: String? = null
    set(value) {
      field = value
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

  override var onReady: (() -> Unit)? = null

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

  override fun setText(text: String, keepHistory: Boolean): Promise<Unit> {
    val promise = Promise<Unit>()
    editor.post {
      editor.setText(text, keepHistory)
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
