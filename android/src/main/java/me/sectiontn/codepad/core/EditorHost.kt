package me.sectiontn.codepad.core

import com.facebook.proguard.annotations.DoNotStrip

/**
 * What the core calls back, from core_jni.cpp by name, on the thread that made the core call. A throw is kept and
 * rethrown once the core returns, so it never crosses native frames, and later callbacks of that call are skipped.
 */
@DoNotStrip
internal class EditorHost(private val clock: (() -> Long)?) {
  var onChange: ((Change, ChangeOrigin) -> Unit)? = null
  var onSelection: ((Selection) -> Unit)? = null
  private var failure: Throwable? = null

  @DoNotStrip
  fun changed(start: Int, removed: String, inserted: String, revision: Int, origin: Int) {
    if (failure != null) return
    try {
      onChange?.invoke(Change(start, removed, inserted, revision), ChangeOrigin.entries[origin])
    } catch (t: Throwable) {
      failure = t
    }
  }

  @DoNotStrip
  fun selected(anchor: Int, head: Int) {
    if (failure != null) return
    try {
      onSelection?.invoke(Selection(anchor, head))
    } catch (t: Throwable) {
      failure = t
    }
  }

  @DoNotStrip
  fun now(): Long = clock?.invoke() ?: System.currentTimeMillis()

  fun rethrow() {
    val t = failure ?: return
    failure = null
    throw t
  }
}
